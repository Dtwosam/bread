import { type NetworkManifest, type ProtocolDeploymentManifest } from '../../../../packages/config/src/index.js';
import { type ProtocolContext } from '../../../../packages/protocol-sdk/src/context.js';
export declare const repositoryRoot: string;
/**
 * Canonical Day-9 stack identity.
 *
 * The verified deployment manifest deliberately does not carry a stackVersion
 * field, so the runtime derives it from the same canonical label the deployment
 * preflight used rather than inventing one or mutating deployment truth.
 * `reconcileCanonicalEconomicsHash()` proves the derivation matches the
 * economics hash actually recorded in the verified manifest.
 */
export declare const BREAD_LAN_STACK_VERSION: `0x${string}`;
export type BreadRuntimeContext = Readonly<{
    network: NetworkManifest;
    deployment: ProtocolDeploymentManifest;
    context: ProtocolContext;
}>;
/**
 * Resolve the runtime protocol context from validated canonical configuration
 * only. Contract addresses, economics, authorities, USDC, DEX family and stack
 * identity are never accepted from CLI or environment overrides.
 */
export declare function resolveBreadRuntimeContext(root?: string): BreadRuntimeContext;
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
export declare function reconcileCanonicalEconomicsHash(root?: string): EconomicsReconciliation;
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
export declare function resolveRuntimeInfrastructure(env?: NodeJS.ProcessEnv, network?: NetworkManifest): RuntimeInfrastructure;
