import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

import { createBreadApi } from '../../apps/api/src/server.js';
import { BoundedRealtimeFanout } from '../../apps/indexer/src/fanout.js';
import {
  createBreadDb,
  migrateBreadDb,
  type BreadPgPool,
} from '../../packages/db/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'day8-load-test-only',
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

const HOT_TOKEN = address(10);
const HOT_CURVE = address(20);
const schemaName = `day8_load_${process.pid}`;
const databaseUrl = process.env.BREAD_DATABASE_URL ?? 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread';
const redisUrl = process.env.BREAD_REDIS_URL ?? 'redis://127.0.0.1:6379';
const tokenConcurrency = Number(process.env.BREAD_DAY8_TOKEN_CONCURRENCY ?? '10000');
const tokenRequests = Number(process.env.BREAD_DAY8_TOKEN_REQUESTS ?? String(tokenConcurrency));
const feedConcurrency = Number(process.env.BREAD_DAY8_FEED_CONCURRENCY ?? '1000');
const feedRequests = Number(process.env.BREAD_DAY8_FEED_REQUESTS ?? '5000');

for (const [label, value, max] of [
  ['BREAD_DAY8_TOKEN_CONCURRENCY', tokenConcurrency, 10_000],
  ['BREAD_DAY8_TOKEN_REQUESTS', tokenRequests, 100_000],
  ['BREAD_DAY8_FEED_CONCURRENCY', feedConcurrency, 10_000],
  ['BREAD_DAY8_FEED_REQUESTS', feedRequests, 100_000],
] as const) {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${label} must be an integer between 1 and ${max}`);
  }
}

const requireDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireDb('pg') as {
  Pool: new (config: Record<string, unknown>) => BreadPgPool & { end(): Promise<void> };
};
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { createClient } = requireApi('redis') as {
  createClient: (input: { url: string }) => {
    connect(): Promise<void>;
    quit(): Promise<void>;
    flushDb(): Promise<unknown>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
    incr(key: string): Promise<number>;
    eval(script: string, input: { keys: readonly string[]; arguments: readonly string[] }): Promise<unknown>;
    pExpire(key: string, ms: number): Promise<unknown>;
  };
};

type LoadResult = Readonly<{
  name: string;
  concurrency: number;
  requests: number;
  ok: number;
  failed: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  durationMs: number;
}>;

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index] ?? 0;
}

async function runHttpLoad(input: Readonly<{
  name: string;
  url: string;
  concurrency: number;
  requests: number;
}>): Promise<LoadResult> {
  let next = 0;
  let ok = 0;
  let failed = 0;
  const latencies: number[] = [];
  const startedAll = performance.now();

  async function worker() {
    while (true) {
      const id = next++;
      if (id >= input.requests) return;
      const started = performance.now();
      try {
        const response = await fetch(input.url, {
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        await response.arrayBuffer();
        const elapsed = performance.now() - started;
        latencies.push(elapsed);
        if (response.ok) ok += 1;
        else failed += 1;
      } catch {
        latencies.push(performance.now() - started);
        failed += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(input.concurrency, input.requests) }, () => worker()),
  );
  const durationMs = performance.now() - startedAll;
  latencies.sort((left, right) => left - right);
  return {
    name: input.name,
    concurrency: input.concurrency,
    requests: input.requests,
    ok,
    failed,
    errorRate: input.requests === 0 ? 0 : failed / input.requests,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    maxMs: latencies.at(-1) ?? 0,
    durationMs,
  };
}

async function seed(pool: BreadPgPool): Promise<void> {
  await migrateBreadDb(pool);
  await pool.query(`TRUNCATE
    event_journal, admin_events, holder_snapshots, creator_rollups, fee_claims, fee_credits,
    market_candles, token_metrics, trades, launch_state, metadata, launches, indexer_checkpoints,
    protocol_stacks CASCADE`);
  await pool.query(
    `INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals, addresses)
     VALUES ($1,$2,$3,'100',$4,6,'{}'::jsonb)`,
    [context.chainId, context.stackVersion, context.factoryAddress, context.quoteAsset],
  );
  await pool.query(
    `INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block,
       indexed_through_block_hash, indexed_through_block_timestamp, decoder_schema_version, status)
     VALUES ($1,$2,$3,'100','120',$4,'1786262400','day6-v1','COMMITTED')`,
    [context.chainId, context.stackVersion, context.factoryAddress, hash(120)],
  );
  await pool.query(
    `INSERT INTO launches
      (chain_id, token_address, curve_address, stack_version, factory_address, deployer_address,
       creator_fee_recipient, launch_timestamp, name, symbol, initial_supply, launch_block_number,
       launch_transaction_hash, launch_log_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'1786262400','Hot Bread','HOT','1000000','120',$8,1)`,
    [
      context.chainId,
      HOT_TOKEN,
      HOT_CURVE,
      context.stackVersion,
      context.factoryAddress,
      address(30),
      address(31),
      hash(120),
    ],
  );
}

const adminPool = new Pool({ connectionString: databaseUrl });
let pool: (BreadPgPool & { end(): Promise<void> }) | undefined;
let redis: ReturnType<typeof createClient> | undefined;
let app: ReturnType<typeof createBreadApi> | undefined;

try {
  await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
  await seed(pool);

  redis = createClient({ url: redisUrl });
  await redis.connect();
  await redis.flushDb();

  let observedHeadReads = 0;
  app = createBreadApi({
    db: createBreadDb(pool),
    context,
    observedHeadBlock: async () => {
      observedHeadReads += 1;
      return 120n;
    },
    redis,
    capacity: {
      dbMaxActive: 16,
      dbMaxQueued: 64,
      dbQueueTimeoutMs: 250,
    },
    rateLimits: {
      feed: { maxRequests: 100_000, windowMs: 10_000 },
      search: { maxRequests: 100_000, windowMs: 10_000 },
    },
  });

  const origin = await app.listen({ port: 0, host: '127.0.0.1' });
  const tokenUrl = `${origin}/v1/tokens/${HOT_TOKEN}`;
  const feedUrl = `${origin}/v1/feed?view=new&limit=1`;

  const tokenWarm = await fetch(tokenUrl);
  if (!tokenWarm.ok) throw new Error(`token warmup failed with ${tokenWarm.status}`);
  await tokenWarm.arrayBuffer();
  const feedWarm = await fetch(feedUrl);
  if (!feedWarm.ok) throw new Error(`feed warmup failed with ${feedWarm.status}`);
  await feedWarm.arrayBuffer();
  const observedHeadReadsAfterWarm = observedHeadReads;

  const token = await runHttpLoad({
    name: 'hot-token-10k',
    url: tokenUrl,
    concurrency: tokenConcurrency,
    requests: tokenRequests,
  });
  const headReadsAfterToken = observedHeadReads;

  const feed = await runHttpLoad({
    name: 'cached-feed',
    url: feedUrl,
    concurrency: feedConcurrency,
    requests: feedRequests,
  });
  const headReadsAfterFeed = observedHeadReads;

  const fanout = new BoundedRealtimeFanout<{ channel: string; sequence: number }>({
    maxPendingPerSubscriber: 2,
    maxSubscribers: 10_000,
  });
  let deliveries = 0;
  for (let i = 0; i < 10_000; i += 1) {
    fanout.subscribe('token:hot', async () => {
      deliveries += 1;
    });
  }
  const fanoutStarted = performance.now();
  await fanout.publish({ channel: 'token:hot', sequence: 1 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const fanoutMs = performance.now() - fanoutStarted;
  const fanoutSnapshot = fanout.snapshot();

  const report = {
    schemaVersion: 1,
    environment: 'github-hosted-runner-local-postgres-redis-fastify',
    token,
    feed,
    observedHeadReads: {
      afterWarm: observedHeadReadsAfterWarm,
      afterToken: headReadsAfterToken,
      afterFeed: headReadsAfterFeed,
      tokenLoadDelta: headReadsAfterToken - observedHeadReadsAfterWarm,
      feedLoadDelta: headReadsAfterFeed - headReadsAfterToken,
    },
    realtime: {
      subscribers: fanoutSnapshot.subscribers,
      deliveries,
      publishMs: fanoutMs,
      slowConsumerDrops: fanoutSnapshot.slowConsumerDrops,
      maxObservedPending: fanoutSnapshot.maxObservedPending,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const failures: string[] = [];
  if (token.concurrency < 10_000 || token.requests < 10_000) failures.push('hot token did not exercise at least 10,000 concurrent/read-active requests');
  if (token.errorRate >= 0.01) failures.push(`hot-token healthy-read error rate ${token.errorRate} >= 0.01`);
  if (token.p95Ms > 350) failures.push(`hot-token p95 ${token.p95Ms.toFixed(2)}ms > 350ms`);
  if (feed.errorRate >= 0.01) failures.push(`cached-feed healthy-read error rate ${feed.errorRate} >= 0.01`);
  if (feed.p95Ms > 250) failures.push(`cached-feed p95 ${feed.p95Ms.toFixed(2)}ms > 250ms`);
  if (headReadsAfterToken - observedHeadReadsAfterWarm > 1) failures.push('hot-token viewers multiplied observed-head source reads');
  if (headReadsAfterFeed - headReadsAfterToken > 1) failures.push('cached-feed viewers multiplied observed-head source reads');
  if (deliveries !== 10_000) failures.push(`realtime delivered ${deliveries}/10000`);
  if (fanoutMs > 1_000) failures.push(`10k realtime publish ${fanoutMs.toFixed(2)}ms > 1000ms`);
  if (fanoutSnapshot.slowConsumerDrops !== 0) failures.push('fast 10k realtime fanout unexpectedly dropped consumers');
  if (fanoutSnapshot.maxObservedPending > 1) failures.push(`fast fanout pending depth ${fanoutSnapshot.maxObservedPending} > 1`);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`DAY8_CAPACITY_FAIL: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('DAY8_HOT_LAUNCH_CAPACITY_PASS');
  }
} finally {
  await app?.close().catch(() => undefined);
  await redis?.quit().catch(() => undefined);
  await pool?.end().catch(() => undefined);
  await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`).catch(() => undefined);
  await adminPool.end().catch(() => undefined);
}
