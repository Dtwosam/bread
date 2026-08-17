import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import type { ExploreAgeBounds } from './explore-age.js';
import type { ExploreHolderBounds } from './explore-holders.js';
import type { ExploreProgressBounds } from './explore-progress.js';
import type { ExploreVolumeBounds } from './explore-volume.js';
import { decimalIntegerToBigInt } from './read.js';

export type TrendingLaunchCursorKey = Readonly<{
  quoteVolume1h: string;
  uniqueTraders1h: string;
  tradeCount1h: string;
  latestActivityBlockNumber: string;
  latestActivityLogIndex: number;
  tokenAddress: string;
}>;

type TrendingRawRow = Readonly<{
  chainId: number;
  tokenAddress: string;
  curveAddress: string;
  stackVersion: string;
  factoryAddress: string;
  deployerAddress: string | null;
  creatorFeeRecipient: string | null;
  creatorTaxBps: string | null;
  economicsDigest: string | null;
  configVersion: string | null;
  launchTimestamp: string | null;
  name: string | null;
  symbol: string | null;
  metadata: Record<string, unknown> | null;
  quoteAsset: string | null;
  initialSupply: string | null;
  phantomQuote: string | null;
  graduationThreshold: string | null;
  protocolFeeRecipient: string | null;
  tradeFeeBps: string | null;
  protocolFeeShareBps: string | null;
  maxCreatorTaxBps: string | null;
  graduationCoordinator: string | null;
  graduationAdapter: string | null;
  graduationAdapterFamily: number | null;
  graduationConfigHash: string | null;
  reservedTokensBaseline: string | null;
  launchBlockNumber: string;
  launchTransactionHash: string;
  launchLogIndex: number;
  createdAt: Date;
  quoteVolume1h: string;
  uniqueTraders1h: string;
  tradeCount1h: string;
  latestActivityBlockNumber: string;
  latestActivityLogIndex: number;
}>;

function resultRows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

function optionalBigInt(value: string | null): bigint | null {
  return value === null ? null : decimalIntegerToBigInt(value);
}

function launchAgeClauses(bounds: ExploreAgeBounds | undefined) {
  if (!bounds) return { minClause: sql``, maxClause: sql`` } as const;
  const min = bounds.minLaunchTimestamp;
  const minClause =
    min === undefined
      ? sql``
      : bounds.minInclusive
        ? sql`AND launch_scope.launch_timestamp >= CAST(${min} AS numeric)`
        : sql`AND launch_scope.launch_timestamp > CAST(${min} AS numeric)`;
  const maxClause = bounds.maxInclusive
    ? sql`AND launch_scope.launch_timestamp <= CAST(${bounds.maxLaunchTimestamp} AS numeric)`
    : sql`AND launch_scope.launch_timestamp < CAST(${bounds.maxLaunchTimestamp} AS numeric)`;
  return { minClause, maxClause } as const;
}

function holderClauses(bounds: ExploreHolderBounds | undefined) {
  if (!bounds) {
    return {
      joinClause: sql``,
      knownClause: sql``,
      minClause: sql``,
      maxClause: sql``,
    } as const;
  }
  return {
    joinClause: sql`INNER JOIN token_metrics holder_metric
      ON holder_metric.chain_id = launch_scope.chain_id
     AND holder_metric.token_address = launch_scope.token_address`,
    knownClause: sql`AND holder_metric.holder_count IS NOT NULL`,
    minClause:
      bounds.min === undefined
        ? sql``
        : sql`AND holder_metric.holder_count >= CAST(${bounds.min} AS numeric)`,
    maxClause:
      bounds.max === undefined
        ? sql``
        : sql`AND holder_metric.holder_count <= CAST(${bounds.max} AS numeric)`,
  } as const;
}

function progressClauses(bounds: ExploreProgressBounds | undefined) {
  if (!bounds) {
    return {
      metricJoinClause: sql``,
      stateJoinClause: sql``,
      knownClause: sql``,
      minClause: sql``,
      maxClause: sql``,
      scopeClause: sql``,
    } as const;
  }
  return {
    metricJoinClause: sql`INNER JOIN token_metrics progress_metric
      ON progress_metric.chain_id = launch_scope.chain_id
     AND progress_metric.token_address = launch_scope.token_address`,
    stateJoinClause: sql`LEFT JOIN launch_state progress_state
      ON progress_state.chain_id = launch_scope.chain_id
     AND progress_state.token_address = launch_scope.token_address`,
    knownClause: sql`AND progress_metric.graduation_progress_bps IS NOT NULL`,
    minClause:
      bounds.minBps === undefined
        ? sql``
        : sql`AND progress_metric.graduation_progress_bps >= CAST(${bounds.minBps} AS numeric)`,
    maxClause:
      bounds.maxBps === undefined
        ? sql``
        : sql`AND progress_metric.graduation_progress_bps <= CAST(${bounds.maxBps} AS numeric)`,
    scopeClause: sql`AND COALESCE(progress_state.graduation_phase, 'NOT_GRADUATED') <> 'POOL_CREATED'`,
  } as const;
}

function creatorClause(creatorAddress: string | undefined) {
  return creatorAddress === undefined
    ? sql``
    : sql`AND launch_scope.deployer_address = ${creatorAddress}`;
}

function volumeClauses(bounds: ExploreVolumeBounds | undefined, headTimestamp: bigint) {
  if (!bounds) {
    return { joinClause: sql``, minClause: sql``, maxClause: sql`` } as const;
  }
  const cutoffTimestamp = headTimestamp > 86_400n ? headTimestamp - 86_400n : 0n;
  return {
    joinClause: sql`LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(volume_trade.quote_amount), 0) AS quote_volume_24h
      FROM trades volume_trade
      WHERE volume_trade.chain_id = l.chain_id
        AND volume_trade.token_address = l.token_address
        AND volume_trade.stack_version = l.stack_version
        AND volume_trade.block_timestamp IS NOT NULL
        AND volume_trade.block_timestamp >= CAST(${cutoffTimestamp.toString(10)} AS numeric)
        AND volume_trade.block_timestamp <= CAST(${headTimestamp.toString(10)} AS numeric)
    ) volume24 ON TRUE`,
    minClause:
      bounds.minQuote === undefined
        ? sql``
        : sql`AND COALESCE(volume24.quote_volume_24h, 0) >= CAST(${bounds.minQuote} AS numeric)`,
    maxClause:
      bounds.maxQuote === undefined
        ? sql``
        : sql`AND COALESCE(volume24.quote_volume_24h, 0) <= CAST(${bounds.maxQuote} AS numeric)`,
  } as const;
}

export class TrendingRepository {
  constructor(private readonly db: BreadDb) {}

  async listTrendingLaunches(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
    indexedHeadTimestamp: string,
    limit: number,
    cursor?: TrendingLaunchCursorKey,
    ageBounds?: ExploreAgeBounds,
    holderBounds?: ExploreHolderBounds,
    progressBounds?: ExploreProgressBounds,
    creatorAddress?: string,
    volumeBounds?: ExploreVolumeBounds,
  ) {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const headTimestamp = decimalIntegerToBigInt(indexedHeadTimestamp);
    const cutoffTimestamp = headTimestamp > 3_600n ? headTimestamp - 3_600n : 0n;
    const canonicalFactory = factoryAddress.toLowerCase();
    const { minClause, maxClause } = launchAgeClauses(ageBounds);
    const holder = holderClauses(holderBounds);
    const progress = progressClauses(progressBounds);
    const creator = creatorClause(creatorAddress);
    const volume24 = volumeClauses(volumeBounds, headTimestamp);
    const cursorClause = cursor
      ? sql`AND (
          r.quote_volume_1h < CAST(${cursor.quoteVolume1h} AS numeric)
          OR (r.quote_volume_1h = CAST(${cursor.quoteVolume1h} AS numeric)
            AND r.unique_traders_1h < CAST(${cursor.uniqueTraders1h} AS numeric))
          OR (r.quote_volume_1h = CAST(${cursor.quoteVolume1h} AS numeric)
            AND r.unique_traders_1h = CAST(${cursor.uniqueTraders1h} AS numeric)
            AND r.trade_count_1h < CAST(${cursor.tradeCount1h} AS numeric))
          OR (r.quote_volume_1h = CAST(${cursor.quoteVolume1h} AS numeric)
            AND r.unique_traders_1h = CAST(${cursor.uniqueTraders1h} AS numeric)
            AND r.trade_count_1h = CAST(${cursor.tradeCount1h} AS numeric)
            AND r.latest_activity_block_number < CAST(${cursor.latestActivityBlockNumber} AS numeric))
          OR (r.quote_volume_1h = CAST(${cursor.quoteVolume1h} AS numeric)
            AND r.unique_traders_1h = CAST(${cursor.uniqueTraders1h} AS numeric)
            AND r.trade_count_1h = CAST(${cursor.tradeCount1h} AS numeric)
            AND r.latest_activity_block_number = CAST(${cursor.latestActivityBlockNumber} AS numeric)
            AND r.latest_activity_log_index < ${cursor.latestActivityLogIndex})
          OR (r.quote_volume_1h = CAST(${cursor.quoteVolume1h} AS numeric)
            AND r.unique_traders_1h = CAST(${cursor.uniqueTraders1h} AS numeric)
            AND r.trade_count_1h = CAST(${cursor.tradeCount1h} AS numeric)
            AND r.latest_activity_block_number = CAST(${cursor.latestActivityBlockNumber} AS numeric)
            AND r.latest_activity_log_index = ${cursor.latestActivityLogIndex}
            AND r.token_address > ${cursor.tokenAddress.toLowerCase()})
        )`
      : sql``;

    const result = await this.db.execute(sql`
      WITH eligible AS (
        SELECT
          t.token_address,
          t.quote_amount,
          t.trader_address,
          t.block_number,
          t.log_index
        FROM trades t
        INNER JOIN launches launch_scope
          ON launch_scope.chain_id = t.chain_id
         AND launch_scope.token_address = t.token_address
        ${holder.joinClause}
        ${progress.metricJoinClause}
        ${progress.stateJoinClause}
        WHERE t.chain_id = ${chainId}
          AND t.stack_version = ${stackVersion}
          AND launch_scope.stack_version = ${stackVersion}
          AND launch_scope.factory_address = ${canonicalFactory}
          AND launch_scope.launch_timestamp IS NOT NULL
          ${minClause}
          ${maxClause}
          ${holder.knownClause}
          ${holder.minClause}
          ${holder.maxClause}
          ${progress.knownClause}
          ${progress.minClause}
          ${progress.maxClause}
          ${progress.scopeClause}
          ${creator}
          AND t.block_timestamp IS NOT NULL
          AND t.block_timestamp >= CAST(${cutoffTimestamp.toString(10)} AS numeric)
          AND t.block_timestamp <= CAST(${headTimestamp.toString(10)} AS numeric)
      ),
      metrics AS (
        SELECT
          token_address,
          SUM(quote_amount) AS quote_volume_1h,
          COUNT(DISTINCT trader_address) AS unique_traders_1h,
          COUNT(*) AS trade_count_1h
        FROM eligible
        GROUP BY token_address
      ),
      latest AS (
        SELECT DISTINCT ON (token_address)
          token_address,
          block_number AS latest_activity_block_number,
          log_index AS latest_activity_log_index
        FROM eligible
        ORDER BY token_address, block_number DESC, log_index DESC
      ),
      ranked AS (
        SELECT
          metrics.token_address,
          metrics.quote_volume_1h,
          metrics.unique_traders_1h,
          metrics.trade_count_1h,
          latest.latest_activity_block_number,
          latest.latest_activity_log_index
        FROM metrics
        INNER JOIN latest USING (token_address)
      )
      SELECT
        l.chain_id AS "chainId",
        l.token_address AS "tokenAddress",
        l.curve_address AS "curveAddress",
        l.stack_version AS "stackVersion",
        l.factory_address AS "factoryAddress",
        l.deployer_address AS "deployerAddress",
        l.creator_fee_recipient AS "creatorFeeRecipient",
        l.creator_tax_bps::text AS "creatorTaxBps",
        l.economics_digest AS "economicsDigest",
        l.config_version::text AS "configVersion",
        l.launch_timestamp::text AS "launchTimestamp",
        l.name,
        l.symbol,
        l.metadata,
        l.quote_asset AS "quoteAsset",
        l.initial_supply::text AS "initialSupply",
        l.phantom_quote::text AS "phantomQuote",
        l.graduation_threshold::text AS "graduationThreshold",
        l.protocol_fee_recipient AS "protocolFeeRecipient",
        l.trade_fee_bps::text AS "tradeFeeBps",
        l.protocol_fee_share_bps::text AS "protocolFeeShareBps",
        l.max_creator_tax_bps::text AS "maxCreatorTaxBps",
        l.graduation_coordinator AS "graduationCoordinator",
        l.graduation_adapter AS "graduationAdapter",
        l.graduation_adapter_family AS "graduationAdapterFamily",
        l.graduation_config_hash AS "graduationConfigHash",
        l.reserved_tokens_baseline::text AS "reservedTokensBaseline",
        l.launch_block_number::text AS "launchBlockNumber",
        l.launch_transaction_hash AS "launchTransactionHash",
        l.launch_log_index AS "launchLogIndex",
        l.created_at AS "createdAt",
        r.quote_volume_1h::text AS "quoteVolume1h",
        r.unique_traders_1h::text AS "uniqueTraders1h",
        r.trade_count_1h::text AS "tradeCount1h",
        r.latest_activity_block_number::text AS "latestActivityBlockNumber",
        r.latest_activity_log_index AS "latestActivityLogIndex"
      FROM ranked r
      INNER JOIN launches l
        ON l.chain_id = ${chainId}
       AND l.token_address = r.token_address
       AND l.stack_version = ${stackVersion}
       AND l.factory_address = ${canonicalFactory}
      ${volume24.joinClause}
      WHERE true
        ${volume24.minClause}
        ${volume24.maxClause}
        ${cursorClause}
      ORDER BY
        r.quote_volume_1h DESC,
        r.unique_traders_1h DESC,
        r.trade_count_1h DESC,
        r.latest_activity_block_number DESC,
        r.latest_activity_log_index DESC,
        r.token_address ASC
      LIMIT ${boundedLimit}
    `);

    return resultRows<TrendingRawRow>(result).map((row) => ({
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
      quoteVolume1h: decimalIntegerToBigInt(row.quoteVolume1h),
      uniqueTraders1h: decimalIntegerToBigInt(row.uniqueTraders1h),
      tradeCount1h: decimalIntegerToBigInt(row.tradeCount1h),
      latestActivityBlockNumber: decimalIntegerToBigInt(row.latestActivityBlockNumber),
    } as const));
  }
}
