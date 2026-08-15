import { validateAuthoritySet } from './arc-safe-bootstrap-lib.mjs';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

function requireAddress(value, label) {
  if (!ADDRESS_RE.test(value ?? '') || value.toLowerCase() === ZERO) {
    throw new Error(`${label} must be a non-zero EVM address`);
  }
  return value;
}

// Public Arc Testnet uses the same Day-9 controlled-rehearsal economics shape,
// but quote-side fixture values are divided by 10,000 so a faucet-funded smoke
// can exercise launch -> trade -> graduate -> lock without implying production economics.
export const DAY9_ARC_TESTNET_ECONOMICS = Object.freeze({
  supply: '1000000000000000000000000',
  phantomQuote: '1000000', // 1 USDC, down from 10,000 USDC local controlled fixture.
  graduationThreshold: '10000000', // 10 USDC, down from 100,000 USDC.
  launchFeeUsdc: '0',
  tradeFeeBps: '100',
  protocolFeeShareBps: '2500',
  maxCreatorTaxBps: '500',
});

export const DAY9_ARC_TESTNET_SMOKE = Object.freeze({
  quoteIn: '11000000', // 11 USDC, preserves the controlled rehearsal's threshold-crossing ratio.
  minimumFunding: '12000000', // 12 USDC balance floor before the smoke transaction.
});

export const DAY9_ARC_TESTNET_ECONOMICS_PROVENANCE =
  'DAY9_CONTROLLED_REHEARSAL_QUOTE_VALUES_DIVIDED_BY_10000';
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
    smoke: DAY9_ARC_TESTNET_SMOKE,
    economicsProvenance: DAY9_ARC_TESTNET_ECONOMICS_PROVENANCE,
    stackVersionLabel: DAY9_ARC_TESTNET_STACK_VERSION_LABEL,
    dexEvidenceLabel: DAY9_ARC_TESTNET_DEX_EVIDENCE_LABEL,
    forkEvidenceBlock: DAY9_ARC_TESTNET_FORK_EVIDENCE_BLOCK,
  });
}
