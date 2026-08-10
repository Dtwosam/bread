import { describe, expect, it } from 'vitest';

import arcTestnet from '../../config/networks/arc-testnet.json';
import arcMainnet from '../../config/networks/arc-mainnet.json';

describe('Day 9 Arc environment reconciliation', () => {
  it('uses the currently published Arc Testnet endpoints without inventing DEX/mainnet values', () => {
    expect(arcTestnet.chainId).toBe(5_042_002);
    expect(arcTestnet.rpc).toEqual(['https://rpc.testnet.arc.network']);
    expect(arcTestnet.websocket).toEqual(['wss://rpc.testnet.arc.network']);
    expect(arcTestnet.usdc).toEqual({
      address: '0x3600000000000000000000000000000000000000',
      decimals: 6,
      role: 'bread-financial-quote-asset',
    });
    expect(arcTestnet.dex).toEqual({
      type: 'UNRESOLVED_TESTNET_ADAPTER',
      poolManager: null,
      positionManager: null,
      factory: null,
    });

    expect(arcMainnet.status).toBe('AWAITING_OFFICIAL_VALUES');
    expect(arcMainnet.chainId).toBeNull();
    expect(arcMainnet.rpc).toEqual([]);
    expect(arcMainnet.usdc.address).toBeNull();
  });
});
