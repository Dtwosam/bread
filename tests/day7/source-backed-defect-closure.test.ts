import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('source-backed interface and automatic-graduation defect closure', () => {
  it('forbids any public wallet-owned graduation transaction path', () => {
    const graduation = read('apps/web/components/token/graduation-module.tsx');

    expect(graduation).not.toMatch(/useTradeRuntime|executeGraduationRetryLifecycle|recoverGraduationRetryTransactions/);
    expect(graduation).not.toMatch(/Retry graduation|Continue graduation|Connect wallet to retry|Switch to Arc/);
    expect(graduation).not.toMatch(/sendPreparedTransaction|AWAITING_SIGNATURE|TransactionStatus/);
    expect(graduation).toMatch(/automatic/i);
  });

  it('owns permissionless graduation continuation in the operator runtime', () => {
    const keeperPath = resolve(root, 'apps/operator/src/graduation-keeper.ts');
    const runnerPath = resolve(root, 'apps/operator/src/run-graduation-keeper.ts');
    expect(existsSync(keeperPath)).toBe(true);
    expect(existsSync(runnerPath)).toBe(true);
    if (!existsSync(keeperPath) || !existsSync(runnerPath)) return;

    const keeper = read('apps/operator/src/graduation-keeper.ts');
    const runner = read('apps/operator/src/run-graduation-keeper.ts');
    expect(keeper).toContain('prepareRetryGraduation');
    expect(keeper).toContain('simulatePreparedTransaction');
    expect(keeper).toMatch(/CREATE_POOL|SWEEP/);
    expect(keeper).toMatch(/waitForTransactionReceipt/);
    expect(runner).toContain("url.searchParams.set('lifecycle', 'processing')");
    expect(runner).toContain('BREAD_GRADUATION_KEEPER_PRIVATE_KEY');
    expect(runner).toContain('runGraduationKeeperPass');
    expect(runner).not.toMatch(/creator.*private.?key|user.*private.?key/i);
  });

  it('renders canonical indexed market cap on Token detail', () => {
    const stats = read('apps/web/components/token/token-stats.tsx');
    expect(stats).toContain("formatUsdcBaseUnits(token.metrics?.marketCap ?? null)");
    expect(stats).not.toContain("['Market cap', '—']");
  });

  it('renders sanitized token description and social metadata instead of placeholders', () => {
    const tabs = read('apps/web/components/token/token-tabs.tsx');
    expect(tabs).toContain('token.metadata.description');
    expect(tabs).toContain('token.metadata.website');
    expect(tabs).toContain('token.metadata.x');
    expect(tabs).toContain('token.metadata.telegram');
    expect(tabs).not.toMatch(/<dt>Description<\/dt>\s*<dd>—<\/dd>/s);
    expect(tabs).not.toMatch(/<dt>Social links<\/dt>\s*<dd>—<\/dd>/s);
  });

  it('does not display unsupported 24h change placeholders as if they were connected metrics', () => {
    const card = read('apps/web/components/token-card.tsx');
    const portfolio = read('apps/web/app/portfolio/page.tsx');
    expect(card).not.toContain('24h change');
    expect(portfolio).not.toContain('24h change');
  });

  it('passes the trusted Bread media base through feed serialization and renders canonical card images', () => {
    const feed = read('apps/api/src/routes/feed.ts');
    const model = read('apps/web/components/explore/model.ts');
    const card = read('apps/web/components/token-card.tsx');

    expect(feed).toContain('serializeLaunch(launch, deps.trustedMediaBaseUrl)');
    expect(model).toContain("'metadata'");
    expect(card).toContain('model.image');
    expect(card).toMatch(/<img[\s\S]*src=\{model\.image\}/);
  });
});
