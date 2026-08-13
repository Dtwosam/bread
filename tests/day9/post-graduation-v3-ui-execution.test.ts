import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const experiencePath = 'apps/web/components/trade/trade-experience.tsx';
const panelPath = 'apps/web/components/trade/trade-panel.tsx';

describe('Day 9 graduated V3 canonical UI handoff', () => {
  it('passes a narrowed canonical protocol context into the trade lifecycle', () => {
    const experience = read(experiencePath);
    expect(experience).toContain('const protocolContext = runtime.protocolContext');
    expect(experience).toMatch(/executeTradeLifecycle\(\{[\s\S]*protocolContext,[\s\S]*approvedReview: review/);
  });

  it('has no temporary graduated-route submission block', () => {
    const experience = read(experiencePath);
    expect(experience).not.toContain('Graduated V3 execution is not enabled in this build.');
    expect(experience).not.toContain("if (reviewRoute?.kind === 'V3_POOL')");
  });

  it('keeps the reviewed action on the shared primary button', () => {
    const panel = read(panelPath);
    expect(panel).toContain("review.route === 'V3_POOL'");
    expect(panel).not.toMatch(/disabled=\{[^}]*v3Review/);
    expect(panel).not.toContain('V3 execution unavailable');
    expect(panel).toContain('onClick={walletReady ? (review ? onSubmit : onReview) : onConnectionAction}');
  });
});
