import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOnce(path, before, after) {
  const source = await readFile(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected source fragment not found: ${before}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${path}: source fragment is not unique: ${before}`);
  }
  await writeFile(path, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
}

await replaceOnce(
  'apps/web/components/explore/model.ts',
  '    image: source.metadata.image ?? null,',
  '    image: source.metadata?.image ?? null,',
);

await replaceOnce(
  'tests/day7/explore-search.test.ts',
  "        symbol: 'BRD',\n        metrics:",
  "        symbol: 'BRD',\n        metadata: {},\n        metrics:",
);
await replaceOnce(
  'tests/day7/explore-search.test.ts',
  "      symbol: 'BRD',\n      price:",
  "      symbol: 'BRD',\n      image: null,\n      price:",
);
await replaceOnce(
  'tests/day7/explore-search.test.ts',
  '      priceChange24h: null,\n',
  '',
);
await replaceOnce(
  'tests/day7/explore-search.test.ts',
  "      symbol: 'FRESH',\n      metrics:",
  "      symbol: 'FRESH',\n      metadata: {},\n      metrics:",
);
await replaceOnce(
  'tests/day7/explore-search.test.ts',
  "    expect(source).toContain('<dt>24h change</dt>');",
  "    expect(source).not.toContain('<dt>24h change</dt>');",
);

await replaceOnce(
  'apps/web/e2e/fixtures/indexed-api.ts',
  '    symbol: item.symbol,\n    matchKind,',
  '    symbol: item.symbol,\n    metadata: item.metadata,\n    matchKind,',
);

await rm('.github/workflows/source-backed-followup-sync.yml', { force: true });
await rm('scripts/maintenance/apply-source-backed-followup.mjs', { force: true });
