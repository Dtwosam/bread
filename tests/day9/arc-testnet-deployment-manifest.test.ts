import { describe, expect, it } from 'vitest';

import { buildArcTestnetDeploymentManifest } from '../../scripts/day9/arc-testnet-deployment-manifest-lib.mjs';

const plan = {
  chainId: 5_042_002,
  protocolAdmin: '0x9004e285521d69197cd9965c301b02161eb1d0d8',
  guardian: '0xdcb9cb7038ff1a282265a855754dba8695a3121c',
  dex: {
    family: 'UNISWAP_V3',
    positionManager: '0x444Cc395346428216fB6f2892eb03cB804aE4CD5',
    factory: '0x0fB6EEDA6e90E90797083861A75D15752a27f59c',
    poolManager: null,
  },
} as const;

const created = {
  factory: '0x1000000000000000000000000000000000000001',
  deployer: '0x1000000000000000000000000000000000000002',
  feePolicy: '0x1000000000000000000000000000000000000003',
  feeEscrow: '0x1000000000000000000000000000000000000004',
  emergencyController: '0x1000000000000000000000000000000000000005',
  locker: '0x1000000000000000000000000000000000000006',
  coordinator: '0x1000000000000000000000000000000000000007',
  adapter: '0x1000000000000000000000000000000000000008',
} as const;

const hashes = {
  adapterConfigHash: `0x${'11'.repeat(32)}`,
  economicsConfigHash: `0x${'22'.repeat(32)}`,
  dexEvidenceHash: `0x${'33'.repeat(32)}`,
} as const;

describe('Day 9 Arc Testnet deployment manifest construction', () => {
  it('records the deployed Bread stack behind the generic V3 adapter boundary', () => {
    expect(buildArcTestnetDeploymentManifest({
      plan,
      created,
      hashes,
      deploymentStartBlock: 56_500_000,
      status: 'DEPLOYED',
    })).toEqual({
      schema: 'bread://schemas/day5-graduation-deployment-v1',
      network: 'arc-testnet',
      status: 'DEPLOYED',
      chainId: 5_042_002,
      core: {
        factory: created.factory,
        deployer: created.deployer,
        feePolicy: created.feePolicy,
        feeEscrow: created.feeEscrow,
        emergencyController: created.emergencyController,
        locker: created.locker,
        coordinator: created.coordinator,
      },
      adapter: {
        active: true,
        family: 'UNISWAP_V3',
        adapter: created.adapter,
        positionManager: plan.dex.positionManager,
        poolManager: null,
        v3Factory: plan.dex.factory,
        configHash: hashes.adapterConfigHash,
      },
      authorities: {
        protocolAdmin: plan.protocolAdmin,
        guardian: plan.guardian,
      },
      economicsConfigHash: hashes.economicsConfigHash,
      dexEvidenceHash: hashes.dexEvidenceHash,
      deploymentStartBlock: 56_500_000,
    });
  });

  it('rejects an incomplete deployed address set', () => {
    expect(() => buildArcTestnetDeploymentManifest({
      plan,
      created: { ...created, adapter: '0x0000000000000000000000000000000000000000' },
      hashes,
      deploymentStartBlock: 56_500_000,
      status: 'DEPLOYED',
    })).toThrow(/adapter/i);
  });

  it('allows only DEPLOYED or VERIFIED status', () => {
    expect(() => buildArcTestnetDeploymentManifest({
      plan,
      created,
      hashes,
      deploymentStartBlock: 56_500_000,
      status: 'BLOCKED',
    })).toThrow(/status/i);
  });
});
