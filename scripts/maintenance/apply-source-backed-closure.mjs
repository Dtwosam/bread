import { readFile, writeFile, rm } from 'node:fs/promises';

async function replaceOnce(path, before, after) {
  const source = await readFile(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected source fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${path}: source fragment is not unique`);
  }
  await writeFile(path, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
}

await replaceOnce(
  'apps/api/src/routes/feed.ts',
  '            ...serializeLaunch(launch),',
  '            ...serializeLaunch(launch, deps.trustedMediaBaseUrl),',
);

await replaceOnce(
  'apps/api/src/server.ts',
  '    rateLimit: (subject: string) => limiter.take("search", subject),\n  });',
  '    rateLimit: (subject: string) => limiter.take("search", subject),\n    trustedMediaBaseUrl: deps.trustedMediaBaseUrl,\n  });',
);

await replaceOnce(
  'apps/web/components/token/graduation-module.tsx',
  'The bonding curve is complete. Liquidity creation is in progress. Bread’s automatic graduation keeper advances the next permissionless coordinator step.',
  'The bonding curve is complete. Liquidity creation is in progress. Completed trades remain confirmed. Bread’s automatic graduation keeper advances the next permissionless coordinator step.',
);

await replaceOnce(
  'apps/web/components/search-surface.tsx',
  'type SelectableSearchTarget = Pick<\n  RecentSearchTarget,\n  "tokenAddress" | "name" | "symbol" | "deployerAddress"\n>;\n',
  'type SelectableSearchTarget = Pick<\n  RecentSearchTarget,\n  "tokenAddress" | "name" | "symbol" | "deployerAddress"\n>;\n\ntype SearchResultWithMetadata = IndexedSearchResult & Readonly<{ metadata?: IndexedFeedItem["metadata"] }>;\n',
);

await replaceOnce(
  'apps/web/components/search-surface.tsx',
  'function searchResultInitial(result: SelectableSearchTarget): string {\n  return (result.symbol?.trim() || result.name?.trim() || "?")\n    .slice(0, 1)\n    .toUpperCase();\n}\n',
  'function searchResultInitial(result: SelectableSearchTarget): string {\n  return (result.symbol?.trim() || result.name?.trim() || "?")\n    .slice(0, 1)\n    .toUpperCase();\n}\n\nfunction TokenSearchImage({ image, fallback }: Readonly<{ image?: string; fallback: string }>) {\n  return image ? (\n    <img\n      className="bread-search-result__image"\n      src={image}\n      alt=""\n      width={40}\n      height={40}\n      loading="lazy"\n      decoding="async"\n    />\n  ) : (\n    <span className="bread-search-result__image" aria-hidden="true">{fallback}</span>\n  );\n}\n',
);

await replaceOnce(
  'apps/web/components/search-surface.tsx',
  '  result: IndexedSearchResult;\n',
  '  result: SearchResultWithMetadata;\n',
);

await replaceOnce(
  'apps/web/components/search-surface.tsx',
  '        <span className="bread-search-result__image" aria-hidden="true">\n          {searchResultInitial(result)}\n        </span>',
  '        <TokenSearchImage image={result.metadata?.image} fallback={searchResultInitial(result)} />',
);

await replaceOnce(
  'apps/web/components/search-surface.tsx',
  '        <span className="bread-search-result__image" aria-hidden="true">\n          {searchResultInitial(item)}\n        </span>',
  '        <TokenSearchImage image={item.metadata.image} fallback={searchResultInitial(item)} />',
);

await replaceOnce(
  'apps/web/components/search-surface.tsx',
  '      return api.search<readonly IndexedSearchResult[]>({',
  '      return api.search<readonly SearchResultWithMetadata[]>({',
);

await replaceOnce(
  'tests/day7/token-v2-closure.test.ts',
  '    expect(stats).toContain("[\'Market cap\', \'—\']");',
  '    expect(stats).toContain("[\'Market cap\', formatUsdcBaseUnits(token.metrics?.marketCap ?? null)]");',
);

await replaceOnce(
  'tests/day7/token-page-behavior.test.tsx',
  '    expect(graduation).toContain("state === \'Graduating\'");\n    expect(graduation).toContain(\'Continue graduation\');',
  '    expect(graduation).toContain("displayState(token) === \'Graduating\'");\n    expect(graduation).toMatch(/automatic graduation keeper/i);\n    expect(graduation).toMatch(/No creator action or wallet signature is required/i);\n    expect(graduation).not.toMatch(/Retry graduation|Continue graduation|Connect wallet to retry/);',
);

await rm('.github/workflows/source-backed-closure-sync.yml', { force: true });
await rm('scripts/maintenance/apply-source-backed-closure.mjs', { force: true });
