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

type FakeRedisSetOptions = Readonly<{ NX?: boolean; PX?: number }>;

type FakeRedis = Readonly<{
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  eval: ReturnType<typeof vi.fn>;
}>;

function createFakeRedis(): Readonly<{ redis: FakeRedis; state: Map<string, string> }> {
  const state = new Map<string, string>();
  const redis: FakeRedis = {
    get: vi.fn(async (key: string) => state.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, options?: FakeRedisSetOptions) => {
      if (options?.NX && state.has(key)) return null;
      state.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(state.get(key) ?? '0') + 1;
      state.set(key, String(next));
      return next;
    }),
    eval: vi.fn(async (_script: string, input: Readonly<{ keys: readonly string[]; arguments: readonly string[] }>) => {
      const key = input.keys[0];
      const token = input.arguments[0];
      if (key && token && state.get(key) === token) {
        state.delete(key);
        return 1;
      }
      return 0;
    }),
  };
  return { redis, state };
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

  it('coalesces post-commit invalidation/fanout by logical channel and publishes bounded causal hints', async () => {
    const module = await postCommitModule();
    expect(module.PostCommitPublisher).toBeTypeOf('function');

    const invalidate = vi.fn(async (_channel: string) => undefined);
    const fanout = vi.fn(async (_message: unknown) => undefined);
    const publisher = new module.PostCommitPublisher({ invalidate, fanout });
    const feedChannel = `stack:${context.chainId}:${context.stackVersion}:feed`;
    const tokenChannel = `token:${context.chainId}:${address(10)}`;
    const lastEventId = `${context.chainId}:${hash(2)}:1`;

    await publisher.publish({
      insertedEventIds: [
        `${context.chainId}:${hash(1)}:0`,
        lastEventId,
      ],
      channels: [feedChannel, tokenChannel, tokenChannel],
      checkpoint: { blockNumber: 120n, blockHash: hash(120) },
    });

    expect(invalidate.mock.calls.map(([channel]) => channel).sort()).toEqual([
      feedChannel,
      tokenChannel,
    ].sort());
    expect(fanout).toHaveBeenCalledTimes(2);
    expect(fanout).toHaveBeenCalledWith(expect.objectContaining({
      channel: feedChannel,
      changeKind: 'INVALIDATE',
      changeDomain: 'feed',
      affectedIdentity: `${context.chainId}:${context.stackVersion}`,
      eventId: lastEventId,
      checkpointBlock: '120',
      checkpointHash: hash(120),
    }));
    expect(fanout).toHaveBeenCalledWith(expect.objectContaining({
      channel: tokenChannel,
      changeKind: 'INVALIDATE',
      changeDomain: 'token',
      affectedIdentity: address(10),
      eventId: lastEventId,
      checkpointBlock: '120',
      checkpointHash: hash(120),
    }));
    for (const [message] of fanout.mock.calls) {
      expect(JSON.stringify(message).length).toBeLessThan(2048);
    }
  });

  it('surfaces post-commit invalidation/fanout failure as degraded instead of reporting publication success', async () => {
    const module = await postCommitModule();
    const fanout = vi.fn(async (_message: unknown) => undefined);
    const publisher = new module.PostCommitPublisher({
      invalidate: vi.fn(async () => {
        throw new Error('redis unavailable');
      }),
      fanout,
    });

    await expect(publisher.publish({
      insertedEventIds: [`${context.chainId}:${hash(1)}:0`],
      channels: [`token:${context.chainId}:${address(10)}`],
      checkpoint: { blockNumber: 120n, blockHash: hash(120) },
    })).rejects.toMatchObject({
      code: 'POST_COMMIT_DEGRADED',
      failures: [expect.objectContaining({ operation: 'INVALIDATE' })],
    });
    expect(fanout).toHaveBeenCalledTimes(1);
  });

  it('uses cache generations and process-local single-flight without making Redis authoritative', async () => {
    const module = await cacheModule();
    expect(module.BreadCache).toBeTypeOf('function');

    const { redis } = createFakeRedis();
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

  it('uses Redis cross-instance single-flight and a bounded payload TTL for hot misses', async () => {
    const module = await cacheModule();
    const { redis } = createFakeRedis();
    const cacheA = new module.BreadCache({ redis, schemaVersion: 'day6-v1' });
    const cacheB = new module.BreadCache({ redis, schemaVersion: 'day6-v1' });

    let releaseLoad: (() => void) | undefined;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const load = vi.fn(async () => {
      await loadGate;
      return { rows: ['db'], freshnessBlock: '120' };
    });

    const first = cacheA.getOrLoad({ channel: 'feed', key: 'view=trending', load });
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    const second = cacheB.getOrLoad({ channel: 'feed', key: 'view=trending', load });

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(load).toHaveBeenCalledTimes(1);
    releaseLoad?.();

    const [left, right] = await Promise.all([first, second]);
    expect(left.value).toEqual(right.value);
    expect(load).toHaveBeenCalledTimes(1);

    const lockWrite = redis.set.mock.calls.find(([key, _value, options]) =>
      String(key).startsWith('bread:lock:') && (options as FakeRedisSetOptions | undefined)?.NX === true,
    );
    expect(lockWrite).toBeDefined();
    expect((lockWrite?.[2] as FakeRedisSetOptions | undefined)?.PX).toBeGreaterThan(0);

    const payloadWrite = redis.set.mock.calls.find(([key, _value, options]) =>
      String(key).startsWith('bread:cache:') && typeof (options as FakeRedisSetOptions | undefined)?.PX === 'number',
    );
    expect(payloadWrite).toBeDefined();
    const payloadTtlMs = (payloadWrite?.[2] as FakeRedisSetOptions).PX;
    expect(payloadTtlMs).toBeGreaterThan(0);
    expect(payloadTtlMs).toBeLessThanOrEqual(60_000);
    expect(redis.eval).toHaveBeenCalled();
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

  it('replaying an overlap does not duplicate projections and never regresses checkpoint', async () => {
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
      checkpoint: { blockNumber: 100n, blockHash: hash(100) },
      getBlockHash: vi.fn(async () => hash(100)),
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

  it('verifies the checkpoint anchor before any replay projection rewrite', async () => {
    const replay = await replayModule();
    const loadRange = vi.fn(async (fromBlock: bigint, toBlock: bigint) => ({ fromBlock, toBlock, events: [] }));
    const applyRange = vi.fn(async () => ({ insertedEventIds: ['must-not-apply'] }));
    const publish = vi.fn(async () => undefined);

    await expect(replay.replayOverlap({
      context,
      checkpoint: { blockNumber: 100n, blockHash: hash(100) },
      getBlockHash: vi.fn(async () => hash(999)),
      targetBlock: 101n,
      overlapBlocks: 5n,
      loadRange,
      applyRange,
      publish,
    })).rejects.toMatchObject({ code: 'CHECKPOINT_BLOCK_HASH_MISMATCH' });

    expect(loadRange).not.toHaveBeenCalled();
    expect(applyRange).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not publish cache/fanout if DB apply rejects, publishes after commit, and reports post-commit degradation', async () => {
    const replay = await replayModule();
    const publish = vi.fn(async (_result: unknown) => undefined);
    const order: string[] = [];
    const checkpoint = { blockNumber: 100n, blockHash: hash(100) };
    const getBlockHash = vi.fn(async () => hash(100));

    await expect(
      replay.replayOverlap({
        context,
        checkpoint,
        getBlockHash,
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
    const success = await replay.replayOverlap({
      context,
      checkpoint,
      getBlockHash,
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
    expect(success.postCommit).toBe('PUBLISHED');
    expect(publish).toHaveBeenCalledTimes(1);

    const degraded = await replay.replayOverlap({
      context,
      checkpoint,
      getBlockHash,
      targetBlock: 101n,
      overlapBlocks: 5n,
      loadRange: async (fromBlock: bigint, toBlock: bigint) => ({ fromBlock, toBlock, events: [] }),
      applyRange: async () => ({ insertedEventIds: ['event-2'], checkpointBlock: 101n, channels: ['feed'] }),
      publish: async () => {
        throw new Error('fanout unavailable');
      },
    });
    expect(degraded.postCommit).toBe('DEGRADED');
    expect(degraded.postCommitError).toContain('fanout unavailable');
  });
});
