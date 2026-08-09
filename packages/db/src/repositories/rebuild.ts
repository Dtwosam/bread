import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import type { IndexerProtocolContext } from './indexer.js';

function rows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

export type ReconciliationStackRow = Readonly<{
  deploymentStartBlock: bigint;
  addresses: Readonly<Record<string, string | null>>;
  runtimeCodeHashes: Readonly<Record<string, string>> | null;
}>;

export type ReconciliationLaunchRow = Readonly<{
  tokenAddress: string;
  curveAddress: string;
}>;

export type ReconciliationLaunchStateRow = Readonly<{
  tokenAddress: string;
  trackedQuote: bigint | null;
  trackedTokens: bigint | null;
  graduationPhase: string;
  poolId: string | null;
  positionLocked: boolean;
  tokenSupplyLocked: bigint | null;
}>;

export type ReconciliationSnapshot = Readonly<{
  stack: ReconciliationStackRow | null;
  launches: readonly ReconciliationLaunchRow[];
  states: readonly ReconciliationLaunchStateRow[];
  credited: bigint;
  claimed: bigint;
  checkpoint: Readonly<{
    deploymentStartBlock: bigint;
    indexedThroughBlock: bigint;
    indexedThroughBlockHash: string;
    status: string;
  }> | null;
}>;

export class RebuildRepository {
  constructor(private readonly db: BreadDb) {}

  async deleteSelectedStackReadModel(context: IndexerProtocolContext): Promise<Readonly<{ tokenAddresses: readonly string[] }>> {
    const factory = context.factoryAddress.toLowerCase();
    const registeredAddresses = [factory, ...Object.values(context.addresses)]
      .filter((value): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value))
      .map((value) => value.toLowerCase());

    return this.db.transaction(async (tx) => {
      const lockKey = `bread-rebuild:${context.chainId}:${context.stackVersion}:${factory}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const tokenResult = await tx.execute(sql`
        SELECT token_address
        FROM launches
        WHERE chain_id=${context.chainId}
          AND stack_version=${context.stackVersion}
          AND factory_address=${factory}
        ORDER BY token_address
      `);
      const tokenAddresses = rows<{ token_address: string }>(tokenResult).map((row) => row.token_address.toLowerCase());

      // Token-owned projections are scoped through the selected stack's launch set.
      await tx.execute(sql`DELETE FROM holder_snapshots h WHERE h.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM launches l WHERE l.chain_id=h.chain_id AND l.token_address=h.token_address
          AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory})`);
      await tx.execute(sql`DELETE FROM creator_rollups c WHERE c.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM launches l WHERE l.chain_id=c.chain_id AND l.token_address=c.token_address
          AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory})`);
      await tx.execute(sql`DELETE FROM market_candles c WHERE c.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM launches l WHERE l.chain_id=c.chain_id AND l.token_address=c.token_address
          AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory})`);
      await tx.execute(sql`DELETE FROM token_metrics m WHERE m.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM launches l WHERE l.chain_id=m.chain_id AND l.token_address=m.token_address
          AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory})`);
      await tx.execute(sql`DELETE FROM launch_state s WHERE s.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM launches l WHERE l.chain_id=s.chain_id AND l.token_address=s.token_address
          AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory})`);
      await tx.execute(sql`DELETE FROM metadata m WHERE m.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM launches l WHERE l.chain_id=m.chain_id AND l.token_address=m.token_address
          AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory})`);
      await tx.execute(sql`DELETE FROM trades t WHERE t.chain_id=${context.chainId} AND t.stack_version=${context.stackVersion} AND EXISTS (
        SELECT 1 FROM launches l WHERE l.chain_id=t.chain_id AND l.token_address=t.token_address
          AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory})`);

      // Entitlement/admin rows are deleted only when their canonical journal identity belongs to this stack's registered contracts.
      await tx.execute(sql`DELETE FROM fee_credits f WHERE f.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM event_journal j
        WHERE j.chain_id=f.chain_id AND j.transaction_hash=f.transaction_hash AND j.log_index=f.log_index
          AND j.stack_version=${context.stackVersion}
          AND j.contract_address = ANY(${registeredAddresses}::text[]))`);
      await tx.execute(sql`DELETE FROM fee_claims f WHERE f.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM event_journal j
        WHERE j.chain_id=f.chain_id AND j.transaction_hash=f.transaction_hash AND j.log_index=f.log_index
          AND j.stack_version=${context.stackVersion}
          AND j.contract_address = ANY(${registeredAddresses}::text[]))`);
      await tx.execute(sql`DELETE FROM admin_events a WHERE a.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM event_journal j
        WHERE j.chain_id=a.chain_id AND j.transaction_hash=a.transaction_hash AND j.log_index=a.log_index
          AND j.stack_version=${context.stackVersion}
          AND j.contract_address = ANY(${registeredAddresses}::text[]))`);

      await tx.execute(sql`DELETE FROM event_journal j
        WHERE j.chain_id=${context.chainId}
          AND j.stack_version=${context.stackVersion}
          AND (
            j.contract_address = ANY(${registeredAddresses}::text[])
            OR EXISTS (SELECT 1 FROM launches l WHERE l.chain_id=j.chain_id AND l.stack_version=${context.stackVersion}
              AND l.factory_address=${factory} AND (l.token_address=j.token_address OR l.curve_address=j.curve_address))
          )`);
      await tx.execute(sql`DELETE FROM indexer_checkpoints
        WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion} AND factory_address=${factory}`);
      await tx.execute(sql`DELETE FROM launches
        WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion} AND factory_address=${factory}`);

      return { tokenAddresses };
    });
  }

  async reconciliationSnapshot(context: IndexerProtocolContext): Promise<ReconciliationSnapshot> {
    const factory = context.factoryAddress.toLowerCase();
    const stackResult = await this.db.execute(sql`
      SELECT deployment_start_block::text AS "deploymentStartBlock", addresses, runtime_code_hashes AS "runtimeCodeHashes"
      FROM protocol_stacks
      WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion} AND factory_address=${factory}
    `);
    const stackRaw = rows<{ deploymentStartBlock: string; addresses: Record<string, string | null>; runtimeCodeHashes: Record<string, string> | null }>(stackResult)[0];

    const launchResult = await this.db.execute(sql`
      SELECT token_address AS "tokenAddress", curve_address AS "curveAddress"
      FROM launches
      WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion} AND factory_address=${factory}
      ORDER BY token_address
    `);
    const launches = rows<ReconciliationLaunchRow>(launchResult);

    const stateResult = await this.db.execute(sql`
      SELECT s.token_address AS "tokenAddress", s.tracked_quote::text AS "trackedQuote",
             s.tracked_tokens::text AS "trackedTokens", s.graduation_phase AS "graduationPhase",
             s.pool_id AS "poolId", s.position_locked AS "positionLocked",
             s.token_supply_locked::text AS "tokenSupplyLocked"
      FROM launch_state s
      JOIN launches l ON l.chain_id=s.chain_id AND l.token_address=s.token_address
      WHERE l.chain_id=${context.chainId} AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory}
      ORDER BY s.token_address
    `);
    const states = rows<{
      tokenAddress: string; trackedQuote: string | null; trackedTokens: string | null; graduationPhase: string;
      poolId: string | null; positionLocked: boolean; tokenSupplyLocked: string | null;
    }>(stateResult).map((row) => ({
      tokenAddress: row.tokenAddress,
      trackedQuote: row.trackedQuote === null ? null : BigInt(row.trackedQuote),
      trackedTokens: row.trackedTokens === null ? null : BigInt(row.trackedTokens),
      graduationPhase: row.graduationPhase,
      poolId: row.poolId,
      positionLocked: row.positionLocked,
      tokenSupplyLocked: row.tokenSupplyLocked === null ? null : BigInt(row.tokenSupplyLocked),
    }));

    const accountingResult = await this.db.execute(sql`
      SELECT
        COALESCE((SELECT sum(amount) FROM fee_credits WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion}), 0)::text AS credited,
        COALESCE((SELECT sum(amount) FROM fee_claims WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion}), 0)::text AS claimed
    `);
    const accounting = rows<{ credited: string; claimed: string }>(accountingResult)[0] ?? { credited: '0', claimed: '0' };

    const checkpointResult = await this.db.execute(sql`
      SELECT deployment_start_block::text AS "deploymentStartBlock",
             indexed_through_block::text AS "indexedThroughBlock",
             indexed_through_block_hash AS "indexedThroughBlockHash", status
      FROM indexer_checkpoints
      WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion} AND factory_address=${factory}
    `);
    const checkpointRaw = rows<{
      deploymentStartBlock: string; indexedThroughBlock: string; indexedThroughBlockHash: string; status: string;
    }>(checkpointResult)[0];

    return {
      stack: stackRaw ? {
        deploymentStartBlock: BigInt(stackRaw.deploymentStartBlock),
        addresses: stackRaw.addresses,
        runtimeCodeHashes: stackRaw.runtimeCodeHashes,
      } : null,
      launches,
      states,
      credited: BigInt(accounting.credited),
      claimed: BigInt(accounting.claimed),
      checkpoint: checkpointRaw ? {
        deploymentStartBlock: BigInt(checkpointRaw.deploymentStartBlock),
        indexedThroughBlock: BigInt(checkpointRaw.indexedThroughBlock),
        indexedThroughBlockHash: checkpointRaw.indexedThroughBlockHash,
        status: checkpointRaw.status,
      } : null,
    };
  }
}
