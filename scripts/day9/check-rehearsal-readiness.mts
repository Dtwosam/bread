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

type DexSourceInventory = Readonly<{
  uniswapV3?: Readonly<{
    activationAllowed?: boolean;
    arcDeployment?: Readonly<{
      status?: string;
      factory?: string | null;
      positionManager?: string | null;
      realDependencyForkProof?: Readonly<{ status?: string }>;
    }>;
  }>;
  uniswapV4?: Readonly<{
    arcDeployment?: Readonly<{
      status?: string;
      activationAllowed?: boolean;
    }>;
  }>;
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

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return isAddress(a) && isAddress(b) && a.toLowerCase() === b.toLowerCase();
}

function hasPublishedMainnetIdentity(network: NetworkManifest): boolean {
  return network.status !== 'AWAITING_OFFICIAL_VALUES'
    && network.chainId !== null
    && network.rpc.length > 0
    && isAddress(network.usdc.address)
    && network.usdc.decimals === 6;
}

/**
 * DEX evidence is a property of the selected network dependencies, not of a
 * Bread deployment that does not exist yet. Keeping this boundary independent
 * avoids a circular gate where deployment is required to authorize deployment.
 */
function hasVerifiedNetworkDexEvidence(
  network: NetworkManifest,
  inventory: DexSourceInventory,
): boolean {
  const family = network.dex?.type;

  if (family === 'UNISWAP_V3') {
    const evidence = inventory.uniswapV3?.arcDeployment;
    return inventory.uniswapV3?.activationAllowed === true
      && evidence?.realDependencyForkProof?.status === 'PASS'
      && /VERIFIED|PASS/.test(evidence?.status ?? '')
      && sameAddress(network.dex?.positionManager, evidence?.positionManager)
      && sameAddress(network.dex?.factory, evidence?.factory)
      && network.dex?.poolManager === null;
  }

  if (family === 'UNISWAP_V4') {
    const evidence = inventory.uniswapV4?.arcDeployment;
    return evidence?.activationAllowed === true
      && /VERIFIED|PASS/.test(evidence?.status ?? '')
      && isAddress(network.dex?.positionManager)
      && isAddress(network.dex?.poolManager)
      && network.dex?.factory === null;
  }

  return false;
}

function hasReadyDeploymentManifest(deployment: DeploymentManifest): boolean {
  if (!['DEPLOYED', 'VERIFIED'].includes(deployment.status)) return false;
  if (!isHash(deployment.economicsConfigHash) || !isHash(deployment.dexEvidenceHash)) return false;
  if (!isAddress(deployment.authorities.protocolAdmin) || !isAddress(deployment.authorities.guardian)) return false;
  return Object.values(deployment.core).every((address) => isAddress(address));
}

function deploymentMatchesVerifiedDex(
  network: NetworkManifest,
  deployment: DeploymentManifest,
): boolean {
  const family = network.dex?.type;
  if (!deployment.adapter.active || deployment.adapter.family !== family) return false;
  if (!isHash(deployment.adapter.configHash) || !isAddress(deployment.adapter.adapter)) return false;

  if (family === 'UNISWAP_V3') {
    return sameAddress(deployment.adapter.positionManager, network.dex?.positionManager)
      && sameAddress(deployment.adapter.v3Factory, network.dex?.factory)
      && deployment.adapter.poolManager === null;
  }

  if (family === 'UNISWAP_V4') {
    return sameAddress(deployment.adapter.positionManager, network.dex?.positionManager)
      && sameAddress(deployment.adapter.poolManager, network.dex?.poolManager)
      && deployment.adapter.v3Factory === null;
  }

  return false;
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
  const dexInventory = readJson<DexSourceInventory>('config/protocol/day5-dex-source-inventory.json');

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

  if (!hasVerifiedNetworkDexEvidence(network, dexInventory)) {
    return { ready: false, code: 'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED' };
  }

  if (!hasReadyDeploymentManifest(deployment) || !deploymentMatchesVerifiedDex(network, deployment)) {
    return { ready: false, code: 'DEPLOYMENT_MANIFEST_NOT_READY' };
  }

  return {
    ready: true,
    mode: 'CANONICAL',
    canonicalDeploymentClaim: true,
    productionMoneyClaim: false,
  };
}
