import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Day9Network = 'arc-testnet' | 'arc-mainnet';
export type Day9RehearsalMode = 'CANONICAL' | 'CONTROLLED_FIXTURE';

export type Day9Readiness =
  | Readonly<{
      ready: true;
      mode: 'CANONICAL';
      canonicalDeploymentClaim: true;
      productionMoneyClaim: false;
    }>
  | Readonly<{
      ready: true;
      mode: 'CONTROLLED_FIXTURE';
      canonicalDeploymentClaim: false;
      productionMoneyClaim: false;
    }>
  | Readonly<{
      ready: false;
      code:
        | 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED'
        | 'ARC_MAINNET_VALUES_REQUIRED'
        | 'DEPLOYMENT_MANIFEST_NOT_READY';
    }>;

type NetworkManifest = Readonly<{
  status?: string;
  chainId: number | null;
  rpc: readonly string[];
  usdc: Readonly<{ address: string | null; decimals: number }>;
  dex?: Readonly<{
    type?: string | null;
    poolManager?: string | null;
    positionManager?: string | null;
    factory?: string | null;
  }>;
}>;

type DeploymentManifest = Readonly<{
  status: string;
  chainId: number | null;
  core: Readonly<Record<string, string | null>>;
  adapter: Readonly<{
    active: boolean;
    family: string | null;
    adapter: string | null;
    positionManager: string | null;
    poolManager: string | null;
    v3Factory: string | null;
    configHash: string | null;
  }>;
  authorities: Readonly<{
    protocolAdmin: string | null;
    guardian: string | null;
  }>;
  economicsConfigHash: string | null;
  dexEvidenceHash: string | null;
}>;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as T;
}

function isAddress(value: string | null | undefined): value is string {
  return /^0x[0-9a-fA-F]{40}$/.test(value ?? '') && !/^0x0{40}$/i.test(value ?? '');
}

function isHash(value: string | null | undefined): value is string {
  return /^0x[0-9a-fA-F]{64}$/.test(value ?? '') && !/^0x0{64}$/i.test(value ?? '');
}

function hasPublishedMainnetIdentity(network: NetworkManifest): boolean {
  return network.status !== 'AWAITING_OFFICIAL_VALUES'
    && network.chainId !== null
    && network.rpc.length > 0
    && isAddress(network.usdc.address)
    && network.usdc.decimals === 6;
}

function hasVerifiedDexBoundary(network: NetworkManifest, deployment: DeploymentManifest): boolean {
  const family = deployment.adapter.family;
  if (!deployment.adapter.active || (family !== 'UNISWAP_V3' && family !== 'UNISWAP_V4')) return false;
  if (network.dex?.type !== family) return false;
  if (!isHash(deployment.dexEvidenceHash) || !isHash(deployment.adapter.configHash)) return false;
  if (!isAddress(deployment.adapter.adapter) || !isAddress(deployment.adapter.positionManager)) return false;

  if (family === 'UNISWAP_V3') {
    return isAddress(deployment.adapter.v3Factory) && deployment.adapter.poolManager === null;
  }
  return isAddress(deployment.adapter.poolManager) && deployment.adapter.v3Factory === null;
}

function hasReadyDeploymentManifest(deployment: DeploymentManifest): boolean {
  if (!['DEPLOYED', 'VERIFIED'].includes(deployment.status)) return false;
  if (!isHash(deployment.economicsConfigHash)) return false;
  if (!isAddress(deployment.authorities.protocolAdmin) || !isAddress(deployment.authorities.guardian)) return false;
  return Object.values(deployment.core).every((address) => isAddress(address));
}

/**
 * Classifies whether Day-9 rehearsal may use canonical Arc deployment claims.
 *
 * This function is deliberately read-only. It does not populate manifests,
 * select a DEX, infer production economics, choose authorities, or authorize a
 * transaction broadcast. CONTROLLED_FIXTURE means local/CI rehearsal only and
 * can never become evidence of a canonical Arc or production-money deployment.
 */
export function assessDay9RehearsalReadiness(input: Readonly<{
  network: Day9Network;
  mode: Day9RehearsalMode;
}>): Day9Readiness {
  const network = readJson<NetworkManifest>(`config/networks/${input.network}.json`);
  const deployment = readJson<DeploymentManifest>(`config/deployments/${input.network}.day5.json`);

  if (input.network === 'arc-mainnet' && !hasPublishedMainnetIdentity(network)) {
    return { ready: false, code: 'ARC_MAINNET_VALUES_REQUIRED' };
  }

  if (input.mode === 'CONTROLLED_FIXTURE') {
    return {
      ready: true,
      mode: 'CONTROLLED_FIXTURE',
      canonicalDeploymentClaim: false,
      productionMoneyClaim: false,
    };
  }

  if (!hasVerifiedDexBoundary(network, deployment)) {
    return { ready: false, code: 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED' };
  }

  if (!hasReadyDeploymentManifest(deployment)) {
    return { ready: false, code: 'DEPLOYMENT_MANIFEST_NOT_READY' };
  }

  return {
    ready: true,
    mode: 'CANONICAL',
    canonicalDeploymentClaim: true,
    productionMoneyClaim: false,
  };
}
