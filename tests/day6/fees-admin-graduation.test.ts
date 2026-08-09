import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address, DecodedBreadEvent, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address('1');
const token = address('2');
const curve = address('3');
const creator = address('4');
const deployer = address('5');
const adapter = address('6');
const coordinator = address('7');
const locker = address('8');
const protocolRecipient = address('9');
const guardian = address('a');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task6-test-stack',
  factoryAddress: factory,
  quoteAsset: address('b'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('c'),
    feePolicy: address('d'),
    feeEscrow: address('e'),
    emergencyController: address('f'),
    locker,
    coordinator,
    graduationAdapter: adapter,
  },
};

function event<EventName extends DecodedBreadEvent['eventName']>(
  eventName: EventName,
  contractRole: DecodedBreadEvent['contractRole'],
  contractAddress: Address,
  transactionHash: Hex32,
  logIndex: number,
  payload: Extract<DecodedBreadEvent, { eventName: EventName }>['payload'],
  blockNumber = 101n,
  transactionIndex = 1,
): DecodedBreadEvent {
  return {
    identity: { chainId: context.chainId, transactionHash, logIndex },
    blockNumber,
    blockHash: hash('c'),
    blockTimestamp: 1_786_262_461n + blockNumber - 101n,
    transactionIndex,
    contractAddress,
    contractRole,
    stackVersion: context.stackVersion,
    topic0: hash('d'),
    topics: [hash('d')],
    data: '0x',
    eventName,
    payload,
  } as DecodedBreadEvent;
}

describe('Day 6 Task 6 reducer surface', () => {
  it('exposes one canonical fee/admin/graduation reducer factory', async () => {
    const reducers = await import('../../apps/indexer/src/reducers.ts');
    expect((reducers as Record<string, unknown>).createFeeAdminGraduationReducer).toBeTypeOf('function');
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 6 Task 6 fee/admin/graduation authority against PostgreSQL', () => {
  const schemaName = `day6_task6_${process.pid}`;
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
    await pool.query('TRUNCATE event_journal, fee_credits, fee_claims, creator_rollups, admin_events, launch_state, launches, indexer_checkpoints CASCADE');
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        deployer_address, creator_fee_recipient, creator_tax_bps,
        launch_timestamp, quote_asset, initial_supply, phantom_quote,
        graduation_threshold, graduation_coordinator, graduation_adapter,
        reserved_tokens_baseline, launch_block_number, launch_transaction_hash, launch_log_index,
        name, symbol
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'200','1786262400',$8,'1000','100','900',$9,$10,'200','100',$11,4,'Creator Token','CRT')`,
      [context.chainId, token, curve, context.stackVersion, factory, deployer, creator, context.quoteAsset, coordinator, adapter, hash('1')],
    );
    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'100','100',$4,'1786262400','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory, hash('0')],
    );
  });

  async function task6Reducer() {
    const reducers = await import('../../apps/indexer/src/reducers.ts');
    const factoryFn = (reducers as Record<string, unknown>).createFeeAdminGraduationReducer;
    if (typeof factoryFn !== 'function') throw new Error('createFeeAdminGraduationReducer is not implemented');
    return (factoryFn as (input: { context: ProtocolContext }) => (tx: unknown, ev: DecodedBreadEvent) => Promise<void>)({ context });
  }

  async function apply(events: readonly DecodedBreadEvent[]) {
    const dbModule = await import('../../packages/db/src/index.ts');
    const db = dbModule.createBreadDb(pool);
    const reducer = await task6Reducer();
    await db.transaction(async (tx) => {
      for (const canonical of events) await reducer(tx, canonical);
    });
    return db;
  }

  it('creates entitlement only from FeeEscrow and never duplicates upstream fee/dust context', async () => {
    const tx = hash('a');
    await apply([
      event('FeesSwept', 'CURVE', curve, tx, 1, { protocolAmount: 20n, creatorAmount: 80n, creatorTaxAmount: 0n }),
      event('LaunchFeeCredited', 'FACTORY', factory, tx, 2, { token, protocolRecipient, amount: 20n }),
      event('GraduationUsdcDustCredited', 'GRADUATION_COORDINATOR', coordinator, tx, 3, { token, recipient: creator, amount: 5n }),
      event('FeeCredited', 'FEE_ESCROW', context.addresses.feeEscrow, tx, 4, {
        creditor: curve,
        recipient: creator,
        amount: 80n,
        recipientBalance: 80n,
        totalOutstanding: 80n,
      }),
      event('FeeClaimed', 'FEE_ESCROW', context.addresses.feeEscrow, hash('b'), 0, {
        recipient: creator,
        amount: 30n,
        remainingBalance: 50n,
        totalOutstanding: 50n,
      }, 102n, 0),
    ]);

    const counts = (await pool.query(`SELECT
      (SELECT count(*)::int FROM fee_credits) AS credits,
      (SELECT count(*)::int FROM fee_claims) AS claims,
      (SELECT count(*)::int FROM creator_rollups) AS rollups`)).rows[0];
    expect(counts).toMatchObject({ credits: 1, claims: 1, rollups: 1 });

    const credit = (await pool.query(`SELECT creditor_address, recipient_address, amount::text,
      recipient_balance::text, total_outstanding::text, token_address, attribution_status
      FROM fee_credits`)).rows[0];
    expect(credit).toMatchObject({
      creditor_address: curve,
      recipient_address: creator,
      amount: '80',
      recipient_balance: '80',
      total_outstanding: '80',
      token_address: token,
      attribution_status: 'EXACT_CURVE',
    });

    const claim = (await pool.query(`SELECT recipient_address, amount::text, remaining_balance::text, total_outstanding::text FROM fee_claims`)).rows[0];
    expect(claim).toMatchObject({ recipient_address: creator, amount: '30', remaining_balance: '50', total_outstanding: '50' });

    const rollup = (await pool.query(`SELECT creator_address, token_address, accrued_fees::text, claimed_fees::text FROM creator_rollups`)).rows[0];
    expect(rollup).toMatchObject({ creator_address: creator, token_address: token, accrued_fees: '80', claimed_fees: '0' });
  });

  it('projects graduation phase/lock evidence and records privileged/recovery events in chain order', async () => {
    await apply([
      event('GraduationReady', 'CURVE', curve, hash('c'), 0, { token, curve, coordinator }, 103n, 0),
      event('GraduationAutoAttemptFailed', 'CURVE', curve, hash('c'), 1, { token, reasonHash: hash('1') }, 103n, 0),
      event('CurveGraduationReleased', 'CURVE', curve, hash('d'), 0, {
        coordinator, seedUsdc: 500n, tokenOut: 200n, protocolFeeAmount: 20n, creatorFeeAmount: 10n,
      }, 104n, 0),
      event('GraduationSwept', 'GRADUATION_COORDINATOR', coordinator, hash('d'), 1, {
        token, adapter, usdcAmount: 500n, tokenAmount: 200n, sweptAt: 1_786_262_464n,
      }, 104n, 0),
      event('GraduationCompleted', 'GRADUATION_COORDINATOR', coordinator, hash('e'), 0, {
        token, adapter, poolId: hash('2'), positionManager: address('1'), positionId: 77n,
        usdcUsed: 490n, tokenUsed: 190n, tokenLocked: 180n, usdcDust: 10n,
      }, 105n, 0),
      event('PositionLocked', 'LOCKER', locker, hash('e'), 1, { token, positionManager: address('1'), positionId: 77n }, 105n, 0),
      event('TokenSupplyLocked', 'LOCKER', locker, hash('e'), 2, { token, amount: 180n, totalLocked: 180n }, 105n, 0),
      event('GuardianUpdated', 'EMERGENCY_CONTROLLER', context.addresses.emergencyController, hash('f'), 0, {
        previousGuardian: address('0'), nextGuardian: guardian,
      }, 106n, 0),
      event('GraduationPauseUpdated', 'EMERGENCY_CONTROLLER', context.addresses.emergencyController, hash('f'), 1, {
        actor: guardian, previousPaused: false, nextPaused: true,
      }, 106n, 0),
    ]);

    const state = (await pool.query(`SELECT graduation_phase, graduation_adapter, swept_usdc_amount::text,
      swept_token_amount::text, pool_id, position_manager, position_id::text, usdc_used::text,
      token_used::text, token_locked::text, usdc_dust::text, position_locked, token_supply_locked::text,
      graduation_failure_reason_hash
      FROM launch_state WHERE chain_id=$1 AND token_address=$2`, [context.chainId, token])).rows[0];
    expect(state).toMatchObject({
      graduation_phase: 'POOL_CREATED',
      graduation_adapter: adapter,
      swept_usdc_amount: '500',
      swept_token_amount: '200',
      pool_id: hash('2'),
      position_manager: address('1'),
      position_id: '77',
      usdc_used: '490',
      token_used: '190',
      token_locked: '180',
      usdc_dust: '10',
      position_locked: true,
      token_supply_locked: '180',
      graduation_failure_reason_hash: hash('1'),
    });

    const admin = (await pool.query(`SELECT event_name FROM admin_events ORDER BY block_number, log_index`)).rows.map((row) => row.event_name);
    expect(admin).toEqual(['GuardianUpdated', 'GraduationPauseUpdated']);
  });

  it('serves DB-only creator aggregates with claims kept aggregate rather than assigned to tokens', async () => {
    await apply([
      event('FeeCredited', 'FEE_ESCROW', context.addresses.feeEscrow, hash('a'), 0, {
        creditor: curve, recipient: creator, amount: 80n, recipientBalance: 80n, totalOutstanding: 80n,
      }),
      event('FeeClaimed', 'FEE_ESCROW', context.addresses.feeEscrow, hash('b'), 0, {
        recipient: creator, amount: 30n, remainingBalance: 50n, totalOutstanding: 50n,
      }, 102n, 0),
    ]);

    const dbModule = await import('../../packages/db/src/index.ts');
    const api = await import('../../apps/api/src/server.ts');
    const app = api.createBreadApi({
      db: dbModule.createBreadDb(pool),
      context,
      observedHeadBlock: async () => 102n,
      now: () => new Date('2026-08-09T15:00:00.000Z'),
    });

    const malformed = await app.inject({ method: 'GET', url: '/v1/creators/not-an-address' });
    expect(malformed.statusCode).toBe(400);

    const response = await app.inject({ method: 'GET', url: `/v1/creators/${creator}` });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Record<string, unknown>; meta?: Record<string, unknown> };
    expect(body.data).toMatchObject({
      address: creator,
      createdLaunches: [],
      feeRecipientLaunches: [{ tokenAddress: token, curveAddress: curve }],
      fees: {
        credited: '80',
        claimed: '30',
        indexedClaimable: '50',
        onchainAuthoritative: false,
      },
      perLaunchEarnedRevenue: [{ tokenAddress: token, credited: '80' }],
      unavailable: { buyback: true, vesting: true },
    });
    expect(body.meta?.source).toBe('bread-indexer');

    const deployerResponse = await app.inject({ method: 'GET', url: `/v1/creators/${deployer}` });
    expect(deployerResponse.statusCode).toBe(200);
    const deployerBody = deployerResponse.json() as { data: Record<string, unknown> };
    expect(deployerBody.data).toMatchObject({
      address: deployer,
      createdLaunches: [{ tokenAddress: token, curveAddress: curve }],
      feeRecipientLaunches: [],
    });

    await app.close();
  });
});
