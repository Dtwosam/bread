import { describe, expect, it } from 'vitest';

import { buildArcTestnetDeploymentPlan } from '../../scripts/day9/arc-testnet-deployment-preflight-lib.mjs';

const network = {
  chainId: 5_042_002,
  usdc: {
    address: '0x3600000000000000000000000000000000000000',
    decimals: 6,
  },
  dex: {
    type: 'UNISWAP_V3',
    poolManager: null,
    positionManager: '0x444Cc395346428216fB6f2892eb03cB804aE4CD5',
    factory: '0x0fB6EEDA6e90E90797083861A75D15752a27f59c',
  },
} as const;

const authority = {
  deploymentAuthority: '0x1bc5a40329b309be3ac77cb3688061b985f8d3fb',
  guardian: '0xdcb9cb7038ff1a282265a855754dba8695a3121c',
  safe: '0x9004e285521d69197cd9965c301b02161eb1d0d8',
  owners: [
    '0x2473795adf14b131ca76580acb4ecdff7ac08011',
    '0x5c277c90ff2608c4c65445498d63c77264998bb2',
    '0xf7755a64cc76051839968b367400f3215cef8d48',
  ],
} as const;

describe('Day 9 Arc Testnet Bread deployment preflight plan', () => {
  it('reuses the controlled Day-9 economics only as explicit non-production testnet values', () => {
    const plan = buildArcTestnetDeploymentPlan({ network, authority });

    expect(plan).toMatchObject({
      chainId: 5_042_002,
      productionMoneyClaim: false,
      productionAuthorityClaim: false,
      protocolAdmin: authority.safe,
      protocolFeeRecipient: authority.safe,
      guardian: authority.guardian,
      usdc: network.usdc.address,
      dex: {
        family: 'UNISWAP_V3',
        positionManager: network.dex.positionManager,
        factory: network.dex.factory,
        poolManager: null,
        fee: 3000,
      },
      economics: {
        supply: '1000000000000000000000000',
        phantomQuote: '10000000000',
        graduationThreshold: '100000000000',
        launchFeeUsdc: '0',
        tradeFeeBps: '100',
        protocolFeeShareBps: '2500',
        maxCreatorTaxBps: '500',
      },
      stackVersionLabel: 'BREAD_DAY9_ARC_TESTNET_STACK_V1',
      dexEvidenceLabel: 'BREAD_DAY9_ARC_TESTNET_SYNTHRA_V3_REAL_DEPENDENCY_FORK_PASS',
      forkEvidenceBlock: 56_439_192,
    });
  });

  it('rejects a non-V3 or incomplete Arc Testnet dependency boundary', () => {
    expect(() => buildArcTestnetDeploymentPlan({
      network: {
        ...network,
        dex: { type: 'UNRESOLVED_TESTNET_ADAPTER', poolManager: null, positionManager: null, factory: null },
      },
      authority,
    })).toThrow(/UNISWAP_V3/i);
  });

  it('rejects a Safe owner/deployer/Guardian overlap', () => {
    expect(() => buildArcTestnetDeploymentPlan({
      network,
      authority: {
        ...authority,
        guardian: authority.owners[0],
      },
    })).toThrow(/distinct/i);
  });

  it('rejects anything other than canonical six-decimal Arc Testnet USDC', () => {
    expect(() => buildArcTestnetDeploymentPlan({
      network: {
        ...network,
        usdc: { ...network.usdc, decimals: 18 },
      },
      authority,
    })).toThrow(/6-decimal/i);
  });
});
