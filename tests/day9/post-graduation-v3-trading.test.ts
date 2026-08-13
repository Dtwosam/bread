import { describe, expect, it } from 'vitest';

import { parseNetworkManifest } from '../../packages/config/src/manifests.js';

const ARC_USDC = '0x3600000000000000000000000000000000000000';
const V3_FACTORY = '0x0fB6EEDA6e90E90797083861A75D15752a27f59c';
const POSITION_MANAGER = '0x444Cc395346428216fB6f2892eb03cB804aE4CD5';
const ROUTER = '0x1111111111111111111111111111111111111111';
const QUOTER = '0x2222222222222222222222222222222222222222';

describe('Day 9 V3 periphery manifest boundary', () => {
  it('parses explicit router and quoter addresses with their ABI kinds', () => {
    const parsed = parseNetworkManifest({
      schemaVersion: 1,
      network: 'arc-testnet',
      chainId: 5_042_002,
      nativeGasAsset: 'USDC',
      nativePrecision: 18,
      rpc: ['https://rpc.testnet.arc.network'],
      websocket: ['wss://rpc.testnet.arc.network'],
      explorer: 'https://testnet.arcscan.app',
      usdc: { address: ARC_USDC, decimals: 6, role: 'bread-financial-quote-asset' },
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      create2Factory: '0x4e59b44847b379578588920cA78FbF26c0B4956C',
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
      dex: {
        type: 'UNISWAP_V3',
        poolManager: null,
        positionManager: POSITION_MANAGER,
        factory: V3_FACTORY,
        swapRouter: ROUTER,
        swapRouterKind: 'V3_SWAP_ROUTER',
        quoter: QUOTER,
        quoterKind: 'V3_QUOTER_V2',
      },
      deploymentStartBlock: null,
      status: 'bootstrap-ready',
    });

    expect(parsed.dex).toMatchObject({
      swapRouter: ROUTER,
      swapRouterKind: 'V3_SWAP_ROUTER',
      quoter: QUOTER,
      quoterKind: 'V3_QUOTER_V2',
    });
  });
});
