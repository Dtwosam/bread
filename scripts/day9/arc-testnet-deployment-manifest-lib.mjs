const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

function requireAddress(value, label) {
  if (!ADDRESS_RE.test(value ?? '') || value.toLowerCase() === ZERO) {
    throw new Error(`${label} must be a non-zero EVM address`);
  }
  return value;
}

function requireHash(value, label) {
  if (!HASH_RE.test(value ?? '') || /^0x0{64}$/i.test(value)) {
    throw new Error(`${label} must be a non-zero bytes32 hash`);
  }
  return value;
}

export function buildArcTestnetDeploymentManifest({
  plan,
  created,
  hashes,
  deploymentStartBlock,
  status,
}) {
  if (!['DEPLOYED', 'VERIFIED'].includes(status)) {
    throw new Error('deployment manifest status must be DEPLOYED or VERIFIED');
  }
  if (plan?.chainId !== 5_042_002) throw new Error('Arc Testnet chain ID must be 5042002');
  if (plan?.dex?.family !== 'UNISWAP_V3' || plan.dex.poolManager !== null) {
    throw new Error('Arc Testnet deployment manifest requires the verified UNISWAP_V3 boundary');
  }
  if (!Number.isSafeInteger(deploymentStartBlock) || deploymentStartBlock <= 0) {
    throw new Error('deploymentStartBlock must be a positive integer');
  }

  const core = {
    factory: requireAddress(created?.factory, 'factory'),
    deployer: requireAddress(created?.deployer, 'deployer'),
    feePolicy: requireAddress(created?.feePolicy, 'feePolicy'),
    feeEscrow: requireAddress(created?.feeEscrow, 'feeEscrow'),
    emergencyController: requireAddress(created?.emergencyController, 'emergencyController'),
    locker: requireAddress(created?.locker, 'locker'),
    coordinator: requireAddress(created?.coordinator, 'coordinator'),
  };
  const adapter = requireAddress(created?.adapter, 'adapter');

  return {
    schema: 'bread://schemas/day5-graduation-deployment-v1',
    network: 'arc-testnet',
    status,
    chainId: plan.chainId,
    core,
    adapter: {
      active: true,
      family: 'UNISWAP_V3',
      adapter,
      positionManager: requireAddress(plan.dex.positionManager, 'positionManager'),
      poolManager: null,
      v3Factory: requireAddress(plan.dex.factory, 'v3Factory'),
      configHash: requireHash(hashes?.adapterConfigHash, 'adapterConfigHash'),
    },
    authorities: {
      protocolAdmin: requireAddress(plan.protocolAdmin, 'protocolAdmin'),
      guardian: requireAddress(plan.guardian, 'guardian'),
    },
    economicsConfigHash: requireHash(hashes?.economicsConfigHash, 'economicsConfigHash'),
    dexEvidenceHash: requireHash(hashes?.dexEvidenceHash, 'dexEvidenceHash'),
    deploymentStartBlock,
  };
}
