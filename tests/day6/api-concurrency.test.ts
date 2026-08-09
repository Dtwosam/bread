import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import { ReadRepository } from '../../packages/db/src/index.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task9-test-stack',
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

function inMemoryRedis() {
  const state = new Map<string, string>();
  const expiries = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    state,
    get: vi.fn(async (key: string) => state.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, options?: { NX?: boolean; PX?: number }) => {
      if (options?.NX && state.has(key)) return null;
      state.set(key, value);
      if (options?.PX) {
        const prior = expiries.get(key);
        if (prior) clearTimeout(prior);
        expiries.set(key, setTimeout(() => state.delete(key), options.PX));
      }
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(state.get(key) ?? '0') + 1;
      state.set(key, String(next));
      return next;
    }),
    eval: vi.fn(async (_script: string, input: { keys: readonly string[]; arguments: readonly string[] }) => {
      const key = input.keys[0]!;
      if (state.get(key) === input.arguments[0]) {
        state.delete(key);
        return 1;
      }
      return 0;
    }),
    pExpire: vi.fn(async (_key: string, _ms: number) => true),
  };
}

function unavailableRedis() {
  const unavailable = async () => { throw new Error('redis unavailable'); };
  return {
    get: vi.fn(unavailable),
    set: vi.fn(unavailable),
    incr: vi.fn(unavailable),
    eval: vi.fn(unavailable),
    pExpire: vi.fn(unavailable),
  };
}

describe('Day 6 Task 9 public API contract', () => {
  it('adds the eighth required route as a dedicated search module', async () => {
    const module = await optionalModule('../../apps/api/src/routes/search.ts');
    expect(module.registerSearchRoute).toBeTypeOf('function');
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

type TestApp = {
  inject: (input: Readonly<{ method: string; url: string }>) => Promise<{
    statusCode: number;
    json: () => Record<string, unknown>;
  }>;
  close: () => Promise<void>;
};

async function seedReadModel(pool: TestPool) {
  await pool.query(
    `INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals, addresses)
     VALUES ($1,$2,$3,'100',$4,6,'{}'::jsonb)`,
    [context.chainId, context.stackVersion, context.factoryAddress.toLowerCase(), context.quoteAsset.toLowerCase()],
  );
  await pool.query(
    `INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block,
       indexed_through_block_hash, indexed_through_block_timestamp, decoder_schema_version, status)
     VALUES ($1,$2,$3,'100','120',$4,'1786262400','day6-v1','COMMITTED')`,
    [context.chainId, context.stackVersion, context.factoryAddress.toLowerCase(), hash(120)],
  );

  const launches = [
    { token: address(10), curve: address(20), creator: address(30), recipient: address(31), name: 'Bread Alpha', symbol: 'BREAD', block: '120', log: 1 },
    { token: address(11), curve: address(21), creator: address(32), recipient: address(33), name: 'Bread Basket', symbol: 'BRE', block: '119', log: 2 },
    { token: address(12), curve: address(22), creator: address(30), recipient: address(34), name: 'Another Token', symbol: 'ALT', block: '118', log: 3 },
  ];
  for (const row of launches) {
    await pool.query(
      `INSERT INTO launches
        (chain_id, token_address, curve_address, stack_version, factory_address, deployer_address,
         creator_fee_recipient, launch_timestamp, name, symbol, initial_supply, launch_block_number,
         launch_transaction_hash, launch_log_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'1000000',$11,$12,$13)`,
      [
        context.chainId,
        row.token.toLowerCase(),
        row.curve.toLowerCase(),
        context.stackVersion,
        context.factoryAddress.toLowerCase(),
        row.creator.toLowerCase(),
        row.recipient.toLowerCase(),
        String(1_786_262_400 + Number(row.block)),
        row.name,
        row.symbol,
        row.block,
        hash(Number(row.block)),
        row.log,
      ],
    );
  }
}

describe.skipIf(!RUN_DB)('Day 6 Task 9 search isolation and bounded concurrent reads', () => {
  const schemaName = `day6_task9_${process.pid}`;
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
    vi.restoreAllMocks();
    const dbModule = await import('../../packages/db/src/index.ts');
    await dbModule.migrateBreadDb(pool);
    await pool.query(`TRUNCATE
      event_journal, admin_events, holder_snapshots, creator_rollups, fee_claims, fee_credits,
      market_candles, token_metrics, trades, launch_state, metadata, launches, indexer_checkpoints,
      protocol_stacks CASCADE`);
    await seedReadModel(pool);
  });

  async function createApp(redis: ReturnType<typeof inMemoryRedis> | ReturnType<typeof unavailableRedis>, overrides: Record<string, unknown> = {}) {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apiModule = await import('../../apps/api/src/server.ts');
    const createBreadApi = apiModule.createBreadApi as (input: Record<string, unknown>) => TestApp;
    const db = dbModule.createBreadDb(pool);
    return createBreadApi({
      db,
      context,
      observedHeadBlock: async () => 123n,
      now: () => new Date('2026-08-09T18:00:00.000Z'),
      redis,
      capacity: {
        dbMaxActive: 4,
        dbMaxQueued: 8,
        dbQueueTimeoutMs: 250,
      },
      rateLimits: {
        feed: { maxRequests: 50, windowMs: 1_000 },
        search: { maxRequests: 2, windowMs: 1_000 },
      },
      ...overrides,
    });
  }

  it('collapses 100 concurrent identical feed requests to one cache-miss DB load while preserving freshness', async () => {
    const original = ReadRepository.prototype.listNewLaunches;
    const feedLoads = vi.spyOn(ReadRepository.prototype, 'listNewLaunches').mockImplementation(async function (...args) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return original.apply(this, args as never);
    });
    const app = await createApp(inMemoryRedis(), {
      rateLimits: {
        feed: { maxRequests: 200, windowMs: 1_000 },
        search: { maxRequests: 2, windowMs: 1_000 },
      },
    });

    const responses = await Promise.all(
      Array.from({ length: 100 }, () => app.inject({ method: 'GET', url: '/v1/feed?view=new&limit=3' })),
    );
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    expect(feedLoads).toHaveBeenCalledTimes(1);
    for (const response of responses) {
      expect(response.json()).toMatchObject({
        meta: {
          indexedThroughBlock: '120',
          status: 'LAGGING',
        },
      });
    }

    const hit = await app.inject({ method: 'GET', url: '/v1/feed?view=new&limit=3' });
    expect(hit.statusCode).toBe(200);
    expect(hit.json()).toMatchObject({ meta: { cache: 'HIT', indexedThroughBlock: '120' } });
    expect(feedLoads).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('keeps search on an isolated stricter limiter so search abuse cannot exhaust the feed bucket', async () => {
    const app = await createApp(inMemoryRedis());

    const first = await app.inject({ method: 'GET', url: '/v1/search?q=br&limit=10' });
    const second = await app.inject({ method: 'GET', url: '/v1/search?q=br&limit=10' });
    const limited = await app.inject({ method: 'GET', url: '/v1/search?q=br&limit=10' });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'SEARCH_RATE_LIMITED' } });

    const feed = await app.inject({ method: 'GET', url: '/v1/feed?view=new&limit=3' });
    expect(feed.statusCode).toBe(200);
    await app.close();
  });

  it('searches exact contract/creator and normalized ticker/name prefixes with deterministic ranking', async () => {
    const app = await createApp(inMemoryRedis(), {
      rateLimits: {
        feed: { maxRequests: 50, windowMs: 1_000 },
        search: { maxRequests: 50, windowMs: 1_000 },
      },
    });

    const contract = await app.inject({ method: 'GET', url: `/v1/search?q=${address(11)}&limit=10` });
    expect(contract.statusCode).toBe(200);
    expect(contract.json()).toMatchObject({
      data: [expect.objectContaining({ tokenAddress: address(11).toLowerCase() })],
      meta: { source: 'bread-indexer' },
    });

    const creator = await app.inject({ method: 'GET', url: `/v1/search?q=${address(30)}&limit=10` });
    expect(creator.statusCode).toBe(200);
    expect((creator.json().data as Array<Record<string, unknown>>).map((row) => row.tokenAddress)).toEqual([
      address(10).toLowerCase(),
      address(12).toLowerCase(),
    ]);

    const prefix = await app.inject({ method: 'GET', url: '/v1/search?q=br&limit=10' });
    expect(prefix.statusCode).toBe(200);
    const rows = prefix.json().data as Array<Record<string, unknown>>;
    expect(rows.map((row) => row.tokenAddress)).toEqual([address(10).toLowerCase(), address(11).toLowerCase()]);
    expect(rows.every((row) => typeof row.tokenAddress === 'string')).toBe(true);
    await app.close();
  });

  it('bounds Redis-down fallback without a 500 storm and keeps degraded cache/freshness metadata truthful', async () => {
    const original = ReadRepository.prototype.listNewLaunches;
    const feedLoads = vi.spyOn(ReadRepository.prototype, 'listNewLaunches').mockImplementation(async function (...args) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return original.apply(this, args as never);
    });
    const app = await createApp(unavailableRedis(), {
      rateLimits: {
        feed: { maxRequests: 100, windowMs: 1_000 },
        search: { maxRequests: 10, windowMs: 1_000 },
      },
    });

    const responses = await Promise.all(
      Array.from({ length: 40 }, () => app.inject({ method: 'GET', url: '/v1/feed?view=new&limit=3' })),
    );
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    expect(feedLoads).toHaveBeenCalledTimes(1);
    for (const response of responses) {
      expect(response.json()).toMatchObject({
        meta: {
          cache: 'BYPASS',
          status: 'LAGGING',
          indexedThroughBlock: '120',
        },
      });
    }

    const search = await app.inject({ method: 'GET', url: '/v1/search?q=br' });
    expect(search.statusCode).toBe(503);
    expect(search.json()).toMatchObject({ error: { code: 'SEARCH_LIMITER_UNAVAILABLE' } });
    await app.close();
  });

  it('rejects malformed search/address/cursor/limit input before DB work and never uses an RPC client', async () => {
    const searchBefore = (ReadRepository.prototype as unknown as { searchLaunches?: unknown }).searchLaunches;
    const rpcClient = {
      readContract: vi.fn(async () => { throw new Error('API must not call RPC'); }),
      getBlock: vi.fn(async () => { throw new Error('API must not call RPC'); }),
    };
    const app = await createApp(inMemoryRedis(), { rpcClient });
    const queryCountBefore = (await pool.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()`)).rows[0]?.count;

    const tooShort = await app.inject({ method: 'GET', url: '/v1/search?q=a' });
    const overlong = await app.inject({ method: 'GET', url: `/v1/search?q=${'x'.repeat(257)}` });
    const badLimit = await app.inject({ method: 'GET', url: '/v1/search?q=br&limit=9999' });
    const badToken = await app.inject({ method: 'GET', url: '/v1/tokens/not-an-address' });
    const badCursor = await app.inject({ method: 'GET', url: '/v1/feed?view=new&cursor=not-a-cursor' });

    expect([tooShort.statusCode, overlong.statusCode, badLimit.statusCode, badToken.statusCode, badCursor.statusCode]).toEqual([400, 400, 400, 400, 400]);
    expect(rpcClient.readContract).not.toHaveBeenCalled();
    expect(rpcClient.getBlock).not.toHaveBeenCalled();
    expect((ReadRepository.prototype as unknown as { searchLaunches?: unknown }).searchLaunches).toBe(searchBefore);

    const queryCountAfter = (await pool.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()`)).rows[0]?.count;
    expect(queryCountAfter).toBe(queryCountBefore);
    await app.close();
  });
});
