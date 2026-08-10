import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const port = Number(process.env.BREAD_DAY8_EDGE_PORT ?? '3120');
const upstreamOrigins = (process.env.BREAD_DAY8_UPSTREAM_ORIGINS ?? 'http://127.0.0.1:3108')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('BREAD_DAY8_EDGE_PORT must be a valid TCP port');
}
if (upstreamOrigins.length < 1) {
  throw new Error('BREAD_DAY8_UPSTREAM_ORIGINS must contain at least one origin');
}

type CachedResponse = Readonly<{
  statusCode: number;
  headers: Readonly<Record<string, string>>;
  body: Buffer;
  storedAtMs: number;
  expiresAtMs: number;
}>;

type EdgeStats = {
  requests: number;
  cacheHits: number;
  cacheMisses: number;
  coalescedWaiters: number;
  originFetches: number;
  nonCacheableResponses: number;
};

const cache = new Map<string, CachedResponse>();
const inFlight = new Map<string, Promise<CachedResponse>>();
const stats: EdgeStats = {
  requests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  coalescedWaiters: 0,
  originFetches: 0,
  nonCacheableResponses: 0,
};
let nextOrigin = 0;

function parseSharedMaxAge(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const directives = cacheControl
    .split(',')
    .map((value) => value.trim().toLowerCase());
  if (!directives.includes('public') || directives.includes('no-store') || directives.includes('private')) {
    return null;
  }
  for (const directive of directives) {
    const match = /^s-maxage=(\d+)$/.exec(directive);
    if (!match) continue;
    const seconds = Number(match[1]);
    if (Number.isSafeInteger(seconds) && seconds > 0) return seconds;
  }
  return null;
}

function responseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of ['content-type', 'cache-control', 'etag', 'last-modified']) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

async function fetchOrigin(path: string): Promise<CachedResponse> {
  const origin = upstreamOrigins[nextOrigin % upstreamOrigins.length]!;
  nextOrigin += 1;
  stats.originFetches += 1;
  const response = await fetch(`${origin}${path}`, {
    headers: { 'x-bread-day8-edge-probe': '1' },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  const body = Buffer.from(await response.arrayBuffer());
  const now = Date.now();
  const sharedMaxAgeSeconds = parseSharedMaxAge(response.headers.get('cache-control'));
  const cached: CachedResponse = {
    statusCode: response.status,
    headers: responseHeaders(response),
    body,
    storedAtMs: now,
    expiresAtMs: sharedMaxAgeSeconds === null ? now : now + sharedMaxAgeSeconds * 1_000,
  };
  if (response.ok && sharedMaxAgeSeconds !== null) {
    cache.set(path, cached);
  } else {
    stats.nonCacheableResponses += 1;
  }
  return cached;
}

function send(res: ServerResponse, response: CachedResponse, cacheState: 'HIT' | 'MISS' | 'COALESCED'): void {
  const headers: Record<string, string | number> = {
    ...response.headers,
    'content-length': response.body.length,
    'x-bread-edge-cache': cacheState,
  };
  if (cacheState === 'HIT') {
    headers.age = Math.max(0, Math.floor((Date.now() - response.storedAtMs) / 1_000));
  }
  res.writeHead(response.statusCode, headers);
  res.end(response.body);
}

async function handleProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'cache-control': 'no-store', allow: 'GET' });
    res.end('Method Not Allowed');
    return;
  }

  const path = req.url ?? '/';
  if (path === '/__bread_edge_stats') {
    const body = Buffer.from(JSON.stringify({
      ...stats,
      cacheEntries: cache.size,
      inFlight: inFlight.size,
      upstreamOrigins: upstreamOrigins.length,
    }));
    res.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'content-length': body.length,
    });
    res.end(body);
    return;
  }

  stats.requests += 1;
  const now = Date.now();
  const existing = cache.get(path);
  if (existing && existing.expiresAtMs > now) {
    stats.cacheHits += 1;
    send(res, existing, 'HIT');
    return;
  }
  if (existing) cache.delete(path);

  const pending = inFlight.get(path);
  if (pending) {
    stats.coalescedWaiters += 1;
    try {
      send(res, await pending, 'COALESCED');
    } catch (error) {
      res.writeHead(502, { 'cache-control': 'no-store', 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'EDGE_UPSTREAM_FAILURE', detail: String(error) }));
    }
    return;
  }

  stats.cacheMisses += 1;
  const load = fetchOrigin(path);
  inFlight.set(path, load);
  try {
    send(res, await load, 'MISS');
  } catch (error) {
    res.writeHead(502, { 'cache-control': 'no-store', 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'EDGE_UPSTREAM_FAILURE', detail: String(error) }));
  } finally {
    if (inFlight.get(path) === load) inFlight.delete(path);
  }
}

const server = createServer((req, res) => {
  void handleProxy(req, res).catch((error) => {
    if (!res.headersSent) {
      res.writeHead(500, { 'cache-control': 'no-store', 'content-type': 'application/json' });
    }
    if (!res.writableEnded) res.end(JSON.stringify({ error: 'EDGE_INTERNAL_FAILURE', detail: String(error) }));
  });
});

server.keepAliveTimeout = 72_000;
server.headersTimeout = 75_000;
server.requestTimeout = 15_000;

await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', () => resolve());
});
console.log(`DAY8_EDGE_READY http://127.0.0.1:${port} upstreams=${upstreamOrigins.length}`);

async function shutdown(): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

process.once('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
process.once('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
