import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
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

export class TrendingRepository {
  constructor(private readonly db: BreadDb) {}

  async listTrendingLaunches(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
    indexedHeadTimestamp: string,
    limit: number,
    cursor?: TrendingLaunchCursorKey,
  ) {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const headTimestamp = decimalIntegerToBigInt(indexedHeadTimestamp);
    const cutoffTimestamp = headTimestamp > 3_600n ? headTimestamp - 3_600n : 0n;
    const canonicalFactory = factoryAddress.toLowerCase();
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
        WHERE t.chain_id = ${chainId}
          AND t.stack_version = ${stackVersion}
          AND launch_scope.stack_version = ${stackVersion}
          AND launch_scope.factory_address = ${canonicalFactory}
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
      WHERE true
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
