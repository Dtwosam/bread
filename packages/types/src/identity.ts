export type ChainId = number;
export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type Hex32 = `0x${string}`;

export type CanonicalLogIdentity = Readonly<{
  chainId: ChainId;
  transactionHash: Hex32;
  logIndex: number;
}>;

const HASH_32_RE = /^0x[0-9a-fA-F]{64}$/;

export function canonicalEventId(identity: CanonicalLogIdentity): string {
  if (!Number.isSafeInteger(identity.chainId) || identity.chainId <= 0) {
    throw new Error('invalid chainId');
  }
  if (!HASH_32_RE.test(identity.transactionHash)) {
    throw new Error('invalid transactionHash');
  }
  if (!Number.isSafeInteger(identity.logIndex) || identity.logIndex < 0) {
    throw new Error('invalid logIndex');
  }
  return `${identity.chainId}:${identity.transactionHash.toLowerCase()}:${identity.logIndex}`;
}
