import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  adminEvents,
  type BreadDb,
  type CanonicalIndexedEvent,
  type IndexerProtocolContext,
  type ProjectionReducer,
} from '../../packages/db/src/index.ts';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;

const context: IndexerProtocolContext = {
  chainId: 5_042_002,
  stackVersion: 'task8-test-stack',
  factoryAddress: address(1),
  quoteAsset: address(2),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: { factory: address(1), feeEscrow: address(3) },
};

const event: CanonicalIndexedEvent = {
  identity: { chainId: context.chainId, transactionHash: hash(1), logIndex: 0 },
  blockNumber: 100n,
  blockHash: hash(100),
  blockTimestamp: 1_786_263_000n,
  transactionIndex: 0,
  contractAddress: context.factoryAddress,
  contractRole: 'FACTORY',
  stackVersion: context.stackVersion,
  topic0: hash(2),
  topics: [hash(2)],
  data: '0x',
  eventName: 'OwnershipTransferred',
  payload: { previousOwner: address(4), newOwner: address(5) },
};

async function replayModule() {
  return import('../../apps/indexer/src/replay.ts');
}

async function postCommitModule() {
  return import('../../apps/indexer/src/post-commit.ts');
}

async function cacheModule() {
  return import('../../apps/api/src/cache.ts');
}

describe('Day 6 Task 8 replay/finality/cache/fanout contracts', () => {
  it('exports checkpoint anchor verification and rejects a contradictory committed hash', async () => {
    const module = await replayModule();
    expect(module.verifyCheckpointAnchor).toBeTypeOf('function');

    const getBlockHash = vi.fn(async () => hash(999));
    await expect(
      module.verifyCheckpointAnchor({
        checkpoint: { blockNumber: 120n, blockHash: hash(120) },
        getBlockHash,
      }),
    ).rejects.toMatchObject({ code: 'CHECKPOINT_BLOCK_HASH_MISMATCH' });
    expect(getBlockHash).toHaveBeenCalledWith(120n);
  });

  it('coalesces post-commit invalidation/fanout by logical channel and publishes bounded hints', async () => {
    const module = await postCommitModule();
    expect(module.PostCommitPublisher).toBeTypeOf('function');

    const invalidate = vi.fn(async (_channel: string) => undefined);
    const fanout = vi.fn(async (_message: unknown) => undefined);
    const publisher = new module.PostCommitPublisher({ invalidate, fanout });

    await publisher.publish({
      insertedEventIds: [
        `${context.chainId}:${hash(1)}:0`,
        `${context.chainId}:${hash(2)}:1`,
      ],
      channels: [
        `stack:${context.chainId}:${context.stackVersion}:feed`,
        `token:${context.chainId}:${address(10)}`,
        `token:${context.chainId}:${address(10)}`,
      ],
      checkpoint: { blockNumber: 120n, blockHash: hash(120) },
    });

    expect(invalidate.mock.calls.map(([channel]) => channel).sort()).toEqual([
      `stack:${context.chainId}:${context.stackVersion}:feed`,
      `token:${context.chainId}:${address(10)}`,
    ].sort());
    expect(fanout).toHaveBeenCalledTimes(2);
    for (const [message] of fanout.mock.calls) {
      expect(message).toMatchObject({
        changeKind: 'INVALIDATE',
        checkpointBlock: '120',
        checkpointHash: hash(120),
      });
      expect(JSON.stringify(message).length).toBeLessThan(2048);
    }
  });

  it('uses cache generations and single-flight without making Redis authoritative', async () => {
    const module = await cacheModule();
    expect(module.BreadCache).toBeTypeOf('function');

    const state = new Map<string, string>();
    const redis = {
      get: vi.fn(async (key: string) => state.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        state.set(key, value);
        return 'OK';
      }),
      incr: vi.fn(async (key: string) => {
        const next = Number(state.get(key) ?? '0') + 1;
        state.set(key, String(next));
        return next;
      }),
    };
    const cache = new module.BreadCache({ redis, schemaVersion: 'day6-v1' });
    const load = vi.fn(async () => ({ rows: ['db'], freshnessBlock: '120' }));

    const [left, right] = await Promise.all([
      cache.getOrLoad({ channel: 'feed', key: 'view=new', load }),
      cache.getOrLoad({ channel: 'feed', key: 'view=new', load }),
    ]);
    expect(left).toEqual(right);
    expect(load).toHaveBeenCalledTimes(1);

    await cache.invalidate('feed');
    await cache.getOrLoad({ channel: 'feed', key: 'view=new', load });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 6 Task 8 replay commit boundary against PostgreSQL', () => {
  const schemaName = `day6_task8_${process.pid}`;
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
    await pool.query('TRUNCATE event_journal, admin_events, indexer_checkpoints, protocol_stacks CASCADE');
  });

  it('replays an overlap without duplicate projection effects and never regresses checkpoint', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const replay = await replayModule();
    expect(replay.replayOverlap).toBeTypeOf('function');

    const db = dbModule.createBreadDb(pool);
    const reducer: ProjectionReducer = async (tx, projectedEvent) => {
      const database = tx as BreadDb;
      await database.insert(adminEvents).values({
        chainId: projectedEvent.identity.chainId,
        transactionHash: projectedEvent.identity.transactionHash,
        logIndex: projectedEvent.identity.logIndex,
        contractAddress: projectedEvent.contractAddress,
        eventName: 'TASK8_TEST_PROJECTION',
        actorAddress: null,
        payload: {},
        blockNumber: projectedEvent.blockNumber.toString(10),
        stackVersion: projectedEvent.stackVersion,
      });
    };
    const repository = new dbModule.IndexerRepository(db, [reducer]);

    await repository.applyCanonicalRange({
      context,
      fromBlock: 100n,
      toBlock: 100n,
      toBlockHash: hash(100),
      toBlockTimestamp: event.blockTimestamp,
      events: [event],
    });

    const publish = vi.fn(async (_result: unknown) => undefined);
    const result = await replay.replayOverlap({
      context,
      checkpointBlock: 100n,
      targetBlock: 100n,
      overlapBlocks: 20n,
      loadRange: async (fromBlock: bigint, toBlock: bigint) => ({
        fromBlock,
        toBlock,
        toBlockHash: hash(100),
        toBlockTimestamp: event.blockTimestamp,
        events: [event],
      }),
      applyRange: (range) => repository.applyCanonicalRange({
        context,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
        toBlockHash: String(range.toBlockHash),
        toBlockTimestamp: range.toBlockTimestamp as bigint,
        events: range.events as readonly CanonicalIndexedEvent[],
      }),
      publish,
    });

    expect(result.fromBlock).toBe(100n);
    const journal = await pool.query('SELECT count(*)::int AS count FROM event_journal');
    const projection = await pool.query('SELECT count(*)::int AS count FROM admin_events');
    const checkpoint = await pool.query('SELECT indexed_through_block::text AS block FROM indexer_checkpoints');
    expect(journal.rows[0]?.count).toBe(1);
    expect(projection.rows[0]?.count).toBe(1);
    expect(checkpoint.rows[0]?.block).toBe('100');
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not publish cache/fanout if the DB apply rejects, and publishes only after a successful apply', async () => {
    const replay = await replayModule();
    const publish = vi.fn(async (_result: unknown) => undefined);
    const order: string[] = [];

    await expect(
      replay.replayOverlap({
        context,
        checkpointBlock: 100n,
        targetBlock: 101n,
        overlapBlocks: 5n,
        loadRange: async (fromBlock: bigint, toBlock: bigint) => ({ fromBlock, toBlock, events: [] }),
        applyRange: async () => {
          order.push('apply-start');
          throw new Error('db transaction failed');
        },
        publish: async (result: unknown) => {
          order.push('publish');
          await publish(result);
        },
      }),
    ).rejects.toThrow('db transaction failed');
    expect(publish).not.toHaveBeenCalled();

    order.length = 0;
    await replay.replayOverlap({
      context,
      checkpointBlock: 100n,
      targetBlock: 101n,
      overlapBlocks: 5n,
      loadRange: async (fromBlock: bigint, toBlock: bigint) => ({ fromBlock, toBlock, events: [] }),
      applyRange: async () => {
        order.push('apply');
        return { insertedEventIds: ['event-1'], checkpointBlock: 101n, channels: ['feed'] };
      },
      publish: async (result: unknown) => {
        order.push('publish');
        await publish(result);
      },
    });
    expect(order).toEqual(['apply', 'publish']);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
