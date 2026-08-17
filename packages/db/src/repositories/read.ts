import { and, asc, desc, eq, gt, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import { indexerCheckpoints, launches, launchState, tokenMetrics } from '../schema/projections.js';

export type NewLaunchCursorKey = Readonly<{
  launchBlockNumber: string;
  launchTimestamp: string;
  launchLogIndex: number;
  tokenAddress: string;
}>;

export type GraduatedLaunchCursorKey = Readonly<{
  graduationCompletedBlock: string;
  graduationCompletedLogIndex: number;
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

  async listLaunchStates(chainId: number, tokenAddresses: readonly string[]) {
    if (tokenAddresses.length === 0) return [];
    const canonical = [...new Set(tokenAddresses.map((value) => value.toLowerCase()))];
    const rows = await this.db
      .select()
      .from(launchState)
      .where(and(eq(launchState.chainId, chainId), inArray(launchState.tokenAddress, canonical)));
    return rows.map(normalizeLaunchStateRow);
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
      ? or(
          lt(launches.launchBlockNumber, cursor.launchBlockNumber),
          and(
            eq(launches.launchBlockNumber, cursor.launchBlockNumber),
            lt(launches.launchTimestamp, cursor.launchTimestamp),
          ),
          and(
            eq(launches.launchBlockNumber, cursor.launchBlockNumber),
            eq(launches.launchTimestamp, cursor.launchTimestamp),
            lt(launches.launchLogIndex, cursor.launchLogIndex),
          ),
          and(
            eq(launches.launchBlockNumber, cursor.launchBlockNumber),
            eq(launches.launchTimestamp, cursor.launchTimestamp),
            eq(launches.launchLogIndex, cursor.launchLogIndex),
            gt(launches.tokenAddress, cursor.tokenAddress.toLowerCase()),
          ),
        )
      : undefined;

    const rows = await this.db
      .select()
      .from(launches)
      .where(
        and(
          eq(launches.chainId, chainId),
          eq(launches.stackVersion, stackVersion),
          eq(launches.factoryAddress, factoryAddress.toLowerCase()),
          isNotNull(launches.launchTimestamp),
          isNotNull(launches.initialSupply),
          cursorPredicate,
        ),
      )
      .orderBy(
        desc(launches.launchBlockNumber),
        desc(launches.launchTimestamp),
        desc(launches.launchLogIndex),
        asc(launches.tokenAddress),
      )
      .limit(boundedLimit);
    return rows.map(normalizeLaunchRow);
  }

  async listGraduatedLaunches(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
    limit: number,
    cursor?: GraduatedLaunchCursorKey,
  ) {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const cursorPredicate = cursor
      ? or(
          lt(launchState.graduationCompletedBlock, cursor.graduationCompletedBlock),
          and(
            eq(launchState.graduationCompletedBlock, cursor.graduationCompletedBlock),
            lt(launchState.graduationCompletedLogIndex, cursor.graduationCompletedLogIndex),
          ),
          and(
            eq(launchState.graduationCompletedBlock, cursor.graduationCompletedBlock),
            eq(launchState.graduationCompletedLogIndex, cursor.graduationCompletedLogIndex),
            gt(launchState.tokenAddress, cursor.tokenAddress.toLowerCase()),
          ),
        )
      : undefined;

    const keys = await this.db
      .select({
        tokenAddress: launchState.tokenAddress,
        graduationCompletedBlock: launchState.graduationCompletedBlock,
        graduationCompletedLogIndex: launchState.graduationCompletedLogIndex,
      })
      .from(launchState)
      .innerJoin(
        launches,
        and(
          eq(launches.chainId, launchState.chainId),
          eq(launches.tokenAddress, launchState.tokenAddress),
        ),
      )
      .where(
        and(
          eq(launchState.chainId, chainId),
          eq(launchState.graduationPhase, 'POOL_CREATED'),
          isNotNull(launchState.graduationCompletedBlock),
          isNotNull(launchState.graduationCompletedLogIndex),
          eq(launches.stackVersion, stackVersion),
          eq(launches.factoryAddress, factoryAddress.toLowerCase()),
          cursorPredicate,
        ),
      )
      .orderBy(
        desc(launchState.graduationCompletedBlock),
        desc(launchState.graduationCompletedLogIndex),
        asc(launchState.tokenAddress),
      )
      .limit(boundedLimit);

    if (keys.length === 0) return [];
    const tokenAddresses = keys.map((key) => key.tokenAddress);
    const launchRows = await this.db
      .select()
      .from(launches)
      .where(
        and(
          eq(launches.chainId, chainId),
          eq(launches.stackVersion, stackVersion),
          eq(launches.factoryAddress, factoryAddress.toLowerCase()),
          inArray(launches.tokenAddress, tokenAddresses),
        ),
      );
    const launchesByToken = new Map(launchRows.map((row) => [row.tokenAddress.toLowerCase(), row]));

    return keys.map((key) => {
      const launch = launchesByToken.get(key.tokenAddress.toLowerCase());
      if (!launch) throw new Error(`Graduated-feed launch missing for ${key.tokenAddress}`);
      if (key.graduationCompletedBlock === null || key.graduationCompletedLogIndex === null) {
        throw new Error(`Graduated-feed completion key missing for ${key.tokenAddress}`);
      }
      return {
        ...normalizeLaunchRow(launch),
        graduationCompletedBlock: decimalIntegerToBigInt(key.graduationCompletedBlock),
        graduationCompletedLogIndex: key.graduationCompletedLogIndex,
      } as const;
    });
  }

  async listTrades(chainId: number, tokenAddress: string, limit: number, cursor?: TradeCursorKey): Promise<TradeReadRow[]> {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const cursorClause = cursor
      ? sql`AND (
          block_number < ${cursor.blockNumber}
          OR (block_number = ${cursor.blockNumber} AND transaction_index < ${cursor.transactionIndex})
          OR (block_number = ${cursor.blockNumber} AND transaction_index = ${cursor.transactionIndex} AND log_index < ${cursor.logIndex})
        )`
      : sql``;
    const result = await this.db.execute(sql`
      SELECT
        chain_id AS "chainId",
        transaction_hash AS "transactionHash",
        log_index AS "logIndex",
        token_address AS "tokenAddress",
        curve_address AS "curveAddress",
        side,
        trader_address AS "traderAddress",
        recipient_address AS "recipientAddress",
        base_amount::text AS "baseAmount",
        quote_amount::text AS "quoteAmount",
        fee_amount::text AS "feeAmount",
        tax_amount::text AS "taxAmount",
        block_number::text AS "blockNumber",
        block_timestamp::text AS "blockTimestamp",
        transaction_index AS "transactionIndex",
        stack_version AS "stackVersion",
        offered_quote::text AS "offeredQuote",
        opening_tax_bps::text AS "openingTaxBps",
        opening_tax_amount::text AS "openingTaxAmount",
        launch_buy_exempt AS "launchBuyExempt",
        refund_amount::text AS "refundAmount",
        net_curve_input::text AS "netCurveInput",
        net_quote_out::text AS "netQuoteOut",
        gross_curve_quote_out::text AS "grossCurveQuoteOut",
        execution_price_numerator::text AS "executionPriceNumerator",
        execution_price_denominator::text AS "executionPriceDenominator"
      FROM trades
      WHERE chain_id = ${chainId}
        AND token_address = ${tokenAddress.toLowerCase()}
        ${cursorClause}
      ORDER BY block_number DESC, transaction_index DESC, log_index DESC
      LIMIT ${boundedLimit}
    `);
    return resultRows<TradeReadRow>(result);
  }

  async listHolders(
    chainId: number,
    tokenAddress: string,
    limit: number,
    cursor?: HolderCursorKey,
  ): Promise<HolderReadRow[]> {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const canonicalToken = tokenAddress.toLowerCase();
    const cursorClause = cursor
      ? sql`AND (
          h.balance < CAST(${cursor.balance} AS numeric)
          OR (h.balance = CAST(${cursor.balance} AS numeric) AND h.holder_address > ${cursor.holderAddress.toLowerCase()})
        )`
      : sql``;
    const result = await this.db.execute(sql`
      SELECT
        h.token_address AS "tokenAddress",
        h.holder_address AS "holderAddress",
        h.balance::text AS balance,
        h.is_protocol_address AS "isProtocolAddress",
        h.as_of_block_number::text AS "asOfBlockNumber",
        h.last_transaction_hash AS "lastTransactionHash",
        h.last_log_index AS "lastLogIndex"
      FROM holder_snapshots h
      WHERE h.chain_id = ${chainId}
        AND h.token_address = ${canonicalToken}
        AND h.balance > 0
        ${cursorClause}
      ORDER BY h.balance DESC, h.holder_address ASC
      LIMIT ${boundedLimit}
    `);
    return resultRows<HolderReadRow>(result);
  }

  async getHolderConcentration(chainId: number, tokenAddress: string): Promise<HolderConcentrationRead> {
    const canonicalToken = tokenAddress.toLowerCase();
    const result = await this.db.execute(sql`
      SELECT
        (SELECT initial_supply::text FROM launches WHERE chain_id = ${chainId} AND token_address = ${canonicalToken} LIMIT 1) AS supply,
        (SELECT count(*)::text FROM holder_snapshots WHERE chain_id = ${chainId} AND token_address = ${canonicalToken} AND balance > 0) AS "holderCount",
        (SELECT count(*)::text FROM holder_snapshots WHERE chain_id = ${chainId} AND token_address = ${canonicalToken} AND balance > 0 AND is_protocol_address = false) AS "userHolderCount",
        COALESCE((
          SELECT sum(balance)::text FROM (
            SELECT balance
            FROM holder_snapshots
            WHERE chain_id = ${chainId}
              AND token_address = ${canonicalToken}
              AND balance > 0
              AND is_protocol_address = false
            ORDER BY balance DESC, holder_address ASC
            LIMIT 10
          ) AS top10
        ), '0') AS "top10NonProtocolBalance"
    `);
    return resultRows<HolderConcentrationRead>(result)[0] ?? {
      supply: null,
      holderCount: '0',
      userHolderCount: '0',
      top10NonProtocolBalance: '0',
    };
  }

  async listPortfolio(
    chainId: number,
    holderAddress: string,
    limit: number,
    cursor?: PortfolioCursorKey,
  ): Promise<PortfolioReadRow[]> {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const canonicalHolder = holderAddress.toLowerCase();
    const cursorClause = cursor ? sql`AND h.token_address > ${cursor.tokenAddress.toLowerCase()}` : sql``;
    const result = await this.db.execute(sql`
      SELECT
        h.token_address AS "tokenAddress",
        h.balance::text AS balance,
        h.is_protocol_address AS "isProtocolAddress",
        h.as_of_block_number::text AS "asOfBlockNumber",
        h.last_transaction_hash AS "lastTransactionHash",
        h.last_log_index AS "lastLogIndex",
        l.name,
        l.symbol,
        s.graduation_phase AS "graduationPhase",
        m.graduation_state AS "graduationState",
        m.last_price_numerator::text AS "lastPriceNumerator",
        m.last_price_denominator::text AS "lastPriceDenominator",
        m.last_price_source AS "lastPriceSource"
      FROM holder_snapshots h
      JOIN launches l
        ON l.chain_id = h.chain_id
       AND l.token_address = h.token_address
      LEFT JOIN launch_state s
        ON s.chain_id = h.chain_id
       AND s.token_address = h.token_address
      LEFT JOIN token_metrics m
        ON m.chain_id = h.chain_id
       AND m.token_address = h.token_address
      WHERE h.chain_id = ${chainId}
        AND h.holder_address = ${canonicalHolder}
        AND h.balance > 0
        ${cursorClause}
      ORDER BY h.token_address ASC
      LIMIT ${boundedLimit}
    `);
    return resultRows<PortfolioReadRow>(result);
  }
}
