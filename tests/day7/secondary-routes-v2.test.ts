import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const paths = {
  activity: 'apps/web/app/activity/page.tsx',
  stats: 'apps/web/app/stats/page.tsx',
  activityClient: 'apps/web/components/activity/activity-client.tsx',
  statsClient: 'apps/web/components/stats/stats-client.tsx',
  activityRow: 'packages/ui/src/activity-row.ts',
  secondaryRoute: 'apps/api/src/routes/secondary.ts',
  secondaryRepository: 'packages/db/src/repositories/secondary.ts',
  apiTypes: 'packages/types/src/api.ts',
  apiIndex: 'packages/types/src/index.ts',
  apiClient: 'apps/web/lib/api/client.ts',
  apiServer: 'apps/api/src/server.ts',
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

  it('renders platform activity only from canonical indexed launches, trades, and graduation transitions', () => {
    for (const path of [paths.activityClient, paths.activityRow, paths.secondaryRoute, paths.secondaryRepository]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    const page = read(paths.activity);
    const client = read(paths.activityClient);
    const route = read(paths.secondaryRoute);
    const repository = read(paths.secondaryRepository);
    const apiTypes = read(paths.apiTypes);
    const apiIndex = read(paths.apiIndex);
    const apiClient = read(paths.apiClient);
    const server = read(paths.apiServer);

    expect(page).toContain('ActivityClient');
    expect(client).toContain('ActivityRow');
    expect(client).toContain('CreatorAttribution');
    expect(client).toContain('getActivity');
    expect(route).toContain("'/v1/activity'");
    expect(route).toContain('listPlatformActivity');
    expect(repository).toContain('listPlatformActivity');
    expect(repository).toContain("'LAUNCH'");
    expect(repository).toContain("'TRADE'");
    expect(repository).toContain("'GRADUATION'");
    expect(repository).toMatch(/ORDER BY[\s\S]*"blockNumberRaw" DESC[\s\S]*"logIndex" DESC/i);
    expect(apiTypes).toContain('IndexedPlatformActivityItem');
    expect(apiIndex).toContain('IndexedPlatformActivityItem');
    expect(apiClient).toContain('getActivity');
    expect(server).toContain('registerSecondaryRoutes');
    expect(`${page}\n${client}`).not.toMatch(/sample|mock activity|fake activity/i);
  });

  it('renders only reliable indexed lifetime platform statistics', () => {
    for (const path of [paths.statsClient, paths.secondaryRoute, paths.secondaryRepository]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    const page = read(paths.stats);
    const client = read(paths.statsClient);
    const route = read(paths.secondaryRoute);
    const repository = read(paths.secondaryRepository);
    const apiTypes = read(paths.apiTypes);
    const apiClient = read(paths.apiClient);

    expect(page).toContain('StatsClient');
    expect(client).toContain('getStats');
    expect(client).toContain('Volume');
    expect(client).toContain('Launches');
    expect(client).toContain('Trades');
    expect(client).toContain('Graduations');
    expect(route).toContain("'/v1/stats'");
    expect(route).toContain('getPlatformStats');
    expect(repository).toContain('getPlatformStats');
    expect(repository).toContain('SUM(t.quote_amount)');
    expect(repository).toContain("s.graduation_phase = 'POOL_CREATED'");
    expect(apiTypes).toContain('IndexedPlatformStats');
    expect(apiClient).toContain('getStats');
    expect(`${page}\n${client}`).not.toMatch(/active users|tvl|pnl|success rate/i);
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
