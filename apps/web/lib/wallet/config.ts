import { defineChain } from 'viem';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

import arcTestnetManifest from '../../../../config/networks/arc-testnet.json';

export const arcTestnetChain = defineChain({
  id: arcTestnetManifest.chainId,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: arcTestnetManifest.nativeCurrency.name,
    symbol: arcTestnetManifest.nativeCurrency.symbol,
    decimals: arcTestnetManifest.nativeCurrency.decimals,
  },
  rpcUrls: {
    default: {
      http: [arcTestnetManifest.rpc.http],
      webSocket: [arcTestnetManifest.rpc.ws],
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
  quoteAsset: arcTestnetManifest.quoteAsset.address as `0x${string}`,
  quoteDecimals: arcTestnetManifest.quoteAsset.decimals,
} as const;

export const breadWagmiConfig = createConfig({
  chains: [arcTestnetChain],
  connectors: [injected()],
  transports: {
    [arcTestnetChain.id]: http(arcTestnetManifest.rpc.http),
  },
  ssr: true,
});
