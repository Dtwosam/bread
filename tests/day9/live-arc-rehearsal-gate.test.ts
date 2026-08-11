import { describe, expect, it } from 'vitest';

async function loadLiveArcGate() {
  const path = '../../scripts/day9/check-live-arc-rehearsal.mts';
  try {
    return await import(/* @vite-ignore */ path) as Readonly<{
      checkLiveArcRehearsal: () => Readonly<{
        authorized: boolean;
        blockers: readonly string[];
      }>;
    }>;
  } catch {
    return null;
  }
}

describe('Day 9 live Arc Testnet rehearsal gate', () => {
  it('blocks live rehearsal while canonical DEX and deployment evidence remain unresolved', async () => {
    const module = await loadLiveArcGate();
    expect(module?.checkLiveArcRehearsal).toBeTypeOf('function');
    if (!module) return;

    expect(module.checkLiveArcRehearsal()).toEqual({
      authorized: false,
      blockers: expect.arrayContaining([
        'ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED',
        'ARC_TESTNET_DEPLOYMENT_MANIFEST_NOT_READY',
      ]),
    });
  });
});
