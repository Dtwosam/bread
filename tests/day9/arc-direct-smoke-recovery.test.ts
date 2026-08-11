import { describe, expect, it } from 'vitest';

import { classifyArcDirectSmokeStep } from '../../scripts/day9/arc-direct-smoke-recovery-lib.mjs';

describe('Day 9 Arc direct-RPC smoke recovery', () => {
  const quoteIn = 11_000_000n;

  it('approves only when no launch exists and allowance is insufficient', () => {
    expect(classifyArcDirectSmokeStep({
      launchExists: false,
      allowance: 0n,
      quoteIn,
      permanentlyLocked: false,
      readyToGraduate: false,
      graduated: false,
      creatorCredit: 0n,
      creatorClaimObserved: false,
    })).toBe('APPROVE');
  });

  it('launches without another approval when sufficient allowance already exists', () => {
    expect(classifyArcDirectSmokeStep({
      launchExists: false,
      allowance: quoteIn,
      quoteIn,
      permanentlyLocked: false,
      readyToGraduate: false,
      graduated: false,
      creatorCredit: 0n,
      creatorClaimObserved: false,
    })).toBe('LAUNCH');
  });

  it('resumes an existing ready launch at sweep rather than creating another token', () => {
    expect(classifyArcDirectSmokeStep({
      launchExists: true,
      allowance: 0n,
      quoteIn,
      permanentlyLocked: false,
      readyToGraduate: true,
      graduated: false,
      creatorCredit: 0n,
      creatorClaimObserved: false,
    })).toBe('SWEEP');
  });

  it('resumes an already swept launch at pool creation', () => {
    expect(classifyArcDirectSmokeStep({
      launchExists: true,
      allowance: 0n,
      quoteIn,
      permanentlyLocked: false,
      readyToGraduate: false,
      graduated: true,
      creatorCredit: 0n,
      creatorClaimObserved: false,
    })).toBe('CREATE_POOL');
  });

  it('claims creator credit after permanent lock instead of touching graduation again', () => {
    expect(classifyArcDirectSmokeStep({
      launchExists: true,
      allowance: 0n,
      quoteIn,
      permanentlyLocked: true,
      readyToGraduate: false,
      graduated: true,
      creatorCredit: 1n,
      creatorClaimObserved: false,
    })).toBe('CLAIM');
  });

  it('finishes with read-only replay verification only after a creator claim was observed', () => {
    expect(classifyArcDirectSmokeStep({
      launchExists: true,
      allowance: 0n,
      quoteIn,
      permanentlyLocked: true,
      readyToGraduate: false,
      graduated: true,
      creatorCredit: 0n,
      creatorClaimObserved: true,
    })).toBe('VERIFY_REPLAY');
  });

  it('fails closed when permanent lock exists but creator credit vanished without claim evidence', () => {
    expect(() => classifyArcDirectSmokeStep({
      launchExists: true,
      allowance: 0n,
      quoteIn,
      permanentlyLocked: true,
      readyToGraduate: false,
      graduated: true,
      creatorCredit: 0n,
      creatorClaimObserved: false,
    })).toThrow(/creator claim evidence/i);
  });

  it('fails closed on an existing launch that is neither ready, graduated nor locked', () => {
    expect(() => classifyArcDirectSmokeStep({
      launchExists: true,
      allowance: 0n,
      quoteIn,
      permanentlyLocked: false,
      readyToGraduate: false,
      graduated: false,
      creatorCredit: 0n,
      creatorClaimObserved: false,
    })).toThrow(/inconsistent existing launch state/i);
  });
});
