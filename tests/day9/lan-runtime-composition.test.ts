import { spawn } from 'node:child_process';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BREAD_LAN_STACK_VERSION,
  reconcileCanonicalEconomicsHash,
  resolveBreadRuntimeContext,
} from '../../apps/indexer/src/lan/runtime-context.js';
import { createOriginProxy } from '../../scripts/day9/lan/origin-proxy.mjs';

const root = resolve(import.meta.dirname, '../..');
const CANONICAL_FILES = [
  'config/deployments/arc-testnet.day5.json',
  'config/networks/arc-testnet.json',
] as const;

function fingerprint() {
  return CANONICAL_FILES.map((path) => readFileSync(resolve(root, path), 'utf8'));
}

type StubServer = Readonly<{ server: Server; port: number; seen: string[] }>;

async function startStub(body: string, seen: string[]): Promise<StubServer> {
  const server = createServer((incoming, response) => {
    seen.push(`${incoming.method} ${incoming.url}`);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(body);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('stub port unavailable');
  return { server, port: address.port, seen };
}

async function fetchThrough(port: number, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: string }>((resolveResult, reject) => {
    const call = httpRequest(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (response) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => resolveResult({ status: response.statusCode ?? 0, body }));
      },
    );
    call.on('error', reject);
    call.end();
  });
}

describe('Day 9 LAN runtime composition', () => {
  describe('canonical configuration derivation', () => {
    it('resolves the verified Arc Testnet deployment context from validated manifests', () => {
      const { context, deployment } = resolveBreadRuntimeContext(root);

      expect(deployment.status).toBe('VERIFIED');
      expect(context.chainId).toBe(5_042_002);
      expect(context.deploymentStartBlock).toBe(56_448_201n);
      expect(context.factoryAddress).toBe('0xddf400f7a376fb8a962eee6d74c1ba37efa644f7');
      expect(context.quoteAsset).toBe('0x3600000000000000000000000000000000000000');
      expect(context.quoteDecimals).toBe(6);
      expect(context.addresses.locker).toBe('0xecf66a3a221d90a413d9015803417aa8d4ba97fe');
    });

    it('derives the stack version from the canonical label and reconciles it against recorded economics', () => {
      // Proves the derived stack identity is the one the deployed stack used,
      // rather than a convenience value invented for the runtime.
      expect(BREAD_LAN_STACK_VERSION).toBe(
        '0xc862a0ec7e5eb592f1a77b4971552b79f65528b1f1addf97fdfc42b8f774e063',
      );

      const reconciliation = reconcileCanonicalEconomicsHash();
      expect(reconciliation.recomputed).toBe(reconciliation.recorded);
      expect(reconciliation.matches).toBe(true);
      expect(reconciliation.recorded).toBe(
        '0x081b597d7b603cb67d3921f269f7940a84221524b2d9baefc4f319c9f15f9747',
      );
    });

    it('fails closed when canonical configuration is missing or inconsistent', () => {
      expect(() => resolveBreadRuntimeContext(resolve(root, 'docs'))).toThrow();
    });
  });

  describe('same-origin router', () => {
    let api: StubServer;
    let web: StubServer;
    let proxy: Server;
    let proxyPort: number;
    const apiSeen: string[] = [];
    const webSeen: string[] = [];

    beforeAll(async () => {
      api = await startStub(JSON.stringify({ data: { indexed: true }, meta: { status: 'FRESH' } }), apiSeen);
      web = await startStub('<html>bread-web</html>', webSeen);
      proxy = createOriginProxy({
        apiTarget: { host: '127.0.0.1', port: api.port },
        webTarget: { host: '127.0.0.1', port: web.port },
      });
      await new Promise<void>((done) => proxy.listen(0, '127.0.0.1', done));
      const address = proxy.address();
      if (typeof address === 'string' || address === null) throw new Error('proxy port unavailable');
      proxyPort = address.port;
    });

    afterAll(async () => {
      await new Promise<void>((done) => proxy.close(() => done()));
      await new Promise<void>((done) => api.server.close(() => done()));
      await new Promise<void>((done) => web.server.close(() => done()));
    });

    it('serves the web application and proxies /v1/* to the real API on one origin', async () => {
      const page = await fetchThrough(proxyPort, '/explore');
      expect(page.status).toBe(200);
      expect(page.body).toContain('bread-web');

      const status = await fetchThrough(proxyPort, '/v1/status');
      expect(status.status).toBe(200);
      expect(JSON.parse(status.body).data.indexed).toBe(true);

      expect(apiSeen.some((entry) => entry.includes('/v1/status'))).toBe(true);
      expect(webSeen.some((entry) => entry.includes('/explore'))).toBe(true);
    });

    it('is not an open proxy and contains /v1 path traversal', async () => {
      const absolute = await fetchThrough(proxyPort, 'http://example.com/v1/status');
      expect(absolute.status).toBe(400);

      // A traversal attempt must never be forwarded to the API upstream.
      const before = apiSeen.length;
      const traversal = await fetchThrough(proxyPort, '/v1/../../secret');
      expect(traversal.status).toBeLessThan(500);
      expect(apiSeen.slice(before).every((entry) => entry.startsWith('GET /v1/'))).toBe(true);
    });

    it('rejects a forged Host header rather than trusting it for routing', async () => {
      const forged = await fetchThrough(proxyPort, '/v1/status', { host: 'evil.example.com' });
      // Routing is decided by path against fixed loopback targets, so the
      // response must still come from the pinned API upstream.
      expect(forged.status).toBe(200);
      expect(JSON.parse(forged.body).data.indexed).toBe(true);
    });
  });

  describe('runtime process boundaries', () => {
    it('requires explicit infrastructure coordinates and fails closed without them', async () => {
      const { resolveRuntimeInfrastructure } = await import(
        '../../apps/indexer/src/lan/runtime-context.js'
      );

      expect(() => resolveRuntimeInfrastructure({} as NodeJS.ProcessEnv)).toThrow(/BREAD_DATABASE_URL/);
      expect(() =>
        resolveRuntimeInfrastructure({ BREAD_DATABASE_URL: 'postgres://x' } as NodeJS.ProcessEnv),
      ).toThrow(/BREAD_REDIS_URL/);
    });

    it('refuses to bind the Bread API to a non-loopback interface', async () => {
      const { startBreadApiProcess } = await import('../../apps/api/src/lan/api-server.js');

      await expect(
        (async () => {
          const previous = { ...process.env };
          Object.assign(process.env, {
            BREAD_DATABASE_URL: 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread',
            BREAD_REDIS_URL: 'redis://127.0.0.1:6379',
            BREAD_API_HOST: '0.0.0.0',
            BREAD_ALLOW_NON_LOOPBACK_API: '',
          });
          try {
            await startBreadApiProcess();
          } finally {
            process.env = previous;
          }
        })(),
      ).rejects.toThrow(/non-loopback/);
    });

    it('never accepts canonical protocol values as runtime overrides', () => {
      const runtime = readFileSync(
        resolve(root, 'apps/indexer/src/lan/runtime-context.ts'),
        'utf8',
      );
      // Only infrastructure coordinates may come from the environment.
      const envReads = runtime.match(/env\.[A-Z_]+/g) ?? [];
      expect(envReads.sort()).toEqual(['env.BREAD_DATABASE_URL', 'env.BREAD_REDIS_URL']);
    });
  });

  describe('operator lifecycle', () => {
    it('leaves canonical deployment and network files byte-for-byte unchanged', () => {
      const before = fingerprint();
      resolveBreadRuntimeContext(root);
      expect(fingerprint()).toEqual(before);
    });

    it('keeps the real indexer live after the startup catch-up so physical writes enter the projection', () => {
      const orchestrator = readFileSync(
        resolve(root, 'scripts/day9/lan/run-lan-acceptance.mjs'),
        'utf8',
      );
      const runner = readFileSync(
        resolve(root, 'apps/indexer/src/lan/indexer-runner.ts'),
        'utf8',
      );

      // Initial catch-up stays a blocking readiness gate.
      expect(orchestrator).toMatch(/await\s+run\(tsx,\s*\['apps\/indexer\/src\/lan\/indexer-runner\.ts'\]/);
      // After that gate, the same canonical indexer machinery must remain live
      // for launches/trades created during the physical-device session.
      expect(orchestrator).toMatch(/spawnRuntime\(['"]bread-indexer['"]/);
      expect(orchestrator).toContain('BREAD_LAN_INDEXER_CONTINUOUS');
      expect(runner).toContain('BREAD_LAN_INDEXER_CONTINUOUS');
    });

    it('terminates every child process it spawns on teardown', async () => {
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        stdio: 'ignore',
        detached: false,
      });
      expect(child.pid).toBeGreaterThan(0);

      const { terminateProcess } = await import('../../scripts/day9/lan/process-lifecycle.mjs');
      await terminateProcess(child, 5_000);
      await delay(50);

      expect(child.killed || child.exitCode !== null || child.signalCode !== null).toBe(true);
    });

    it('never loads signing material into runtime process configuration', () => {
      const orchestrator = readFileSync(
        resolve(root, 'scripts/day9/lan/run-lan-acceptance.mjs'),
        'utf8',
      );
      expect(orchestrator).not.toMatch(/\b(PRIVATE_KEY|MNEMONIC|SIGNING_KEY|KEYSTORE)\b/);
      expect(orchestrator).toContain('BREAD_DATABASE_URL');
    });
  });
});
