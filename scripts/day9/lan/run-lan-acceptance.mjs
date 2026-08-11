#!/usr/bin/env node
/**
 * Day-9 operator-only LAN acceptance composition.
 *
 * Brings up the smallest REAL Bread runtime capable of executing the 04D
 * physical browser/device matrix over a trusted local network:
 *
 *   Postgres + Redis  ->  real Bread indexer  ->  real Bread read API
 *                                              -> production Next.js build
 *                                              -> one bounded LAN origin
 *
 * This is acceptance tooling, not a hosting architecture. It deploys no
 * contract, creates no token, runs no lifecycle smoke, touches no Safe, and
 * loads no signing material of any kind.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../..');
const compose = 'infra/docker/compose.yaml';

const CANONICAL_FILES = [
  'config/deployments/arc-testnet.day5.json',
  'config/networks/arc-testnet.json',
];

const DATABASE_URL =
  process.env.BREAD_DATABASE_URL?.trim() || 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread';
const REDIS_URL = process.env.BREAD_REDIS_URL?.trim() || 'redis://127.0.0.1:6379';
const API_PORT = Number.parseInt(process.env.BREAD_API_PORT?.trim() || '4010', 10);
const WEB_PORT = Number.parseInt(process.env.BREAD_WEB_PORT?.trim() || '4020', 10);
const LAN_PORT = Number.parseInt(process.env.BREAD_LAN_PORT?.trim() || '4000', 10);

const children = [];
let proxyServer;
let startedInfrastructure = false;

function log(message) {
  process.stdout.write(`${message}\n`);
}

function run(command, args, options = {}) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: 'inherit', ...options });
    child.once('error', fail);
    child.once('exit', (code) => (code === 0 ? done() : fail(new Error(`${command} ${args.join(' ')} exited ${code}`))));
  });
}

function fingerprintCanonicalFiles() {
  return CANONICAL_FILES.map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8'));
}

function lanAddress() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

function httpGet(port, path, host = '127.0.0.1') {
  return new Promise((done, fail) => {
    const call = httpRequest({ host, port, path, method: 'GET' }, (response) => {
      let body = '';
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => done({ status: response.statusCode ?? 0, body }));
    });
    call.on('error', fail);
    call.end();
  });
}

async function waitFor(label, probe, attempts = 60, intervalMs = 1_000) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (await probe()) return;
    } catch {
      /* keep waiting */
    }
    await new Promise((done) => setTimeout(done, intervalMs));
  }
  throw new Error(`readiness timeout: ${label}`);
}

/**
 * Runtime environment for every spawned Bread process.
 *
 * Only infrastructure coordinates are passed. Contract addresses, economics,
 * authorities, USDC, DEX family and stack identity come from validated
 * canonical repository configuration and are never overridable here. No
 * signing material is present.
 */
function runtimeEnv(extra) {
  return {
    ...process.env,
    BREAD_DATABASE_URL: DATABASE_URL,
    BREAD_REDIS_URL: REDIS_URL,
    // The deterministic browser fixture harness must never be active in a
    // physical acceptance run.
    BREAD_E2E: '',
    ...extra,
  };
}

function spawnRuntime(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    env: runtimeEnv(env),
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  child.once('exit', (code, signal) => {
    if (code !== 0 && code !== null && signal === null) {
      process.stderr.write(`${label} exited unexpectedly with code ${code}\n`);
    }
  });
  children.push(child);
  return child;
}

async function teardown() {
  const { terminateAll } = await import('./process-lifecycle.mts');
  if (proxyServer) await new Promise((done) => proxyServer.close(() => done()));
  await terminateAll(children).catch(() => undefined);
  if (startedInfrastructure) {
    await run('docker', ['compose', '-f', compose, 'down', '-v'], { stdio: 'ignore' }).catch(() => undefined);
  }
}

let tornDown = false;
async function teardownOnce(code) {
  if (tornDown) return;
  tornDown = true;
  log('\n== Tearing down Bread LAN acceptance environment ==');
  await teardown();
  log('teardown complete');
  process.exit(code);
}

process.on('SIGINT', () => void teardownOnce(130));
process.on('SIGTERM', () => void teardownOnce(143));

async function main() {
  const canonicalBefore = fingerprintCanonicalFiles();
  const tsx = resolve(repositoryRoot, 'node_modules/.bin/tsx');

  log('== 1-2. Bounded local infrastructure ==');
  await run('docker', ['compose', '-f', compose, 'up', '-d', '--wait', '--wait-timeout', '90']);
  startedInfrastructure = true;

  log('== 3-5. Canonical context + real indexer catch-up ==');
  const requireFromIndexer = createRequire(
    new URL('../../../apps/indexer/package.json', import.meta.url),
  );
  void requireFromIndexer;

  await run(tsx, ['apps/indexer/src/lan/indexer-runner.ts'], {
    env: runtimeEnv({ BREAD_LAN_INDEXER_MAIN: '1' }),
  });

  log('== 6-7. Real Bread read API (loopback only) ==');
  spawnRuntime('bread-api', tsx, ['apps/api/src/lan/api-server.ts'], {
    BREAD_LAN_API_MAIN: '1',
    BREAD_API_HOST: '127.0.0.1',
    BREAD_API_PORT: String(API_PORT),
  });

  await waitFor('api /v1/status', async () => {
    const response = await httpGet(API_PORT, '/v1/status');
    if (response.status !== 200) return false;
    const payload = JSON.parse(response.body);
    if (!payload?.meta) throw new Error('API /v1/status returned no freshness metadata');
    return true;
  });

  log('== 8. Production Next.js build (loopback only) ==');
  await run('corepack', ['pnpm', '--filter', '@bread/web', 'build']);
  spawnRuntime('bread-web', resolve(repositoryRoot, 'apps/web/node_modules/.bin/next'), [
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(WEB_PORT),
  ], {});
  await waitFor('web root', async () => (await httpGet(WEB_PORT, '/explore')).status < 500);

  log('== 9. Bounded same-origin LAN entrypoint ==');
  const { createOriginProxy } = await import('./origin-proxy.mts');
  proxyServer = createOriginProxy({
    apiTarget: { host: '127.0.0.1', port: API_PORT },
    webTarget: { host: '127.0.0.1', port: WEB_PORT },
  });
  const bindHost = process.env.BREAD_LAN_BIND?.trim() || '0.0.0.0';
  await new Promise((done) => proxyServer.listen(LAN_PORT, bindHost, done));

  log('== 10-12. Startup verification ==');
  const lanIp = lanAddress();
  if (!lanIp) throw new Error('no LAN IPv4 interface found for physical device access');

  const originStatus = await httpGet(LAN_PORT, '/v1/status', lanIp);
  if (originStatus.status !== 200) throw new Error('same-origin /v1/status did not return the real API response');
  const originPayload = JSON.parse(originStatus.body);
  if (!originPayload?.meta) throw new Error('same-origin /v1/status carried no freshness metadata');

  const explore = await httpGet(LAN_PORT, '/explore', lanIp);
  if (explore.status >= 500) throw new Error('Explore did not load through the LAN origin');

  if (process.env.BREAD_E2E) throw new Error('browser fixture mode must not be enabled');

  const canonicalAfter = fingerprintCanonicalFiles();
  if (JSON.stringify(canonicalAfter) !== JSON.stringify(canonicalBefore)) {
    throw new Error('canonical deployment/network configuration mutated during startup');
  }

  log('');
  log('BREAD_LAN_ACCEPTANCE_READY');
  log(`  LAN origin for physical devices: http://${lanIp}:${LAN_PORT}`);
  log(`  indexed API through same origin: http://${lanIp}:${LAN_PORT}/v1/status`);
  log('  Postgres/Redis/API/web remain loopback-only.');
  log('');
  log('  Press Ctrl-C to tear down.');
}

main().catch(async (error) => {
  process.stderr.write(`BREAD_LAN_ACCEPTANCE_FAILED ${error instanceof Error ? error.message : String(error)}\n`);
  await teardownOnce(1);
});
