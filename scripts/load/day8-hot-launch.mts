import { readFileSync } from 'node:fs';
import { Agent, request } from 'node:http';
import { performance } from 'node:perf_hooks';

import { BoundedRealtimeFanout } from '../../apps/indexer/src/fanout.js';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const HOT_TOKEN = address(10);
const origins = (process.env.BREAD_DAY8_ORIGINS ?? 'http://127.0.0.1:3108')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const headReadsFiles = (process.env.BREAD_DAY8_HEAD_READS_FILES ?? '/tmp/bread-day8-head-reads-3108')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const tokenConcurrency = Number(process.env.BREAD_DAY8_TOKEN_CONCURRENCY ?? '10000');
const tokenRequests = Number(process.env.BREAD_DAY8_TOKEN_REQUESTS ?? String(tokenConcurrency));
const feedConcurrency = Number(process.env.BREAD_DAY8_FEED_CONCURRENCY ?? '1000');
const feedRequests = Number(process.env.BREAD_DAY8_FEED_REQUESTS ?? '5000');
const connectConcurrency = Number(process.env.BREAD_DAY8_CONNECT_CONCURRENCY ?? '500');

if (origins.length < 1) throw new Error('at least one Bread API origin is required');
if (headReadsFiles.length !== origins.length) {
  throw new Error('head-read diagnostic file count must match Bread API origin count');
}
for (const [label, value, max] of [
  ['BREAD_DAY8_TOKEN_CONCURRENCY', tokenConcurrency, 10_000],
  ['BREAD_DAY8_TOKEN_REQUESTS', tokenRequests, 100_000],
  ['BREAD_DAY8_FEED_CONCURRENCY', feedConcurrency, 10_000],
  ['BREAD_DAY8_FEED_REQUESTS', feedRequests, 100_000],
  ['BREAD_DAY8_CONNECT_CONCURRENCY', connectConcurrency, 2_000],
] as const) {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${label} must be an integer between 1 and ${max}`);
  }
}
if (feedConcurrency > tokenConcurrency) {
  throw new Error('feed concurrency cannot exceed the preconnected token client count');
}

type LoadClient = Readonly<{ agent: Agent; origin: string }>;
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

const tokenUrl = (origin: string) => `${origin}/v1/tokens/${HOT_TOKEN}`;
const feedUrl = (origin: string) => `${origin}/v1/feed?view=new&limit=1`;

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index] ?? 0;
}

function readHeadReads(): number {
  return headReadsFiles.reduce(
    (total, path) => total + Number(readFileSync(path, 'utf8').trim()),
    0,
  );
}

function freeSocketCount(agent: Agent): number {
  return Object.values(agent.freeSockets).reduce((count, sockets) => count + sockets.length, 0);
}

function requestOnce(url: string, agent: Agent): Promise<boolean> {
  const parsed = new URL(url);
  return new Promise<boolean>((resolve, reject) => {
    const req = request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        agent,
      },
      (response) => {
        response.resume();
        response.once('end', () => {
          const status = response.statusCode ?? 0;
          resolve(status >= 200 && status < 300);
        });
      },
    );
    req.setTimeout(10_000, () => req.destroy(new Error('capacity request timed out')));
    req.once('error', reject);
    req.end();
  });
}

async function warmClients(clients: readonly LoadClient[]): Promise<number> {
  let next = 0;
  let failures = 0;
  async function worker() {
    while (true) {
      const index = next++;
      const client = clients[index];
      if (!client) return;
      try {
        if (!(await requestOnce(tokenUrl(client.origin), client.agent))) failures += 1;
      } catch {
        failures += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(connectConcurrency, clients.length) }, () => worker()));
  return failures;
}

async function runHttpLoad(input: Readonly<{
  name: string;
  clients: readonly LoadClient[];
  requests: number;
  urlFor: (client: LoadClient) => string;
}>): Promise<LoadResult> {
  let next = 0;
  let ok = 0;
  let failed = 0;
  const latencies: number[] = [];
  const startedAll = performance.now();

  async function worker(client: LoadClient) {
    while (true) {
      const id = next++;
      if (id >= input.requests) return;
      const started = performance.now();
      try {
        const success = await requestOnce(input.urlFor(client), client.agent);
        latencies.push(performance.now() - started);
        if (success) ok += 1;
        else failed += 1;
      } catch {
        latencies.push(performance.now() - started);
        failed += 1;
      }
    }
  }

  await Promise.all(input.clients.map((client) => worker(client)));
  const durationMs = performance.now() - startedAll;
  latencies.sort((left, right) => left - right);
  return {
    name: input.name,
    concurrency: input.clients.length,
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

const clients: LoadClient[] = Array.from({ length: tokenConcurrency }, (_, index) => ({
  agent: new Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 }),
  origin: origins[index % origins.length]!,
}));
const controlAgent = new Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 });

try {
  if (!(await requestOnce(feedUrl(origins[0]!), controlAgent))) throw new Error('feed warmup failed');
  const warmFailures = await warmClients(clients);
  const preconnectedSockets = clients.reduce(
    (count, client) => count + freeSocketCount(client.agent),
    0,
  );
  const observedHeadReadsAfterWarm = readHeadReads();

  const token = await runHttpLoad({
    name: 'hot-token-10k-horizontally-scaled-preconnected',
    clients,
    requests: tokenRequests,
    urlFor: (client) => tokenUrl(client.origin),
  });
  const headReadsAfterToken = readHeadReads();

  const feedClients = clients.slice(0, feedConcurrency);
  const feed = await runHttpLoad({
    name: 'cached-feed-horizontally-scaled-preconnected',
    clients: feedClients,
    requests: feedRequests,
    urlFor: (client) => feedUrl(client.origin),
  });
  const headReadsAfterFeed = readHeadReads();

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
    schemaVersion: 3,
    environment: 'github-hosted-runner-horizontally-scaled-node-api-local-postgres-redis',
    apiWorkers: origins.length,
    origins,
    connectionModel: 'one keepalive agent/socket per hot-token client; round-robin stateless API workers; connections established before timed stampede',
    warmFailures,
    preconnectedSockets,
    clientRssBytes: process.memoryUsage().rss,
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
  if (warmFailures !== 0) failures.push(`preconnection warmup had ${warmFailures} failed requests`);
  if (preconnectedSockets !== tokenConcurrency) failures.push(`only ${preconnectedSockets}/${tokenConcurrency} client sockets remained preconnected before the stampede`);
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
  controlAgent.destroy();
  for (const client of clients) client.agent.destroy();
}
