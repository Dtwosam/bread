import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address, DecodedBreadEvent, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as {
  Pool: new (config: Record<string, unknown>) => {
    query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
};

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;
const txHash = `0x${'ab'.repeat(32)}` as const;
const blockHash = `0x${'cd'.repeat(32)}` as Hex32;
const topic0 = `0x${'ef'.repeat(32)}` as Hex32;
const token = address('1');
const curve = address('2');
const factory = address('3');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task3-test-stack',
  factoryAddress: factory,
  quoteAsset: address('4'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('5'),
    feePolicy: address('6'),
    feeEscrow: address('7'),
    emergencyController: address('8'),
    locker: address('9'),
    coordinator: address('a'),
    graduationAdapter: address('b'),
  },
};

const launchEvent: DecodedBreadEvent = {
  identity: { chainId: context.chainId, transactionHash: txHash, logIndex: 7 },
  blockNumber: 100n,
  blockHash,
  blockTimestamp: 1_786_262_400n,
  transactionIndex: 3,
  contractAddress: factory,
  contractRole: 'FACTORY',
  stackVersion: context.stackVersion,
  topic0,
  topics: [topic0],
  data: '0x',
  eventName: 'LaunchCreated',
  payload: {
    deployer: address('c'),
    token,
    curve,
    creatorFeeRecipient: address('d'),
    creatorTaxBps: 100n,
    economicsDigest: `0x${'11'.repeat(32)}`,
    configVersion: 1n,
  },
};

type TestPool = InstanceType<typeof Pool>;

function count(rows: unknown[]): number {
  const row = rows[0] as { count?: string | number } | undefined;
  return Number(row?.count ?? 0);
}

describe.skipIf(!RUN_DB)('Day 6 Task 3 PostgreSQL journal/projection boundary', () => {
  const schemaName = `day6_task3_${process.pid}`;
  let adminPool: TestPool;
  let pool: TestPool;

  beforeAll(async () => {
    const connectionString =
      process.env.BREAD_DATABASE_URL ?? 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread';
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
    const dbModule = await import('../../packages/db/src/index.ts');
    const migrateBreadDb = (dbModule as Record<string, unknown>).migrateBreadDb as
      | ((pool: TestPool) => Promise<void>)
      | undefined;
    if (migrateBreadDb) {
      await migrateBreadDb(pool);
      await pool.query('TRUNCATE event_journal, launches, indexer_checkpoints CASCADE');
    }
  });

  it('exports every required Day-6 table family and a repeatable migration command', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    for (const name of [
      'eventJournal',
      'protocolStacks',
      'launches',
      'launchState',
      'trades',
      'feeCredits',
      'feeClaims',
      'creatorRollups',
      'holderSnapshots',
      'marketCandles',
      'tokenMetrics',
      'indexerCheckpoints',
      'adminEvents',
      'metadata',
    ]) {
      expect(dbModule, name).toHaveProperty(name);
    }
    expect(dbModule).toHaveProperty('createBreadDb');
    expect(dbModule).toHaveProperty('migrateBreadDb');
    expect(dbModule).toHaveProperty('IndexerRepository');
    expect(dbModule).toHaveProperty('ReadRepository');

    const migrateBreadDb = (dbModule as Record<string, unknown>).migrateBreadDb as
      | ((pool: TestPool) => Promise<void>)
      | undefined;
    expect(migrateBreadDb).toBeTypeOf('function');
    await migrateBreadDb?.(pool);
    await migrateBreadDb?.(pool);

    const tableResult = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [schemaName],
    );
    const names = tableResult.rows.map((row) => (row as { table_name: string }).table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'event_journal',
        'protocol_stacks',
        'launches',
        'launch_state',
        'trades',
        'fee_credits',
        'fee_claims',
        'creator_rollups',
        'holder_snapshots',
        'market_candles',
        'token_metrics',
        'indexer_checkpoints',
        'admin_events',
        'metadata',
      ]),
    );
  });

  it('deduplicates canonical journal identity and applies projection reducers only once', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const createBreadDb = (dbModule as Record<string, unknown>).createBreadDb as ((pool: TestPool) => unknown) | undefined;
    const IndexerRepository = (dbModule as Record<string, unknown>).IndexerRepository as
      | (new (db: unknown, reducers: readonly ((tx: unknown, event: DecodedBreadEvent) => Promise<void>)[]) => {
          applyCanonicalRange: (input: Record<string, unknown>) => Promise<{ insertedEventIds: readonly string[]; checkpointBlock: bigint }>;
        })
      | undefined;
    const launches = (dbModule as Record<string, unknown>).launches as unknown;

    expect(createBreadDb).toBeTypeOf('function');
    expect(IndexerRepository).toBeTypeOf('function');
    expect(launches).toBeDefined();

    let reducerCalls = 0;
    const reducer = async (tx: unknown, event: DecodedBreadEvent) => {
      reducerCalls += 1;
      const writer = tx as { insert: (table: unknown) => { values: (value: Record<string, unknown>) => Promise<unknown> } };
      if (event.eventName !== 'LaunchCreated') return;
      await writer.insert(launches).values({
        chainId: context.chainId,
        tokenAddress: event.payload.token,
        curveAddress: event.payload.curve,
        stackVersion: context.stackVersion,
        factoryAddress: factory,
        launchBlockNumber: event.blockNumber.toString(),
        launchTransactionHash: event.identity.transactionHash,
        launchLogIndex: event.identity.logIndex,
      });
    };

    const db = createBreadDb?.(pool);
    const repo = IndexerRepository && new IndexerRepository(db, [reducer]);
    const range = {
      context,
      fromBlock: 100n,
      toBlock: 100n,
      toBlockHash: blockHash,
      events: [launchEvent],
    };

    const first = await repo?.applyCanonicalRange(range);
    const second = await repo?.applyCanonicalRange(range);

    expect(first?.insertedEventIds).toHaveLength(1);
    expect(second?.insertedEventIds).toHaveLength(0);
    expect(reducerCalls).toBe(1);
    expect(count((await pool.query('SELECT count(*) FROM event_journal')).rows)).toBe(1);
    expect(count((await pool.query('SELECT count(*) FROM launches')).rows)).toBe(1);
    expect(count((await pool.query('SELECT count(*) FROM indexer_checkpoints')).rows)).toBe(1);
  });

  it('rolls back journal, projection and checkpoint together when a reducer fails', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const createBreadDb = (dbModule as Record<string, unknown>).createBreadDb as ((pool: TestPool) => unknown) | undefined;
    const IndexerRepository = (dbModule as Record<string, unknown>).IndexerRepository as
      | (new (db: unknown, reducers: readonly ((tx: unknown, event: DecodedBreadEvent) => Promise<void>)[]) => {
          applyCanonicalRange: (input: Record<string, unknown>) => Promise<unknown>;
        })
      | undefined;
    const launches = (dbModule as Record<string, unknown>).launches as unknown;

    const reducer = async (tx: unknown, event: DecodedBreadEvent) => {
      const writer = tx as { insert: (table: unknown) => { values: (value: Record<string, unknown>) => Promise<unknown> } };
      if (event.eventName === 'LaunchCreated') {
        await writer.insert(launches).values({
          chainId: context.chainId,
          tokenAddress: event.payload.token,
          curveAddress: event.payload.curve,
          stackVersion: context.stackVersion,
          factoryAddress: factory,
          launchBlockNumber: event.blockNumber.toString(),
          launchTransactionHash: event.identity.transactionHash,
          launchLogIndex: event.identity.logIndex,
        });
      }
      throw new Error('intentional reducer failure');
    };

    const db = createBreadDb?.(pool);
    const repo = IndexerRepository && new IndexerRepository(db, [reducer]);

    await expect(
      repo?.applyCanonicalRange({
        context,
        fromBlock: 100n,
        toBlock: 100n,
        toBlockHash: blockHash,
        events: [launchEvent],
      }),
    ).rejects.toThrow('intentional reducer failure');

    expect(count((await pool.query('SELECT count(*) FROM event_journal')).rows)).toBe(0);
    expect(count((await pool.query('SELECT count(*) FROM launches')).rows)).toBe(0);
    expect(count((await pool.query('SELECT count(*) FROM indexer_checkpoints')).rows)).toBe(0);
  });

  it('rejects a non-contiguous forward gap before checkpoint advancement', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const createBreadDb = (dbModule as Record<string, unknown>).createBreadDb as ((pool: TestPool) => unknown) | undefined;
    const IndexerRepository = (dbModule as Record<string, unknown>).IndexerRepository as
      | (new (db: unknown) => { applyCanonicalRange: (input: Record<string, unknown>) => Promise<unknown> })
      | undefined;
    const db = createBreadDb?.(pool);
    const repo = IndexerRepository && new IndexerRepository(db);

    await expect(
      repo?.applyCanonicalRange({
        context,
        fromBlock: 101n,
        toBlock: 101n,
        toBlockHash: blockHash,
        events: [],
      }),
    ).rejects.toThrow(/deploymentStartBlock|contiguous|gap/i);

    expect(count((await pool.query('SELECT count(*) FROM indexer_checkpoints')).rows)).toBe(0);
  });
});
