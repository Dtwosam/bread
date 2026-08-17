import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Day 7 Task 4 Token page consumer contract', () => {
  it('preserves distinct malformed-address and valid non-Bread token API states', () => {
    const tokenRoute = read('apps/api/src/routes/token.ts');

    expect(tokenRoute).toMatch(/code:\s*["']INVALID_ADDRESS["']/);
    expect(tokenRoute).toMatch(/code:\s*["']TOKEN_NOT_FOUND["']/);
  });

  it('projects already-indexed graduation progress and canonical graduation evidence through token detail', () => {
    const tokenRoute = read('apps/api/src/routes/token.ts');

    expect(tokenRoute).toContain('progress: serializeGraduationProgress(metrics)');
    expect(tokenRoute).toContain('graduationPhase: row.graduationPhase');
    expect(tokenRoute).toContain('poolId: row.poolId');
    expect(tokenRoute).toContain('graduationAdapter: row.graduationAdapter');
    expect(tokenRoute).toContain('positionLocked: row.positionLocked');
  });

  it('keeps Token detail, trades and holders DTOs in the shared API type authority', () => {
    const sharedTypes = read('packages/types/src/api.ts');

    for (const typeName of [
      'IndexedCurveStateSummary',
      'IndexedTokenDetail',
      'IndexedTokenTrade',
      'IndexedTokenHolder',
      'IndexedTokenHolders',
    ]) {
      expect(sharedTypes).toMatch(new RegExp(`export type ${typeName}\\b`));
    }
  });

  it('owns the frozen public route at /token/:address without inventing another route', () => {
    expect(existsSync(resolve(root, 'apps/web/app/token/[address]/page.tsx'))).toBe(true);
    expect(existsSync(resolve(root, 'apps/web/app/search/page.tsx'))).toBe(false);
    expect(existsSync(resolve(root, 'apps/web/app/create/review/page.tsx'))).toBe(false);
  });
});