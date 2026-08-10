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

  it('shows actual prepared launch values and exact final action labels', () => {
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
    ]) {
      expect(review).toContain(label);
    }
    expect(review).toContain('Launch & Buy');
    expect(review).toContain('Launch');
  });

  it('uses bounded desktop form/review regions and remains single-column on mobile', () => {
    const route = read(paths.route);
    expect(route).toContain('bread-create-layout');
    expect(route).toContain('bread-create-form-region');
    expect(route).toContain('bread-launch-review-region');
  });
});
