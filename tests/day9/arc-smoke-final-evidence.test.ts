import { describe, expect, it } from 'vitest';

import { assertArcSmokeFinalEvidence } from '../../scripts/day9/arc-smoke-final-evidence-lib.mjs';

const locker = '0xecf66a3a221d90a413d9015803417aa8d4ba97fe';
const manager = '0x444cc395346428216fb6f2892eb03cb804ae4cd5';

describe('Day 9 Arc smoke final evidence', () => {
  const passing = {
    creatorClaimLogCount: 1,
    creatorCredit: 0n,
    graduationPhase: 2,
    sweptUsdc: 0n,
    sweptTokens: 0n,
    poolTokenAmount: 0n,
    lockerPositionManager: manager,
    graduationPositionManager: manager,
    lockerPositionId: 42n,
    graduationPositionId: 42n,
    nftOwner: locker,
    locker,
    replayRejected: true,
  } as const;

  it('accepts a claimed, reconciled, permanently locked, replay-safe graduation', () => {
    expect(assertArcSmokeFinalEvidence(passing)).toBe(true);
  });

  it('rejects a zero credit balance without FeeClaimed evidence', () => {
    expect(() => assertArcSmokeFinalEvidence({ ...passing, creatorClaimLogCount: 0 }))
      .toThrow(/FeeClaimed/i);
  });

  it('rejects any remaining graduation residue', () => {
    expect(() => assertArcSmokeFinalEvidence({ ...passing, sweptUsdc: 1n }))
      .toThrow(/residue/i);
  });

  it('rejects an LP NFT that is not held by the permanent locker', () => {
    expect(() => assertArcSmokeFinalEvidence({
      ...passing,
      nftOwner: '0x1111111111111111111111111111111111111111',
    })).toThrow(/locker/i);
  });

  it('rejects a replay that would still succeed', () => {
    expect(() => assertArcSmokeFinalEvidence({ ...passing, replayRejected: false }))
      .toThrow(/replay/i);
  });
});
