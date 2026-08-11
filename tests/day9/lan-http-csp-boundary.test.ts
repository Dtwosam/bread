import { createServer, request as httpRequest, type IncomingHttpHeaders, type Server } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { createOriginProxy } from '../../scripts/day9/lan/origin-proxy.mjs';

type Running = Readonly<{ server: Server; port: number }>;
const running: Server[] = [];

async function listen(server: Server): Promise<Running> {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  running.push(server);
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('port unavailable');
  return { server, port: address.port };
}

async function get(port: number, path = '/explore') {
  return new Promise<{ status: number; body: string; headers: IncomingHttpHeaders }>(
    (resolveResult, reject) => {
      const call = httpRequest({ host: '127.0.0.1', port, path, method: 'GET' }, (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () =>
          resolveResult({
            status: response.statusCode ?? 0,
            body,
            headers: response.headers,
          }),
        );
      });
      call.on('error', reject);
      call.end();
    },
  );
}

afterEach(async () => {
  while (running.length > 0) {
    const server = running.pop();
    if (!server) continue;
    await new Promise<void>((done) => server.close(() => done()));
  }
});

describe('Day 9 HTTP LAN CSP boundary', () => {
  it('removes only upgrade-insecure-requests from proxied web responses', async () => {
    const web = await listen(
      createServer((_request, response) => {
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy':
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests; frame-ancestors 'none'",
          'x-content-type-options': 'nosniff',
        });
        response.end('<html>Bread</html>');
      }),
    );
    const api = await listen(
      createServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{"ok":true}');
      }),
    );
    const proxy = await listen(
      createOriginProxy({
        webTarget: { host: '127.0.0.1', port: web.port },
        apiTarget: { host: '127.0.0.1', port: api.port },
      }),
    );

    const page = await get(proxy.port);

    expect(page.status).toBe(200);
    expect(page.body).toContain('Bread');
    expect(page.headers['content-security-policy']).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
    expect(page.headers['x-content-type-options']).toBe('nosniff');
  });
});
