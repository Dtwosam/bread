import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  route: 'apps/web/app/create/page.tsx',
  forbiddenRoute: 'apps/web/app/create/review/page.tsx',
  form: 'apps/web/components/create/token-form.tsx',
  review: 'apps/web/components/create/launch-review.tsx',
  css: 'apps/web/components/create/create.module.css',
} as const;

describe('Day 7 Task 6 Create and Review source contract', () => {
  it('uses one canonical /create route and keeps Review as state inside it', () => {
    expect(existsSync(resolve(root, paths.route))).toBe(true);
    expect(existsSync(resolve(root, paths.forbiddenRoute))).toBe(false);
    expect(existsSync(resolve(root, paths.form))).toBe(true);
    expect(existsSync(resolve(root, paths.review))).toBe(true);

    const route = read(paths.route);
    expect(route).toContain('TokenForm');
    expect(route).toContain('LaunchReview');
    expect(route).not.toContain('/create/review');
  });

  it('implements the v2.2 staged Create flow without changing launch semantics', () => {
    const route = read(paths.route);
    const form = read(paths.form);

    expect(route).toContain("'TOKEN'");
    expect(route).toContain("'ECONOMICS'");
    expect(route).toContain("'REVIEW'");
    expect(route).toContain('bread-create-stepper');
    expect(route).toContain('bread-create-preview');
    expect(form).toContain('Token details');
    expect(form).toContain('Economics');
    expect(form).toContain('Continue');
    expect(form).toContain('Review');
  });

  it('exposes only source-defined creator inputs and no protocol-only reserve controls', () => {
    const form = read(paths.form);
    for (const label of [
      'Image',
      'Name',
      'Ticker',
      'Description',
      'Website',
      'X',
      'Telegram',
      'Creator tax',
      'Buyback',
      'Initial buy',
    ]) {
      expect(form).toContain(label);
    }

    expect(form).not.toMatch(/phantom reserve/i);
    expect(form).not.toMatch(/tick spacing/i);
    expect(form).not.toMatch(/graduation adapter/i);
  });

  it('keeps buyback visible but unavailable until Bread has canonical buyback/vesting semantics', () => {
    const form = read(paths.form);
    expect(form).toContain('Buyback');
    expect(form).toMatch(/unavailable|not available/i);
    expect(form).toMatch(/disabled/);
  });

  it('shows canonical economics in the economics step and a truthful creator live preview', () => {
    const route = read(paths.route);
    const form = read(paths.form);

    for (const label of ['Quote asset', 'Launch fee', 'Graduation target', 'Creator revenue wallet']) {
      expect(form).toContain(label);
    }
    expect(route).toContain('readLaunchReviewSnapshot');
    expect(route).toContain('maxCreatorTaxBps');
    expect(route).toContain('bread-create-preview__creator');
    expect(route).toContain('by you');
    expect(route).not.toMatch(/preview.*(?:volume|holders|market cap|price)/i);
  });

  it('shows actual prepared launch values, config pin, and exact final action labels', () => {
    const review = read(paths.review);
    for (const label of [
      'Fixed supply',
      'Quote currency',
      'Creator tax',
      'Buyback',
      'Initial buy',
      'Launch fee',
      'Graduation target',
      'Creator revenue wallet',
      'Permanent liquidity lock',
      'Economics/config pin',
    ]) {
      expect(review).toContain(label);
    }
    expect(review).toContain('Launch & Buy');
    expect(review).toContain('Launch');
  });

  it('uses the exact v2.2 desktop create geometry and collapses to one column below desktop', () => {
    const css = read(paths.css);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*720px\)\s+360px/);
    expect(css).toMatch(/bread-create-preview[\s\S]*position:\s*sticky/);
    expect(css).toMatch(/@media\s*\(max-width:\s*1023px\)[\s\S]*grid-template-columns:\s*1fr/);
  });

  it('uses bounded desktop form/review regions and remains single-column on mobile', () => {
    const route = read(paths.route);
    expect(route).toContain('bread-create-layout');
    expect(route).toContain('bread-create-form-region');
    expect(route).toContain('bread-launch-review-region');
  });
});
