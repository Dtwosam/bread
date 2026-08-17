import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';

export type PlatformActivityRow = Readonly<{
  kind: 'LAUNCH' | 'TRADE' | 'GRADUATION';
  tokenAddress: string;
  creatorAddress: string | null;
  name: string | null;
  symbol: string | null;
  transactionHash: string;
  blockNumber: string;
  logIndex: number;
  blockTimestamp: string | null;
  side: string | null;
  tokenAmount: string | null;
  quoteAmount: string | null;
}>;

export type PlatformStatsRow = Readonly<{
  quoteVolume: string;
  launches: string;
  trades: string;
  graduations: string;
}>;

function resultRows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

export class SecondaryRepository {
  constructor(private readonly db: BreadDb) {}

  async listPlatformActivity(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
    limit: number,
  ): Promise<PlatformActivityRow[]> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const factory = factoryAddress.toLowerCase();
    const result = await this.db.execute(sql`
      WITH platform_activity AS (
        SELECT
          'LAUNCH'::text AS kind,
          l.token_address AS "tokenAddress",
          l.deployer_address AS "creatorAddress",
          l.name,
          l.symbol,
          l.launch_transaction_hash AS "transactionHash",
          l.launch_block_number AS "blockNumberRaw",
          l.launch_block_number::text AS "blockNumber",
          l.launch_log_index AS "logIndex",
          l.launch_timestamp::text AS "blockTimestamp",
          NULL::text AS side,
          NULL::text AS "tokenAmount",
          NULL::text AS "quoteAmount"
        FROM launches l
        WHERE l.chain_id = ${chainId}
          AND l.stack_version = ${stackVersion}
          AND l.factory_address = ${factory}

        UNION ALL

        SELECT
          'TRADE'::text AS kind,
          t.token_address AS "tokenAddress",
          l.deployer_address AS "creatorAddress",
          l.name,
          l.symbol,
          t.transaction_hash AS "transactionHash",
          t.block_number AS "blockNumberRaw",
          t.block_number::text AS "blockNumber",
          t.log_index AS "logIndex",
          t.block_timestamp::text AS "blockTimestamp",
          t.side,
          t.base_amount::text AS "tokenAmount",
          t.quote_amount::text AS "quoteAmount"
        FROM trades t
        INNER JOIN launches l
          ON l.chain_id = t.chain_id
         AND l.token_address = t.token_address
        WHERE t.chain_id = ${chainId}
          AND t.stack_version = ${stackVersion}
          AND l.stack_version = ${stackVersion}
          AND l.factory_address = ${factory}

        UNION ALL

        SELECT
          'GRADUATION'::text AS kind,
          s.token_address AS "tokenAddress",
          l.deployer_address AS "creatorAddress",
          l.name,
          l.symbol,
          j.transaction_hash AS "transactionHash",
          s.graduation_completed_block AS "blockNumberRaw",
          s.graduation_completed_block::text AS "blockNumber",
          s.graduation_completed_log_index AS "logIndex",
          j.block_timestamp::text AS "blockTimestamp",
          NULL::text AS side,
          NULL::text AS "tokenAmount",
          NULL::text AS "quoteAmount"
        FROM launch_state s
        INNER JOIN launches l
          ON l.chain_id = s.chain_id
         AND l.token_address = s.token_address
        INNER JOIN event_journal j
          ON j.chain_id = s.chain_id
         AND j.token_address = s.token_address
         AND j.block_number = s.graduation_completed_block
         AND j.log_index = s.graduation_completed_log_index
        WHERE s.chain_id = ${chainId}
          AND s.graduation_phase = 'POOL_CREATED'
          AND s.graduation_completed_block IS NOT NULL
          AND s.graduation_completed_log_index IS NOT NULL
          AND l.stack_version = ${stackVersion}
          AND l.factory_address = ${factory}
          AND j.stack_version = ${stackVersion}
      )
      SELECT
        kind,
        "tokenAddress",
        "creatorAddress",
        name,
        symbol,
        "transactionHash",
        "blockNumber",
        "logIndex",
        "blockTimestamp",
        side,
        "tokenAmount",
        "quoteAmount"
      FROM platform_activity
      ORDER BY "blockNumberRaw" DESC, "logIndex" DESC
      LIMIT ${boundedLimit}
    `);
    return resultRows<PlatformActivityRow>(result);
  }

  async getPlatformStats(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
  ): Promise<PlatformStatsRow> {
    const factory = factoryAddress.toLowerCase();
    const result = await this.db.execute(sql`
      SELECT
        COALESCE((
          SELECT SUM(t.quote_amount)::text
          FROM trades t
          INNER JOIN launches trade_launch
            ON trade_launch.chain_id = t.chain_id
           AND trade_launch.token_address = t.token_address
          WHERE t.chain_id = ${chainId}
            AND t.stack_version = ${stackVersion}
            AND trade_launch.stack_version = ${stackVersion}
            AND trade_launch.factory_address = ${factory}
        ), '0') AS "quoteVolume",
        (
          SELECT COUNT(*)::text
          FROM launches l
          WHERE l.chain_id = ${chainId}
            AND l.stack_version = ${stackVersion}
            AND l.factory_address = ${factory}
        ) AS launches,
        (
          SELECT COUNT(*)::text
          FROM trades t
          INNER JOIN launches trade_launch
            ON trade_launch.chain_id = t.chain_id
           AND trade_launch.token_address = t.token_address
          WHERE t.chain_id = ${chainId}
            AND t.stack_version = ${stackVersion}
            AND trade_launch.stack_version = ${stackVersion}
            AND trade_launch.factory_address = ${factory}
        ) AS trades,
        (
          SELECT COUNT(*)::text
          FROM launch_state s
          INNER JOIN launches graduated_launch
            ON graduated_launch.chain_id = s.chain_id
           AND graduated_launch.token_address = s.token_address
          WHERE s.chain_id = ${chainId}
            AND s.graduation_phase = 'POOL_CREATED'
            AND graduated_launch.stack_version = ${stackVersion}
            AND graduated_launch.factory_address = ${factory}
        ) AS graduations
    `);
    return resultRows<PlatformStatsRow>(result)[0] ?? {
      quoteVolume: '0',
      launches: '0',
      trades: '0',
      graduations: '0',
    };
  }
}
