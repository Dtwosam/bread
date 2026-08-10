const BPS_NUMBER = 10_000;
const BPS = BigInt(BPS_NUMBER);

export type TradeReviewSnapshot = Readonly<{
  quoteReserve: bigint;
  tokenReserve: bigint;
  reservedTokens: bigint;
  tradeFeeBps: number;
  creatorTaxBps: number;
  openingTaxBps: number;
}>;

export type BuyTradeReview = Readonly<{
  action: 'BUY';
  inputAmount: bigint;
  spentAmount: bigint;
  refundAmount: bigint;
  expectedOutput: bigint;
  minimumOutput: bigint;
  baseFee: bigint;
  creatorTax: bigint;
  openingTaxBps: number;
  openingTax: bigint;
  netCurveInput: bigint;
  priceImpactBps: number;
  slippageBps: number;
}>;

export type SellTradeReview = Readonly<{
  action: 'SELL';
  inputAmount: bigint;
  grossOutput: bigint;
  expectedOutput: bigint;
  minimumOutput: bigint;
  baseFee: bigint;
  creatorTax: bigint;
  openingTaxBps: 0;
  openingTax: bigint;
  priceImpactBps: number;
  slippageBps: number;
}>;

function requirePositiveInput(amount: bigint): void {
  if (amount <= BigInt(0)) throw new Error('Trade review requires a positive input amount.');
}

function requireBps(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= BPS_NUMBER) {
    throw new Error(`${label} must be an integer from 0 to 9999 bps.`);
  }
}

function validateSnapshot(snapshot: TradeReviewSnapshot): void {
  if (snapshot.quoteReserve <= BigInt(0) || snapshot.tokenReserve <= BigInt(0)) {
    throw new Error('Trade review requires seeded liquidity reserves.');
  }
  if (snapshot.reservedTokens < BigInt(0) || snapshot.reservedTokens >= snapshot.tokenReserve) {
    throw new Error('Trade review requires valid sellable liquidity.');
  }

  requireBps('Trade fee', snapshot.tradeFeeBps);
  requireBps('Creator tax', snapshot.creatorTaxBps);
  requireBps('Opening tax', snapshot.openingTaxBps);

  if (snapshot.tradeFeeBps + snapshot.creatorTaxBps >= BPS_NUMBER) {
    throw new Error('Combined standard fee basis points must remain below 10000.');
  }
}

function validateSlippage(slippageBps: number): void {
  requireBps('Slippage', slippageBps);
}

function floorBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / BPS;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) throw new Error('Trade review denominator must be positive.');
  return (numerator + denominator - BigInt(1)) / denominator;
}

function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= BigInt(0) || reserveIn <= BigInt(0) || reserveOut <= BigInt(0)) {
    throw new Error('Trade review requires positive curve amounts and liquidity.');
  }
  return (amountIn * reserveOut) / (reserveIn + amountIn);
}

function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (
    amountOut <= BigInt(0) ||
    reserveIn <= BigInt(0) ||
    reserveOut <= BigInt(0) ||
    amountOut >= reserveOut
  ) {
    throw new Error('Trade review requires a valid curve output amount.');
  }
  return (amountOut * reserveIn) / (reserveOut - amountOut) + BigInt(1);
}

function minimumAfterSlippage(expectedOutput: bigint, slippageBps: number): bigint {
  return (expectedOutput * BigInt(BPS_NUMBER - slippageBps)) / BPS;
}

function priceImpactBps(
  inputAmount: bigint,
  inputReserve: bigint,
  outputAmount: bigint,
  outputReserve: bigint,
): number {
  const spotCross = inputAmount * outputReserve;
  const executionCross = outputAmount * inputReserve;
  if (executionCross >= spotCross || spotCross === BigInt(0)) return 0;
  return Number(((spotCross - executionCross) * BPS) / spotCross);
}

function buyCharges(spent: bigint, snapshot: TradeReviewSnapshot) {
  const baseFee = floorBps(spent, snapshot.tradeFeeBps);
  const creatorTax = floorBps(spent, snapshot.creatorTaxBps);
  const quoteAfterStandardCharges = spent - baseFee - creatorTax;
  const openingTax = floorBps(quoteAfterStandardCharges, snapshot.openingTaxBps);
  const netCurveInput = quoteAfterStandardCharges - openingTax;
  return { baseFee, creatorTax, openingTax, netCurveInput } as const;
}

export function estimateBuyTradeReview({
  quoteIn,
  slippageBps,
  snapshot,
}: Readonly<{
  quoteIn: bigint;
  slippageBps: number;
  snapshot: TradeReviewSnapshot;
}>): BuyTradeReview {
  requirePositiveInput(quoteIn);
  validateSlippage(slippageBps);
  validateSnapshot(snapshot);

  let spentAmount = quoteIn;
  let charges = buyCharges(spentAmount, snapshot);
  if (charges.netCurveInput <= BigInt(0)) {
    throw new Error('Trade review fees leave no positive curve input.');
  }

  let expectedOutput = getAmountOut(
    charges.netCurveInput,
    snapshot.quoteReserve,
    snapshot.tokenReserve,
  );
  const availableTokens = snapshot.tokenReserve - snapshot.reservedTokens;

  if (expectedOutput > availableTokens) {
    const netRequired = getAmountIn(
      availableTokens,
      snapshot.quoteReserve,
      snapshot.tokenReserve,
    );
    const openingDenominator = BPS - BigInt(snapshot.openingTaxBps);
    const quoteAfterStandardRequired = ceilDiv(netRequired * BPS, openingDenominator);
    const standardDenominator =
      BPS - BigInt(snapshot.tradeFeeBps) - BigInt(snapshot.creatorTaxBps);
    const grossRequired = ceilDiv(quoteAfterStandardRequired * BPS, standardDenominator);

    spentAmount = grossRequired < quoteIn ? grossRequired : quoteIn;
    charges = buyCharges(spentAmount, snapshot);
    if (charges.netCurveInput < netRequired) {
      throw new Error('Trade review input cannot satisfy the final curve fill after fees.');
    }
    expectedOutput = availableTokens;
  }

  const refundAmount = quoteIn - spentAmount;

  return {
    action: 'BUY',
    inputAmount: quoteIn,
    spentAmount,
    refundAmount,
    expectedOutput,
    minimumOutput: minimumAfterSlippage(expectedOutput, slippageBps),
    baseFee: charges.baseFee,
    creatorTax: charges.creatorTax,
    openingTaxBps: snapshot.openingTaxBps,
    openingTax: charges.openingTax,
    netCurveInput: charges.netCurveInput,
    priceImpactBps: priceImpactBps(
      charges.netCurveInput,
      snapshot.quoteReserve,
      expectedOutput,
      snapshot.tokenReserve,
    ),
    slippageBps,
  };
}

export function estimateSellTradeReview({
  tokensIn,
  slippageBps,
  snapshot,
}: Readonly<{
  tokensIn: bigint;
  slippageBps: number;
  snapshot: TradeReviewSnapshot;
}>): SellTradeReview {
  requirePositiveInput(tokensIn);
  validateSlippage(slippageBps);
  validateSnapshot(snapshot);

  const grossOutput = getAmountOut(tokensIn, snapshot.tokenReserve, snapshot.quoteReserve);
  const baseFee = floorBps(grossOutput, snapshot.tradeFeeBps);
  const creatorTax = floorBps(grossOutput, snapshot.creatorTaxBps);
  const expectedOutput = grossOutput - baseFee - creatorTax;

  return {
    action: 'SELL',
    inputAmount: tokensIn,
    grossOutput,
    expectedOutput,
    minimumOutput: minimumAfterSlippage(expectedOutput, slippageBps),
    baseFee,
    creatorTax,
    openingTaxBps: 0,
    openingTax: BigInt(0),
    priceImpactBps: priceImpactBps(
      tokensIn,
      snapshot.tokenReserve,
      grossOutput,
      snapshot.quoteReserve,
    ),
    slippageBps,
  };
}
