import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { rehearseServiceRollback } from './rehearse-service-rollback.mts';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const contractsRoot = path.join(repoRoot, 'contracts');

export const REQUIRED_RECOVERY_DRILL_IDS = [
  'GUARDIAN_PAUSE_NEW_LAUNCHES',
  'ESCALATE_BUY_TRADING_PAUSE',
  'PROTOCOL_ADMIN_UNPAUSE',
  'APPLICATION_ROLLBACK',
  'RPC_FAILOVER',
  'INDEXER_REBUILD_RECONCILE',
  'SUBMITTED_TX_BROWSER_REFRESH_RECOVERY',
  'FAILED_GRADUATION_RETRY',
  'GUARDIAN_ROTATION',
  'MULTISIG_SIGNER_RECOVERY_ROTATION',
] as const;

export type RecoveryDrillId = (typeof REQUIRED_RECOVERY_DRILL_IDS)[number];
export type RecoveryDrillStatus = 'PASS' | 'BLOCKED' | 'MISSING' | 'UNEXECUTED';
export type RecoveryEvidenceKind = 'EXECUTED_TEST' | 'EXECUTED_REHEARSAL' | 'ENVIRONMENT_BLOCKER' | 'PROSE_ONLY';

export type RecoveryDrillResult = Readonly<{
  id: RecoveryDrillId;
  status: RecoveryDrillStatus;
  evidence: string;
  evidenceKind: RecoveryEvidenceKind;
}>;

export type RecoveryDrillSummary = Readonly<{
  status: 'PASS' | 'BLOCKED';
  blocker: 'DAY9_RECOVERY_DRILL_BLOCKED_MULTISIG_ENVIRONMENT' | null;
  drills: readonly RecoveryDrillResult[];
}>;

type CommandEvidence = Readonly<{
  evidence: string;
  evidenceKind: 'EXECUTED_TEST';
}>;

type BrowserRecoveryProof = Readonly<{
  status?: string;
  commit?: string;
  evidence?: string;
  evidenceKind?: string;
  transactionRecoverySpecIncluded?: boolean;
  manifestRestoration?: string;
}>;

function execute(
  evidence: string,
  command: string,
  args: readonly string[],
  options: Readonly<{
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
  }> = {},
): CommandEvidence {
  const result = spawnSync(command, [...args], {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
    timeout: options.timeout ?? 300_000,
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Recovery drill evidence failed: ${evidence}`,
        `${command} ${args.join(' ')}`,
        `status=${String(result.status)} signal=${String(result.signal)}`,
        String(result.stdout ?? ''),
        String(result.stderr ?? ''),
      ].join('\n'),
    );
  }

  return { evidence, evidenceKind: 'EXECUTED_TEST' };
}

function currentCommit(): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`git rev-parse HEAD failed\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return String(result.stdout).trim();
}

function pass(id: RecoveryDrillId, evidence: CommandEvidence): RecoveryDrillResult {
  return { id, status: 'PASS', ...evidence };
}

function requireDbIntegration(): NodeJS.ProcessEnv {
  if (process.env.BREAD_DB_INTEGRATION !== '1' || !process.env.BREAD_DATABASE_URL) {
    throw new Error('Day 9 recovery drills require BREAD_DB_INTEGRATION=1 and BREAD_DATABASE_URL');
  }
  return process.env;
}

function runEmergencyDrills(): readonly RecoveryDrillResult[] {
  const evidence = execute(
    'contracts/test/BreadEmergencyController.t.sol',
    'forge',
    ['test', '--match-contract', 'BreadEmergencyControllerTest', '-q'],
    { cwd: contractsRoot, timeout: 180_000 },
  );

  return [
    pass('GUARDIAN_PAUSE_NEW_LAUNCHES', evidence),
    pass('ESCALATE_BUY_TRADING_PAUSE', evidence),
    pass('PROTOCOL_ADMIN_UNPAUSE', evidence),
    pass('GUARDIAN_ROTATION', evidence),
  ];
}

async function runApplicationRollback(): Promise<RecoveryDrillResult> {
  const result = await rehearseServiceRollback({
    knownGoodCommit: 'fe9b13f1ce271fd5423fdd76de13034dac18fee1',
    candidateMode: 'INJECTED_UNHEALTHY_APPLICATION_ONLY',
  });
  if (
    result.rollback !== 'PASS'
    || result.contractMutationCount !== 0
    || result.authoritativeReconcile !== 'PASS'
    || result.routerTarget !== 'KNOWN_GOOD'
  ) {
    throw new Error('Day 9 application rollback rehearsal did not reach the accepted recovery state');
  }
  return {
    id: 'APPLICATION_ROLLBACK',
    status: 'PASS',
    evidence: 'scripts/day9/rehearse-service-rollback.mts + tests/day9/service-rollback-rehearsal.test.ts',
    evidenceKind: 'EXECUTED_REHEARSAL',
  };
}

function runRpcFailover(): RecoveryDrillResult {
  return pass(
    'RPC_FAILOVER',
    execute(
      'tests/day8/rpc-failover-under-load.test.ts',
      'pnpm',
      ['exec', 'vitest', 'run', 'tests/day8/rpc-failover-under-load.test.ts'],
      { timeout: 180_000 },
    ),
  );
}

function runIndexerReconcile(): RecoveryDrillResult {
  return pass(
    'INDEXER_REBUILD_RECONCILE',
    execute(
      'tests/day6/rebuild-reconcile.test.ts',
      'pnpm',
      ['exec', 'vitest', 'run', 'tests/day6/rebuild-reconcile.test.ts'],
      { env: requireDbIntegration(), timeout: 240_000 },
    ),
  );
}

async function runBrowserTransactionRecovery(): Promise<RecoveryDrillResult> {
  const markerPath = process.env.BREAD_DAY9_BROWSER_RECOVERY_MARKER;
  if (!markerPath) {
    throw new Error('BREAD_DAY9_BROWSER_RECOVERY_MARKER is required; browser recovery must execute as a standalone same-job predecessor');
  }

  let proof: BrowserRecoveryProof;
  try {
    proof = JSON.parse(await readFile(markerPath, 'utf8')) as BrowserRecoveryProof;
  } catch (error) {
    throw new Error(`standalone browser recovery proof is unavailable or invalid at ${markerPath}: ${String(error)}`);
  }

  const commit = currentCommit();
  if (
    proof.status !== 'PASS'
    || proof.commit !== commit
    || proof.evidenceKind !== 'EXECUTED_TEST'
    || proof.transactionRecoverySpecIncluded !== true
    || proof.manifestRestoration !== 'PASS'
    || !proof.evidence
  ) {
    throw new Error(`standalone browser recovery proof does not match current commit ${commit}: ${JSON.stringify(proof)}`);
  }

  return {
    id: 'SUBMITTED_TX_BROWSER_REFRESH_RECOVERY',
    status: 'PASS',
    evidence: proof.evidence,
    evidenceKind: 'EXECUTED_TEST',
  };
}

function runGraduationRetry(): RecoveryDrillResult {
  return pass(
    'FAILED_GRADUATION_RETRY',
    execute(
      'contracts/test/BreadGraduationRetry.t.sol',
      'forge',
      ['test', '--match-contract', 'BreadGraduationRetryTest', '-q'],
      { cwd: contractsRoot, timeout: 180_000 },
    ),
  );
}

function multisigEnvironmentBlocker(): RecoveryDrillResult {
  // There is currently no Safe-compatible threshold signer-change/recovery
  // executor in the repository or CI environment. A configured Protocol Admin
  // contract address is not evidence of a threshold recovery drill. This must
  // remain BLOCKED until an actual Safe-compatible environment executes it.
  return {
    id: 'MULTISIG_SIGNER_RECOVERY_ROTATION',
    status: 'BLOCKED',
    evidence: 'ENVIRONMENT_CHECK:NO_SAFE_COMPATIBLE_THRESHOLD_RECOVERY_EXECUTOR_CONFIGURED',
    evidenceKind: 'ENVIRONMENT_BLOCKER',
  };
}

export async function runRecoveryDrills(): Promise<RecoveryDrillSummary> {
  requireDbIntegration();

  const emergency = runEmergencyDrills();
  const browserRecovery = await runBrowserTransactionRecovery();
  const applicationRollback = await runApplicationRollback();
  const rpcFailover = runRpcFailover();
  const indexerReconcile = runIndexerReconcile();
  const graduationRetry = runGraduationRetry();
  const multisig = multisigEnvironmentBlocker();

  const byId = new Map<RecoveryDrillId, RecoveryDrillResult>();
  for (const result of [
    ...emergency,
    applicationRollback,
    rpcFailover,
    indexerReconcile,
    browserRecovery,
    graduationRetry,
    multisig,
  ]) {
    if (byId.has(result.id)) throw new Error(`duplicate recovery drill result: ${result.id}`);
    byId.set(result.id, result);
  }

  const drills = REQUIRED_RECOVERY_DRILL_IDS.map((id) => {
    const result = byId.get(id);
    if (!result) {
      return { id, status: 'MISSING', evidence: '', evidenceKind: 'PROSE_ONLY' } as const;
    }
    return result;
  });

  const blocked = drills.some((drill) => drill.status === 'BLOCKED');
  const summary: RecoveryDrillSummary = {
    status: blocked ? 'BLOCKED' : 'PASS',
    blocker: blocked ? 'DAY9_RECOVERY_DRILL_BLOCKED_MULTISIG_ENVIRONMENT' : null,
    drills,
  };

  console.log(`DAY9_RECOVERY_DRILL_SUMMARY=${JSON.stringify(summary)}`);
  return summary;
}
