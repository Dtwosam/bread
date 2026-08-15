import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { encodeAbiParameters, keccak256, toHex } from 'viem';

import {
  parseNetworkManifest,
  parseProtocolDeploymentManifest,
  type NetworkManifest,
  type ProtocolDeploymentManifest,
} from '../../../../packages/config/src/index.js';
import {
  resolveProtocolContext,
  type ProtocolContext,
} from '../../../../packages/protocol-sdk/src/context.js';
import {
  DAY9_ARC_TESTNET_ECONOMICS,
  DAY9_ARC_TESTNET_STACK_VERSION_LABEL,
} from '../../../../scripts/day9/arc-testnet-deployment-preflight-lib.mjs';

const NETWORK_MANIFEST = 'config/networks/arc-testnet.json';
const DEPLOYMENT_MANIFEST = 'config/deployments/arc-testnet.day5.json';

export const repositoryRoot = resolve(import.meta.dirname, '../../../..');

/**
 * Canonical Day-9 stack identity.
 *
 * The verified deployment manifest deliberately does not carry a stackVersion
 * field, so the runtime derives it from the same canonical label the deployment
 * preflight used rather than inventing one or mutating deployment truth.
 * `reconcileCanonicalEconomicsHash()` proves the derivation matches the
 * economics hash actually recorded in the verified manifest.
 */
export const BREAD_LAN_STACK_VERSION = keccak256(toHex(DAY9_ARC_TESTNET_STACK_VERSION_LABEL));

export type BreadRuntimeContext = Readonly<{
  network: NetworkManifest;
  deployment: ProtocolDeploymentManifest;
  context: ProtocolContext;
}>;

function readManifest(root: string, relative: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relative), 'utf8')) as unknown;
}

/**
 * Resolve the runtime protocol context from validated canonical configuration
 * only. Contract addresses, economics, authorities, USDC, DEX family and stack
 * identity are never accepted from CLI or environment overrides.
 */
export function resolveBreadRuntimeContext(root: string = repositoryRoot): BreadRuntimeContext {
  const network = parseNetworkManifest(readManifest(root, NETWORK_MANIFEST));
  const deployment = parseProtocolDeploymentManifest(readManifest(root, DEPLOYMENT_MANIFEST));

  if (deployment.status !== 'VERIFIED') {
    throw new Error(`refusing to run against a non-VERIFIED deployment manifest: ${deployment.status}`);
  }

  const context = resolveProtocolContext({
    network,
    deployment,
    stackVersion: BREAD_LAN_STACK_VERSION,
  });

  return { network, deployment, context };
}

export type EconomicsReconciliation = Readonly<{
  recomputed: string;
  recorded: string;
  matches: boolean;
}>;

/**
 * Recompute the deployment economics hash from the canonical testnet economics
 * plus the derived stack version, and compare it with the hash recorded in the
 * verified deployment manifest. A match proves the derived stack identity is
 * the identity the deployed stack was configured with.
 */
export function reconcileCanonicalEconomicsHash(root: string = repositoryRoot): EconomicsReconciliation {
  const { network, deployment } = resolveBreadRuntimeContext(root);
  const usdc = network.usdc.address;
  const protocolFeeRecipient = deployment.authorities.protocolAdmin;
  if (usdc === null || protocolFeeRecipient === null) {
    throw new Error('unresolved canonical economics inputs');
  }

  const encoded = encodeAbiParameters(
    [
      { type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
      { type: 'uint256' }, { type: 'address' }, { type: 'uint16' }, { type: 'uint16' },
      { type: 'uint16' }, { type: 'bytes32' },
    ],
    [
      usdc as `0x${string}`,
      BigInt(DAY9_ARC_TESTNET_ECONOMICS.supply),
      BigInt(DAY9_ARC_TESTNET_ECONOMICS.phantomQuote),
      BigInt(DAY9_ARC_TESTNET_ECONOMICS.graduationThreshold),
      BigInt(DAY9_ARC_TESTNET_ECONOMICS.launchFeeUsdc),
      protocolFeeRecipient as `0x${string}`,
      Number(DAY9_ARC_TESTNET_ECONOMICS.tradeFeeBps),
      Number(DAY9_ARC_TESTNET_ECONOMICS.protocolFeeShareBps),
      Number(DAY9_ARC_TESTNET_ECONOMICS.maxCreatorTaxBps),
      BREAD_LAN_STACK_VERSION,
    ],
  );

  const recomputed = keccak256(encoded);
  const recorded = deployment.economicsConfigHash ?? '';
  return { recomputed, recorded, matches: recomputed === recorded };
}

/**
 * Runtime infrastructure inputs. These are the only values an operator may
 * supply, because they describe where this bounded local environment listens
 * and stores projections - never what Bread is or what it charges.
 */
export type RuntimeInfrastructure = Readonly<{
  databaseUrl: string;
  redisUrl: string;
  rpcUrls: readonly string[];
}>;

export function resolveRuntimeInfrastructure(
  env: NodeJS.ProcessEnv = process.env,
  network?: NetworkManifest,
): RuntimeInfrastructure {
  const databaseUrl = env.BREAD_DATABASE_URL?.trim();
  const redisUrl = env.BREAD_REDIS_URL?.trim();
  if (!databaseUrl) throw new Error('BREAD_DATABASE_URL is required');
  if (!redisUrl) throw new Error('BREAD_REDIS_URL is required');

  const rpcUrls = network?.rpc ?? resolveBreadRuntimeContext().network.rpc;
  if (!Array.isArray(rpcUrls) || rpcUrls.length === 0) {
    throw new Error('canonical network manifest carries no RPC endpoint');
  }

  return { databaseUrl, redisUrl, rpcUrls };
}
