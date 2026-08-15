import { type PublicClient } from 'viem';
import type { NetworkManifest } from '../../../../packages/config/src/index.js';
/**
 * Read-only Arc Testnet client for the operator LAN environment.
 *
 * No account, signer, keystore or private key is ever attached: this client
 * only reads chain state. Wallet signing stays entirely on the operator's
 * physical device.
 */
export declare function createArcReadClient(network: NetworkManifest): PublicClient;
export declare function observeHeadBlock(client: PublicClient): () => Promise<bigint>;
