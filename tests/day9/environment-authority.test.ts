import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;

const OFFICIAL_ARC_TESTNET = {
  source: 'https://docs.arc.io/arc/references/connect-to-arc',
  contractSource: 'https://docs.arc.io/arc/references/contract-addresses',
  chainId: 5_042_002,
  rpc: 'https://rpc.testnet.arc.network',
  websocket: 'wss://rpc.testnet.arc.network',
  explorer: 'https://testnet.arcscan.app',
  usdc: '0x3600000000000000000000000000000000000000',
  usdcDecimals: 6,
} as const;

describe('Day 9 environment authority', () => {
  it('matches the current official Arc testnet connection facts', () => {
    const network = readJson('config/networks/arc-testnet.json');

    expect(network.chainId).toBe(OFFICIAL_ARC_TESTNET.chainId);
    expect(network.rpc).toEqual([OFFICIAL_ARC_TESTNET.rpc]);
    expect(network.websocket).toEqual([OFFICIAL_ARC_TESTNET.websocket]);
    expect(network.explorer).toBe(OFFICIAL_ARC_TESTNET.explorer);
    expect(String(network.usdc?.address).toLowerCase()).toBe(OFFICIAL_ARC_TESTNET.usdc);
    expect(network.usdc?.decimals).toBe(OFFICIAL_ARC_TESTNET.usdcDecimals);
  });

  it('keeps canonical DEX and Bread deployment authority unresolved until independently verified', () => {
    const network = readJson('config/networks/arc-testnet.json');
    const deployment = readJson('config/deployments/arc-testnet.day5.json');

    expect(network.dex).toEqual({
      type: 'UNRESOLVED_TESTNET_ADAPTER',
      poolManager: null,
      positionManager: null,
      factory: null,
    });
    expect(deployment.status).toBe('BLOCKED_UNTIL_VERIFIED_DEX_AND_PRODUCTION_CONFIG');
    expect(deployment.core).toEqual({
      factory: null,
      deployer: null,
      feePolicy: null,
      feeEscrow: null,
      emergencyController: null,
      locker: null,
      coordinator: null,
    });
    expect(deployment.adapter?.active).toBe(false);
    expect(deployment.adapter?.family).toBeNull();
    expect(deployment.authorities).toEqual({ protocolAdmin: null, guardian: null });
    expect(deployment.economicsConfigHash).toBeNull();
    expect(deployment.dexEvidenceHash).toBeNull();
    expect(deployment.deploymentStartBlock).toBeNull();
  });
});
