import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address, Hex32, ReconciliationReport } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const ZERO = `0x${'00'.repeat(20)}` as Address;
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address('1');
const token = address('2');
const curve = address('3');
const deployer = address('4');
const creator = address('5');
const quoteAsset = address('6');
const coordinator = address('7');
const adapter = address('8');
const locker = address('9');
const feeEscrow = address('a');
const protocolFeeRecipient = address('b');
const initialSupply = 1_000_000n;
const txHash = hash('a');
const blockHash = hash('b');
const economicsDigest = hash('c');
const graduationConfigHash = hash('d');
const topic0 = hash('e');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task10-test-stack',
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('c'),
    feePolicy: address('d'),
    feeEscrow,
    emergencyController: address('e'),
    locker,
    coordinator,
    graduationAdapter: adapter,
  },
};

type FixtureLog = Readonly<{
  address: Address;
  blockNumber: bigint;
  blockHash: Hex32;
  transactionHash: Hex32;
  transactionIndex: number;
  logIndex: number;
  eventName: string;
  args: Readonly<Record<string, unknown>>;
  topics: readonly Hex32[];
  data: `0x${string}`;
}>;

const launchLogs: readonly FixtureLog[] = [
  {
    address: token,
    blockNumber: 100n,
    blockHash,
    transactionHash: txHash,
    transactionIndex: 1,
    logIndex: 0,
    eventName: 'Transfer',
    args: { from: ZERO, to: curve, value: initialSupply },
    topics: [topic0],
    data: '0x',
  },
  {
    address: factory,
    blockNumber: 100n,
    blockHash,
    transactionHash: txHash,
    transactionIndex: 1,
    logIndex: 4,
    eventName: 'LaunchCreated',
    args: {
      deployer,
      token,
      curve,
      creatorFeeRecipient: creator,
      creatorTaxBps: 125n,
      economicsDigest,
      configVersion: 3n,
    },
    topics: [topic0],
    data: '0x',
  },
];

function fakeReadClient() {
  return {
    readContract: async (request: Record<string, unknown>) => {
      const fn = String(request.functionName);
      const target = String(request.address).toLowerCase();
      if (target === factory.toLowerCase() && fn === 'getLaunch') {
        return {
          token,
          curve,
          deployer,
          creatorFeeRecipient: creator,
          creatorTaxBps: 125,
          economicsDigest,
          launchTimestamp: 1_786_262_400,
          configVersion: 3,
          graduationCoordinator: coordinator,
          graduationAdapter: adapter,
          graduationAdapterFamily: 1,
          graduationConfigHash,
        };
      }
      if (target === factory.toLowerCase() && fn === 'stackVersion') return context.stackVersion;
      if (target === curve.toLowerCase()) {
        const values: Record<string, unknown> = {
          token,
          pairToken: quoteAsset,
          phantomQuote: 250n,
          graduationThreshold: 9_000n,
          protocolFeeRecipient,
          tradeFeeBps: 100,
          protocolFeeShareBps: 7_500,
          maxCreatorTaxBps: 1_000,
          creatorTaxBps: 125,
          launchTimestamp: 1_786_262_400,
          reservedTokens: 200n,
          graduationCoordinator: coordinator,
        };
        if (fn in values) return values[fn];
      }
      if (target === token.toLowerCase()) {
        const values: Record<string, unknown> = {
          name: 'Rebuild Bread',
          symbol: 'RBLD',
          curve,
          launchFactory: factory,
          deployer,
          logo: 'ipfs://logo',
          description: 'Task 10 fixture',
          socials: ['', '', '', '', ''],
        };
        if (fn in values) return values[fn];
      }
      throw new Error(`unexpected read ${target}.${fn}`);
    },
  };
}

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

describe('Day 6 Task 10 rebuild/reconcile public surface', () => {
  it('exports rebuildStack and reconcileStack', async () => {
    const module = await optionalModule('../../apps/indexer/src/reconcile.ts');
    expect(module.rebuildStack).toBeTypeOf('function');
    expect(module.reconcileStack).toBeTypeOf('function');
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

async function digestStack(pool: TestPool): Promise<string> {
  const result = await pool.query(`
    SELECT md5(jsonb_build_object(
      'journal', COALESCE((SELECT jsonb_agg(to_jsonb(j) - 'inserted_at' ORDER BY block_number, transaction_index, log_index)
        FROM event_journal j WHERE stack_version=$1), '[]'::jsonb),
      'launches', COALESCE((SELECT jsonb_agg(to_jsonb(l) - 'created_at' ORDER BY token_address)
        FROM launches l WHERE stack_version=$1 AND factory_address=$2), '[]'::jsonb),
      'state', COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'updated_at' ORDER BY token_address)
        FROM launch_state s WHERE chain_id=$3 AND token_address IN
          (SELECT token_address FROM launches WHERE stack_version=$1 AND factory_address=$2)), '[]'::jsonb),
      'holders', COALESCE((SELECT jsonb_agg(to_jsonb(h) - 'updated_at' ORDER BY token_address, holder_address)
        FROM holder_snapshots h WHERE chain_id=$3 AND token_address IN
          (SELECT token_address FROM launches WHERE stack_version=$1 AND factory_address=$2)), '[]'::jsonb),
      'checkpoint', COALESCE((SELECT to_jsonb(c) - 'created_at' - 'updated_at' - 'applied_at'
        FROM indexer_checkpoints c WHERE chain_id=$3 AND stack_version=$1 AND factory_address=$2), '{}'::jsonb)
    )::text) AS digest
  `, [context.stackVersion, factory, context.chainId]);
  return String(result.rows[0]?.digest);
}

async function insertJournalEvent(
  pool: TestPool,
  input: Readonly<{
    transactionHash: Hex32;
    logIndex: number;
    blockNumber: bigint;
    contractAddress: Address;
    contractRole: string;
    eventName: string;
    tokenAddress?: Address;
    curveAddress?: Address;
  }>,
): Promise<void> {
  await pool.query(`INSERT INTO event_journal
    (chain_id, transaction_hash, log_index, block_number, block_hash, block_timestamp, transaction_index,
     contract_address, contract_role, stack_version, topic0, topics, data, event_name, payload, token_address, curve_address)
    VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11::jsonb,'0x',$12,'{}'::jsonb,$13,$14)`, [
    context.chainId,
    input.transactionHash,
    input.logIndex,
    input.blockNumber.toString(10),
    hash('9'),
    (1_786_262_400n + input.blockNumber - 100n).toString(10),
    input.contractAddress,
    input.contractRole,
    context.stackVersion,
    topic0,
    JSON.stringify([topic0]),
    input.eventName,
    input.tokenAddress ?? null,
    input.curveAddress ?? null,
  ]);
}

function authoritativeReader(overrides: Record<string, unknown> = {}) {
  const runtimeHashes: Record<string, string> = {
    [factory.toLowerCase()]: hash('1'),
    [context.addresses.deployer!.toLowerCase()]: hash('c'),
    [context.addresses.feePolicy!.toLowerCase()]: hash('d'),
    [feeEscrow.toLowerCase()]: hash('2'),
    [context.addresses.emergencyController!.toLowerCase()]: hash('e'),
    [locker.toLowerCase()]: hash('4'),
    [coordinator.toLowerCase()]: hash('3'),
    [adapter.toLowerCase()]: hash('8'),
  };
  return {
    countLaunchCreated: async () => 1n,
    scanLaunchCreated: async () => [{ transactionHash: txHash, logIndex: 4, tokenAddress: token }],
    scanCanonicalEventIdentities: async () => [
      { transactionHash: txHash, logIndex: 4 },
      { transactionHash: hash('7'), logIndex: 0 },
      { transactionHash: hash('8'), logIndex: 0 },
    ],
    readCurveState: async () => ({
      trackedQuote: 500n,
      trackedTokens: 800n,
      quoteFeeBalance: 0n,
      creatorTaxBalance: 0n,
      realQuoteReserve: 500n,
      virtualQuoteReserve: 250n,
      reservedTokens: 200n,
      remainingSellableTokens: 600n,
      readyToGraduate: false,
      graduated: true,
    }),
    readFeeEscrowState: async () => ({ totalOutstanding: 50n, custody: 55n }),
    readGraduationState: async () => ({
      phase: 'POOL_CREATED',
      sweptTokenAmount: 200n,
      sweptUsdcAmount: 50n,
      poolId: hash('5'),
      positionId: 77n,
      positionLocked: true,
      tokenSupplyLocked: 180n,
    }),
    readChainConfig: async () => ({
      chainId: context.chainId,
      quoteAsset: context.quoteAsset,
      quoteDecimals: context.quoteDecimals,
    }),
    getRuntimeCodeHash: async (target: string) => runtimeHashes[target.toLowerCase()] ?? null,
    getBlockHash: async (block: bigint) => block === 105n ? hash('9') : block === 100n ? blockHash : hash('0'),
    ...overrides,
  };
}

describe.skipIf(!RUN_DB)('Day 6 Task 10 deterministic rebuild and reconciliation against PostgreSQL', () => {
  const schemaName = `day6_task10_${process.pid}`;
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
    const db = await import('../../packages/db/src/index.ts');
    await db.migrateBreadDb(pool);
    await pool.query(`TRUNCATE event_journal, admin_events, holder_snapshots, creator_rollups, fee_claims, fee_credits,
      market_candles, token_metrics, trades, launch_state, metadata, launches, indexer_checkpoints, protocol_stacks CASCADE`);
  });

  it('deletes only the selected stack read model and rebuilds an identical digest through production applyRange', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apply = await import('../../apps/indexer/src/apply-range.ts');
    const reconcile = await optionalModule('../../apps/indexer/src/reconcile.ts');
    expect(reconcile.rebuildStack).toBeTypeOf('function');
    const db = dbModule.createBreadDb(pool);

    await apply.applyRange({
      db,
      client: fakeReadClient(),
      context,
      fromBlock: 100n,
      toBlock: 100n,
      toBlockHash: blockHash,
      toBlockTimestamp: 1_786_262_400n,
      logs: launchLogs,
    });
    await pool.query(`UPDATE protocol_stacks SET runtime_code_hashes=$1::jsonb WHERE chain_id=$2 AND stack_version=$3 AND factory_address=$4`, [
      JSON.stringify({
        factory: hash('1'),
        deployer: hash('c'),
        feePolicy: hash('d'),
        feeEscrow: hash('2'),
        emergencyController: hash('e'),
        locker: hash('4'),
        coordinator: hash('3'),
        graduationAdapter: hash('8'),
      }),
      context.chainId,
      context.stackVersion,
      factory,
    ]);

    const otherStack = 'task10-other-stack';
    const otherFactory = address('f');
    await pool.query(`INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals, addresses)
      VALUES ($1,$2,$3,'100',$4,6,'{}'::jsonb)`, [context.chainId, otherStack, otherFactory, quoteAsset]);
    await pool.query(`INSERT INTO launches
      (chain_id, token_address, curve_address, stack_version, factory_address, launch_block_number, launch_transaction_hash, launch_log_index)
      VALUES ($1,$2,$3,$4,$5,'100',$6,0)`, [context.chainId, address('d'), address('e'), otherStack, otherFactory, hash('f')]);

    const before = await digestStack(pool);
    const result = await (reconcile.rebuildStack as (input: Record<string, unknown>) => Promise<Record<string, unknown>>)({
      db,
      client: fakeReadClient(),
      context,
      targetBlock: 100n,
      batchSize: 25n,
      loadRange: async (fromBlock: bigint, toBlock: bigint) => ({
        fromBlock,
        toBlock,
        toBlockHash: blockHash,
        toBlockTimestamp: 1_786_262_400n,
        logs: fromBlock <= 100n && toBlock >= 100n ? launchLogs : [],
      }),
      chain: authoritativeReader({
        scanCanonicalEventIdentities: async () => [
          { transactionHash: txHash, logIndex: 0 },
          { transactionHash: txHash, logIndex: 4 },
        ],
        readCurveState: async () => ({
          trackedQuote: 0n,
          trackedTokens: initialSupply,
          quoteFeeBalance: 0n,
          creatorTaxBalance: 0n,
          realQuoteReserve: 0n,
          virtualQuoteReserve: 250n,
          reservedTokens: 200n,
          remainingSellableTokens: initialSupply - 200n,
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
      }),
    });
    const after = await digestStack(pool);
    expect(after).toBe(before);
    expect(result).toMatchObject({
      fromBlock: '100',
      toBlock: '100',
      reconciliation: { status: 'PASS' },
    });

    const other = await pool.query(`SELECT count(*)::int AS count FROM launches WHERE stack_version=$1 AND factory_address=$2`, [otherStack, otherFactory]);
    expect(other.rows[0]?.count).toBe(1);
  });

  it('returns PASS only when all six authoritative reconciliation checks match', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const reconcile = await optionalModule('../../apps/indexer/src/reconcile.ts');
    expect(reconcile.reconcileStack).toBeTypeOf('function');
    const db = dbModule.createBreadDb(pool);

    await pool.query(`INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals, addresses, runtime_code_hashes, manifest_hash, source_hash)
      VALUES ($1,$2,$3,'100',$4,6,$5::jsonb,$6::jsonb,$7,$8)`, [
      context.chainId,
      context.stackVersion,
      factory,
      quoteAsset,
      JSON.stringify({ factory, feeEscrow, coordinator, locker }),
      JSON.stringify({ factory: hash('1'), feeEscrow: hash('2'), coordinator: hash('3'), locker: hash('4') }),
      hash('c'),
      hash('d'),
    ]);
    await pool.query(`INSERT INTO launches
      (chain_id, token_address, curve_address, stack_version, factory_address, graduation_coordinator, reserved_tokens_baseline,
       launch_block_number, launch_transaction_hash, launch_log_index)
      VALUES ($1,$2,$3,$4,$5,$6,'200','100',$7,4)`, [context.chainId, token, curve, context.stackVersion, factory, coordinator, txHash]);
    await pool.query(`INSERT INTO launch_state
      (chain_id, token_address, tracked_quote, tracked_tokens, quote_fee_balance, creator_tax_balance,
       real_quote_reserve, virtual_quote_reserve, remaining_sellable_tokens, ready_to_graduate,
       graduation_phase, swept_token_amount, swept_usdc_amount, pool_id, position_id, position_locked, token_supply_locked,
       latest_block_number, latest_transaction_hash, latest_log_index)
      VALUES ($1,$2,'500','800','0','0','500','250','600',false,'POOL_CREATED','200','50',$3,'77',true,'180','105',$4,2)`, [
      context.chainId, token, hash('5'), hash('6'),
    ]);
    await pool.query(`INSERT INTO fee_credits
      (chain_id, transaction_hash, log_index, creditor_address, recipient_address, amount, recipient_balance, total_outstanding, stack_version, block_number)
      VALUES ($1,$2,0,$3,$4,'80','80','80',$5,'101')`, [context.chainId, hash('7'), curve, creator, context.stackVersion]);
    await pool.query(`INSERT INTO fee_claims
      (chain_id, transaction_hash, log_index, recipient_address, amount, remaining_balance, total_outstanding, stack_version, block_number)
      VALUES ($1,$2,0,$3,'30','50','50',$4,'102')`, [context.chainId, hash('8'), creator, context.stackVersion]);
    await insertJournalEvent(pool, {
      transactionHash: txHash,
      logIndex: 4,
      blockNumber: 100n,
      contractAddress: factory,
      contractRole: 'FACTORY',
      eventName: 'LaunchCreated',
      tokenAddress: token,
      curveAddress: curve,
    });
    await insertJournalEvent(pool, {
      transactionHash: hash('7'),
      logIndex: 0,
      blockNumber: 101n,
      contractAddress: feeEscrow,
      contractRole: 'FEE_ESCROW',
      eventName: 'FeeCredited',
    });
    await insertJournalEvent(pool, {
      transactionHash: hash('8'),
      logIndex: 0,
      blockNumber: 102n,
      contractAddress: feeEscrow,
      contractRole: 'FEE_ESCROW',
      eventName: 'FeeClaimed',
    });
    await pool.query(`INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block, indexed_through_block_hash,
       indexed_through_block_timestamp, decoder_schema_version, status)
      VALUES ($1,$2,$3,'100','105',$4,'1786262405','day6-v1','COMMITTED')`, [context.chainId, context.stackVersion, factory, hash('9')]);

    const report = await (reconcile.reconcileStack as (input: Record<string, unknown>) => Promise<ReconciliationReport>)({
      db,
      context,
      checkedBlock: 105n,
      chain: authoritativeReader(),
    });
    expect(report.status).toBe('PASS');
    expect(report.checks.map((check) => check.id)).toEqual(['REC-01', 'REC-02', 'REC-03', 'REC-04', 'REC-05', 'REC-06']);
    expect(report.checks.every((check) => check.status === 'PASS')).toBe(true);
    expect(report.checks.find((check) => check.id === 'REC-03')?.detail).toContain('surplus=5');
  });

  it('fails closed with typed mismatch rows and never soft-passes missing code hashes or accounting mismatch', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const reconcile = await optionalModule('../../apps/indexer/src/reconcile.ts');
    expect(reconcile.reconcileStack).toBeTypeOf('function');
    const db = dbModule.createBreadDb(pool);

    await pool.query(`INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals, addresses, runtime_code_hashes)
      VALUES ($1,$2,$3,'100',$4,6,$5::jsonb,NULL)`, [context.chainId, context.stackVersion, factory, quoteAsset, JSON.stringify({ factory, feeEscrow })]);
    await pool.query(`INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block, indexed_through_block_hash,
       indexed_through_block_timestamp, decoder_schema_version, status)
      VALUES ($1,$2,$3,'100','105',$4,'1786262405','day6-v1','COMMITTED')`, [context.chainId, context.stackVersion, factory, hash('9')]);

    const report = await (reconcile.reconcileStack as (input: Record<string, unknown>) => Promise<ReconciliationReport>)({
      db,
      context,
      checkedBlock: 105n,
      chain: authoritativeReader({
        scanCanonicalEventIdentities: async () => [],
        readFeeEscrowState: async () => ({ totalOutstanding: 10n, custody: 5n }),
        getRuntimeCodeHash: async () => hash('1'),
        getBlockHash: async () => hash('0'),
      }),
    });
    expect(report.status).toBe('FAIL');
    expect(report.checks).toHaveLength(6);
    expect(report.checks.filter((check) => check.status === 'FAIL').length).toBeGreaterThanOrEqual(3);
    expect(report.checks.find((check) => check.id === 'REC-03')?.status).toBe('FAIL');
    expect(report.checks.find((check) => check.id === 'REC-05')?.status).toBe('FAIL');
    expect(report.checks.find((check) => check.id === 'REC-06')?.status).toBe('FAIL');
  });
});