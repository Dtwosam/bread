import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';

export type SearchLaunchInput = Readonly<{
  chainId: number;
  stackVersion: string;
  factoryAddress: string;
  query: string;
  kind: 'ADDRESS' | 'TEXT';
  limit: number;
}>;

export type SearchLifecycleState = 'PROCESSING' | 'GRADUATION_PENDING' | 'GRADUATED';

export type SearchLaunchRow = Readonly<{
  tokenAddress: string;
  curveAddress: string;
  deployerAddress: string | null;
  creatorFeeRecipient: string | null;
  launchTimestamp: string | null;
  holderCount: string | null;
  marketCap: string | null;
  lifecycleState: SearchLifecycleState | null;
  name: string | null;
  symbol: string | null;
  launchBlockNumber: string;
  launchLogIndex: number;
  matchKind: 'CONTRACT' | 'CREATOR' | 'TICKER_EXACT' | 'TICKER_PREFIX' | 'NAME_PREFIX';
}>;

function resultRows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

export class SearchRepository {
  constructor(private readonly db: BreadDb) {}

  async searchLaunches(input: SearchLaunchInput): Promise<SearchLaunchRow[]> {
    const limit = Math.max(1, Math.min(50, Math.trunc(input.limit)));
    const factory = input.factoryAddress.toLowerCase();
    const query = input.query.toLowerCase();

    if (input.kind === 'ADDRESS') {
      const result = await this.db.execute(sql`
        SELECT
          l.token_address AS "tokenAddress",
          l.curve_address AS "curveAddress",
          l.deployer_address AS "deployerAddress",
          l.creator_fee_recipient AS "creatorFeeRecipient",
          l.launch_timestamp::text AS "launchTimestamp",
          m.holder_count::text AS "holderCount",
          m.market_cap::text AS "marketCap",
          CASE
            WHEN s.graduation_phase = 'POOL_CREATED' THEN 'GRADUATED'
            WHEN s.graduation_phase = 'SWEPT' THEN 'PROCESSING'
            WHEN s.graduation_phase = 'NOT_GRADUATED'
              AND s.ready_to_graduate IS TRUE
              AND s.graduation_failure_reason_hash IS NOT NULL
              THEN 'GRADUATION_PENDING'
            ELSE NULL
          END AS "lifecycleState",
          l.name,
          l.symbol,
          l.launch_block_number::text AS "launchBlockNumber",
          l.launch_log_index AS "launchLogIndex",
          CASE
            WHEN l.token_address = ${query} THEN 'CONTRACT'
            ELSE 'CREATOR'
          END AS "matchKind"
        FROM launches l
        LEFT JOIN token_metrics m
          ON m.chain_id = l.chain_id
         AND m.token_address = l.token_address
        LEFT JOIN launch_state s
          ON s.chain_id = l.chain_id
         AND s.token_address = l.token_address
        WHERE l.chain_id = ${input.chainId}
          AND l.stack_version = ${input.stackVersion}
          AND l.factory_address = ${factory}
          AND (
            l.token_address = ${query}
            OR l.deployer_address = ${query}
          )
        ORDER BY
          CASE WHEN l.token_address = ${query} THEN 0 ELSE 1 END ASC,
          l.launch_block_number DESC,
          l.launch_log_index DESC,
          l.token_address ASC
        LIMIT ${limit}
      `);
      return resultRows<SearchLaunchRow>(result);
    }

    const prefix = `${query}%`;
    const result = await this.db.execute(sql`
      SELECT
        l.token_address AS "tokenAddress",
        l.curve_address AS "curveAddress",
        l.deployer_address AS "deployerAddress",
        l.creator_fee_recipient AS "creatorFeeRecipient",
        l.launch_timestamp::text AS "launchTimestamp",
        m.holder_count::text AS "holderCount",
        m.market_cap::text AS "marketCap",
        CASE
          WHEN s.graduation_phase = 'POOL_CREATED' THEN 'GRADUATED'
          WHEN s.graduation_phase = 'SWEPT' THEN 'PROCESSING'
          WHEN s.graduation_phase = 'NOT_GRADUATED'
            AND s.ready_to_graduate IS TRUE
            AND s.graduation_failure_reason_hash IS NOT NULL
            THEN 'GRADUATION_PENDING'
          ELSE NULL
        END AS "lifecycleState",
        l.name,
        l.symbol,
        l.launch_block_number::text AS "launchBlockNumber",
        l.launch_log_index AS "launchLogIndex",
        CASE
          WHEN lower(l.symbol) = ${query} THEN 'TICKER_EXACT'
          WHEN lower(l.symbol) LIKE ${prefix} THEN 'TICKER_PREFIX'
          ELSE 'NAME_PREFIX'
        END AS "matchKind"
      FROM launches l
      LEFT JOIN token_metrics m
        ON m.chain_id = l.chain_id
       AND m.token_address = l.token_address
      LEFT JOIN launch_state s
        ON s.chain_id = l.chain_id
       AND s.token_address = l.token_address
      WHERE l.chain_id = ${input.chainId}
        AND l.stack_version = ${input.stackVersion}
        AND l.factory_address = ${factory}
        AND (
          lower(l.symbol) = ${query}
          OR lower(l.symbol) LIKE ${prefix}
          OR lower(l.name) LIKE ${prefix}
        )
      ORDER BY
        CASE
          WHEN lower(l.symbol) = ${query} THEN 0
          WHEN lower(l.symbol) LIKE ${prefix} THEN 1
          ELSE 2
        END ASC,
        l.launch_block_number DESC,
        l.launch_log_index DESC,
        l.token_address ASC
      LIMIT ${limit}
    `);
    return resultRows<SearchLaunchRow>(result);
  }
}
