import { describe, expect, it } from 'vitest';

import {
  classifySafeRecoveryState,
  predecessorForOwner,
  sortSafeSignatures,
} from '../../scripts/day9/arc-safe-threshold-recovery-lib.mjs';

const SENTINEL = '0x0000000000000000000000000000000000000001';
const owner1 = '0x1111111111111111111111111111111111111111';
const owner2 = '0x2222222222222222222222222222222222222222';
const owner3 = '0x3333333333333333333333333333333333333333';
const recovery = '0x4444444444444444444444444444444444444444';
const original = [owner1, owner2, owner3];

describe('Day 9 Arc Safe threshold recovery', () => {
  it('derives the linked-list predecessor required by Safe swapOwner', () => {
    expect(predecessorForOwner(original, owner1)).toBe(SENTINEL);
    expect(predecessorForOwner(original, owner2)).toBe(owner1);
    expect(predecessorForOwner(original, owner3)).toBe(owner2);
  });

  it('starts rotation only from the exact original 3-owner threshold-2 state', () => {
    expect(classifySafeRecoveryState({
      currentOwners: original,
      originalOwners: original,
      recoveryOwner: recovery,
      removedOwner: owner1,
      threshold: 2n,
      startNonce: 7n,
      currentNonce: 7n,
    })).toBe('ROTATE_TO_RECOVERY_OWNER');
  });

  it('resumes restoration only from the exact one-owner-replaced state', () => {
    expect(classifySafeRecoveryState({
      currentOwners: [recovery, owner2, owner3],
      originalOwners: original,
      recoveryOwner: recovery,
      removedOwner: owner1,
      threshold: 2n,
      startNonce: 7n,
      currentNonce: 8n,
    })).toBe('RESTORE_ORIGINAL_OWNER');
  });

  it('recognizes completion only after two Safe nonce advances and exact owner restoration', () => {
    expect(classifySafeRecoveryState({
      currentOwners: original,
      originalOwners: original,
      recoveryOwner: recovery,
      removedOwner: owner1,
      threshold: 2n,
      startNonce: 7n,
      currentNonce: 9n,
    })).toBe('VERIFY_COMPLETE');
  });

  it('fails closed on owner, threshold or nonce states outside the reversible sequence', () => {
    expect(() => classifySafeRecoveryState({
      currentOwners: [owner1, owner2],
      originalOwners: original,
      recoveryOwner: recovery,
      removedOwner: owner1,
      threshold: 2n,
      startNonce: 7n,
      currentNonce: 7n,
    })).toThrow(/unexpected Safe recovery state/i);

    expect(() => classifySafeRecoveryState({
      currentOwners: original,
      originalOwners: original,
      recoveryOwner: recovery,
      removedOwner: owner1,
      threshold: 1n,
      startNonce: 7n,
      currentNonce: 7n,
    })).toThrow(/threshold/i);
  });

  it('sorts packed owner signatures by signer address as Safe requires', () => {
    const sorted = sortSafeSignatures([
      { owner: owner3, signature: '0x' + '33'.repeat(65) },
      { owner: owner1, signature: '0x' + '11'.repeat(65) },
    ]);

    expect(sorted.map((entry) => entry.owner)).toEqual([owner1, owner3]);
    expect(sorted.map((entry) => entry.signature)).toEqual([
      '0x' + '11'.repeat(65),
      '0x' + '33'.repeat(65),
    ]);
  });
});
