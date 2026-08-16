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
const coordinator = address('7');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task6-conformance-stack',
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
    locker: address('8'),
    coordinator,
    graduationAdapter: address('6'),
  },
};

function event<EventName extends DecodedBreadEvent['eventName']>(
  eventName: EventName,
  role: DecodedBreadEvent['contractRole'],
  contractAddress: Address,
  transactionHash: Hex32,
  logIndex: number,
  payload: Extract<DecodedBreadEvent, { eventName: EventName }>['payload'],
): DecodedBreadEvent {
  return {
    identity: { chainId: context.chainId, transactionHash, logIndex },
    blockNumber: 101n,
    blockHash: hash('c'),
    blockTimestamp: 1_786_262_461n,
    transactionIndex: 0,
    contractAddress,
    contractRole: role,
    stackVersion: context.stackVersion,
    topic0: hash('d'),
    topics: [hash('d')],
    data: '0x',
    eventName,
    payload,
  } as DecodedBreadEvent;
}

describe('Day 6 Task 6 typed schema conformance', () => {
  it('exports every Task-6 migration field through the Drizzle schema', async () => {
    const db = await import('../../packages/db/src/index.ts');
    expect(Object.keys(db.feeCredits)).toEqual(expect.arrayContaining(['tokenAddress', 'attributionStatus']));
    expect(Object.keys(db.launchState)).toEqual(expect.arrayContaining([
      'graduationAdapter',
      'sweptUsdcAmount',
      'sweptTokenAmount',
      'sweptAt',
      'graduationFailureReasonHash',
      'graduationReleaseSeedUsdc',
      'graduationReleaseTokenOut',
      'positionManager',
      'positionId',
      'usdcUsed',
      'tokenUsed',
      'tokenLocked',
      'usdcDust',
      'positionLocked',
      'tokenSupplyLocked',
      'rescueRecipient',
      'rescueUsdcAmount',
      'rescueTokenAmount',
    ]));
    expect(Object.keys(db.tokenMetrics)).toEqual(expect.arrayContaining(['graduationProgressBps', 'graduationState']));
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 6 Task 6 contextual attribution and progress', () => {
  const schemaName = `day6_task6_conformance_${process.pid}`;
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
    await pool.query('TRUNCATE event_journal, fee_credits, fee_claims, creator_rollups, admin_events, launch_state, token_metrics, launches, indexer_checkpoints, protocol_stacks CASCADE');
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        creator_fee_recipient, initial_supply, reserved_tokens_baseline, graduation_threshold,
        launch_block_number, launch_transaction_hash, launch_log_index
      ) VALUES ($1,$2,$3,$4,$5,$6,'1000','200','900','100',$7,4)`,
      [context.chainId, token, curve, context.stackVersion, factory, creator, hash('1')],
    );
    await pool.query(
      `INSERT INTO launch_state (
        chain_id, token_address, remaining_sellable_tokens, tracked_sold_inventory,
        real_quote_reserve, updated_at
      ) VALUES ($1,$2,'400','400','450',now())`,
      [context.chainId, token],
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

  it('attributes Factory and coordinator FeeEscrow credits only from exact same-transaction journal context', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const reducers = await import('../../apps/indexer/src/reducers.ts');
    const db = dbModule.createBreadDb(pool);
    const repository = new dbModule.IndexerRepository(db, [reducers.createFeeAdminGraduationReducer({ context })]);
    const txA = hash('a');
    const txB = hash('b');

    await repository.applyCanonicalRange({
      context,
      fromBlock: 101n,
      toBlock: 101n,
      toBlockHash: hash('c'),
      toBlockTimestamp: 1_786_262_461n,
      events: [
        event('LaunchFeeCredited', 'FACTORY', factory, txA, 0, { token, protocolRecipient: creator, amount: 20n }),
        event('FeeCredited', 'FEE_ESCROW', context.addresses.feeEscrow, txA, 1, {
          creditor: factory, recipient: creator, amount: 20n, recipientBalance: 20n, totalOutstanding: 20n,
        }),
        event('GraduationUsdcDustCredited', 'GRADUATION_COORDINATOR', coordinator, txB, 0, { token, recipient: creator, amount: 5n }),
        event('FeeCredited', 'FEE_ESCROW', context.addresses.feeEscrow, txB, 1, {
          creditor: coordinator, recipient: creator, amount: 5n, recipientBalance: 25n, totalOutstanding: 25n,
        }),
      ],
    });

    const credits = (await pool.query(`SELECT token_address, attribution_status, amount::text FROM fee_credits`)).rows
      .sort((left, right) => String(left.attribution_status).localeCompare(String(right.attribution_status)));
    expect(credits).toEqual([
      { token_address: token, attribution_status: 'EXACT_FACTORY_CONTEXT', amount: '20' },
      { token_address: token, attribution_status: 'EXACT_GRADUATION_CONTEXT', amount: '5' },
    ]);
  });

  it('derives graduation progress in bps from real quote reserve over the snapshotted threshold without floats', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const reducers = await import('../../apps/indexer/src/reducers.ts');
    const db = dbModule.createBreadDb(pool);
    const reducer = reducers.createFeeAdminGraduationReducer({ context });
    await db.transaction(async (tx) => {
      await reducer(tx, event('CurveBuy', 'CURVE', curve, hash('a'), 3, {
        buyer: address('9'), recipient: address('9'), quoteIn: 100n, tokensOut: 10n, fee: 1n, tax: 0n,
      }));
    });

    const metric = (await pool.query(`SELECT graduation_progress_bps::text, graduation_state FROM token_metrics WHERE chain_id=$1 AND token_address=$2`, [context.chainId, token])).rows[0];
    expect(metric).toEqual({ graduation_progress_bps: '5000', graduation_state: 'CURVE_ACTIVE' });
  });
});
