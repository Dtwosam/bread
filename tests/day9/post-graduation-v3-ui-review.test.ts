import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const experiencePath = 'apps/web/components/trade/trade-experience.tsx';
const panelPath = 'apps/web/components/trade/trade-panel.tsx';

describe('Day 9 graduated V3 web review boundary', () => {
  it('uses the canonical SDK review orchestrator with the full protocol context', () => {
    const experience = read(experiencePath);

    expect(experience).toContain('readCanonicalTradeReview');
    expect(experience).toContain('runtime.protocolContext');
    expect(experience).toContain('CanonicalTradeRoute');
    expect(experience).toContain('setReviewRoute(result.route)');
  });

  it('renders V3 venue economics without showing Bread curve fee or tax rows', () => {
    const panel = read(panelPath);

    expect(panel).toContain('V3TradeReview');
    expect(panel).toContain("review.route === 'V3_POOL'");
    expect(panel).toContain('V3 venue fee');
    expect(panel).toContain('venueFee');
    expect(panel).toContain('Base fee');
    expect(panel).toContain('Creator tax');
    expect(panel).toContain('Opening buy tax');
    expect(panel).toMatch(/review\.route === 'V3_POOL'[\s\S]*V3 venue fee[\s\S]*:[\s\S]*Base fee/);
  });
});
