import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import { createBreadDb, migrateBreadDb } from '../../packages/db/src/index.js';
import { reconcileStack } from '../../apps/indexer/src/reconcile.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;

const token = address(10);
const curve = address(11);
const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task10-pregraduation-stack',
  factoryAddress: address(1),
  quoteAsset: address(2),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory: address(1),
    deployer: address(3),
    feePolicy: address(4),
    feeEscrow: address(5),
    emergencyController: address(6),
    locker: address(7),
    coordinator: address(8),
    graduationAdapter: address(9),
  },
};

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 6 Task 10 persisted pre-graduation reconciliation', () => {
  const schemaName = `day6_task10_pregraduation_${process.pid}`;
  let adminPool: TestPool;
  let pool: TestPool;

  beforeAll(async () => {
    const connectionString = process.env.BREAD_DATABASE_URL ?? 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread';
    adminPool = new Pool({ connectionString });
    await adminPool.query('SELECT 1');
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await adminPool.query(`CREATE SCHEMA ${schemaName}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schemaName}` });
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await adminPool.end();
    }
  });

  beforeEach(async () => {
    await migrateBreadDb(pool);
    await pool.query(`TRUNCATE event_journal, admin_events, holder_snapshots, creator_rollups, fee_claims, fee_credits,
      market_candles, token_metrics, trades, launch_state, metadata, launches, indexer_checkpoints, protocol_stacks CASCADE`);
  });

  it('treats persisted NULL graduation_phase as the canonical not-yet-graduated state', async () => {
    const runtimeHashes = Object.fromEntries(Object.entries(context.addresses).map(([role]) => [role, hash(role.length + 20)]));
    await pool.query(`INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals, addresses, runtime_code_hashes)
      VALUES ($1,$2,$3,'100',$4,6,$5::jsonb,$6::jsonb)`, [
      context.chainId, context.stackVersion, context.factoryAddress, context.quoteAsset,
      JSON.stringify(context.addresses), JSON.stringify(runtimeHashes),
    ]);
    await pool.query(`INSERT INTO launches
      (chain_id, token_address, curve_address, stack_version, factory_address, initial_supply, phantom_quote,
       reserved_tokens_baseline, graduation_coordinator, launch_block_number, launch_transaction_hash, launch_log_index)
      VALUES ($1,$2,$3,$4,$5,'1000','250','100',$6,'100',$7,1)`, [
      context.chainId, token, curve, context.stackVersion, context.factoryAddress, context.addresses.coordinator, hash(100),
    ]);
    await pool.query(`INSERT INTO launch_state
      (chain_id, token_address, tracked_quote, tracked_tokens, quote_fee_balance, creator_tax_balance,
       real_quote_reserve, virtual_quote_reserve, remaining_sellable_tokens, ready_to_graduate,
       graduation_phase, swept_token_amount, swept_usdc_amount, pool_id, position_id, position_locked,
       token_supply_locked, latest_block_number, latest_transaction_hash, latest_log_index)
      VALUES ($1,$2,'500','800','20','5','500','750','700',false,NULL,'0','0',NULL,NULL,false,'0','105',$3,2)`, [
      context.chainId, token, hash(105),
    ]);
    await pool.query(`INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block,
       indexed_through_block_hash, indexed_through_block_timestamp, decoder_schema_version, status)
      VALUES ($1,$2,$3,'100','105',$4,'1786262405','day6-v1','COMMITTED')`, [
      context.chainId, context.stackVersion, context.factoryAddress, hash(105),
    ]);
    await pool.query(`INSERT INTO event_journal
      (chain_id, transaction_hash, log_index, block_number, block_hash, block_timestamp, transaction_index,
       contract_address, contract_role, stack_version, topic0, topics, data, event_name, payload,
       token_address, curve_address, decoder_schema_version)
      VALUES ($1,$2,1,'100',$3,'1786262400',0,$4,'FACTORY',$5,$6,$7::jsonb,'0x','LaunchCreated','{}'::jsonb,$8,$9,'day6-v1')`, [
      context.chainId, hash(100), hash(100), context.factoryAddress, context.stackVersion,
      hash(900), JSON.stringify([hash(900)]), token, curve,
    ]);

    const observedHashes = new Map(Object.entries(context.addresses).map(([role, target]) => [target!.toLowerCase(), runtimeHashes[role]! ]));
    const report = await reconcileStack({
      db: createBreadDb(pool),
      context,
      checkedBlock: 105n,
      chain: {
        countLaunchCreated: async () => 1n,
        scanLaunchCreated: async () => [{ transactionHash: hash(100), logIndex: 1, tokenAddress: token }],
        scanCanonicalEventIdentities: async () => [{ transactionHash: hash(100), logIndex: 1 }],
        readCurveState: async () => ({
          trackedQuote: 500n,
          trackedTokens: 800n,
          quoteFeeBalance: 20n,
          creatorTaxBalance: 5n,
          realQuoteReserve: 500n,
          virtualQuoteReserve: 750n,
          reservedTokens: 100n,
          remainingSellableTokens: 700n,
          readyToGraduate: false,
          graduated: false,
        }),
        readFeeEscrowState: async () => ({ totalOutstanding: 0n, custody: 0n }),
        readGraduationState: async () => ({
          phase: 'NOT_GRADUATED',
          sweptTokenAmount: 0n,
          sweptUsdcAmount: 0n,
          poolId: null,
          positionId: null,
          positionLocked: false,
          tokenSupplyLocked: 0n,
        }),
        readChainConfig: async () => ({
          chainId: context.chainId,
          quoteAsset: context.quoteAsset,
          quoteDecimals: context.quoteDecimals,
        }),
        getRuntimeCodeHash: async (target: string) => observedHashes.get(target.toLowerCase()) ?? null,
        getBlockHash: async (block: bigint) => block === 105n ? hash(105) : hash(Number(block)),
      },
    });

    expect(report.status).toBe('PASS');
    expect(report.checks.find((item) => item.id === 'REC-02')?.status).toBe('PASS');
    expect(report.checks.find((item) => item.id === 'REC-04')?.status).toBe('PASS');
  });
});
