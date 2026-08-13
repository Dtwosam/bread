import { describe, expect, it } from 'vitest';

import { parseNetworkManifest, parseProtocolDeploymentManifest } from '../../packages/config/src/manifests.js';
import { resolveProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (byte: string) => `0x${byte.repeat(40)}`;

const QUOTE = address('1');
const V3_FACTORY = address('2');
const POSITION_MANAGER = address('3');
const ROUTER = address('4');
const QUOTER = address('5');

function network() {
  return parseNetworkManifest({
    schemaVersion: 1,
    network: 'arc-testnet',
    chainId: 5_042_002,
    nativeGasAsset: 'USDC',
    nativePrecision: 18,
    rpc: ['https://rpc.testnet.arc.network'],
    websocket: ['wss://rpc.testnet.arc.network'],
    explorer: 'https://testnet.arcscan.app',
    usdc: { address: QUOTE, decimals: 6 },
    dex: {
      type: 'UNISWAP_V3',
      poolManager: null,
      positionManager: POSITION_MANAGER,
      factory: V3_FACTORY,
      swapRouter: ROUTER,
      swapRouterKind: 'V3_SWAP_ROUTER_02',
      quoter: QUOTER,
      quoterKind: 'V3_QUOTER_V2',
    },
    deploymentStartBlock: 123,
    status: 'bootstrap-ready',
  });
}

function deployment() {
  return parseProtocolDeploymentManifest({
    schema: 'bread://schemas/day5-graduation-deployment-v1',
    network: 'arc-testnet',
    status: 'VERIFIED',
    chainId: 5_042_002,
    core: {
      factory: address('6'),
      deployer: address('7'),
      feePolicy: address('8'),
      feeEscrow: address('9'),
      emergencyController: address('a'),
      locker: address('b'),
      coordinator: address('c'),
    },
    adapter: {
      active: true,
      family: 'UNISWAP_V3',
      adapter: address('d'),
      positionManager: POSITION_MANAGER,
      poolManager: null,
      v3Factory: V3_FACTORY,
      configHash: `0x${'11'.repeat(32)}`,
    },
    authorities: { protocolAdmin: address('e'), guardian: address('f') },
    economicsConfigHash: `0x${'22'.repeat(32)}`,
    dexEvidenceHash: `0x${'33'.repeat(32)}`,
    deploymentStartBlock: 123,
  });
}

describe('Day 9 graduated V3 ProtocolContext boundary', () => {
  it('exposes a complete canonicalized V3 trading tuple', () => {
    const context = resolveProtocolContext({ network: network(), deployment: deployment(), stackVersion: 'test-stack' });

    expect((context as Record<string, unknown>).graduatedTrading).toEqual({
      family: 'UNISWAP_V3',
      factory: V3_FACTORY,
      positionManager: POSITION_MANAGER,
      swapRouter: ROUTER,
      swapRouterKind: 'V3_SWAP_ROUTER_02',
      quoter: QUOTER,
      quoterKind: 'V3_QUOTER_V2',
    });
  });
});
