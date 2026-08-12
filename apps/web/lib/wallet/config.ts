import { defineChain, keccak256, toHex } from 'viem';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';

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

// The verified Day-9 deployment manifest intentionally does not publish a
// stackVersion field. The deployment preflight and LAN runtime derive the
// deployed stack identity from this canonical label instead. Keep browser
// execution on that same derivation; the Day-9 browser-context regression pins
// this value against BREAD_LAN_STACK_VERSION so any future drift fails closed.
const ARC_TESTNET_STACK_VERSION = keccak256(toHex('BREAD_DAY9_ARC_TESTNET_STACK_V1'));

function resolveArcProtocolContext(): ProtocolContext | null {
  try {
    return resolveProtocolContext({
      network: arcTestnetManifest as unknown as ResolverInput['network'],
      deployment: arcTestnetDeployment as unknown as ResolverInput['deployment'],
      stackVersion: ARC_TESTNET_STACK_VERSION,
    });
  } catch {
    return null;
  }
}

export const arcProtocolContext = resolveArcProtocolContext();

/**
 * WalletConnect project id.
 *
 * This is a PUBLIC client identifier issued by the Reown dashboard, not a
 * secret and not signing material. It is deliberately read from NEXT_PUBLIC
 * configuration because it is designed to ship to the browser, and it must
 * never be sourced from a server-only or secret-shaped variable.
 *
 * Origin allowlisting is configured in the Reown dashboard, not here.
 */
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_BREAD_WALLETCONNECT_PROJECT_ID?.trim() || null;

/**
 * `injected()` can only reach a wallet through EIP-6963/EIP-1193 injection.
 * Chrome for Android supports no extensions at all, and no mainstream EVM
 * wallet ships an iOS Safari extension, so injected-only can never present a
 * wallet on either mandatory 04D mobile target. WalletConnect is the
 * provider-neutral remote path named by 04C that closes that gap.
 *
 * Signing stays entirely on the user's device: the relay only transports
 * session and request payloads between the browser and the user's wallet.
 *
 * Wagmi calls connector setup while createConfig is constructed, including
 * during Next.js server rendering. WalletConnect setup initializes browser
 * persistence, so registering it while `window` is absent can touch IndexedDB
 * on the server. The server therefore keeps the injected-only fallback; the
 * remote connector is registered only in a real browser and only when a
 * project id is configured.
 */
const remoteConnectors =
  typeof window !== 'undefined' && walletConnectProjectId
    ? [walletConnect({ projectId: walletConnectProjectId })]
    : [];

export const breadWagmiConfig = createConfig({
  chains: [arcTestnetChain],
  connectors: [injected(), ...remoteConnectors],
  multiInjectedProviderDiscovery: true,
  transports: {
    [arcTestnetChain.id]: http(arcTestnetManifest.rpc[0]),
  },
  ssr: true,
});
