import { defineChain } from 'viem';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

import arcTestnetManifest from '../../../../config/networks/arc-testnet.json';

export const arcTestnetChain = defineChain({
  id: arcTestnetManifest.chainId,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: arcTestnetManifest.nativeGasAsset,
    symbol: arcTestnetManifest.nativeGasAsset,
    decimals: arcTestnetManifest.nativePrecision,
  },
  rpcUrls: {
    default: {
      http: arcTestnetManifest.rpc,
      webSocket: arcTestnetManifest.websocket,
    },
  },
  blockExplorers: {
    default: {
      name: 'Arcscan Testnet',
      url: arcTestnetManifest.explorer,
    },
  },
  testnet: true,
});

export const arcTradeExecutionContext = {
  chainId: arcTestnetManifest.chainId,
  quoteAsset: arcTestnetManifest.usdc.address as `0x${string}`,
  quoteDecimals: arcTestnetManifest.usdc.decimals,
} as const;

export const breadWagmiConfig = createConfig({
  chains: [arcTestnetChain],
  connectors: [injected()],
  transports: {
    [arcTestnetChain.id]: http(arcTestnetManifest.rpc[0]),
  },
  ssr: true,
});
