import { and, asc, desc, eq, gt, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import { indexerCheckpoints, launches, launchState, tokenMetrics } from '../schema/projections.js';

export type NewLaunchCursorKey = Readonly<{
  launchBlockNumber: string;
  launchTimestamp: string;
  launchLogIndex: number;
  tokenAddress: string;
}>;

export type TradeCursorKey = Readonly<{
  blockNumber: string;
  transactionIndex: number;
  logIndex: number;
  transactionHash: string;
}>;

export type HolderCursorKey = Readonly<{
  balance: string;
  holderAddress: string;
}>;

export type PortfolioCursorKey = Readonly<{
  tokenAddress: string;
}>;

export type TradeReadRow = Readonly<{
  chainId: number;
  transactionHash: string;
  logIndex: number;
  tokenAddress: string;
  curveAddress: string;
  side: string;
  traderAddress: string;
  recipientAddress: string;
  baseAmount: string;
  quoteAmount: string;
  feeAmount: string;
  taxAmount: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionIndex: number;
  stackVersion: string;
  offeredQuote: string;
  openingTaxBps: string;
  openingTaxAmount: string;
  launchBuyExempt: boolean;
  refundAmount: string;
  netCurveInput: string;
  netQuoteOut: string;
  grossCurveQuoteOut: string;
  executionPriceNumerator: string;
  executionPriceDenominator: string;
}>;

export type HolderReadRow = Readonly<{
  tokenAddress: string;
  holderAddress: string;
  balance: string;
  isProtocolAddress: boolean;
  asOfBlockNumber: string;
  lastTransactionHash: string | null;
  lastLogIndex: number | null;
}>;

export type HolderConcentrationRead = Readonly<{
  supply: string | null;
  holderCount: string;
  userHolderCount: string;
  top10NonProtocolBalance: string;
}>;

export type PortfolioReadRow = Readonly<{
  tokenAddress: string;
  balance: string;
  isProtocolAddress: boolean;
  asOfBlockNumber: string;
  lastTransactionHash: string | null;
  lastLogIndex: number | null;
  name: string | null;
  symbol: string | null;
  graduationPhase: string | null;
  graduationState: string | null;
  lastPriceNumerator: string | null;
  lastPriceDenominator: string | null;
  lastPriceSource: string | null;
}>;

export function decimalIntegerToBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('unsafe numeric integer cannot be converted losslessly');
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new Error(`invalid lossless integer: ${value}`);
  return BigInt(value);
}

function optionalBigInt(value: string | number | bigint | null): bigint | null {
  return value === null ? null : decimalIntegerToBigInt(value);
}

function normalizeLaunchRow(row: typeof launches.$inferSelect) {
  return {
    ...row,
    creatorTaxBps: optionalBigInt(row.creatorTaxBps),
    configVersion: optionalBigInt(row.configVersion),
    launchTimestamp: optionalBigInt(row.launchTimestamp),
    initialSupply: optionalBigInt(row.initialSupply),
    phantomQuote: optionalBigInt(row.phantomQuote),
    graduationThreshold: optionalBigInt(row.graduationThreshold),
    tradeFeeBps: optionalBigInt(row.tradeFeeBps),
    protocolFeeShareBps: optionalBigInt(row.protocolFeeShareBps),
    maxCreatorTaxBps: optionalBigInt(row.maxCreatorTaxBps),
    reservedTokensBaseline: optionalBigInt(row.reservedTokensBaseline),
    launchBlockNumber: decimalIntegerToBigInt(row.launchBlockNumber),
  } as const;
}

function normalizeLaunchStateRow(row: typeof launchState.$inferSelect) {
  return {
    ...row,
    quoteReserve: optionalBigInt(row.quoteReserve),
    tokenReserve: optionalBigInt(row.tokenReserve),
    remainingSellableTokens: optionalBigInt(row.remainingSellableTokens),
    trackedSoldInventory: optionalBigInt(row.trackedSoldInventory),
    trackedQuote: optionalBigInt(row.trackedQuote),
    trackedTokens: optionalBigInt(row.trackedTokens),
    quoteFeeBalance: optionalBigInt(row.quoteFeeBalance),
    creatorTaxBalance: optionalBigInt(row.creatorTaxBalance),
    realQuoteReserve: optionalBigInt(row.realQuoteReserve),
    virtualQuoteReserve: optionalBigInt(row.virtualQuoteReserve),
    latestBlockNumber: optionalBigInt(row.latestBlockNumber),
  } as const;
}

function normalizeTokenMetricRow(row: typeof tokenMetrics.$inferSelect) {
  return {
    ...row,
    price: optionalBigInt(row.price),
    marketCap: optionalBigInt(row.marketCap),
    holderCount: optionalBigInt(row.holderCount),
    tradeCount: optionalBigInt(row.tradeCount),
    quoteVolume: optionalBigInt(row.quoteVolume),
    latestBlockNumber: optionalBigInt(row.latestBlockNumber),
    lastPriceNumerator: optionalBigInt(row.lastPriceNumerator),
    lastPriceDenominator: optionalBigInt(row.lastPriceDenominator),
    quoteVolume5m: optionalBigInt(row.quoteVolume5m),
    quoteVolume1h: optionalBigInt(row.quoteVolume1h),
    quoteVolume24h: optionalBigInt(row.quoteVolume24h),
    tradeCount1h: optionalBigInt(row.tradeCount1h),
    tradeCount24h: optionalBigInt(row.tradeCount24h),
    uniqueTraders1h: optionalBigInt(row.uniqueTraders1h),
    uniqueTraders24h: optionalBigInt(row.uniqueTraders24h),
    graduationProgressBps: optionalBigInt(row.graduationProgressBps),
  } as const;
}

function resultRows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

export class ReadRepository {
  constructor(private readonly db: BreadDb) {}

  async getCheckpoint(chainId: number, stackVersion: string, factoryAddress: string) {
    const [row] = await this.db
      .select()
      .from(indexerCheckpoints)
      .where(
        and(
          eq(indexerCheckpoints.chainId, chainId),
          eq(indexerCheckpoints.stackVersion, stackVersion),
          eq(indexerCheckpoints.factoryAddress, factoryAddress.toLowerCase()),
        ),
      )
      .limit(1);
    if (!row) return undefined;
    return {
      chainId: row.chainId,
      stackVersion: row.stackVersion,
      factoryAddress: row.factoryAddress,
      deploymentStartBlock: decimalIntegerToBigInt(row.deploymentStartBlock),
      indexedThroughBlock: decimalIntegerToBigInt(row.indexedThroughBlock),
      indexedThroughBlockHash: row.indexedThroughBlockHash,
      indexedThroughBlockTimestamp:
        row.indexedThroughBlockTimestamp === null
          ? null
          : decimalIntegerToBigInt(row.indexedThroughBlockTimestamp),
      lastTransactionHash: row.lastTransactionHash,
      lastLogIndex: row.lastLogIndex,
      decoderSchemaVersion: row.decoderSchemaVersion,
      status: row.status,
      appliedAt: row.appliedAt,
      updatedAt: row.updatedAt,
    } as const;
  }

  async getLaunch(chainId: number, tokenAddress: string) {
    const [row] = await this.db
      .select()
      .from(launches)
      .where(and(eq(launches.chainId, chainId), eq(launches.tokenAddress, tokenAddress.toLowerCase())))
      .limit(1);
    return row ? normalizeLaunchRow(row) : undefined;
  }

  async getLaunchState(chainId: number, tokenAddress: string) {
    const [row] = await this.db
      .select()
      .from(launchState)
      .where(and(eq(launchState.chainId, chainId), eq(launchState.tokenAddress, tokenAddress.toLowerCase())))
      .limit(1);
    return row ? normalizeLaunchStateRow(row) : undefined;
  }

  async getTokenMetrics(chainId: number, tokenAddress: string) {
    const [row] = await this.db
      .select()
      .from(tokenMetrics)
      .where(and(eq(tokenMetrics.chainId, chainId), eq(tokenMetrics.tokenAddress, tokenAddress.toLowerCase())))
      .limit(1);
    return row ? normalizeTokenMetricRow(row) : undefined;
  }

  async listTokenMetrics(chainId: number, tokenAddresses: readonly string[]) {
    if (tokenAddresses.length === 0) return [];
    const canonical = [...new Set(tokenAddresses.map((value) => value.toLowerCase()))];
    const rows = await this.db
      .select()
      .from(tokenMetrics)
      .where(and(eq(tokenMetrics.chainId, chainId), inArray(tokenMetrics.tokenAddress, canonical)));
    return rows.map(normalizeTokenMetricRow);
  }

  async listLaunchIdentities(chainId: number, stackVersion: string, factoryAddress: string) {
    return this.db
      .select({ tokenAddress: launches.tokenAddress, curveAddress: launches.curveAddress })
      .from(launches)
      .where(
        and(
          eq(launches.chainId, chainId),
          eq(launches.stackVersion, stackVersion),
          eq(launches.factoryAddress, factoryAddress.toLowerCase()),
        ),
      )
      .orderBy(asc(launches.tokenAddress));
  }

  async listNewLaunches(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
    limit: number,
    cursor?: NewLaunchCursorKey,
  ) {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const cursorPredicate = cursor