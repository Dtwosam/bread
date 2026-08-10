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
const edgeMode = process.env.BREAD_DAY8_EDGE_MODE === '1';
const tokenConcurrency = Number(process.env.BREAD_DAY8_TOKEN_CONCURRENCY ?? '10000');
const tokenRequests = Number(process.env.BREAD_DAY8_TOKEN_REQUESTS ?? String(tokenConcurrency));
const tokenArrivalWindowMs = Number(process.env.BREAD_DAY8_TOKEN_ARRIVAL_WINDOW_MS ?? '0');
const feedConcurrency = Number(process.env.BREAD_DAY8_FEED_CONCURRENCY ?? '1000');
const feedRequests = Number(process.env.BREAD_DAY8_FEED_REQUESTS ?? '5000');
const feedArrivalWindowMs = Number(process.env.BREAD_DAY8_FEED_ARRIVAL_WINDOW_MS ?? '0');
const representativeConcurrency = Number(process.env.BREAD_DAY8_REPRESENTATIVE_CONCURRENCY ?? '500');
const representativeRequests = Number(process.env.BREAD_DAY8_REPRESENTATIVE_REQUESTS ?? '5000');
const connectConcurrency = Number(process.env.BREAD_DAY8_CONNECT_CONCURRENCY ?? '500');

if (origins.length < 1) throw new Error('at least one Bread read origin is required');
if (headReadsFiles.length < 1) throw new Error('at least one observed-head diagnostic file is required');
for (const [label, value, max] of [
  ['BREAD_DAY8_TOKEN_CONCURRENCY', tokenConcurrency, 10_000],
  ['BREAD_DAY8_TOKEN_REQUESTS', tokenRequests, 100_000],
  ['BREAD_DAY8_FEED_CONCURRENCY', feedConcurrency, 10_000],
  ['BREAD_DAY8_FEED_REQUESTS', feedRequests, 100_000],
  ['BREAD_DAY8_REPRESENTATIVE_CONCURRENCY', representativeConcurrency, 10_000],
  ['BREAD_DAY8_REPRESENTATIVE_REQUESTS', representativeRequests, 100_000],
  ['BREAD_DAY8_CONNECT_CONCURRENCY', connectConcurrency, 2_000],
] as const) {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${label} must be an integer between 1 and ${max}`);
  }
}
for (const [label, value] of [
  ['BREAD_DAY8_TOKEN_ARRIVAL_WINDOW_MS', tokenArrivalWindowMs],
  ['BREAD_DAY8_FEED_ARRIVAL_WINDOW_MS', feedArrivalWindowMs],
] as const) {
  if (!Number.isInteger(value) || value < 0 || value > 5_000) {
    throw new Error(`${label} must be an integer between 0 and 5000`);
  }
}
if (feedConcurrency > tokenConcurrency) {
  throw new Error('feed concurrency cannot exceed the preconnected token client count');
}
if (representativeConcurrency > tokenConcurrency) {
  throw new Error('representative concurrency cannot exceed the preconnected token client count');
}

type LoadClient = Readonly<{ agent: Agent; origin: string }>;
type LoadResult = Readonly<{
  name: string;
  concurrency: number;
  requests: number;
  arrivalWindowMs: number;
  ok: number;
  failed: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  durationMs: number;
}>;
type EdgeStats = Readonly<{
  requests: number;
  cacheHits: number;
  cacheMisses: number;
  coalescedWaiters: number;
  originFetches: number;
  nonCacheableResponses: number;
  cacheEntries: number;
  inFlight: number;
}>;

const tokenUrl = (origin: string) => `${origin}/v1/tokens/${HOT_TOKEN}`;
const feedUrl = (origin: string) => `${origin}/v1/feed?view=new&limit=1`;
const connectUrl = (origin: string) => edgeMode ? `${origin}/__bread_edge_connect` : tokenUrl(origin);

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

async function readEdgeStats(): Promise<EdgeStats | null> {
  if (!edgeMode) return null;
  const snapshots = await Promise.all(origins.map(async (origin) => {
    const response = await fetch(`${origin}/__bread_edge_stats`, {
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`edge stats failed for ${origin}: ${response.status}`);
    return await response.json() as EdgeStats;
  }));
  return snapshots.reduce<EdgeStats>((total, snapshot) => ({
    requests: total.requests + snapshot.requests,
    cacheHits: total.cacheHits + snapshot.cacheHits,
    cacheMisses: total.cacheMisses + snapshot.cacheMisses,
    coalescedWaiters: total.coalescedWaiters + snapshot.coalescedWaiters,
    originFetches: total.originFetches + snapshot.originFetches,
    nonCacheableResponses: total.nonCacheableResponses + snapshot.nonCacheableResponses,
    cacheEntries: total.cacheEntries + snapshot.cacheEntries,
    inFlight: total.inFlight + snapshot.inFlight,
  }), {
    requests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    coalescedWaiters: 0,
    originFetches: 0,
    nonCacheableResponses: 0,
    cacheEntries: 0,
    inFlight: 0,
  });
}

function deltaEdgeStats(after: EdgeStats | null, before: EdgeStats | null): EdgeStats | null {
  if (!after || !before) return null;
  return {
    requests: after.requests - before.requests,
    cacheHits: after.cacheHits - before.cacheHits,
    cacheMisses: after.cacheMisses - before.cacheMisses,
    coalescedWaiters: after.coalescedWaiters - before.coalescedWaiters,
    originFetches: after.originFetches - before.originFetches,
    nonCacheableResponses: after.nonCacheableResponses - before.nonCacheableResponses,
    cacheEntries: after.cacheEntries,
    inFlight: after.inFlight,
  };
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
        if (!(await requestOnce(connectUrl(client.origin), client.agent))) failures += 1;
      } catch {
        failures += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(connectConcurrency, clients.length) }, () => worker()));
  return failures;
}

async function warmAcrossOrigins(urlFor: (origin: string) => string, agent: Agent): Promise<void> {
  const results = await Promise.all(origins.map((origin) => requestOnce(urlFor(origin), agent)));
  if (results.some((ok) => !ok)) throw new Error('representative-load cache warmup failed');
}

async function delayUntil(targetMs: number): Promise<void> {
  const remaining = targetMs - performance.now();
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

async function runHttpLoad(input: Readonly<{
  name: string;
  clients: readonly LoadClient[];
  requests: number;
  arrivalWindowMs: number;
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
      if (input.arrivalWindowMs > 0) {
        const scheduledAt = startedAll + (id * input.arrivalWindowMs / input.requests);
        await delayUntil(scheduledAt);
      }
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
    arrivalWindowMs: input.arrivalWindowMs,
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
  if (!edgeMode && !(await requestOnce(feedUrl(origins[0]!), controlAgent))) {
    throw new Error('feed warmup failed');
  }
  const warmFailures = await warmClients(clients);
  const preconnectedSockets = clients.reduce(
    (count, client) => count + freeSocketCount(client.agent),
    0,
  );
  const observedHeadReadsAfterWarm = readHeadReads();
  const edgeBefore = await readEdgeStats();

  const hotTokenStress = await runHttpLoad({
    name: edgeMode ? 'hot-token-10k-edge-preconnected' : 'hot-token-10k-origin-preconnected',
    clients,
    requests: tokenRequests,
    arrivalWindowMs: tokenArrivalWindowMs,
    urlFor: (client) => tokenUrl(client.origin),
  });
  const headReadsAfterTokenStress = readHeadReads();
  const edgeAfterTokenStress = await readEdgeStats();

  const feedStressClients = clients.slice(0, feedConcurrency);
  const feedStress = await runHttpLoad({
    name: edgeMode ? 'feed-polling-stress-edge-preconnected' : 'feed-polling-stress-origin-preconnected',
    clients: feedStressClients,
    requests: feedRequests,
    arrivalWindowMs: feedArrivalWindowMs,
    urlFor: (client) => feedUrl(client.origin),
  });
  const headReadsAfterFeedStress = readHeadReads();
  const edgeAfterFeedStress = await readEdgeStats();

  // 06I separates the 10k hot-launch stress gate from the existing 04D latency
  // targets, which remain applicable under representative cached/read load. The
  // concurrency below is an explicit CI profile; it is not a source-defined value.
  const representativeClients = clients.slice(0, representativeConcurrency);

  await warmAcrossOrigins(tokenUrl, controlAgent);
  const headReadsBeforeRepresentativeToken = readHeadReads();
  const representativeToken = await runHttpLoad({
    name: 'representative-cached-token-read',
    clients: representativeClients,
    requests: representativeRequests,
    arrivalWindowMs: 0,
    urlFor: (client) => tokenUrl(client.origin),
  });
  const headReadsAfterRepresentativeToken = readHeadReads();

  await warmAcrossOrigins(feedUrl, controlAgent);
  const headReadsBeforeRepresentativeFeed = readHeadReads();
  const representativeFeed = await runHttpLoad({
    name: 'representative-cached-feed-read',
    clients: representativeClients,
    requests: representativeRequests,
    arrivalWindowMs: 0,
    urlFor: (client) => feedUrl(client.origin),
  });
  const headReadsAfterRepresentativeFeed = readHeadReads();
  const edgeAfterRepresentative = await readEdgeStats();

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

  const tokenStressEdgeDelta = deltaEdgeStats(edgeAfterTokenStress, edgeBefore);
  const feedStressEdgeDelta = deltaEdgeStats(edgeAfterFeedStress, edgeAfterTokenStress);
  const report = {
    schemaVersion: 6,
    environment: edgeMode
      ? 'github-hosted-runner-test-edge-before-stateless-api-local-postgres-redis'
      : 'github-hosted-runner-stateless-node-api-local-postgres-redis',
    readFrontends: origins.length,
    edgeMode,
    origins,
    connectionModel: edgeMode
      ? '10,000 preconnected keepalive client sockets to shared-cache edge frontends; 10k stress and representative latency are measured separately'
      : 'preconnected keepalive client sockets to stateless API workers; stress and representative latency are measured separately',
    representativeProfile: {
      concurrency: representativeConcurrency,
      requestsPerRoute: representativeRequests,
      cacheState: 'explicitly warmed on every read frontend immediately before each timed route',
      provenance: 'CI-defined representative load; source-defined p95 thresholds are unchanged',
    },
    warmFailures,
    preconnectedSockets,
    clientRssBytes: process.memoryUsage().rss,
    hotTokenStress,
    feedStress,
    representativeToken,
    representativeFeed,
    observedHeadReads: {
      afterWarm: observedHeadReadsAfterWarm,
      afterTokenStress: headReadsAfterTokenStress,
      afterFeedStress: headReadsAfterFeedStress,
      tokenStressDelta: headReadsAfterTokenStress - observedHeadReadsAfterWarm,
      feedStressDelta: headReadsAfterFeedStress - headReadsAfterTokenStress,
      representativeTokenDelta: headReadsAfterRepresentativeToken - headReadsBeforeRepresentativeToken,
      representativeFeedDelta: headReadsAfterRepresentativeFeed - headReadsBeforeRepresentativeFeed,
    },
    edge: edgeMode ? {
      before: edgeBefore,
      tokenStressDelta: tokenStressEdgeDelta,
      feedStressDelta: feedStressEdgeDelta,
      afterRepresentative: edgeAfterRepresentative,
    } : null,
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
  if (hotTokenStress.concurrency < 10_000 || hotTokenStress.requests < 10_000) failures.push('hot token did not exercise at least 10,000 connected/read-active clients and requests');
  if (hotTokenStress.arrivalWindowMs > 5_000) failures.push(`hot-token arrival window ${hotTokenStress.arrivalWindowMs}ms exceeded the bounded launch-burst window`);
  if (warmFailures !== 0) failures.push(`preconnection warmup had ${warmFailures} failed requests`);
  if (preconnectedSockets !== tokenConcurrency) failures.push(`only ${preconnectedSockets}/${tokenConcurrency} client sockets remained preconnected before the stampede`);
  if (hotTokenStress.errorRate >= 0.01) failures.push(`hot-token healthy-read error rate ${hotTokenStress.errorRate} >= 0.01`);
  if (feedStress.errorRate >= 0.01) failures.push(`feed-polling healthy-read error rate ${feedStress.errorRate} >= 0.01`);
  if (representativeToken.errorRate >= 0.01) failures.push(`representative token healthy-read error rate ${representativeToken.errorRate} >= 0.01`);
  if (representativeFeed.errorRate >= 0.01) failures.push(`representative feed healthy-read error rate ${representativeFeed.errorRate} >= 0.01`);
  if (representativeToken.p95Ms > 350) failures.push(`representative token p95 ${representativeToken.p95Ms.toFixed(2)}ms > 350ms`);
  if (representativeFeed.p95Ms > 250) failures.push(`representative feed p95 ${representativeFeed.p95Ms.toFixed(2)}ms > 250ms`);
  if (headReadsAfterTokenStress - observedHeadReadsAfterWarm > Math.max(1, headReadsFiles.length)) failures.push('hot-token viewers multiplied observed-head source reads');
  if (headReadsAfterFeedStress - headReadsAfterTokenStress > Math.max(1, headReadsFiles.length)) failures.push('feed-polling viewers multiplied observed-head source reads');
  if (headReadsAfterRepresentativeToken - headReadsBeforeRepresentativeToken > Math.max(1, headReadsFiles.length)) failures.push('representative token readers multiplied observed-head source reads');
  if (headReadsAfterRepresentativeFeed - headReadsBeforeRepresentativeFeed > Math.max(1, headReadsFiles.length)) failures.push('representative feed readers multiplied observed-head source reads');
  if (edgeMode) {
    if (!tokenStressEdgeDelta || !feedStressEdgeDelta) failures.push('edge statistics were unavailable');
    else {
      const maxOriginFetchesPerPhase = origins.length * 2;
      if (tokenStressEdgeDelta.originFetches > maxOriginFetchesPerPhase) failures.push(`hot-token edge made ${tokenStressEdgeDelta.originFetches} origin fetches > ${maxOriginFetchesPerPhase}`);
      if (feedStressEdgeDelta.originFetches > maxOriginFetchesPerPhase) failures.push(`feed edge made ${feedStressEdgeDelta.originFetches} origin fetches > ${maxOriginFetchesPerPhase}`);
      if (tokenStressEdgeDelta.cacheMisses > maxOriginFetchesPerPhase) failures.push('hot-token edge cache misses were not bounded');
      if (feedStressEdgeDelta.cacheMisses > maxOriginFetchesPerPhase) failures.push('feed edge cache misses were not bounded');
      const tokenAbsorbed = tokenStressEdgeDelta.cacheHits + tokenStressEdgeDelta.coalescedWaiters;
      const feedAbsorbed = feedStressEdgeDelta.cacheHits + feedStressEdgeDelta.coalescedWaiters;
      if (tokenAbsorbed / tokenRequests < 0.99) failures.push(`hot-token edge absorbed only ${tokenAbsorbed}/${tokenRequests} requests`);
      if (feedAbsorbed / feedRequests < 0.99) failures.push(`feed edge absorbed only ${feedAbsorbed}/${feedRequests} requests`);
    }
  }
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
