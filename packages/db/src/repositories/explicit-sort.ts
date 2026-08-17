import { sql, type SQL } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import type { ExploreAgeBounds } from './explore-age.js';
import type { ExploreHolderBounds } from './explore-holders.js';
import type { ExploreMarketCapBounds } from './explore-market-cap.js';
import type { ExploreProgressBounds } from './explore-progress.js';
import type { ExploreVolumeBounds } from './explore-volume.js';
import { decimalIntegerToBigInt } from './read.js';

export const EXPLICIT_FEED_SORTS = [
  'newest',
  'market-cap',
  'volume-24h',
  'holders',
  'baked-progress',
] as const;

export type ExplicitFeedSort = (typeof EXPLICIT_FEED_SORTS)[number];
export type ExplicitFeedView = 'new' | 'trending' | 'graduating' | 'graduated';

export function isExplicitFeedSort(value: string): value is ExplicitFeedSort {
  return (EXPLICIT_FEED_SORTS as readonly string[]).includes(value);
}

export type ExplicitSortCursorKey = Readonly<{
  sortValue: string | null;
  launchTimestamp: string;
  tokenAddress: string;
}>;

type ExplicitSortRawRow = Readonly<{
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
  explicitSortValue: string | null;
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
  const minClause = bounds.minLaunchTimestamp === undefined
    ? sql``
    : bounds.minInclusive
      ? sql`AND l.launch_timestamp >= CAST(${bounds.minLaunchTimestamp} AS numeric)`
      : sql`AND l.launch_timestamp > CAST(${bounds.minLaunchTimestamp} AS numeric)`;
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

function progressClauses(bounds: ExploreProgressBounds | undefined) {
  if (!bounds) return { knownClause: sql``, minClause: sql``, maxClause: sql``, scopeClause: sql`` } as const;
  return {
    knownClause: sql`AND m.graduation_progress_bps IS NOT NULL`,
    minClause: bounds.minBps === undefined ? sql`` : sql`AND m.graduation_progress_bps >= CAST(${bounds.minBps} AS numeric)`,
    maxClause: bounds.maxBps === undefined ? sql`` : sql`AND m.graduation_progress_bps <= CAST(${bounds.maxBps} AS numeric)`,
    scopeClause: sql`AND COALESCE(s.graduation_phase, 'NOT_GRADUATED') <> 'POOL_CREATED'`,
  } as const;
}

function marketCapClauses(bounds: ExploreMarketCapBounds | undefined) {
  if (!bounds) return { knownClause: sql``, minClause: sql``, maxClause: sql`` } as const;
  return {
    knownClause: sql`AND m.market_cap IS NOT NULL`,
    minClause: bounds.minQuote === undefined ? sql`` : sql`AND m.market_cap >= CAST(${bounds.minQuote} AS numeric)`,
    maxClause: bounds.maxQuote === undefined ? sql`` : sql`AND m.market_cap <= CAST(${bounds.maxQuote} AS numeric)`,
  } as const;
}

function volumeClauses(bounds: ExploreVolumeBounds | undefined) {
  if (!bounds) return { knownClause: sql``, minClause: sql``, maxClause: sql`` } as const;
  return {
    knownClause: sql`AND m.quote_volume_24h IS NOT NULL`,
    minClause: bounds.minQuote === undefined ? sql`` : sql`AND m.quote_volume_24h >= CAST(${bounds.minQuote} AS numeric)`,
    maxClause: bounds.maxQuote === undefined ? sql`` : sql`AND m.quote_volume_24h <= CAST(${bounds.maxQuote} AS numeric)`,
  } as const;
}

function sortExpression(sort: ExplicitFeedSort): SQL {
  switch (sort) {
    case 'newest': return sql`l.launch_timestamp`;
    case 'market-cap': return sql`m.market_cap`;
    case 'volume-24h': return sql`m.quote_volume_24h`;
    case 'holders': return sql`m.holder_count`;
    case 'baked-progress': return sql`m.graduation_progress_bps`;
  }
}

function viewClause(view: ExplicitFeedView, cutoffTimestamp: string, headTimestamp: string) {
  if (view === 'graduated') return sql`AND s.graduation_phase = 'POOL_CREATED'`;
  if (view === 'graduating') {
    return sql`AND m.graduation_progress_bps IS NOT NULL
      AND COALESCE(s.graduation_phase, 'NOT_GRADUATED') <> 'POOL_CREATED'`;
  }
  if (view === 'trending') {
    return sql`AND EXISTS (
      SELECT 1
      FROM trades trend_trade
      WHERE trend_trade.chain_id = l.chain_id
        AND trend_trade.token_address = l.token_address
        AND trend_trade.stack_version = l.stack_version
        AND trend_trade.block_timestamp IS NOT NULL
        AND trend_trade.block_timestamp >= CAST(${cutoffTimestamp} AS numeric)
        AND trend_trade.block_timestamp <= CAST(${headTimestamp} AS numeric)
    )`;
  }
  return sql``;
}

function cursorClause(cursor: ExplicitSortCursorKey | undefined) {
  if (!cursor) return sql``;
  const address = cursor.tokenAddress.toLowerCase();
  if (cursor.sortValue === null) {
    return sql`WHERE c.sort_value IS NULL
      AND (
        c.sort_launch_timestamp < CAST(${cursor.launchTimestamp} AS numeric)
        OR (c.sort_launch_timestamp = CAST(${cursor.launchTimestamp} AS numeric)
          AND c."tokenAddress" > ${address})
      )`;
  }
  return sql`WHERE (
    c.sort_value < CAST(${cursor.sortValue} AS numeric)
    OR c.sort_value IS NULL
    OR (c.sort_value = CAST(${cursor.sortValue} AS numeric)
      AND (
        c.sort_launch_timestamp < CAST(${cursor.launchTimestamp} AS numeric)
        OR (c.sort_launch_timestamp = CAST(${cursor.launchTimestamp} AS numeric)
          AND c."tokenAddress" > ${address})
      ))
  )`;
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

export class ExplicitSortRepository {
  constructor(private readonly db: BreadDb) {}

  async listExplicitSortedLaunches(input: Readonly<{
    chainId: number;
    stackVersion: string;
    factoryAddress: string;
    view: ExplicitFeedView;
    sort: ExplicitFeedSort;
    indexedHeadTimestamp: string;
    limit: number;
    cursor?: ExplicitSortCursorKey;
    ageBounds?: ExploreAgeBounds;
    holderBounds?: ExploreHolderBounds;
    progressBounds?: ExploreProgressBounds;
    creatorAddress?: string;
    volumeBounds?: ExploreVolumeBounds;
    marketCapBounds?: ExploreMarketCapBounds;
  }>) {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(input.limit)));
    const head = decimalIntegerToBigInt(input.indexedHeadTimestamp);
    const cutoff = head > 3_600n ? head - 3_600n : 0n;
    const age = ageClauses(input.ageBounds);
    const holders = holderClauses(input.holderBounds);
    const progress = progressClauses(input.progressBounds);
    const marketCap = marketCapClauses(input.marketCapBounds);
    const volume = volumeClauses(input.volumeBounds);
    const creator = input.creatorAddress === undefined ? sql`` : sql`AND l.deployer_address = ${input.creatorAddress}`;
    const membership = viewClause(input.view, cutoff.toString(10), head.toString(10));
    const after = cursorClause(input.cursor);
    const sortValue = sortExpression(input.sort);

    if (input.view === 'graduated' && input.progressBounds) return [];

    const result = await this.db.execute(sql`
      WITH candidates AS (
        SELECT
          ${launchSelect},
          l.launch_timestamp AS sort_launch_timestamp,
          ${sortValue} AS sort_value
        FROM launches l
        LEFT JOIN token_metrics m
          ON m.chain_id = l.chain_id
         AND m.token_address = l.token_address
        LEFT JOIN launch_state s
          ON s.chain_id = l.chain_id
         AND s.token_address = l.token_address
        WHERE l.chain_id = ${input.chainId}
          AND l.stack_version = ${input.stackVersion}
          AND l.factory_address = ${input.factoryAddress.toLowerCase()}
          AND l.launch_timestamp IS NOT NULL
          AND l.initial_supply IS NOT NULL
          ${membership}
          ${age.minClause}
          ${age.maxClause}
          ${holders.knownClause}
          ${holders.minClause}
          ${holders.maxClause}
          ${progress.knownClause}
          ${progress.minClause}
          ${progress.maxClause}
          ${progress.scopeClause}
          ${marketCap.knownClause}
          ${marketCap.minClause}
          ${marketCap.maxClause}
          ${volume.knownClause}
          ${volume.minClause}
          ${volume.maxClause}
          ${creator}
      )
      SELECT c.*, c.sort_value::text AS "explicitSortValue"
      FROM candidates c
      ${after}
      ORDER BY c.sort_value DESC NULLS LAST,
        c.sort_launch_timestamp DESC,
        c."tokenAddress" ASC
      LIMIT ${boundedLimit}
    `);

    return resultRows<ExplicitSortRawRow>(result).map((row) => ({
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
      explicitSortValue: optionalBigInt(row.explicitSortValue),
    } as const));
  }
}
