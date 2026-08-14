export type V3SwapAmountClassification =
  | Readonly<{
      disposition: "PRICED_TRADE";
      side: "BUY" | "SELL";
      quoteAmount: bigint;
      tokenAmount: bigint;
    }>
  | Readonly<{ disposition: "JOURNAL_ONLY_DUST" }>;

type V3SwapAmountInput = Readonly<{
  tokenAddress: unknown;
  quoteAsset: unknown;
  token0: unknown;
  token1: unknown;
  amount0: unknown;
  amount1: unknown;
}>;

function canonicalAddress(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(value) ||
    /^0x0{40}$/i.test(value)
  ) {
    return undefined;
  }
  return value.toLowerCase();
}

export function classifyV3SwapAmounts(
  input: V3SwapAmountInput,
): V3SwapAmountClassification {
  const tokenAddress = canonicalAddress(input.tokenAddress);
  const quoteAsset = canonicalAddress(input.quoteAsset);
  const token0 = canonicalAddress(input.token0);
  const token1 = canonicalAddress(input.token1);

  if (
    tokenAddress === undefined ||
    quoteAsset === undefined ||
    tokenAddress === quoteAsset ||
    token0 === undefined ||
    token1 === undefined ||
    !(
      (token0 === quoteAsset && token1 === tokenAddress) ||
      (token0 === tokenAddress && token1 === quoteAsset)
    )
  ) {
    throw new Error("invalid canonical V3 pool token ordering");
  }

  if (typeof input.amount0 !== "bigint" || typeof input.amount1 !== "bigint") {
    throw new Error("invalid canonical V3 Swap signed amounts");
  }

  const amount0 = input.amount0;
  const amount1 = input.amount1;
  const onePositiveOneZero =
    (amount0 > 0n && amount1 === 0n) ||
    (amount1 > 0n && amount0 === 0n);

  if (onePositiveOneZero) {
    return { disposition: "JOURNAL_ONLY_DUST" };
  }

  const oppositeNonZero =
    (amount0 > 0n && amount1 < 0n) ||
    (amount0 < 0n && amount1 > 0n);
  if (!oppositeNonZero) {
    throw new Error("invalid canonical V3 Swap signed amounts");
  }

  const quoteIsToken0 = token0 === quoteAsset;
  const quoteDelta = quoteIsToken0 ? amount0 : amount1;
  const tokenDelta = quoteIsToken0 ? amount1 : amount0;

  if (quoteDelta > 0n && tokenDelta < 0n) {
    return {
      disposition: "PRICED_TRADE",
      side: "BUY",
      quoteAmount: quoteDelta,
      tokenAmount: -tokenDelta,
    };
  }

  if (quoteDelta < 0n && tokenDelta > 0n) {
    return {
      disposition: "PRICED_TRADE",
      side: "SELL",
      quoteAmount: -quoteDelta,
      tokenAmount: tokenDelta,
    };
  }

  throw new Error("invalid canonical V3 Swap signed amounts");
}
