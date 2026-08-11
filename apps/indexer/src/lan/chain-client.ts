import { createPublicClient, defineChain, http, type PublicClient } from 'viem';

import type { NetworkManifest } from '../../../../packages/config/src/index.js';

/**
 * Read-only Arc Testnet client for the operator LAN environment.
 *
 * No account, signer, keystore or private key is ever attached: this client
 * only reads chain state. Wallet signing stays entirely on the operator's
 * physical device.
 */
export function createArcReadClient(network: NetworkManifest): PublicClient {
  if (network.chainId === null) throw new Error('canonical network manifest has no chainId');
  const rpcUrls = network.rpc;
  if (!Array.isArray(rpcUrls) || rpcUrls.length === 0) {
    throw new Error('canonical network manifest carries no RPC endpoint');
  }

  const chain = defineChain({
    id: network.chainId,
    name: network.network,
    nativeCurrency: {
      name: network.nativeGasAsset,
      symbol: network.nativeGasAsset,
      decimals: network.nativePrecision,
    },
    rpcUrls: { default: { http: rpcUrls } },
    testnet: true,
  });

  return createPublicClient({ chain, transport: http(rpcUrls[0]) }) as PublicClient;
}

export function observeHeadBlock(client: PublicClient): () => Promise<bigint> {
  return async () => client.getBlockNumber();
}
