import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as apiTypes from '../../packages/types/src/api';

const typeModule = apiTypes as Record<string, unknown>;

describe('Day 7 Explore shared API DTO continuity', () => {
  it('keeps feed/search DTO declarations in the shared types package, not the web model', () => {
    const modelSource = readFileSync(
      new URL('../../apps/web/components/explore/model.ts', import.meta.url),
      'utf8',
    );
    const apiTypeSource = readFileSync(
      new URL('../../packages/types/src/api.ts', import.meta.url),
      'utf8',
    );

    expect(apiTypeSource).toContain('export type IndexedTradeMetricsSummary');
    expect(apiTypeSource).toContain('export type IndexedGraduationProgressSummary');
    expect(apiTypeSource).toContain('export type IndexedFeedItem');
    expect(apiTypeSource).toContain('export type IndexedSearchResult');
    expect(modelSource).toContain("from '../../../../packages/types/src/index'");
    expect(modelSource).not.toContain('export type IndexedTradeMetricsSummary');
    expect(modelSource).not.toContain('export type IndexedSearchResult');
    expect(typeModule).toBeDefined();
  });
});
