import { validateAuthoritySet } from './arc-safe-bootstrap-lib.mjs';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

function requireAddress(value, label) {
  if (!ADDRESS_RE.test(value ?? '') || value.toLowerCase() === ZERO) {
    throw new Error(`${label} must be a non-zero EVM address`);
  }
  return value;
}

export const DAY9_ARC_TESTNET_ECONOMICS = Object.freeze({
  supply: '1000000000000000000000000',
  phantomQuote: '10000000000',
  graduationThreshold: '100000000000',
  launchFeeUsdc: '0',
  tradeFeeBps: '100',
  protocolFeeShareBps: '2500',
  maxCreatorTaxBps: '500',
});

export const DAY9_ARC_TESTNET_V3_FEE = 3000;
export const DAY9_ARC_TESTNET_STACK_VERSION_LABEL = 'BREAD_DAY9_ARC_TESTNET_STACK_V1';
export const DAY9_ARC_TESTNET_DEX_EVIDENCE_LABEL =
  'BREAD_DAY9_ARC_TESTNET_SYNTHRA_V3_REAL_DEPENDENCY_FORK_PASS';
export const DAY9_ARC_TESTNET_FORK_EVIDENCE_BLOCK = 56_439_192;

export function buildArcTestnetDeploymentPlan({ network, authority }) {
  if (network?.chainId !== 5_042_002) {
    throw new Error('Arc Testnet chain ID must be 5042002');
  }
  if (
    network?.usdc?.address?.toLowerCase() !== '0x3600000000000000000000000000000000000000'
    || network?.usdc?.decimals !== 6
  ) {
    throw new Error('canonical 6-decimal Arc Testnet USDC is required');
  }
  if (
    network?.dex?.type !== 'UNISWAP_V3'
    || network.dex.poolManager !== null
    || !network.dex.positionManager
    || !network.dex.factory
  ) {
    throw new Error('verified UNISWAP_V3 Arc Testnet dependencies are required');
  }

  requireAddress(network.dex.positionManager, 'positionManager');
  requireAddress(network.dex.factory, 'v3Factory');
  requireAddress(authority?.safe, 'Safe');
  validateAuthoritySet({
    deployer: authority?.deploymentAuthority,
    guardian: authority?.guardian,
    owners: authority?.owners,
  });

  return Object.freeze({
    chainId: network.chainId,
    productionMoneyClaim: false,
    productionAuthorityClaim: false,
    deploymentAuthority: authority.deploymentAuthority,
    protocolAdmin: authority.safe,
    protocolFeeRecipient: authority.safe,
    guardian: authority.guardian,
    safeOwners: Object.freeze([...authority.owners]),
    usdc: network.usdc.address,
    dex: Object.freeze({
      family: 'UNISWAP_V3',
      positionManager: network.dex.positionManager,
      factory: network.dex.factory,
      poolManager: null,
      fee: DAY9_ARC_TESTNET_V3_FEE,
    }),
    economics: DAY9_ARC_TESTNET_ECONOMICS,
    stackVersionLabel: DAY9_ARC_TESTNET_STACK_VERSION_LABEL,
    dexEvidenceLabel: DAY9_ARC_TESTNET_DEX_EVIDENCE_LABEL,
    forkEvidenceBlock: DAY9_ARC_TESTNET_FORK_EVIDENCE_BLOCK,
  });
}
