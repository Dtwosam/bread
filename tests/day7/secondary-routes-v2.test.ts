import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  activity: 'apps/web/app/activity/page.tsx',
  stats: 'apps/web/app/stats/page.tsx',
  docs: 'apps/web/app/docs/page.tsx',
  terms: 'apps/web/app/legal/terms/page.tsx',
  privacy: 'apps/web/app/legal/privacy/page.tsx',
  risks: 'apps/web/app/legal/risks/page.tsx',
  profile: 'apps/web/app/profile/[address]/page.tsx',
  notFound: 'apps/web/app/not-found.tsx',
  error: 'apps/web/app/error.tsx',
  css: 'apps/web/app/secondary.css',
  layout: 'apps/web/app/layout.tsx',
  tokenClient: 'apps/web/components/token/token-client.tsx',
} as const;

describe('Bread UI/UX v2.2 secondary routes and global states', () => {
  it('ships the source-defined secondary route shells without adding a reputation product', () => {
    for (const path of [
      paths.activity,
      paths.stats,
      paths.docs,
      paths.terms,
      paths.privacy,
      paths.risks,
      paths.profile,
      paths.notFound,
      paths.css,
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }

    const profile = read(paths.profile);
    expect(profile).toContain('redirect');
    expect(profile).toContain('/explore?creator=');
    expect(profile).not.toMatch(/score|reputation|performance history/i);
  });

  it('fails closed for platform-wide activity and statistics while aggregate projections are absent', () => {
    const activity = read(paths.activity);
    const stats = read(paths.stats);

    expect(activity).toMatch(/platform-wide activity/i);
    expect(activity).toMatch(/unavailable|not available/i);
    expect(activity).toMatch(/indexed/i);
    expect(activity).not.toMatch(/fake|sample|mock/i);

    expect(stats).toMatch(/platform statistics/i);
    expect(stats).toMatch(/unavailable|not available/i);
    expect(stats).toMatch(/indexed/i);
    expect(stats).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:USDC|launches|trades|graduations)\b/i);
  });

  it('uses the readable documentation/legal shell and does not invent missing legal copy', () => {
    const docs = read(paths.docs);
    const legal = [read(paths.terms), read(paths.privacy), read(paths.risks)].join('\n');
    const css = read(paths.css);
    const layout = read(paths.layout);

    expect(docs).toContain('bread-readable-route');
    expect(docs).toContain('bread-readable-route__nav');
    expect(docs).toContain('bread-technical');
    expect(legal).toContain('bread-readable-route');
    expect(legal).toMatch(/approved legal copy|legal copy/i);
    expect(read(paths.risks)).toMatch(/risk disclosure/i);
    expect(css).toMatch(/bread-readable-route[\s\S]*max-width:\s*840px/);
    expect(css).toMatch(/bread-readable-route__nav[\s\S]*position:\s*sticky/);
    expect(layout).toContain("import './secondary.css'");
  });

  it('distinguishes ordinary 404, valid-looking non-launch, and website/read-service failure', () => {
    const notFound = read(paths.notFound);
    const token = read(paths.tokenClient);
    const error = read(paths.error);

    expect(notFound).toContain('Page not found');
    expect(token).toContain('Not a Bread launch');
    expect(error).toMatch(/website|read service|page/i);
    expect(error).toMatch(/onchain|on-chain/i);
    expect(error).toMatch(/unchanged|does not change/i);
  });
});
