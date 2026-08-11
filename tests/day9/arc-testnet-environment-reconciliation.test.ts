import { describe, expect, it } from 'vitest';

import arcTestnet from '../../config/networks/arc-testnet.json';
import arcMainnet from '../../config/networks/arc-mainnet.json';

describe('Day 9 Arc environment reconciliation', () => {
  it('uses verified Arc Testnet V3 dependencies without selecting a mainnet DEX', () => {
    expect(arcTestnet.chainId).toBe(5_042_002);
    expect(arcTestnet.rpc).toEqual(['https://rpc.testnet.arc.network']);
    expect(arcTestnet.websocket).toEqual(['wss://rpc.testnet.arc.network']);
    expect(arcTestnet.usdc).toEqual({
      address: '0x3600000000000000000000000000000000000000',
      decimals: 6,
      role: 'bread-financial-quote-asset',
    });
    expect(arcTestnet.dex).toEqual({
      type: 'UNISWAP_V3',
      poolManager: null,
      positionManager: '0x444Cc395346428216fB6f2892eb03cB804aE4CD5',
      factory: '0x0fB6EEDA6e90E90797083861A75D15752a27f59c',
    });

    expect(arcMainnet.status).toBe('AWAITING_OFFICIAL_VALUES');
    expect(arcMainnet.chainId).toBeNull();
    expect(arcMainnet.rpc).toEqual([]);
    expect(arcMainnet.usdc.address).toBeNull();
    expect(arcMainnet.dex.poolManager).toBeNull();
    expect(arcMainnet.dex.positionManager).toBeNull();
    expect(arcMainnet.dex.factory).toBeNull();
  });
});
