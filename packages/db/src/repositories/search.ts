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

export type SearchLaunchRow = Readonly<{
  tokenAddress: string;
  curveAddress: string;
  deployerAddress: string | null;
  creatorFeeRecipient: string | null;
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
          token_address AS "tokenAddress",
          curve_address AS "curveAddress",
          deployer_address AS "deployerAddress",
          creator_fee_recipient AS "creatorFeeRecipient",
          name,
          symbol,
          launch_block_number::text AS "launchBlockNumber",
          launch_log_index AS "launchLogIndex",
          CASE
            WHEN token_address = ${query} THEN 'CONTRACT'
            ELSE 'CREATOR'
          END AS "matchKind"
        FROM launches
        WHERE chain_id = ${input.chainId}
          AND stack_version = ${input.stackVersion}
          AND factory_address = ${factory}
          AND (
            token_address = ${query}
            OR deployer_address = ${query}
            OR creator_fee_recipient = ${query}
          )
        ORDER BY
          CASE WHEN token_address = ${query} THEN 0 ELSE 1 END ASC,
          launch_block_number DESC,
          launch_log_index DESC,
          token_address ASC
        LIMIT ${limit}
      `);
      return resultRows<SearchLaunchRow>(result);
    }

    const prefix = `${query}%`;
    const result = await this.db.execute(sql`
      SELECT
        token_address AS "tokenAddress",
        curve_address AS "curveAddress",
        deployer_address AS "deployerAddress",
        creator_fee_recipient AS "creatorFeeRecipient",
        name,
        symbol,
        launch_block_number::text AS "launchBlockNumber",
        launch_log_index AS "launchLogIndex",
        CASE
          WHEN lower(symbol) = ${query} THEN 'TICKER_EXACT'
          WHEN lower(symbol) LIKE ${prefix} THEN 'TICKER_PREFIX'
          ELSE 'NAME_PREFIX'
        END AS "matchKind"
      FROM launches
      WHERE chain_id = ${input.chainId}
        AND stack_version = ${input.stackVersion}
        AND factory_address = ${factory}
        AND (
          lower(symbol) = ${query}
          OR lower(symbol) LIKE ${prefix}
          OR lower(name) LIKE ${prefix}
        )
      ORDER BY
        CASE
          WHEN lower(symbol) = ${query} THEN 0
          WHEN lower(symbol) LIKE ${prefix} THEN 1
          ELSE 2
        END ASC,
        launch_block_number DESC,
        launch_log_index DESC,
        token_address ASC
      LIMIT ${limit}
    `);
    return resultRows<SearchLaunchRow>(result);
  }
}
