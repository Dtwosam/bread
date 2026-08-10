import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { serializeGraduationProgress } from '../../apps/api/src/routes/token';

describe('Day 7 Explore feed progress contract', () => {
  it('serializes indexed graduation progress without frontend financial math', () => {
    expect(
      serializeGraduationProgress({
        graduationProgressBps: 6250n,
        graduationState: 'CURVE_ACTIVE',
      }),
    ).toEqual({
      progressBps: '6250',
      state: 'CURVE_ACTIVE',
    });

    expect(
      serializeGraduationProgress({
        graduationProgressBps: null,
        graduationState: null,
      }),
    ).toEqual({
      progressBps: null,
      state: null,
    });
  });

  it('normalizes progress losslessly in the canonical read repository', () => {
    const source = readFileSync(
      new URL('../../packages/db/src/repositories/read.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('graduationProgressBps: optionalBigInt(row.graduationProgressBps)');
  });

  it('adds progress to feed rows from the existing batched token-metrics lookup', () => {
    const source = readFileSync(
      new URL('../../apps/api/src/routes/feed.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('serializeGraduationProgress');
    expect(source).toMatch(/progress:\s*serializeGraduationProgress\(/);
    expect(source).not.toMatch(/getLaunchState\s*\(/);
  });
});
