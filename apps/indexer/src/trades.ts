import type { Address, DecodedBreadEvent, Hex32 } from '../../../packages/types/src/index.js';
import type { ProtocolContext } from '../../../packages/protocol-sdk/src/index.js';

export type NormalizedTrade = Readonly<{
  id: Readonly<{ chainId: number; transactionHash: Hex32; logIndex: number }>;
  side: 'BUY' | 'SELL';
  token: Address;
  curve: Address;
  actor: Address;
  recipient: Address;
  offeredQuote: bigint;
  quoteAmount: bigint;
  tokenAmount: bigint;
  baseFee: bigint;
  creatorTax: bigint;
  openingTaxBps: bigint;
  openingTax: bigint;
  launchBuyExempt: boolean;
  refund: bigint;
  netCurveInput: bigint;
  netQuoteOut: bigint;
  grossCurveQuoteOut: bigint;
  executionPriceNumerator: bigint;
  executionPriceDenominator: bigint;
  blockNumber: bigint;
  blockHash: Hex32;
  blockTimestamp: bigint;
  transactionIndex: number;
}>;

export type KnownTradeLaunch = Readonly<{
  tokenAddress: string;
  curveAddress: string;
}>;

function address(value: string, label: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} is not an address`);
  return value.toLowerCase() as Address;
}

function sortEvents(events: readonly DecodedBreadEvent[]): DecodedBreadEvent[] {
  return [...events].sort((left, right) => {
    if (left.blockNumber !== right.blockNumber) return left.blockNumber < right.blockNumber ? -1 : 1;
    if (left.transactionIndex !== right.transactionIndex) return left.transactionIndex - right.transactionIndex;
    return left.identity.logIndex - right.identity.logIndex;
  });
}

type PendingRefund = Readonly<{ buyer: Address; refund: bigint; logIndex: number }>;
type PendingOpening = Readonly<{
  buyer: Address;
  recipient: Address;
  taxBps: bigint;
  taxAmount: bigint;
  launchBuyExempt: boolean;
  logIndex: number;
}>;

type TransactionState = {
  refunds: PendingRefund[];
  openings: PendingOpening[];
};

function txCurveKey(event: DecodedBreadEvent): string {
  return `${event.identity.transactionHash.toLowerCase()}:${event.contractAddress.toLowerCase()}`;
}

function exactlyOne<T>(items: readonly T[], label: string): T {
  if (items.length === 0) throw new Error(`missing ${label}`);
  if (items.length > 1) throw new Error(`ambiguous ${label}`);
  return items[0]!;
}

function curveTokenMap(knownLaunches: readonly KnownTradeLaunch[]): Map<string, Address> {
  const result = new Map<string, Address>();
  for (const launch of knownLaunches) {
    const token = address(launch.tokenAddress, 'known launch token');
    const curve = address(launch.curveAddress, 'known launch curve');
    const previous = result.get(curve);
    if (previous && previous !== token) throw new Error(`curve ${curve} maps to multiple launch tokens`);
    result.set(curve, token);
  }
  return result;
}

export function correlateCanonicalTrades(input: Readonly<{
  context: ProtocolContext;
  knownLaunches: readonly KnownTradeLaunch[];
  events: readonly DecodedBreadEvent[];
}>): readonly NormalizedTrade[] {
  const tokenByCurve = curveTokenMap(input.knownLaunches);
  const stateByTxCurve = new Map<string, TransactionState>();
  const trades: NormalizedTrade[] = [];

  for (const event of sortEvents(input.events)) {
    if (event.contractRole !== 'CURVE') continue;
    const curve = event.contractAddress.toLowerCase() as Address;
    const token = tokenByCurve.get(curve);
    if (!token) continue;
    const key = txCurveKey(event);

    if (event.eventName === 'CurveBuyRefunded') {
      const state = stateByTxCurve.get(key) ?? { refunds: [], openings: [] };
      state.refunds.push({
        buyer: event.payload.buyer.toLowerCase() as Address,
        refund: event.payload.refund,
        logIndex: event.identity.logIndex,
      });
      stateByTxCurve.set(key, state);
      continue;
    }

    if (event.eventName === 'OpeningProtectionApplied') {
      const state = stateByTxCurve.get(key) ?? { refunds: [], openings: [] };
      state.openings.push({
        buyer: event.payload.buyer.toLowerCase() as Address,
        recipient: event.payload.recipient.toLowerCase() as Address,
        taxBps: event.payload.taxBps,
        taxAmount: event.payload.taxAmount,
        launchBuyExempt: event.payload.launchBuyExempt,
        logIndex: event.identity.logIndex,
      });
      stateByTxCurve.set(key, state);
      continue;
    }

    if (event.eventName === 'CurveBuy') {
      const state = stateByTxCurve.get(key) ?? { refunds: [], openings: [] };
      stateByTxCurve.set(key, state);
      const actor = event.payload.buyer.toLowerCase() as Address;
      const recipient = event.payload.recipient.toLowerCase() as Address;
      const openingMatches = state.openings.filter(
        (candidate) =>
          candidate.buyer === actor &&
          candidate.recipient === recipient &&
          candidate.logIndex < event.identity.logIndex,
      );
      const opening = exactlyOne(openingMatches, 'OpeningProtectionApplied context');
      state.openings = state.openings.filter((candidate) => candidate !== opening);

      const refundMatches = state.refunds.filter(
        (candidate) => candidate.buyer === actor && candidate.logIndex < event.identity.logIndex,
      );
      if (refundMatches.length > 1) throw new Error('ambiguous CurveBuyRefunded context');
      const refund = refundMatches[0];
      if (refund) state.refunds = state.refunds.filter((candidate) => candidate !== refund);

      const spent = event.payload.quoteIn;
      const tokenAmount = event.payload.tokensOut;
      const baseFee = event.payload.fee;
      const creatorTax = event.payload.tax;
      const charges = baseFee + creatorTax + opening.taxAmount;
      if (charges > spent) throw new Error('CurveBuy charges exceed spent quote');
      const netCurveInput = spent - charges;
      if (tokenAmount === 0n) throw new Error('CurveBuy token amount must be positive');

      trades.push({
        id: {
          chainId: input.context.chainId,
          transactionHash: event.identity.transactionHash,
          logIndex: event.identity.logIndex,
        },
        side: 'BUY',
        token,
        curve,
        actor,
        recipient,
        offeredQuote: spent + (refund?.refund ?? 0n),
        quoteAmount: spent,
        tokenAmount,
        baseFee,
        creatorTax,
        openingTaxBps: opening.taxBps,
        openingTax: opening.taxAmount,
        launchBuyExempt: opening.launchBuyExempt,
        refund: refund?.refund ?? 0n,
        netCurveInput,
        netQuoteOut: 0n,
        grossCurveQuoteOut: 0n,
        executionPriceNumerator: netCurveInput,
        executionPriceDenominator: tokenAmount,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        blockTimestamp: event.blockTimestamp,
        transactionIndex: event.transactionIndex,
      });
      continue;
    }

    if (event.eventName === 'CurveSell') {
      const actor = event.payload.seller.toLowerCase() as Address;
      const recipient = event.payload.recipient.toLowerCase() as Address;
      const tokenAmount = event.payload.tokensIn;
      const netQuoteOut = event.payload.quoteOut;
      const baseFee = event.payload.fee;
      const creatorTax = event.payload.tax;
      const gross = netQuoteOut + baseFee + creatorTax;
      if (tokenAmount === 0n) throw new Error('CurveSell token amount must be positive');

      trades.push({
        id: {
          chainId: input.context.chainId,
          transactionHash: event.identity.transactionHash,
          logIndex: event.identity.logIndex,
        },
        side: 'SELL',
        token,
        curve,
        actor,
        recipient,
        offeredQuote: 0n,
        quoteAmount: gross,
        tokenAmount,
        baseFee,
        creatorTax,
        openingTaxBps: 0n,
        openingTax: 0n,
        launchBuyExempt: false,
        refund: 0n,
        netCurveInput: 0n,
        netQuoteOut,
        grossCurveQuoteOut: gross,
        executionPriceNumerator: gross,
        executionPriceDenominator: tokenAmount,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        blockTimestamp: event.blockTimestamp,
        transactionIndex: event.transactionIndex,
      });
    }
  }

  for (const [key, state] of stateByTxCurve) {
    if (state.openings.length > 0) throw new Error(`unconsumed OpeningProtectionApplied context in ${key}`);
    if (state.refunds.length > 0) throw new Error(`unconsumed CurveBuyRefunded context in ${key}`);
  }

  return trades;
}
