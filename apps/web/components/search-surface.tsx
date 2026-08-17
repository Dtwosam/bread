'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';

import type { IndexedFeedItem, IndexedSearchResult } from '../../../packages/types/src/index';
import { Button, CreatorAttribution, Icon } from '@bread/ui';
import { createBreadApiClient } from '../lib/api/client';
import { breadQueryKeys } from '../lib/api/queries';
import { formatUsdcBaseUnits, searchIntent, shortAddress } from './explore/model';
import { FreshnessBanner } from './freshness-banner';

const RECENT_SEARCH_STORAGE_KEY = 'bread.search.recent.v1';
const MAX_RECENT_SEARCHES = 8;
const MAX_TRENDING_SEARCHES = 8;
const TOKEN_ADDRESS = /^0x[0-9a-f]{40}$/;

function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function formatSearchAge(ageSeconds: string | null): string | null {
  if (ageSeconds === null || !/^\d+$/.test(ageSeconds)) return null;
  const seconds = Number(ageSeconds);
  if (!Number.isSafeInteger(seconds) || seconds < 0) return null;
  if (seconds < 60) return '<1m';
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function searchLifecycleLabel(state: IndexedSearchResult['lifecycleState']): string | null {
  if (state === 'PROCESSING') return 'Graduating';
  if (state === 'GRADUATION_PENDING') return 'Graduation pending';
  if (state === 'GRADUATED') return 'Graduated';
  return null;
}

function searchResultInitial(result: IndexedSearchResult): string {
  return (result.symbol?.trim() || result.name?.trim() || '?').slice(0, 1).toUpperCase();
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStoredRecentSearch(value: unknown): value is IndexedSearchResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.tokenAddress === 'string' &&
    TOKEN_ADDRESS.test(result.tokenAddress) &&
    typeof result.curveAddress === 'string' &&
    typeof result.deployerAddress === 'string' &&
    typeof result.creatorFeeRecipient === 'string' &&
    nullableString(result.name) &&
    nullableString(result.symbol) &&
    typeof result.matchKind === 'string' &&
    nullableString(result.ageSeconds) &&
    nullableString(result.holderCount) &&
    nullableString(result.marketCap) &&
    (result.lifecycleState === null ||
      result.lifecycleState === 'PROCESSING' ||
      result.lifecycleState === 'GRADUATION_PENDING' ||
      result.lifecycleState === 'GRADUATED')
  );
}

function normalizeRecentSearches(value: unknown): IndexedSearchResult[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  const recent: IndexedSearchResult[] = [];
  for (const candidate of value) {
    if (!isStoredRecentSearch(candidate)) continue;
    const identity = candidate.tokenAddress.toLowerCase();
    if (unique.has(identity)) continue;
    unique.add(identity);
    recent.push({ ...candidate, tokenAddress: identity });
    if (recent.length === MAX_RECENT_SEARCHES) break;
  }
  return recent;
}

function readRecentSearches(): IndexedSearchResult[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeRecentSearches(parsed);
    if (normalized.length === 0 && Array.isArray(parsed) && parsed.length > 0) {
      window.localStorage.removeItem(RECENT_SEARCH_STORAGE_KEY);
    }
    return normalized;
  } catch {
    window.localStorage.removeItem(RECENT_SEARCH_STORAGE_KEY);
    return [];
  }
}

function writeRecentSearches(recent: readonly IndexedSearchResult[]): void {
  if (recent.length === 0) {
    window.localStorage.removeItem(RECENT_SEARCH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(recent));
}

function indexedAgeSeconds(
  launchTimestamp: string | null,
  indexedThroughBlockTimestamp: string,
): string | null {
  if (launchTimestamp === null || !/^\d+$/.test(launchTimestamp) || !/^\d+$/.test(indexedThroughBlockTimestamp)) {
    return null;
  }
  const launched = BigInt(launchTimestamp);
  const indexed = BigInt(indexedThroughBlockTimestamp);
  return (indexed > launched ? indexed - launched : BigInt(0)).toString(10);
}

function feedLifecycleState(item: IndexedFeedItem): IndexedSearchResult['lifecycleState'] {
  if (item.graduatedVenueKind !== null || item.progress?.state === 'GRADUATED') return 'GRADUATED';
  if (item.progress?.state === 'GRADUATION_PENDING') return 'GRADUATION_PENDING';
  if (item.progress?.state === 'PROCESSING') return 'PROCESSING';
  return null;
}

function feedToSearchResult(item: IndexedFeedItem, indexedThroughBlockTimestamp: string): IndexedSearchResult {
  return {
    tokenAddress: item.tokenAddress,
    curveAddress: item.curveAddress,
    deployerAddress: item.deployerAddress,
    creatorFeeRecipient: item.creatorFeeRecipient,
    name: item.name,
    symbol: item.symbol,
    matchKind: 'TRENDING',
    ageSeconds: indexedAgeSeconds(item.launchTimestamp, indexedThroughBlockTimestamp),
    holderCount: item.holderCount,
    marketCap: item.marketCap,
    lifecycleState: feedLifecycleState(item),
  };
}

function SearchResultLink({
  result,
  onSelect,
}: Readonly<{
  result: IndexedSearchResult;
  onSelect?: (result: IndexedSearchResult) => void;
}>) {
  const age = formatSearchAge(result.ageSeconds);
  const lifecycle = searchLifecycleLabel(result.lifecycleState);
  return (
    <a
      className="bread-search-result"
      href={`/token/${encodeURIComponent(result.tokenAddress)}`}
      onClick={() => onSelect?.(result)}
    >
      <span className="bread-search-result__identity">
        <span className="bread-search-result__image" aria-hidden="true">{searchResultInitial(result)}</span>
        <span className="bread-search-result__copy">
          <strong>{result.name?.trim() || 'Unnamed token'}</strong>
          <span>${result.symbol?.trim() || '—'}</span>
          <CreatorAttribution creatorAddress={result.deployerAddress} />
        </span>
      </span>
      <span className="bread-search-result__details">
        <span>Market cap {formatUsdcBaseUnits(result.marketCap)}</span>
        <span>Age {age ?? '—'}</span>
        <span>Holders {result.holderCount ?? '—'}</span>
        <span>Lifecycle {lifecycle ?? '—'}</span>
        {result.matchKind === 'CONTRACT' ? <span>Exact contract match</span> : null}
        <code className="bread-technical" title={result.tokenAddress}>
          {shortAddress(result.tokenAddress)}
        </code>
      </span>
    </a>
  );
}

export function SearchSurface({ compact = false }: Readonly<{ compact?: boolean }>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [recentSearches, setRecentSearches] = useState<readonly IndexedSearchResult[]>([]);
  const inputId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const api = useMemo(() => createBreadApiClient(), []);
  const intent = searchIntent(value);
  const isIdleSurface = intent.kind === 'idle' && value.trim().length === 0;

  const query = useQuery({
    queryKey:
      intent.kind === 'search'
        ? breadQueryKeys.search({ q: intent.query, limit: 20 })
        : (['bread', 'search', 'idle'] as const),
    queryFn: () => {
      if (intent.kind !== 'search') throw new Error('Search query is not ready.');
      return api.search<readonly IndexedSearchResult[]>({ q: intent.query, limit: 20 });
    },
    enabled: open && intent.kind === 'search',
  });

  const trendingQuery = useQuery({
    queryKey: breadQueryKeys.feed({ view: 'trending', limit: MAX_TRENDING_SEARCHES }),
    queryFn: () => api.getFeed<readonly IndexedFeedItem[]>({ view: 'trending', limit: MAX_TRENDING_SEARCHES }),
    enabled: open && isIdleSurface,
  });

  const trendingSearches = useMemo(() => {
    const response = trendingQuery.data;
    if (!response) return [];
    return response.data.map((item) => feedToSearchResult(item, response.meta.indexedThroughBlockTimestamp));
  }, [trendingQuery.data]);

  const searchGroups = useMemo(() => {
    const results = query.data?.data ?? [];
    const addressSearch = intent.kind === 'search' && /^0x[0-9a-f]{40}$/i.test(intent.query);
    const exact = results.filter((result) => result.matchKind === 'CONTRACT');
    const creators = results.filter(
      (result) => result.matchKind === 'CREATOR' || (addressSearch && result.matchKind !== 'CONTRACT'),
    );
    const tokens = addressSearch
      ? []
      : results.filter((result) => result.matchKind !== 'CONTRACT' && result.matchKind !== 'CREATOR');

    return [
      { label: 'Exact match', results: exact },
      { label: 'Tokens', results: tokens },
      { label: 'Creators / wallets', results: creators },
    ].filter((group) => group.results.length > 0);
  }, [intent, query.data?.data]);

  function recordRecentSearch(result: IndexedSearchResult) {
    setRecentSearches((current) => {
      const identity = result.tokenAddress.toLowerCase();
      const next = [
        { ...result, tokenAddress: identity },
        ...current.filter((entry) => entry.tokenAddress.toLowerCase() !== identity),
      ].slice(0, MAX_RECENT_SEARCHES);
      writeRecentSearches(next);
      return next;
    });
  }

  function removeRecentSearch(tokenAddress: string) {
    setRecentSearches((current) => {
      const identity = tokenAddress.toLowerCase();
      const next = current.filter((entry) => entry.tokenAddress.toLowerCase() !== identity);
      writeRecentSearches(next);
      return next;
    });
  }

  function clearRecentSearches() {
    writeRecentSearches([]);
    setRecentSearches([]);
  }

  function openSearch(event: MouseEvent<HTMLButtonElement>) {
    returnFocusRef.current = event.currentTarget;
    setOpen(true);
  }

  function closeSearch() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    setRecentSearches(readRecentSearches());
  }, [open]);

  useEffect(() => {
    if (compact) return;
    const onShortcut = (event: KeyboardEvent) => {
      const isShortcut = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey;
      if (!isShortcut) return;

      event.preventDefault();
      const trigger = document.querySelector<HTMLElement>('.bread-header .bread-search-trigger');
      const active = document.activeElement;
      returnFocusRef.current = trigger ?? (active instanceof HTMLElement ? active : null);
      setOpen(true);
    };

    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [compact]);

  useEffect(() => {
    if (open) return;
    const returnTarget = returnFocusRef.current;
    if (!returnTarget) return;
    returnFocusRef.current = null;
    returnTarget.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const results = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('a.bread-search-result[href]'));
        if (results.length === 0) return;

        const activeIndex = results.findIndex((result) => result === document.activeElement);
        const nextIndex =
          event.key === 'ArrowDown'
            ? activeIndex >= 0
              ? (activeIndex + 1) % results.length
              : 0
            : activeIndex >= 0
              ? (activeIndex - 1 + results.length) % results.length
              : results.length - 1;

        event.preventDefault();
        results[nextIndex]?.focus();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const focusOutside = !(active instanceof Node) || !dialog.contains(active);

      if (event.shiftKey && (active === first || focusOutside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || focusOutside)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        variant="secondary"
        className={compact ? 'bread-search-trigger--compact' : 'bread-search-trigger'}
        ariaLabel="Search"
        onClick={openSearch}
      >
        <Icon size="normal">
          <SearchGlyph />
        </Icon>
        <span>{compact ? 'Search' : 'Search token, ticker or contract…'}</span>
      </Button>

      {open ? (
        <div className="bread-search-backdrop" role="presentation" onMouseDown={closeSearch}>
          <section
            ref={dialogRef}
            tabIndex={-1}
            className="bread-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${inputId}-title`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="bread-search-dialog__header">
              <div>
                <h2 id={`${inputId}-title`}>Search Bread</h2>
                <p>Name, ticker, contract or creator wallet.</p>
              </div>
              <Button variant="small" ariaLabel="Close search" onClick={closeSearch}>
                Close
              </Button>
            </div>

            <label className="bread-search-field" htmlFor={inputId}>
              <span className="bread-visually-hidden">Search tokens</span>
              <input
                id={inputId}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Search by name, ticker, contract or creator"
              />
            </label>

            <div className="bread-search-results" aria-live="polite">
              {query.data?.meta ? <FreshnessBanner meta={query.data.meta} /> : null}
              {isIdleSurface && trendingQuery.data?.meta ? <FreshnessBanner meta={trendingQuery.data.meta} /> : null}
              {intent.kind === 'invalid-address' ? (
                <p className="bread-inline-error">That contract address is incomplete or malformed.</p>
              ) : null}
              {intent.kind === 'idle' && value.trim().length > 0 ? (
                <p className="bread-search-hint">Type at least two characters, or paste a full contract address.</p>
              ) : null}
              {query.isPending && intent.kind === 'search' ? <p className="bread-search-hint">Searching…</p> : null}
              {query.isError ? <p className="bread-inline-error">Search is unavailable right now.</p> : null}
              {query.data?.data.length === 0 ? <p className="bread-search-hint">No indexed tokens found.</p> : null}

              {isIdleSurface && recentSearches.length > 0 ? (
                <section>
                  <div className="bread-search-dialog__header">
                    <h3 className="bread-search-hint">Recent searches</h3>
                    <Button variant="small" ariaLabel="Clear recent searches" onClick={clearRecentSearches}>
                      Clear recent
                    </Button>
                  </div>
                  {recentSearches.map((result) => (
                    <div key={result.tokenAddress}>
                      <SearchResultLink result={result} onSelect={recordRecentSearch} />
                      <Button
                        variant="small"
                        ariaLabel={`Remove ${result.name?.trim() || result.symbol?.trim() || shortAddress(result.tokenAddress)} from recent searches`}
                        onClick={() => removeRecentSearch(result.tokenAddress)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </section>
              ) : null}

              {isIdleSurface ? (
                <section>
                  <h3 className="bread-search-hint">Trending searches</h3>
                  {trendingQuery.isPending ? <p className="bread-search-hint">Loading indexed trends…</p> : null}
                  {trendingQuery.isError ? <p className="bread-inline-error">Trending suggestions are unavailable right now.</p> : null}
                  {trendingQuery.isSuccess && trendingSearches.length === 0 ? (
                    <p className="bread-search-hint">No indexed trending tokens are available.</p>
                  ) : null}
                  {trendingSearches.map((result) => (
                    <SearchResultLink result={result} onSelect={recordRecentSearch} key={result.tokenAddress} />
                  ))}
                </section>
              ) : null}

              {searchGroups.map((group) => (
                <section key={group.label}>
                  <h3 className="bread-search-hint">{group.label}</h3>
                  {group.results.map((result) => (
                    <SearchResultLink result={result} onSelect={recordRecentSearch} key={result.tokenAddress} />
                  ))}
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
