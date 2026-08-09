import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;
const context: ProtocolContext = {
  network: 'arc-testnet', chainId: 5_042_002, stackVersion: 'task10-conformance-stack',
  factoryAddress: address(1), quoteAsset: address(2), quoteDecimals: 6, deploymentStartBlock: 100n,
  addresses: {
    factory: address(1), deployer: address(3), feePolicy: address(4), feeEscrow: address(5),
    emergencyController: address(6), locker: address(7), coordinator: address(8), graduationAdapter: address(9),
  },
};
const token = address(10);
const curve = address(11);

async function optionalModule(relativePath: string): Promise<Record<string, unknown>> {
  const href = new URL(relativePath, import.meta.url).href;
  try {
    return (await import(/* @vite-ignore */ href)) as Record<string, unknown>;
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'ERR_MODULE_NOT_FOUND' || /cannot find module|failed to load url/i.test(message)) return {};
    throw error;
  }
}

describe('Day 6 Task 10 operator command surface', () => {
  it('exports an injected rebuild/reconcile command router', async () => {
    const module = await optionalModule('../../apps/indexer/src/index.ts');
    expect(module.runIndexerCommand).toBeTypeOf('function');
  });
});

type TestPool = { query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>; end: () => Promise<void> };
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

function baseChain(overrides: Record<string, unknown> = {}) {
  return {
    countLaunchCreated: async () => 1n,
    scanLaunchCreated: async () => [{ transactionHash: hash(100), logIndex: 1, tokenAddress: token }],
    scanCanonicalEventIdentities: async () => [{ transactionHash: hash(100), logIndex: 1 }],
    readCurveState: async () => ({
      trackedQuote: 500n, trackedTokens: 800n, quoteFeeBalance: 20n, creatorTaxBalance: 5n,
      realQuoteReserve: 500n, virtualQuoteReserve: 750n, reservedTokens: 100n,
      remainingSellableTokens: 700n, readyToGraduate: false, graduated: false,
    }),
    readFeeEscrowState: async () => ({ totalOutstanding: 50n, custody: 55n }),
    readGraduationState: async () => ({
      phase: 'SWEPT', sweptTokenAmount: 100n, sweptUsdcAmount: 50n, poolId: null, positionId: null,
      positionLocked: false, tokenSupplyLocked: 0n,
    }),
    getRuntimeCodeHash: async (target: string) => ({
      [address(1)]: hash(1), [address(3)]: hash(3), [address(4)]: hash(4), [address(5)]: hash(5),
      [address(6)]: hash(6), [address(7)]: hash(7), [address(8)]: hash(8), [address(9)]: hash(9),
    })[target.toLowerCase()] ?? null,
    getBlockHash: async (block: bigint) => block === 105n ? hash(105) : hash(Number(block)),
    readChainConfig: async () => ({ chainId: context.chainId, quoteAsset: context.quoteAsset, quoteDecimals: context.quoteDecimals }),
    ...overrides,
  };
}

describe.skipIf(!RUN_DB)('Day 6 Task 10 full source reconciliation contract', () => {
  const schemaName = `day6_task10_conformance_${process.pid}`;
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
    if (adminPool) { await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`); await adminPool.end(); }
  });

  beforeEach(async () => {
    const db = await import('../../packages/db/src/index.ts');
    await db.migrateBreadDb(pool);
    await pool.query(`TRUNCATE event_journal, admin_events, holder_snapshots, creator_rollups, fee_claims, fee_credits,
      market_candles, token_metrics, trades, launch_state, metadata, launches, indexer_checkpoints, protocol_stacks CASCADE`);
  });

  async function seedBase(runtimeHashes: Record<string, string> = {
    factory: hash(1), deployer: hash(3), feePolicy: hash(4), feeEscrow: hash(5), emergencyController: hash(6),
    locker: hash(7), coordinator: hash(8), graduationAdapter: hash(9),
  }) {
    await pool.query(`INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals,
       manifest_hash, source_hash, addresses, runtime_code_hashes)
      VALUES ($1,$2,$3,'100',$4,6,$5,$6,$7::jsonb,$8::jsonb)`, [
      context.chainId, context.stackVersion, context.factoryAddress, context.quoteAsset, hash(200), hash(201),
      JSON.stringify(context.addresses), JSON.stringify(runtimeHashes),
    ]);
    await pool.query(`INSERT INTO launches
      (chain_id, token_address, curve_address, stack_version, factory_address, graduation_coordinator,
       launch_block_number, launch_transaction_hash, launch_log_index)
      VALUES ($1,$2,$3,$4,$5,$6,'100',$7,1)`, [context.chainId, token, curve, context.stackVersion, context.factoryAddress, context.addresses.coordinator, hash(100)]);
    await pool.query(`INSERT INTO launch_state
      (chain_id, token_address, tracked_quote, tracked_tokens, quote_fee_balance, creator_tax_balance,
       real_quote_reserve, virtual_quote_reserve, remaining_sellable_tokens, ready_to_graduate,
       graduation_phase, swept_token_amount, swept_usdc_amount, pool_id, position_id, position_locked,
       token_supply_locked, latest_block_number, latest_transaction_hash, latest_log_index)
      VALUES ($1,$2,'500','800','20','5','500','750','700',false,'SWEPT','100','50',NULL,NULL,false,'0','105',$3,2)`, [context.chainId, token, hash(105)]);
    await pool.query(`INSERT INTO fee_credits
      (chain_id, transaction_hash, log_index, creditor_address, recipient_address, amount, recipient_balance, total_outstanding, stack_version, block_number)
      VALUES ($1,$2,0,$3,$4,'80','80','80',$5,'101')`, [context.chainId, hash(101), curve, address(30), context.stackVersion]);
    await pool.query(`INSERT INTO fee_claims
      (chain_id, transaction_hash, log_index, recipient_address, amount, remaining_balance, total_outstanding, stack_version, block_number)
      VALUES ($1,$2,0,$3,'30','50','50',$4,'102')`, [context.chainId, hash(102), address(30), context.stackVersion]);
    await pool.query(`INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block,
       indexed_through_block_hash, indexed_through_block_timestamp, decoder_schema_version, status)
      VALUES ($1,$2,$3,'100','105',$4,'1786262405','day6-v1','COMMITTED')`, [context.chainId, context.stackVersion, context.factoryAddress, hash(105)]);
    await pool.query(`INSERT INTO event_journal
      (chain_id, transaction_hash, log_index, block_number, block_hash, block_timestamp, transaction_index,
       contract_address, contract_role, stack_version, topic0, topics, data, event_name, payload, token_address, curve_address)
      VALUES ($1,$2,1,'100',$3,'1786262400',0,$4,'FACTORY',$5,$6,$7::jsonb,'0x','LaunchCreated','{}'::jsonb,$8,$9)`, [
      context.chainId, hash(100), hash(100), context.factoryAddress, context.stackVersion, hash(900),
      JSON.stringify([hash(900)]), token, curve,
    ]);
  }

  async function reconcile(chain: Record<string, unknown>) {
    const dbModule = await import('../../packages/db/src/index.ts');
    const module = await import('../../apps/indexer/src/reconcile.ts');
    return module.reconcileStack({ db: dbModule.createBreadDb(pool), context, checkedBlock: 105n, chain: chain as never });
  }

  it('REC-01 fails when launch identity/token evidence disagrees even if counts match', async () => {
    await seedBase();
    const report = await reconcile(baseChain({
      scanLaunchCreated: async () => [{ transactionHash: hash(100), logIndex: 1, tokenAddress: address(99) }],
    }));
    expect(report.checks.find((check) => check.id === 'REC-01')?.status).toBe('FAIL');
  });

  it('REC-02 checks full tracked/reserve/fee/readiness state rather than only trackedQuote/trackedTokens', async () => {
    await seedBase();
    const report = await reconcile(baseChain({
      readCurveState: async () => ({
        trackedQuote: 500n, trackedTokens: 800n, quoteFeeBalance: 999n, creatorTaxBalance: 5n,
        realQuoteReserve: 500n, virtualQuoteReserve: 750n, reservedTokens: 100n,
        remainingSellableTokens: 700n, readyToGraduate: false, graduated: false,
      }),
    }));
    expect(report.checks.find((check) => check.id === 'REC-02')?.status).toBe('FAIL');
  });

  it('REC-04 checks graduation amounts and position identity, not only phase/pool/lock boolean', async () => {
    await seedBase();
    const report = await reconcile(baseChain({
      readGraduationState: async () => ({
        phase: 'SWEPT', sweptTokenAmount: 999n, sweptUsdcAmount: 50n, poolId: null,
        positionId: 333n, positionLocked: false, tokenSupplyLocked: 0n,
      }),
    }));
    expect(report.checks.find((check) => check.id === 'REC-04')?.status).toBe('FAIL');
  });

  it('REC-05 fails when any registered active stack deployment lacks a frozen expected runtime hash', async () => {
    await seedBase({ factory: hash(1) });
    const report = await reconcile(baseChain());
    expect(report.checks.find((check) => check.id === 'REC-05')?.status).toBe('FAIL');
  });

  it('REC-05 fails when authoritative chain or canonical quote identity disagrees with the registered stack', async () => {
    await seedBase();
    const report = await reconcile(baseChain({
      readChainConfig: async () => ({ chainId: context.chainId + 1, quoteAsset: address(77), quoteDecimals: 18 }),
    }));
    expect(report.checks.find((check) => check.id === 'REC-05')?.status).toBe('FAIL');
  });

  it('REC-06 fails for journal rows beyond checkpoint or an independent canonical identity-set mismatch', async () => {
    await seedBase();
    await pool.query(`INSERT INTO event_journal
      (chain_id, transaction_hash, log_index, block_number, block_hash, block_timestamp, transaction_index,
       contract_address, contract_role, stack_version, topic0, topics, data, event_name, payload)
      VALUES ($1,$2,0,'106',$3,'1786262406',0,$4,'FACTORY',$5,$6,$7::jsonb,'0x','OwnershipTransferred','{}'::jsonb)`, [
      context.chainId, hash(106), hash(106), context.factoryAddress, context.stackVersion, hash(901),
      JSON.stringify([hash(901)]),
    ]);
    const report = await reconcile(baseChain({ scanCanonicalEventIdentities: async () => [] }));
    expect(report.checks.find((check) => check.id === 'REC-06')?.status).toBe('FAIL');
  });

  it('REC-06 fails when the committed checkpoint decoder schema does not match the active Day-6 schema', async () => {
    await seedBase();
    await pool.query(`UPDATE indexer_checkpoints SET decoder_schema_version='wrong-schema'
      WHERE chain_id=$1 AND stack_version=$2 AND factory_address=$3`, [context.chainId, context.stackVersion, context.factoryAddress]);
    const report = await reconcile(baseChain());
    expect(report.checks.find((check) => check.id === 'REC-06')?.status).toBe('FAIL');
  });

  it('report carries source/manifest/factory/checkpoint/timing identity required by the operator contract', async () => {
    await seedBase();
    const report = await reconcile(baseChain());
    expect(report).toMatchObject({
      reportVersion: expect.any(String),
      chainId: context.chainId,
      stackVersion: context.stackVersion,
      factoryAddress: context.factoryAddress,
      manifestHash: hash(200),
      sourceHash: hash(201),
      deploymentStartBlock: '100',
      checkedBlock: '105',
      checkedBlockHash: hash(105),
      startedAt: expect.any(String),
      completedAt: expect.any(String),
    });
  });

  it('rebuild cannot report success without mandatory authoritative reconciliation', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const module = await import('../../apps/indexer/src/reconcile.ts');
    const db = dbModule.createBreadDb(pool);
    await expect((module.rebuildStack as (input: Record<string, unknown>) => Promise<unknown>)({
      db,
      client: { readContract: async () => { throw new Error('unused'); } },
      context,
      targetBlock: 100n,
      batchSize: 10n,
      loadRange: async (fromBlock: bigint, toBlock: bigint) => ({ fromBlock, toBlock, toBlockHash: hash(100), logs: [] }),
      skipReconciliation: true,
    })).rejects.toThrow(/authoritative chain reader.*required/i);
  });
});