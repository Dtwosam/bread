import type { Address } from "./identity.js";

export const BREAD_PROJECTION_CACHE_SCHEMA_VERSION =
  "bread-projection-v1" as const;

function requireChainId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("cache identity chainId must be a positive safe integer");
  }
  return value;
}

function requireSegment(value: string, label: string): string {
  if (value.length === 0 || value.includes(":")) {
    throw new Error(`${label} must be a non-empty cache identity segment`);
  }
  return value;
}

function requireAddress(value: Address, label: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be a 20-byte EVM address`);
  }
  return value.toLowerCase() as Address;
}

export function tokenProjectionCacheChannel(
  input: Readonly<{
    chainId: number;
    tokenAddress: Address;
  }>,
): string {
  return `token:${requireChainId(input.chainId)}:${requireAddress(input.tokenAddress, "tokenAddress")}`;
}

export function stackFeedProjectionCacheChannel(
  input: Readonly<{
    chainId: number;
    stackVersion: string;
    factoryAddress: Address;
  }>,
): string {
  return `stack:${requireChainId(input.chainId)}:${requireSegment(input.stackVersion, "stackVersion")}:${requireAddress(input.factoryAddress, "factoryAddress")}:feed`;
}

export function projectionCacheGenerationKey(
  input: Readonly<{
    schemaVersion: string;
    channel: string;
  }>,
): string {
  const schemaVersion = requireSegment(input.schemaVersion, "schemaVersion");
  if (input.channel.length === 0) {
    throw new Error("channel must be non-empty");
  }
  return `bread:generation:${schemaVersion}:${input.channel}`;
}
