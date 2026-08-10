import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { migrateBreadDb } from '../../packages/db/src/client.js';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as {
  Pool: new (config: Record<string, unknown>) => {
    query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
    end: () => Promise<void>;
  };
};

const SENTINEL_CHAIN_ID = 5_042_002;
const SENTINEL_STACK = 'day9-rollback-sentinel';
const SENTINEL_FACTORY = '0x1111111111111111111111111111111111111111';
const SENTINEL_HASH = `0x${'ab'.repeat(32)}`;

type CandidateMode = 'INJECTED_UNHEALTHY_APPLICATION_ONLY';

type RollbackInput = Readonly<{
  knownGoodCommit: string;
  candidateMode: CandidateMode;
}>;

export type ServiceRollbackResult = Readonly<{
  rollback: 'PASS';
  contractMutationCount: 0;
  authoritativeReconcile: 'PASS';
  knownGoodCommit: string;
  candidateFailureObserved: true;
  routerTarget: 'KNOWN_GOOD';
  webHealth: 'PASS';
  apiHealth: 'PASS';
  indexerHealth: 'PASS';
  checkpointBefore: bigint;
  checkpointAfter: bigint;
}>;

type ReleaseProcesses = Readonly<{
  web: ChildProcess;
  api: ChildProcess;
  indexer: ChildProcess;
  webPort: number;
  apiPort: number;
  indexerPort: number;
}>;

function runOrThrow(command: string, args: readonly string[], cwd = repoRoot, timeout = 180_000): string {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: 'utf8',
    timeout,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with status ${String(result.status)}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
  return String(result.stdout ?? '').trim();
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('could not allocate rollback rehearsal port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForUrl(url: string, expectedService?: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        if (expectedService) {
          const body = (await response.json()) as { service?: string };
          if (body.service !== expectedService) throw new Error(`unexpected service body from ${url}`);
        }
        return;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`service did not become healthy at ${url}: ${String(lastError)}`);
}

async function waitForFailure(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (!response.ok) return;
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`injected unhealthy candidate remained reachable at ${url}`);
}

function spawnHealthProcess(releaseDir: string, service: 'api' | 'indexer', port: number): ChildProcess {
  const exportName = service === 'api' ? 'apiHealth' : 'indexerHealth';
  const modulePath = service === 'api' ? './apps/api/src/health.ts' : './apps/indexer/src/health.ts';
  const code = [
    `import http from 'node:http';`,
    `import { ${exportName} } from '${modulePath}';`,
    `const server=http.createServer((_req,res)=>{const body=${exportName}();res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(body));});`,
    `server.listen(Number(process.env.BREAD_ROLLBACK_PORT),'127.0.0.1');`,
  ].join(' ');
  return spawn('pnpm', ['exec', 'tsx', '--eval', code], {
    cwd: releaseDir,
    env: { ...process.env, BREAD_ROLLBACK_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
}

function spawnWebProcess(releaseDir: string, port: number): ChildProcess {
  return spawn('pnpm', ['--dir', 'apps/web', 'exec', 'next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: releaseDir,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
}

async function startRelease(releaseDir: string): Promise<ReleaseProcesses> {
  const [webPort, apiPort, indexerPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const release = {
    web: spawnWebProcess(releaseDir, webPort),
    api: spawnHealthProcess(releaseDir, 'api', apiPort),
    indexer: spawnHealthProcess(releaseDir, 'indexer', indexerPort),
    webPort,
    apiPort,
    indexerPort,
  } as const;
  try {
    await Promise.all([
      waitForUrl(`http://127.0.0.1:${webPort}/`),
      waitForUrl(`http://127.0.0.1:${apiPort}/`, 'api'),
      waitForUrl(`http://127.0.0.1:${indexerPort}/`, 'indexer'),
    ]);
    return release;
  } catch (error) {
    stopRelease(release);
    throw error;
  }
}

function stopProcess(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM');
      return;
    } catch {
      // Fall through to direct child termination if the process group already exited.
    }
  }
  child.kill('SIGTERM');
}

function stopRelease(release: ReleaseProcesses | undefined): void {
  if (!release) return;
  stopProcess(release.web);
  stopProcess(release.api);
  stopProcess(release.indexer);
}

function ensureBuild(releaseDir: string): void {
  if (!existsSync(path.join(releaseDir, 'node_modules'))) {
    runOrThrow('pnpm', ['install', '--frozen-lockfile'], releaseDir, 180_000);
  }
  if (!existsSync(path.join(releaseDir, 'apps/web/.next/BUILD_ID'))) {
    runOrThrow('pnpm', ['build'], releaseDir, 240_000);
  }
}

function ensureCommitAvailable(commit: string): void {
  const check = spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: repoRoot, stdio: 'ignore' });
  if (check.status === 0) return;
  runOrThrow('git', ['fetch', '--no-tags', '--depth=1', 'origin', commit], repoRoot, 90_000);
}

async function prepareKnownGood(commit: string, tempRoot: string): Promise<{ dir: string; removeWorktree: boolean }> {
  const supplied = process.env.BREAD_DAY9_KNOWN_GOOD_DIR;
  if (supplied) {
    const resolved = path.resolve(supplied);
    const actual = runOrThrow('git', ['rev-parse', 'HEAD'], resolved);
    if (actual !== commit) throw new Error(`known-good directory is ${actual}, expected ${commit}`);
    ensureBuild(resolved);
    return { dir: resolved, removeWorktree: false };
  }

  ensureCommitAvailable(commit);
  const dir = path.join(tempRoot, 'known-good');
  runOrThrow('git', ['worktree', 'add', '--detach', dir, commit], repoRoot, 90_000);
  ensureBuild(dir);
  return { dir, removeWorktree: true };
}

function assertNoFinancialTreeMutation(before: string): 0 {
  const after = runOrThrow(
    'git',
    ['status', '--porcelain', '--untracked-files=all', '--', 'contracts', 'config/networks', 'config/deployments'],
    repoRoot,
  );
  if (after !== before) throw new Error(`application rollback mutated financial/configuration files\nbefore=${before}\nafter=${after}`);
  return 0;
}

async function runAuthoritativeReconcile(): Promise<void> {
  const databaseUrl = process.env.BREAD_DATABASE_URL;
  if (!databaseUrl || process.env.BREAD_DB_INTEGRATION !== '1') {
    throw new Error('Day 9 rollback rehearsal requires BREAD_DB_INTEGRATION=1 and BREAD_DATABASE_URL');
  }
  runOrThrow(
    'pnpm',
    ['exec', 'vitest', 'run', 'tests/day6/rebuild-reconcile.test.ts'],
    repoRoot,
    180_000,
  );
}

async function seedCheckpoint(pool: InstanceType<typeof Pool>): Promise<bigint> {
  await migrateBreadDb(pool);
  await pool.query(
    `INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block,
       indexed_through_block_hash, decoder_schema_version, status)
     VALUES ($1,$2,$3,100,123,$4,'day6-v1','COMMITTED')
     ON CONFLICT (chain_id, stack_version, factory_address) DO UPDATE SET
       indexed_through_block=GREATEST(indexer_checkpoints.indexed_through_block, EXCLUDED.indexed_through_block),
       indexed_through_block_hash=EXCLUDED.indexed_through_block_hash,
       status='COMMITTED', updated_at=now()`,
    [SENTINEL_CHAIN_ID, SENTINEL_STACK, SENTINEL_FACTORY, SENTINEL_HASH],
  );
  return readCheckpoint(pool);
}

async function readCheckpoint(pool: InstanceType<typeof Pool>): Promise<bigint> {
  const result = await pool.query(
    `SELECT indexed_through_block FROM indexer_checkpoints
     WHERE chain_id=$1 AND stack_version=$2 AND factory_address=$3`,
    [SENTINEL_CHAIN_ID, SENTINEL_STACK, SENTINEL_FACTORY],
  );
  const raw = result.rows[0]?.indexed_through_block;
  if (raw === undefined || raw === null) throw new Error('rollback sentinel checkpoint missing');
  return BigInt(String(raw));
}

function createRouter(
  candidate: ReleaseProcesses,
  knownGood: ReleaseProcesses,
): Promise<{ server: Server; port: number; switchToKnownGood: () => void }> {
  return freePort().then((port) => {
    let active: 'candidate' | 'known-good' = 'candidate';
    const server = createServer(async (request, response) => {
      const release = active === 'candidate' ? candidate : knownGood;
      const route = request.url ?? '/web';
      const target =
        route === '/api'
          ? `http://127.0.0.1:${release.apiPort}/`
          : route === '/indexer'
            ? `http://127.0.0.1:${release.indexerPort}/`
            : `http://127.0.0.1:${release.webPort}/`;
      try {
        const upstream = await fetch(target, { signal: AbortSignal.timeout(2_000) });
        const body = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'text/plain' });
        response.end(body);
      } catch {
        response.writeHead(503, { 'content-type': 'text/plain' });
        response.end('unhealthy release');
      }
    });
    return new Promise<{ server: Server; port: number; switchToKnownGood: () => void }>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () =>
        resolve({ server, port, switchToKnownGood: () => { active = 'known-good'; } }),
      );
    });
  });
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export async function rehearseServiceRollback(input: RollbackInput): Promise<ServiceRollbackResult> {
  if (!/^[0-9a-f]{40}$/i.test(input.knownGoodCommit)) throw new Error('knownGoodCommit must be a full SHA');
  if (input.candidateMode !== 'INJECTED_UNHEALTHY_APPLICATION_ONLY') throw new Error('unsupported candidateMode');

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'bread-day9-rollback-'));
  const financialTreeBefore = runOrThrow(
    'git',
    ['status', '--porcelain', '--untracked-files=all', '--', 'contracts', 'config/networks', 'config/deployments'],
    repoRoot,
  );
  let knownGoodInfo: { dir: string; removeWorktree: boolean } | undefined;
  let candidate: ReleaseProcesses | undefined;
  let knownGood: ReleaseProcesses | undefined;
  let router: Awaited<ReturnType<typeof createRouter>> | undefined;
  const databaseUrl = process.env.BREAD_DATABASE_URL;
  if (!databaseUrl) throw new Error('BREAD_DATABASE_URL is required');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    ensureBuild(repoRoot);
    knownGoodInfo = await prepareKnownGood(input.knownGoodCommit, tempRoot);

    await runAuthoritativeReconcile();
    const checkpointBefore = await seedCheckpoint(pool);

    candidate = await startRelease(repoRoot);
    knownGood = await startRelease(knownGoodInfo.dir);
    router = await createRouter(candidate, knownGood);

    await Promise.all([
      waitForUrl(`http://127.0.0.1:${router.port}/web`),
      waitForUrl(`http://127.0.0.1:${router.port}/api`, 'api'),
      waitForUrl(`http://127.0.0.1:${router.port}/indexer`, 'indexer'),
    ]);

    // Application-only failure injection: terminate the entire candidate web
    // process group. No contract/config/DB mutation is used to manufacture the failure.
    stopProcess(candidate.web);
    await waitForFailure(`http://127.0.0.1:${candidate.webPort}/`);
    await waitForFailure(`http://127.0.0.1:${router.port}/web`);

    router.switchToKnownGood();
    await Promise.all([
      waitForUrl(`http://127.0.0.1:${router.port}/web`),
      waitForUrl(`http://127.0.0.1:${router.port}/api`, 'api'),
      waitForUrl(`http://127.0.0.1:${router.port}/indexer`, 'indexer'),
    ]);

    const checkpointAfter = await readCheckpoint(pool);
    if (checkpointAfter < checkpointBefore) {
      throw new Error(`indexer checkpoint regressed during rollback: ${checkpointBefore} -> ${checkpointAfter}`);
    }

    const contractMutationCount = assertNoFinancialTreeMutation(financialTreeBefore);
    return {
      rollback: 'PASS',
      contractMutationCount,
      authoritativeReconcile: 'PASS',
      knownGoodCommit: input.knownGoodCommit,
      candidateFailureObserved: true,
      routerTarget: 'KNOWN_GOOD',
      webHealth: 'PASS',
      apiHealth: 'PASS',
      indexerHealth: 'PASS',
      checkpointBefore,
      checkpointAfter,
    };
  } finally {
    await closeServer(router?.server).catch(() => undefined);
    stopRelease(candidate);
    stopRelease(knownGood);
    await pool.end().catch(() => undefined);
    if (knownGoodInfo?.removeWorktree) {
      spawnSync('git', ['worktree', 'remove', '--force', knownGoodInfo.dir], { cwd: repoRoot, stdio: 'ignore' });
      spawnSync('git', ['worktree', 'prune'], { cwd: repoRoot, stdio: 'ignore' });
    }
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
