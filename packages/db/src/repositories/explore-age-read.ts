import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import type { ExploreAgeBounds } from './explore-age.js';
import type { ExploreHolderBounds } from './explore-holders.js';
import type { ExploreProgressBounds } from './explore-progress.js';
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
  ) {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const canonicalFactory = factoryAddress.toLowerCase();
    const age = ageClauses(bounds);
    const holder = holderClauses(holders);
    const baked = progressClauses(progress);
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
        ${baked.knownClause}
        ${baked.minClause}
        ${baked.maxClause}
        ${baked.scopeClause}
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
  ) {
    if (progress) return [];

    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const canonicalFactory = factoryAddress.toLowerCase();
    const age = ageClauses(bounds);
    const holder = holderClauses(holders);
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