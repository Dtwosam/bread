import { decodeEventLog } from "viem";

import type { CanonicalIndexedEvent } from "../../../packages/db/src/index.js";
import { v3SwapEvent } from "../../../packages/protocol-sdk/src/v3-abi.js";
import type { Address, Hex, Hex32 } from "../../../packages/types/src/index.js";

import type { RpcLog } from "./discovery.js";
import type { GraduatedPoolRegistryEntry } from "./graduated-pools.js";

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

export type NormalizedV3Trade = Readonly<{
  id: Readonly<{ chainId: number; transactionHash: Hex32; logIndex: number }>;
  side: "BUY" | "SELL";
  token: Address;
  curve: Address;
  actor: Address;
  recipient: Address;
  venueKind: "UNISWAP_V3";
  venueAddress: Address;
  venueFeeTier: number;
  offeredQuote: null;
  quoteAmount: bigint;
  tokenAmount: bigint;
  baseFee: 0n;
  creatorTax: 0n;
  openingTaxBps: 0n;
  openingTax: 0n;
  launchBuyExempt: null;
  refund: null;
  netCurveInput: null;
  netQuoteOut: null;
  grossCurveQuoteOut: null;
  executionPriceNumerator: bigint;
  executionPriceDenominator: bigint;
  blockNumber: bigint;
  blockHash: Hex32;
  blockTimestamp: bigint;
  transactionIndex: number;
}>;

export type NormalizedGraduatedV3Swaps = Readonly<{
  events: readonly CanonicalIndexedEvent[];
  trades: readonly NormalizedV3Trade[];
}>;

type V3SwapReadClient = Readonly<{
  getTransaction: (request: Readonly<{ hash: Hex32 }>) => Promise<
    Readonly<{
      hash?: unknown;
      blockNumber?: unknown;
      from?: unknown;
    }>
  >;
  getBlock: (
    request: Readonly<{ blockNumber: bigint }>,
  ) => Promise<Readonly<{ timestamp?: unknown }>>;
}>;

type V3SwapArgs = Readonly<{
  sender: Address;
  recipient: Address;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number | bigint;
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

function requiredAddress(value: unknown, label: string): Address {
  const canonical = canonicalAddress(value);
  if (canonical === undefined) throw new Error(`${label} is not an address`);
  return canonical as Address;
}

function canonicalHex32(value: unknown, label: string): Hex32 {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} is not bytes32`);
  }
  return value.toLowerCase() as Hex32;
}

function exactBigInt(value: unknown, label: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new Error(`${label} is not an exact integer`);
}

function nonnegativeBigInt(value: unknown, label: string): bigint {
  const integer = exactBigInt(value, label);
  if (integer < 0n) throw new Error(`${label} is negative`);
  return integer;
}

function exactTick(value: unknown): number | bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  throw new Error("V3 Swap tick is not an exact integer");
}

function exactFeeTier(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error("invalid graduated V3 pool fee tier");
  }
  if (value <= 0 || value > 0xffffff) {
    throw new Error("invalid graduated V3 pool fee tier");
  }
  return value;
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
    (amount0 > 0n && amount1 === 0n) || (amount1 > 0n && amount0 === 0n);

  if (onePositiveOneZero) {
    return { disposition: "JOURNAL_ONLY_DUST" };
  }

  const oppositeNonZero =
    (amount0 > 0n && amount1 < 0n) || (amount0 < 0n && amount1 > 0n);
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

function normalizeSwapArgs(
  value: Readonly<Record<string, unknown>>,
): V3SwapArgs {
  return {
    sender: requiredAddress(value.sender, "V3 Swap sender"),
    recipient: requiredAddress(value.recipient, "V3 Swap recipient"),
    amount0: exactBigInt(value.amount0, "V3 Swap amount0"),
    amount1: exactBigInt(value.amount1, "V3 Swap amount1"),
    sqrtPriceX96: nonnegativeBigInt(value.sqrtPriceX96, "V3 Swap sqrtPriceX96"),
    liquidity: nonnegativeBigInt(value.liquidity, "V3 Swap liquidity"),
    tick: exactTick(value.tick),
  };
}

function decodeSwapArgs(log: RpcLog): V3SwapArgs {
  if (log.eventName !== undefined) {
    if (log.eventName !== "Swap")
      throw new Error("invalid canonical V3 Swap log");
    return normalizeSwapArgs(log.args ?? {});
  }

  try {
    const decoded = decodeEventLog({
      abi: [v3SwapEvent],
      eventName: "Swap",
      topics: log.topics as never,
      data: log.data,
      strict: true,
    });
    return normalizeSwapArgs(
      (decoded.args ?? {}) as unknown as Readonly<Record<string, unknown>>,
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("V3 Swap ")) {
      throw error;
    }
    throw new Error("invalid canonical V3 Swap log");
  }
}

function compareLogs(left: RpcLog, right: RpcLog): number {
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber < right.blockNumber ? -1 : 1;
  }
  if (left.transactionIndex !== right.transactionIndex) {
    return left.transactionIndex - right.transactionIndex;
  }
  return left.logIndex - right.logIndex;
}

function sameRegistryEntry(
  left: GraduatedPoolRegistryEntry,
  right: GraduatedPoolRegistryEntry,
): boolean {
  return (
    left.chainId === right.chainId &&
    left.tokenAddress.toLowerCase() === right.tokenAddress.toLowerCase() &&
    left.curveAddress.toLowerCase() === right.curveAddress.toLowerCase() &&
    left.poolAddress.toLowerCase() === right.poolAddress.toLowerCase() &&
    left.feeTier === right.feeTier &&
    left.quoteIsToken0 === right.quoteIsToken0
  );
}

function registryByPool(
  chainId: number,
  entries: readonly GraduatedPoolRegistryEntry[],
): ReadonlyMap<string, GraduatedPoolRegistryEntry> {
  const byPool = new Map<string, GraduatedPoolRegistryEntry>();
  for (const entry of entries) {
    if (entry.chainId !== chainId) {
      throw new Error("graduated V3 pool chain mismatch");
    }
    const poolAddress = requiredAddress(entry.poolAddress, "graduated V3 pool");
    requiredAddress(entry.tokenAddress, "graduated V3 token");
    requiredAddress(entry.curveAddress, "graduated V3 curve");
    exactFeeTier(entry.feeTier);
    if (typeof entry.quoteIsToken0 !== "boolean") {
      throw new Error("invalid graduated V3 pool quote token order");
    }
    const existing = byPool.get(poolAddress);
    if (existing && !sameRegistryEntry(existing, entry)) {
      throw new Error("conflicting graduated V3 registry identity");
    }
    byPool.set(poolAddress, existing ?? entry);
  }
  return byPool;
}

function canonicalTopic0(log: RpcLog): Hex {
  const topic0 = log.topics[0];
  if (topic0 === undefined) throw new Error("V3 Swap log has no topic0");
  return topic0;
}

export async function normalizeGraduatedV3SwapLogs(
  input: Readonly<{
    client: V3SwapReadClient;
    chainId: number;
    stackVersion: string;
    quoteAsset: string;
    entries: readonly GraduatedPoolRegistryEntry[];
    logs: readonly RpcLog[];
  }>,
): Promise<NormalizedGraduatedV3Swaps> {
  const quoteAsset = requiredAddress(input.quoteAsset, "V3 quote asset");
  const byPool = registryByPool(input.chainId, input.entries);
  const orderedLogs = [...input.logs].sort(compareLogs);
  const entryByLog = new Map<RpcLog, GraduatedPoolRegistryEntry>();

  for (const log of orderedLogs) {
    const poolAddress = requiredAddress(log.address, "V3 Swap pool");
    const entry = byPool.get(poolAddress);
    if (!entry) throw new Error("unregistered graduated V3 pool");
    entryByLog.set(log, entry);
  }

  const transactionCache = new Map<
    string,
    Promise<
      Readonly<{
        hash?: unknown;
        blockNumber?: unknown;
        from?: unknown;
      }>
    >
  >();
  const blockCache = new Map<
    bigint,
    Promise<Readonly<{ timestamp?: unknown }>>
  >();
  const events: CanonicalIndexedEvent[] = [];
  const trades: NormalizedV3Trade[] = [];

  for (const log of orderedLogs) {
    const entry = entryByLog.get(log)!;
    const token = requiredAddress(entry.tokenAddress, "graduated V3 token");
    const curve = requiredAddress(entry.curveAddress, "graduated V3 curve");
    const poolAddress = requiredAddress(entry.poolAddress, "graduated V3 pool");
    const transactionHash = canonicalHex32(
      log.transactionHash,
      "V3 Swap transaction hash",
    );
    const blockHash = canonicalHex32(log.blockHash, "V3 Swap block hash");
    const args = decodeSwapArgs(log);
    const token0 = entry.quoteIsToken0 ? quoteAsset : token;
    const token1 = entry.quoteIsToken0 ? token : quoteAsset;
    const classification = classifyV3SwapAmounts({
      tokenAddress: token,
      quoteAsset,
      token0,
      token1,
      amount0: args.amount0,
      amount1: args.amount1,
    });

    let blockRead = blockCache.get(log.blockNumber);
    if (!blockRead) {
      blockRead = input.client.getBlock({ blockNumber: log.blockNumber });
      blockCache.set(log.blockNumber, blockRead);
    }
    const block = await blockRead;
    const blockTimestamp = nonnegativeBigInt(
      block.timestamp,
      "V3 Swap block timestamp",
    );

    events.push({
      identity: {
        chainId: input.chainId,
        transactionHash,
        logIndex: log.logIndex,
      },
      blockNumber: log.blockNumber,
      blockHash,
      blockTimestamp,
      transactionIndex: log.transactionIndex,
      contractAddress: poolAddress,
      contractRole: "V3_POOL",
      stackVersion: input.stackVersion,
      topic0: canonicalTopic0(log),
      topics: log.topics,
      data: log.data,
      eventName: "Swap",
      tokenAddress: token,
      curveAddress: curve,
      payload: {
        sender: args.sender,
        recipient: args.recipient,
        amount0: args.amount0,
        amount1: args.amount1,
        sqrtPriceX96: args.sqrtPriceX96,
        liquidity: args.liquidity,
        tick: args.tick,
      },
    });

    if (classification.disposition === "JOURNAL_ONLY_DUST") continue;

    const transactionKey = transactionHash.toLowerCase();
    let transactionRead = transactionCache.get(transactionKey);
    if (!transactionRead) {
      transactionRead = input.client.getTransaction({ hash: transactionHash });
      transactionCache.set(transactionKey, transactionRead);
    }
    const transaction = await transactionRead;
    if (
      transaction.hash !== undefined &&
      canonicalHex32(transaction.hash, "V3 Swap transaction hash") !==
        transactionHash
    ) {
      throw new Error("V3 Swap transaction hash mismatch");
    }
    if (
      transaction.blockNumber !== undefined &&
      transaction.blockNumber !== null &&
      exactBigInt(transaction.blockNumber, "V3 Swap transaction block") !==
        log.blockNumber
    ) {
      throw new Error("V3 Swap transaction block mismatch");
    }
    const actor = canonicalAddress(transaction.from);
    if (actor === undefined) {
      throw new Error("V3 Swap transaction sender is not an address");
    }

    trades.push({
      id: {
        chainId: input.chainId,
        transactionHash,
        logIndex: log.logIndex,
      },
      side: classification.side,
      token,
      curve,
      actor: actor as Address,
      recipient: args.recipient,
      venueKind: "UNISWAP_V3",
      venueAddress: poolAddress,
      venueFeeTier: exactFeeTier(entry.feeTier),
      offeredQuote: null,
      quoteAmount: classification.quoteAmount,
      tokenAmount: classification.tokenAmount,
      baseFee: 0n,
      creatorTax: 0n,
      openingTaxBps: 0n,
      openingTax: 0n,
      launchBuyExempt: null,
      refund: null,
      netCurveInput: null,
      netQuoteOut: null,
      grossCurveQuoteOut: null,
      executionPriceNumerator: classification.quoteAmount,
      executionPriceDenominator: classification.tokenAmount,
      blockNumber: log.blockNumber,
      blockHash,
      blockTimestamp,
      transactionIndex: log.transactionIndex,
    });
  }

  return { events, trades };
}
