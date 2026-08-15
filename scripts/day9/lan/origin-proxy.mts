import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export type ProxyTarget = Readonly<{ host: string; port: number }>;

export type OriginProxyOptions = Readonly<{
  apiTarget: ProxyTarget;
  webTarget: ProxyTarget;
  apiPrefix?: string;
}>;

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function forwardableHeaders(headers: IncomingMessage['headers']): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (HOP_BY_HOP.has(name.toLowerCase())) continue;
    out[name] = value;
  }
  return out;
}

function removeUpgradeInsecureRequests(value: string): string {
  return value
    .split(';')
    .map((directive) => directive.trim())
    .filter(
      (directive) =>
        directive.length > 0 && directive.toLowerCase() !== 'upgrade-insecure-requests',
    )
    .join('; ');
}

function responseHeadersForLan(
  headers: IncomingMessage['headers'],
  isApi: boolean,
): Record<string, string | string[]> {
  const out = forwardableHeaders(headers);
  if (isApi) return out;

  const cspName = Object.keys(out).find(
    (name) => name.toLowerCase() === 'content-security-policy',
  );
  if (!cspName) return out;

  const csp = out[cspName];
  if (typeof csp === 'string') {
    const adjusted = removeUpgradeInsecureRequests(csp);
    if (adjusted.length > 0) out[cspName] = adjusted;
    else delete out[cspName];
  } else if (Array.isArray(csp)) {
    const adjusted = csp
      .map(removeUpgradeInsecureRequests)
      .filter((value) => value.length > 0);
    if (adjusted.length > 0) out[cspName] = adjusted;
    else delete out[cspName];
  }

  return out;
}

/**
 * Bounded same-origin router for the operator LAN acceptance environment.
 *
 * The browser must see exactly one origin: application requests are served by
 * the production Next.js build and `/v1/*` reaches the real Bread API. Routing
 * is decided solely by request path against two pinned loopback upstreams, so
 * a forged Host header cannot redirect traffic and this can never act as an
 * open proxy.
 *
 * The acceptance origin is intentionally plain HTTP so physical devices on the
 * operator LAN can reach it without installing a local CA. Production Next.js
 * correctly emits `upgrade-insecure-requests`; forwarding that directive over
 * this HTTP-only boundary would make browsers upgrade `/_next/*` assets to
 * HTTPS, where no listener exists. Only this LAN proxy strips that one
 * directive from web responses. The production CSP itself is not weakened.
 */
export function createOriginProxy(options: OriginProxyOptions): Server {
  const apiPrefix = options.apiPrefix ?? '/v1/';

  return createServer((incoming: IncomingMessage, response: ServerResponse) => {
    const rawUrl = incoming.url ?? '/';

    // Absolute-form request targets are how open proxies get abused. This
    // server only ever serves origin-form paths for its own single origin.
    if (!rawUrl.startsWith('/')) {
      response.writeHead(400, { 'content-type': 'text/plain' });
      response.end('origin-form request target required');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl, 'http://127.0.0.1');
    } catch {
      response.writeHead(400, { 'content-type': 'text/plain' });
      response.end('malformed request target');
      return;
    }

    // Compare on the normalized pathname so `/v1/../x` cannot smuggle a
    // non-API path into the API upstream, and so an API-looking path that
    // normalizes outside the prefix is routed to the web app instead.
    const normalizedPath = parsed.pathname;
    const isApi = normalizedPath === '/v1' || normalizedPath.startsWith(apiPrefix);
    const target = isApi ? options.apiTarget : options.webTarget;
    const upstreamPath = `${normalizedPath}${parsed.search}`;

    const upstream = httpRequest(
      {
        host: target.host,
        port: target.port,
        method: incoming.method,
        path: upstreamPath,
        headers: forwardableHeaders(incoming.headers),
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          responseHeadersForLan(upstreamResponse.headers, isApi),
        );
        upstreamResponse.pipe(response);
      },
    );

    upstream.on('error', () => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      response.writeHead(502, { 'content-type': 'text/plain' });
      response.end('bread upstream unavailable');
    });

    incoming.pipe(upstream);
  });
}
