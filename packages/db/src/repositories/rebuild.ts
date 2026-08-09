import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import type { IndexerProtocolContext } from './indexer.js';

function rows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

export type ReconciliationStackRow = Readonly<{
  deploymentStartBlock: bigint;
  quoteAsset: string;
  quoteDecimals: number;
  manifestHash: string | null;
  sourceHash: string | null;
  addresses: Readonly<Record<string, string | null>>;
  runtimeCodeHashes: Readonly<Record<string, string>> | null;
}>;

export type ReconciliationLaunchRow = Readonly<{
  tokenAddress: string;
  curveAddress: string;
  launchTransactionHash: string;
  launchLogIndex: number;
  initialSupply: bigint | null;
  phantomQuote: bigint | null;
  reservedTokensBaseline: bigint | null;
}>;

export type ReconciliationLaunchStateRow = Readonly<{
  tokenAddress: string;
  trackedQuote: bigint | null;
  trackedTokens: bigint | null;
  quoteFeeBalance: bigint | null;
  creatorTaxBalance: bigint | null;
  realQuoteReserve: bigint | null;
  virtualQuoteReserve: bigint | null;
  remainingSellableTokens: bigint | null;
  readyToGraduate: boolean | null;
  graduationPhase: string;
  sweptTokenAmount: bigint | null;
  sweptUsdcAmount: bigint | null;
  poolId: string | null;
  positionId: bigint | null;
  positionLocked: boolean;
  tokenSupplyLocked: bigint | null;
}>;

export type ReconciliationJournalIdentity = Readonly<{
  transactionHash: string;
  logIndex: number;
  blockNumber: bigint;
  decoderSchemaVersion: string;
}>;

export type ReconciliationSnapshot = Readonly<{
  stack: ReconciliationStackRow | null;
  launches: readonly ReconciliationLaunchRow[];
  states: readonly ReconciliationLaunchStateRow[];
  credited: bigint;
  claimed: bigint;
  journal: readonly ReconciliationJournalIdentity[];
  checkpoint: Readonly<{
    deploymentStartBlock: bigint;
    indexedThroughBlock: bigint;
    indexedThroughBlockHash: string;
    decoderSchemaVersion: string;
    status: string;
  }> | null;
}>;

function registeredAddresses(context: IndexerProtocolContext): readonly string[] {
  const factory = context.factoryAddress.toLowerCase();
  return [...new Set([factory, ...Object.values(context.addresses)]
    .filter((value): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value))
    .map((value) => value.toLowerCase()))];
}

function addressList(values: readonly string[]) {
  return sql.join(values.map((value) => sql`${value}`), sql`, `);
}

function initialReconciliationState(launch: ReconciliationLaunchRow): ReconciliationLaunchStateRow | null {
  const { initialSupply, phantomQuote, reservedTokensBaseline } = launch;
  if (initialSupply === null || phantomQuote === null || reservedTokensBaseline === null) return null;
  if (initialSupply < 0n || phantomQuote < 0n || reservedTokensBaseline < 0n || reservedTokensBaseline > initialSupply) return null;
  const remainingSellableTokens = initialSupply - reservedTokensBaseline;
  return {
    tokenAddress: launch.tokenAddress,
    trackedQuote: 0n,
    trackedTokens: initialSupply,
    quoteFeeBalance: 0n,
    creatorTaxBalance: 0n,
    realQuoteReserve: 0n,
    virtualQuoteReserve: phantomQuote,
    remainingSellableTokens,
    readyToGraduate: remainingSellableTokens === 0n,
    graduationPhase: 'NOT_GRADUATED',
    sweptTokenAmount: 0n,
    sweptUsdcAmount: 0n,
    poolId: null,
    positionId: null,
    positionLocked: false,
    tokenSupplyLocked: 0n,
  };
}

export class RebuildRepository {
  constructor(private readonly db: BreadDb) {}

  async deleteSelectedStackReadModel(context: IndexerProtocolContext): Promise<Readonly<{ tokenAddresses: readonly string[] }>> {
    const factory = context.factoryAddress.toLowerCase();
    const registered = registeredAddresses(context);
    const registeredAddressList = addressList(registered);

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

      await tx.execute(sql`DELETE FROM fee_credits f WHERE f.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM event_journal j
        WHERE j.chain_id=f.chain_id AND j.transaction_hash=f.transaction_hash AND j.log_index=f.log_index
          AND j.stack_version=${context.stackVersion}
          AND j.contract_address IN (${registeredAddressList}))`);
      await tx.execute(sql`DELETE FROM fee_claims f WHERE f.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM event_journal j
        WHERE j.chain_id=f.chain_id AND j.transaction_hash=f.transaction_hash AND j.log_index=f.log_index
          AND j.stack_version=${context.stackVersion}
          AND j.contract_address IN (${registeredAddressList}))`);
      await tx.execute(sql`DELETE FROM admin_events a WHERE a.chain_id=${context.chainId} AND EXISTS (
        SELECT 1 FROM event_journal j
        WHERE j.chain_id=a.chain_id AND j.transaction_hash=a.transaction_hash AND j.log_index=a.log_index
          AND j.stack_version=${context.stackVersion}
          AND j.contract_address IN (${registeredAddressList}))`);

      await tx.execute(sql`DELETE FROM event_journal j
        WHERE j.chain_id=${context.chainId}
          AND j.stack_version=${context.stackVersion}
          AND (
            j.contract_address IN (${registeredAddressList})
            OR EXISTS (SELECT 1 FROM launches l WHERE l.chain_id=j.chain_id AND l.stack_version=${context.stackVersion}
              AND l.factory_address=${factory} AND (
                l.token_address=j.contract_address OR l.curve_address=j.contract_address
                OR l.token_address=j.token_address OR l.curve_address=j.curve_address
              ))
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
    const registered = registeredAddresses(context);
    const registeredAddressList = addressList(registered);

    const stackResult = await this.db.execute(sql`
      SELECT deployment_start_block::text AS "deploymentStartBlock",
             quote_asset AS "quoteAsset", quote_decimals AS "quoteDecimals",
             manifest_hash AS "manifestHash", source_hash AS "sourceHash",
             addresses, runtime_code_hashes AS "runtimeCodeHashes"
      FROM protocol_stacks
      WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion} AND factory_address=${factory}
    `);
    const stackRaw = rows<{
      deploymentStartBlock: string; quoteAsset: string; quoteDecimals: number; manifestHash: string | null; sourceHash: string | null;
      addresses: Record<string, string | null>; runtimeCodeHashes: Record<string, string> | null;
    }>(stackResult)[0];

    const launchResult = await this.db.execute(sql`
      SELECT token_address AS "tokenAddress", curve_address AS "curveAddress",
             launch_transaction_hash AS "launchTransactionHash", launch_log_index AS "launchLogIndex",
             initial_supply::text AS "initialSupply", phantom_quote::text AS "phantomQuote",
             reserved_tokens_baseline::text AS "reservedTokensBaseline"
      FROM launches
      WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion} AND factory_address=${factory}
      ORDER BY launch_transaction_hash, launch_log_index, token_address
    `);
    const launches = rows<{
      tokenAddress: string; curveAddress: string; launchTransactionHash: string; launchLogIndex: number;
      initialSupply: string | null; phantomQuote: string | null; reservedTokensBaseline: string | null;
    }>(launchResult).map((row) => ({
      tokenAddress: row.tokenAddress,
      curveAddress: row.curveAddress,
      launchTransactionHash: row.launchTransactionHash,
      launchLogIndex: row.launchLogIndex,
      initialSupply: row.initialSupply === null ? null : BigInt(row.initialSupply),
      phantomQuote: row.phantomQuote === null ? null : BigInt(row.phantomQuote),
      reservedTokensBaseline: row.reservedTokensBaseline === null ? null : BigInt(row.reservedTokensBaseline),
    }));

    const stateResult = await this.db.execute(sql`
      SELECT s.token_address AS "tokenAddress", s.tracked_quote::text AS "trackedQuote",
             s.tracked_tokens::text AS "trackedTokens", s.quote_fee_balance::text AS "quoteFeeBalance",
             s.creator_tax_balance::text AS "creatorTaxBalance", s.real_quote_reserve::text AS "realQuoteReserve",
             s.virtual_quote_reserve::text AS "virtualQuoteReserve",
             s.remaining_sellable_tokens::text AS "remainingSellableTokens", s.ready_to_graduate AS "readyToGraduate",
             s.graduation_phase AS "graduationPhase", s.swept_token_amount::text AS "sweptTokenAmount",
             s.swept_usdc_amount::text AS "sweptUsdcAmount", s.pool_id AS "poolId",
             s.position_id::text AS "positionId", s.position_locked AS "positionLocked",
             s.token_supply_locked::text AS "tokenSupplyLocked"
      FROM launch_state s
      JOIN launches l ON l.chain_id=s.chain_id AND l.token_address=s.token_address
      WHERE l.chain_id=${context.chainId} AND l.stack_version=${context.stackVersion} AND l.factory_address=${factory}
      ORDER BY s.token_address
    `);
    const persistedStates = rows<{
      tokenAddress: string; trackedQuote: string | null; trackedTokens: string | null; quoteFeeBalance: string | null;
      creatorTaxBalance: string | null; realQuoteReserve: string | null; virtualQuoteReserve: string | null;
      remainingSellableTokens: string | null; readyToGraduate: boolean | null; graduationPhase: string | null;
      sweptTokenAmount: string | null; sweptUsdcAmount: string | null; poolId: string | null; positionId: string | null;
      positionLocked: boolean; tokenSupplyLocked: string | null;
    }>(stateResult).map((row) => ({
      tokenAddress: row.tokenAddress,
      trackedQuote: row.trackedQuote === null ? null : BigInt(row.trackedQuote),
      trackedTokens: row.trackedTokens === null ? null : BigInt(row.trackedTokens),
      quoteFeeBalance: row.quoteFeeBalance === null ? null : BigInt(row.quoteFeeBalance),
      creatorTaxBalance: row.creatorTaxBalance === null ? null : BigInt(row.creatorTaxBalance),
      realQuoteReserve: row.realQuoteReserve === null ? null : BigInt(row.realQuoteReserve),
      virtualQuoteReserve: row.virtualQuoteReserve === null ? null : BigInt(row.virtualQuoteReserve),
      remainingSellableTokens: row.remainingSellableTokens === null ? null : BigInt(row.remainingSellableTokens),
      readyToGraduate: row.readyToGraduate,
      graduationPhase: row.graduationPhase ?? 'NOT_GRADUATED',
      sweptTokenAmount: row.sweptTokenAmount === null ? null : BigInt(row.sweptTokenAmount),
      sweptUsdcAmount: row.sweptUsdcAmount === null ? null : BigInt(row.sweptUsdcAmount),
      poolId: row.poolId,
      positionId: row.positionId === null ? null : BigInt(row.positionId),
      positionLocked: row.positionLocked,
      tokenSupplyLocked: row.tokenSupplyLocked === null ? null : BigInt(row.tokenSupplyLocked),
    }));
    const persistedStateByToken = new Map(persistedStates.map((state) => [state.tokenAddress.toLowerCase(), state]));
    const states = launches.flatMap((launch) => {
      const persisted = persistedStateByToken.get(launch.tokenAddress.toLowerCase());
      if (persisted) return [persisted];
      const initial = initialReconciliationState(launch);
      return initial ? [initial] : [];
    });

    const accountingResult = await this.db.execute(sql`
      SELECT
        COALESCE((SELECT sum(f.amount) FROM fee_credits f WHERE f.chain_id=${context.chainId} AND EXISTS (
          SELECT 1 FROM event_journal j WHERE j.chain_id=f.chain_id AND j.transaction_hash=f.transaction_hash AND j.log_index=f.log_index
            AND j.stack_version=${context.stackVersion} AND j.contract_address IN (${registeredAddressList}))), 0)::text AS credited,
        COALESCE((SELECT sum(f.amount) FROM fee_claims f WHERE f.chain_id=${context.chainId} AND EXISTS (
          SELECT 1 FROM event_journal j WHERE j.chain_id=f.chain_id AND j.transaction_hash=f.transaction_hash AND j.log_index=f.log_index
            AND j.stack_version=${context.stackVersion} AND j.contract_address IN (${registeredAddressList}))), 0)::text AS claimed
    `);
    const accounting = rows<{ credited: string; claimed: string }>(accountingResult)[0] ?? { credited: '0', claimed: '0' };

    const journalResult = await this.db.execute(sql`
      SELECT j.transaction_hash AS "transactionHash", j.log_index AS "logIndex", j.block_number::text AS "blockNumber",
             j.decoder_schema_version AS "decoderSchemaVersion"
      FROM event_journal j
      WHERE j.chain_id=${context.chainId} AND j.stack_version=${context.stackVersion}
        AND (
          j.contract_address IN (${registeredAddressList})
          OR EXISTS (SELECT 1 FROM launches l WHERE l.chain_id=j.chain_id AND l.stack_version=${context.stackVersion}
            AND l.factory_address=${factory} AND (
              l.token_address=j.contract_address OR l.curve_address=j.contract_address
              OR l.token_address=j.token_address OR l.curve_address=j.curve_address
            ))
        )
      ORDER BY j.block_number, j.transaction_index, j.log_index, j.transaction_hash
    `);
    const journal = rows<{ transactionHash: string; logIndex: number; blockNumber: string; decoderSchemaVersion: string }>(journalResult).map((row) => ({
      transactionHash: row.transactionHash,
      logIndex: row.logIndex,
      blockNumber: BigInt(row.blockNumber),
      decoderSchemaVersion: row.decoderSchemaVersion,
    }));

    const checkpointResult = await this.db.execute(sql`
      SELECT deployment_start_block::text AS "deploymentStartBlock",
             indexed_through_block::text AS "indexedThroughBlock",
             indexed_through_block_hash AS "indexedThroughBlockHash",
             decoder_schema_version AS "decoderSchemaVersion", status
      FROM indexer_checkpoints
      WHERE chain_id=${context.chainId} AND stack_version=${context.stackVersion} AND factory_address=${factory}
    `);
    const checkpointRaw = rows<{
      deploymentStartBlock: string; indexedThroughBlock: string; indexedThroughBlockHash: string; decoderSchemaVersion: string; status: string;
    }>(checkpointResult)[0];

    return {
      stack: stackRaw ? {
        deploymentStartBlock: BigInt(stackRaw.deploymentStartBlock),
        quoteAsset: stackRaw.quoteAsset,
        quoteDecimals: stackRaw.quoteDecimals,
        manifestHash: stackRaw.manifestHash,
        sourceHash: stackRaw.sourceHash,
        addresses: stackRaw.addresses,
        runtimeCodeHashes: stackRaw.runtimeCodeHashes,
      } : null,
      launches,
      states,
      credited: BigInt(accounting.credited),
      claimed: BigInt(accounting.claimed),
      journal,
      checkpoint: checkpointRaw ? {
        deploymentStartBlock: BigInt(checkpointRaw.deploymentStartBlock),
        indexedThroughBlock: BigInt(checkpointRaw.indexedThroughBlock),
        indexedThroughBlockHash: checkpointRaw.indexedThroughBlockHash,
        decoderSchemaVersion: checkpointRaw.decoderSchemaVersion,
        status: checkpointRaw.status,
      } : null,
    };
  }
}
