import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { assessDay9RehearsalReadiness } from './check-rehearsal-readiness.mts';

export type LiveArcRehearsalBlocker =
  | 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED'
  | 'ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY';

export type LiveArcRehearsalGate = Readonly<
  | { authorized: true; blockers: readonly [] }
  | { authorized: false; blockers: readonly LiveArcRehearsalBlocker[] }
>;

type DeploymentManifest = Readonly<{
  status: string;
  core: Readonly<Record<string, string | null>>;
  adapter: Readonly<{
    active: boolean;
    family: string | null;
    adapter: string | null;
    configHash: string | null;
    positionManager: string | null;
    poolManager: string | null;
    v3Factory: string | null;
  }>;
  authorities: Readonly<{
    protocolAdmin: string | null;
    guardian: string | null;
  }>;
  economicsConfigHash: string | null;
  dexEvidenceHash: string | null;
}>;

function readDeploymentManifest(): DeploymentManifest {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'config/deployments/arc-testnet.day5.json'), 'utf8'),
  ) as DeploymentManifest;
}

function isAddress(value: string | null | undefined): value is string {
  return /^0x[0-9a-fA-F]{40}$/.test(value ?? '') && !/^0x0{40}$/i.test(value ?? '');
}

function isHash(value: string | null | undefined): value is string {
  return /^0x[0-9a-fA-F]{64}$/.test(value ?? '') && !/^0x0{64}$/i.test(value ?? '');
}

function deploymentManifestIsReady(deployment: DeploymentManifest): boolean {
  if (!['DEPLOYED', 'VERIFIED'].includes(deployment.status)) return false;
  if (!isHash(deployment.economicsConfigHash) || !isHash(deployment.dexEvidenceHash)) return false;
  if (!isHash(deployment.adapter.configHash) || !isAddress(deployment.adapter.adapter)) return false;
  if (!isAddress(deployment.authorities.protocolAdmin) || !isAddress(deployment.authorities.guardian)) return false;
  if (!Object.values(deployment.core).every((address) => isAddress(address))) return false;

  if (!deployment.adapter.active) return false;
  if (deployment.adapter.family === 'UNISWAP_V3') {
    return isAddress(deployment.adapter.positionManager)
      && isAddress(deployment.adapter.v3Factory)
      && deployment.adapter.poolManager === null;
  }
  if (deployment.adapter.family === 'UNISWAP_V4') {
    return isAddress(deployment.adapter.positionManager)
      && isAddress(deployment.adapter.poolManager)
      && deployment.adapter.v3Factory === null;
  }
  return false;
}

/**
 * Read-only authorization gate for a live Arc Testnet Day-9 rehearsal.
 *
 * It classifies repository state only. It never reads private keys, selects a
 * DEX, fills canonical manifests, chooses production economics/authorities, or
 * broadcasts a transaction. A false result is a hard stop for live deploy and
 * smoke commands.
 */
export function checkLiveArcRehearsal(): LiveArcRehearsalGate {
  const blockers: LiveArcRehearsalBlocker[] = [];
  const canonical = assessDay9RehearsalReadiness({ network: 'arc-testnet', mode: 'CANONICAL' });
  const deployment = readDeploymentManifest();

  if (!canonical.ready && canonical.code === 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED') {
    blockers.push('ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED');
  }

  if (!deploymentManifestIsReady(deployment)) {
    blockers.push('ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY');
  }

  return blockers.length === 0
    ? { authorized: true, blockers: [] }
    : { authorized: false, blockers };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkLiveArcRehearsal();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.authorized) process.exitCode = 2;
}
