import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import type { ExploreAgeBounds } from './explore-age.js';
import type { ExploreHolderBounds } from './explore-holders.js';
import type { ExploreMarketCapBounds } from './explore-market-cap.js';
import type { ExploreProgressBounds } from './explore-progress.js';
import type { ExploreVolumeBounds } from './explore-volume.js';
import { decimalIntegerToBigInt } from './read.js';

export type AgeFilteredNewCursorKey = Readonly<{
  launchBlockNumber: string;
  launchTimestamp: string;
  launchLogIndex: number;
  tokenAddress: string;
}>;

export type AgeFilteredGraduatedCursorKey = Readonly<{
  graduationCompletedBlock: string;
  graduationCompletedLogIndex: number;
  tokenAddress: string;
}>;

type LaunchRawRow = Readonly<{
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
  launchTimestamp: string;
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
}>;

type GraduatedRawRow = LaunchRawRow & Readonly<{
  graduationCompletedBlock: string;
  graduationCompletedLogIndex: number;
}>;

function resultRows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

function optionalBigInt(value: string | null): bigint | null {
  return value === null ? null : decimalIntegerToBigInt(value);
}

function ageClauses(bounds: ExploreAgeBounds | undefined) {
  if (!bounds) return { minClause: sql``, maxClause: sql`` } as const;
  const min = bounds.minLaunchTimestamp;
  const minClause =
    min === undefined
      ? sql``
      : bounds.minInclusive
        ? sql`AND l.launch_timestamp >= CAST(${min} AS numeric)`
        : sql`AND l.launch_timestamp > CAST(${min} AS numeric)`;
  const maxClause = bounds.maxInclusive
    ? sql`AND l.launch_timestamp <= CAST(${bounds.maxLaunchTimestamp} AS numeric)`
    : sql`AND l.launch_timestamp < CAST(${bounds.maxLaunchTimestamp} AS numeric)`;
  return { minClause, maxClause } as const;
}

function holderClauses(bounds: ExploreHolderBounds | undefined) {
  if (!bounds) return { knownClause: sql``, minClause: sql``, maxClause: sql`` } as const;
  return {
    knownClause: sql`AND m.holder_count IS NOT NULL`,
    minClause: bounds.min === undefined ? sql`` : sql`AND m.holder_count >= CAST(${bounds.min} AS numeric)`,
    maxClause: bounds.max === undefined ? sql`` : sql`AND m.holder_count <= CAST(${bounds.max} AS numeric)`,
  } as const;
}

function marketCapClauses(bounds: ExploreMarketCapBounds | undefined) {
  if (!bounds) return { knownClause: sql``, minClause: sql``, maxClause: sql`` } as const;
  return {
    knownClause: sql`AND m.market_cap IS NOT NULL`,
    minClause:
      bounds.minQuote === undefined
        ? sql``
        : sql`AND m.market_cap >= CAST(${bounds.minQuote} AS numeric)`,
    maxClause:
      bounds.maxQuote === undefined
        ? sql``
        : sql`AND m.market_cap <= CAST(${bounds.maxQuote} AS numeric)`,
  } as const;
}

function progressClauses(bounds: ExploreProgressBounds | undefined) {
  if (!bounds) {
    return {
      knownClause: sql``,
      minClause: sql``,
      maxClause: sql``,
      scopeClause: sql``,
    } as const;
  }
  return {
    knownClause: sql`AND m.graduation_progress_bps IS NOT NULL`,
    minClause:
      bounds.minBps === undefined
        ? sql``
        : sql`AND m.graduation_progress_bps >= CAST(${bounds.minBps} AS numeric)`,
    maxClause:
      bounds.maxBps === undefined
        ? sql``
        : sql`AND m.graduation_progress_bps <= CAST(${bounds.maxBps} AS numeric)`,
    scopeClause: sql`AND COALESCE(progress_state.graduation_phase, 'NOT_GRADUATED') <> 'POOL_CREATED'`,
  } as const;
}

function creatorClause(creatorAddress: string | undefined) {
  return creatorAddress === undefined ? sql`` : sql`AND l.deployer_address = ${creatorAddress}`;
}

function volumeClauses(
  bounds: ExploreVolumeBounds | undefined,
  indexedHeadTimestamp: string | undefined,
) {
  if (!bounds) {
    return { joinClause: sql``, minClause: sql``, maxClause: sql`` } as const;
  }
  if (indexedHeadTimestamp === undefined) {
    throw new Error('Explore 24h volume filter requires committed indexed-head time');
  }
  const headTimestamp = decimalIntegerToBigInt(indexedHeadTimestamp);
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

function normalizeLaunch(row: LaunchRawRow) {
  return {
    ...row,
    creatorTaxBps: optionalBigInt(row.creatorTaxBps),
    configVersion: optionalBigInt(row.configVersion),
    launchTimestamp: decimalIntegerToBigInt(row.launchTimestamp),
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

const launchSelect = sql`
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
  l.created_at AS "createdAt"
`;

export class ExploreAgeReadRepository {
  constructor(private readonly db: BreadDb) {}

  async listNewLaunches(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
    limit: number,
    cursor: AgeFilteredNewCursorKey | undefined,
    bounds?: ExploreAgeBounds,
    holders?: ExploreHolderBounds,
    progress?: ExploreProgressBounds,
    creatorAddress?: string,
    volume?: ExploreVolumeBounds,
    indexedHeadTimestamp?: string,
    marketCap?: ExploreMarketCapBounds,
  ) {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const canonicalFactory = factoryAddress.toLowerCase();
    const age = ageClauses(bounds);
    const holder = holderClauses(holders);
    const cap = marketCapClauses(marketCap);
    const baked = progressClauses(progress);
    const creator = creatorClause(creatorAddress);
    const volume24 = volumeClauses(volume, indexedHeadTimestamp);
    const cursorClause = cursor
      ? sql`AND (
          l.launch_block_number < CAST(${cursor.launchBlockNumber} AS numeric)
          OR (l.launch_block_number = CAST(${cursor.launchBlockNumber} AS numeric)
            AND l.launch_timestamp < CAST(${cursor.launchTimestamp} AS numeric))
          OR (l.launch_block_number = CAST(${cursor.launchBlockNumber} AS numeric)
            AND l.launch_timestamp = CAST(${cursor.launchTimestamp} AS numeric)
            AND l.launch_log_index < ${cursor.launchLogIndex})
          OR (l.launch_block_number = CAST(${cursor.launchBlockNumber} AS numeric)
            AND l.launch_timestamp = CAST(${cursor.launchTimestamp} AS numeric)
            AND l.launch_log_index = ${cursor.launchLogIndex}
            AND l.token_address > ${cursor.tokenAddress.toLowerCase()})
        )`
      : sql``;

    const result = await this.db.execute(sql`
      SELECT ${launchSelect}
      FROM launches l
      LEFT JOIN token_metrics m
        ON m.chain_id = l.chain_id
       AND m.token_address = l.token_address
      LEFT JOIN launch_state progress_state
        ON progress_state.chain_id = l.chain_id
       AND progress_state.token_address = l.token_address
      ${volume24.joinClause}
      WHERE l.chain_id = ${chainId}
        AND l.stack_version = ${stackVersion}
        AND l.factory_address = ${canonicalFactory}
        AND l.launch_timestamp IS NOT NULL
        AND l.initial_supply IS NOT NULL
        ${age.minClause}
        ${age.maxClause}
        ${holder.knownClause}
        ${holder.minClause}
        ${holder.maxClause}
        ${cap.knownClause}
        ${cap.minClause}
        ${cap.maxClause}
        ${baked.knownClause}
        ${baked.minClause}
        ${baked.maxClause}
        ${baked.scopeClause}
        ${creator}
        ${volume24.minClause}
        ${volume24.maxClause}
        ${cursorClause}
      ORDER BY
        l.launch_block_number DESC,
        l.launch_timestamp DESC,
        l.launch_log_index DESC,
        l.token_address ASC
      LIMIT ${boundedLimit}
    `);
    return resultRows<LaunchRawRow>(result).map(normalizeLaunch);
  }

  async listGraduatedLaunches(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
    limit: number,
    cursor: AgeFilteredGraduatedCursorKey | undefined,
    bounds?: ExploreAgeBounds,
    holders?: ExploreHolderBounds,
    progress?: ExploreProgressBounds,
    creatorAddress?: string,
    volume?: ExploreVolumeBounds,
    indexedHeadTimestamp?: string,
    marketCap?: ExploreMarketCapBounds,
  ) {
    if (progress) return [];

    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const canonicalFactory = factoryAddress.toLowerCase();
    const age = ageClauses(bounds);
    const holder = holderClauses(holders);
    const cap = marketCapClauses(marketCap);
    const creator = creatorClause(creatorAddress);
    const volume24 = volumeClauses(volume, indexedHeadTimestamp);
    const cursorClause = cursor
      ? sql`AND (
          s.graduation_completed_block < CAST(${cursor.graduationCompletedBlock} AS numeric)
          OR (s.graduation_completed_block = CAST(${cursor.graduationCompletedBlock} AS numeric)
            AND s.graduation_completed_log_index < ${cursor.graduationCompletedLogIndex})
          OR (s.graduation_completed_block = CAST(${cursor.graduationCompletedBlock} AS numeric)
            AND s.graduation_completed_log_index = ${cursor.graduationCompletedLogIndex}
            AND s.token_address > ${cursor.tokenAddress.toLowerCase()})
        )`
      : sql``;

    const result = await this.db.execute(sql`
      SELECT
        ${launchSelect},
        s.graduation_completed_block::text AS "graduationCompletedBlock",
        s.graduation_completed_log_index AS "graduationCompletedLogIndex"
      FROM launch_state s
      INNER JOIN launches l
        ON l.chain_id = s.chain_id
       AND l.token_address = s.token_address
      LEFT JOIN token_metrics m
        ON m.chain_id = l.chain_id
       AND m.token_address = l.token_address
      ${volume24.joinClause}
      WHERE s.chain_id = ${chainId}
        AND s.graduation_phase = 'POOL_CREATED'
        AND s.graduation_completed_block IS NOT NULL
        AND s.graduation_completed_log_index IS NOT NULL
        AND l.stack_version = ${stackVersion}
        AND l.factory_address = ${canonicalFactory}
        AND l.launch_timestamp IS NOT NULL
        ${age.minClause}
        ${age.maxClause}
        ${holder.knownClause}
        ${holder.minClause}
        ${holder.maxClause}
        ${cap.knownClause}
        ${cap.minClause}
        ${cap.maxClause}
        ${creator}
        ${volume24.minClause}
        ${volume24.maxClause}
        ${cursorClause}
      ORDER BY
        s.graduation_completed_block DESC,
        s.graduation_completed_log_index DESC,
        s.token_address ASC
      LIMIT ${boundedLimit}
    `);

    return resultRows<GraduatedRawRow>(result).map((row) => ({
      ...normalizeLaunch(row),
      graduationCompletedBlock: decimalIntegerToBigInt(row.graduationCompletedBlock),
      graduationCompletedLogIndex: row.graduationCompletedLogIndex,
    } as const));
  }
}
