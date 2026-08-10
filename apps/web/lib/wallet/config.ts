import { defineChain } from 'viem';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

import arcTestnetDeployment from '../../../../config/deployments/arc-testnet.day5.json';
import arcTestnetManifest from '../../../../config/networks/arc-testnet.json';
import {
  resolveProtocolContext,
  type ProtocolContext,
} from '../../../../packages/protocol-sdk/src/context';

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

type ResolverInput = Parameters<typeof resolveProtocolContext>[0];

function resolveArcProtocolContext(): ProtocolContext | null {
  const deployment = arcTestnetDeployment as unknown as Record<string, unknown>;
  const stackVersion = deployment.stackVersion;

  // The current checked-in Day-5 deployment manifest intentionally leaves the
  // deployed core/start block unresolved and does not yet publish stackVersion.
  // Do not synthesize any of those values in the browser.
  if (typeof stackVersion !== 'string' || stackVersion.trim().length === 0) return null;

  try {
    return resolveProtocolContext({
      network: arcTestnetManifest as unknown as ResolverInput['network'],
      deployment: arcTestnetDeployment as unknown as ResolverInput['deployment'],
      stackVersion,
    });
  } catch {
    return null;
  }
}

export const arcProtocolContext = resolveArcProtocolContext();

export const breadWagmiConfig = createConfig({
  chains: [arcTestnetChain],
  connectors: [injected()],
  transports: {
    [arcTestnetChain.id]: http(arcTestnetManifest.rpc[0]),
  },
  ssr: true,
});
