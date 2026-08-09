import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { BreadCache } from '../../apps/api/src/cache.js';
import { BoundedRealtimeFanout } from '../../apps/indexer/src/fanout.js';
import { PostCommitPublisher } from '../../apps/indexer/src/post-commit.js';
import { replayOverlap } from '../../apps/indexer/src/replay.js';
import { ReadRepository, SearchRepository } from '../../packages/db/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;
const context: ProtocolContext = {
  network: 'arc-testnet', chainId: 5_042_002, stackVersion: 'task9-composition-stack',
  factoryAddress: address(1), quoteAsset: address(2), quoteDecimals: 6, deploymentStartBlock: 100n,
  addresses: {
    factory: address(1), deployer: address(3), feePolicy: address(4), feeEscrow: address(5),
    emergencyController: address(6), locker: address(7), coordinator: address(8), graduationAdapter: address(9),
  },
};

function inMemoryRedis() {
  const state = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => state.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, options?: { NX?: boolean }) => {
      if (options?.NX && state.has(key)) return null;
      state.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(state.get(key) ?? '0') + 1;
      state.set(key, String(next));
      return next;
    }),
    eval: vi.fn(async (_script: string, input: { keys: readonly string[]; arguments: readonly string[] }) => {
      const key = input.keys[0]!;
      if (state.get(key) === input.arguments[0]) { state.delete(key); return 1; }
      return 0;
    }),
    pExpire: vi.fn(async () => true),
  };
}

describe('Day 6 Task 9 replay/cache/fanout composition', () => {
  it('invalidates after replay commit and drops a slow consumer without unbounded pending delivery', async () => {
    const redis = inMemoryRedis();
    const cache = new BreadCache({ redis, schemaVersion: 'day6-v1' });
    const channel = `token:${context.chainId}:${address(10)}`;
    let loads = 0;
    const load = async () => ({ revision: ++loads });
    await cache.getOrLoad({ channel, key: 'token', load });

    const fanout = new BoundedRealtimeFanout({ maxPendingPerSubscriber: 1 });
    let releaseSlow!: () => void;
    const slow = new Promise<void>((resolve) => { releaseSlow = resolve; });
    let fastDeliveries = 0;
    fanout.subscribe(channel, async () => slow);
    fanout.subscribe(channel, async () => { fastDeliveries += 1; });

    const publisher = new PostCommitPublisher({
      invalidate: (logicalChannel) => cache.invalidate(logicalChannel),
      fanout: (message) => fanout.publish(message),
    });
    const applyResults = [
      { insertedEventIds: [] as string[], checkpointBlock: 100n, channels: [channel] },
      { insertedEventIds: [`${context.chainId}:${hash(1)}:0`], checkpointBlock: 101n, channels: [channel] },
      { insertedEventIds: [`${context.chainId}:${hash(2)}:0`], checkpointBlock: 102n, channels: [channel] },
    ];

    for (const [index, applyResult] of applyResults.entries()) {
      const blockNumber = 100n + BigInt(index);
      const blockHash = hash(100 + index);
      await replayOverlap({
        context,
        checkpoint: { blockNumber, blockHash },
        getBlockHash: async () => blockHash,
        targetBlock: blockNumber,
        overlapBlocks: 1n,
        loadRange: async (fromBlock, toBlock) => ({ fromBlock, toBlock }),
        applyRange: async () => applyResult,
        publish: async (result) => publisher.publish({
          insertedEventIds: result.insertedEventIds ?? [],
          channels: result.channels as string[],
          checkpoint: { blockNumber: result.checkpointBlock as bigint, blockHash },
        }),
      });
    }

    const refreshed = await cache.getOrLoad({ channel, key: 'token', load });
    expect(refreshed.value).toEqual({ revision: 2 });
    expect(loads).toBe(2);
    expect(fastDeliveries).toBe(2);
    const snapshot = fanout.snapshot();
    expect(snapshot.slowConsumerDrops).toBeGreaterThanOrEqual(1);
    expect(snapshot.maxObservedPending).toBeLessThanOrEqual(1);
    releaseSlow();
  });
});

type TestPool = { query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>; end: () => Promise<void> };
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };
type TestApp = { inject: (input: Readonly<{ method: string; url: string }>) => Promise<{ statusCode: number }>; close: () => Promise<void> };

describe.skipIf(!RUN_DB)('Day 6 Task 9 hot token and DB backpressure proof', () => {
  const schemaName = `day6_task9_composition_${process.pid}`;
  const token = address(10);
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
    vi.restoreAllMocks();
    const dbModule = await import('../../packages/db/src/index.ts');
    await dbModule.migrateBreadDb(pool);
    await pool.query(`TRUNCATE event_journal, admin_events, holder_snapshots, creator_rollups, fee_claims, fee_credits,
      market_candles, token_metrics, trades, launch_state, metadata, launches, indexer_checkpoints, protocol_stacks CASCADE`);
    await pool.query(
      `INSERT INTO protocol_stacks (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals, addresses)
       VALUES ($1,$2,$3,'100',$4,6,'{}'::jsonb)`,
      [context.chainId, context.stackVersion, context.factoryAddress, context.quoteAsset],
    );
    await pool.query(
      `INSERT INTO indexer_checkpoints (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block,
       indexed_through_block_hash, indexed_through_block_timestamp, decoder_schema_version, status)
       VALUES ($1,$2,$3,'100','120',$4,'1786262400','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, context.factoryAddress, hash(120)],
    );
    await pool.query(
      `INSERT INTO launches (chain_id, token_address, curve_address, stack_version, factory_address, deployer_address,
       creator_fee_recipient, launch_timestamp, name, symbol, initial_supply, launch_block_number, launch_transaction_hash, launch_log_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'1786262400','Hot Bread','HOT','1000000','120',$8,1)`,
      [context.chainId, token, address(20), context.stackVersion, context.factoryAddress, address(30), address(31), hash(120)],
    );
  });

  async function createApp(capacity = { dbMaxActive: 4, dbMaxQueued: 8, dbQueueTimeoutMs: 250 }) {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apiModule = await import('../../apps/api/src/server.ts');
    return apiModule.createBreadApi({
      db: dbModule.createBreadDb(pool), context, observedHeadBlock: async () => 120n,
      now: () => new Date('2026-08-09T18:00:00.000Z'), redis: inMemoryRedis(), capacity,
      rateLimits: { feed: { maxRequests: 500, windowMs: 1_000 }, search: { maxRequests: 500, windowMs: 1_000 } },
    }) as TestApp;
  }

  it('collapses a hot-token stampede to one indexed launch load', async () => {
    const original = ReadRepository.prototype.getLaunch;
    const loads = vi.spyOn(ReadRepository.prototype, 'getLaunch').mockImplementation(async function (...args) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return original.apply(this, args as never);
    });
    const server = await createApp();
    const responses = await Promise.all(Array.from({ length: 50 }, () => server.inject({ method: 'GET', url: `/v1/tokens/${token}` })));
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    expect(loads).toHaveBeenCalledTimes(1);
    await server.close();
  });

  it('bounds DB/search overload instead of allowing an unbounded queue', async () => {
    const original = SearchRepository.prototype.searchLaunches;
    vi.spyOn(SearchRepository.prototype, 'searchLaunches').mockImplementation(async function (...args) {
      await new Promise((resolve) => setTimeout(resolve, 75));
      return original.apply(this, args as never);
    });
    const server = await createApp({ dbMaxActive: 2, dbMaxQueued: 2, dbQueueTimeoutMs: 200 });
    const responses = await Promise.all(Array.from({ length: 20 }, () => server.inject({ method: 'GET', url: '/v1/search?q=ho&limit=10' })));
    const statuses = responses.map((response) => response.statusCode);
    expect(statuses.every((status) => status === 200 || status === 503)).toBe(true);
    expect(statuses.filter((status) => status === 503).length).toBeGreaterThan(0);
    expect(statuses.filter((status) => status === 200).length).toBeLessThanOrEqual(4);
    await server.close();
  });
});
