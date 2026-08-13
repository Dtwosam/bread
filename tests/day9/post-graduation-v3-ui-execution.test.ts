import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const experiencePath = 'apps/web/components/trade/trade-experience.tsx';
const panelPath = 'apps/web/components/trade/trade-panel.tsx';

describe('Day 9 graduated V3 UI execution handoff', () => {
  it('passes the full canonical protocol context into the existing trade lifecycle', () => {
    const experience = read(experiencePath);
    expect(experience).toContain('executeTradeLifecycle({');
    expect(experience).toContain('protocolContext: runtime.protocolContext');
  });

  it('removes the temporary V3 submission guard after the canonical controller exists', () => {
    const experience = read(experiencePath);
    expect(experience).not.toContain('Graduated V3 execution is not enabled in this build.');
    expect(experience).not.toContain("if (reviewRoute?.kind === 'V3_POOL')");
  });

  it('keeps the reviewed V3 action submittable through the same one-action wallet button', () => {
    const panel = read(panelPath);
    expect(panel).toContain("review?.route === 'V3_POOL'");
    expect(panel).not.toMatch(/disabled=\{[^}]*v3Review/);
    expect(panel).not.toContain("v3Review ? 'V3 execution unavailable'");
    expect(panel).toContain('onClick={walletReady ? (review ? onSubmit : onReview) : onConnectionAction}');
  });
});
