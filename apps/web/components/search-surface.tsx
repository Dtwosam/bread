'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';

import type { IndexedSearchResult } from '../../../packages/types/src/index';
import { Button, CreatorAttribution, Icon } from '@bread/ui';
import { createBreadApiClient } from '../lib/api/client';
import { breadQueryKeys } from '../lib/api/queries';
import { formatUsdcBaseUnits, searchIntent, shortAddress } from './explore/model';
import { FreshnessBanner } from './freshness-banner';

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

function SearchResultLink({ result }: Readonly<{ result: IndexedSearchResult }>) {
  const age = formatSearchAge(result.ageSeconds);
  const lifecycle = searchLifecycleLabel(result.lifecycleState);
  return (
    <a
      className="bread-search-result"
      href={`/token/${encodeURIComponent(result.tokenAddress)}`}
      key={result.tokenAddress}
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
  const inputId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const api = useMemo(() => createBreadApiClient(), []);
  const intent = searchIntent(value);

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

  function openSearch(event: MouseEvent<HTMLButtonElement>) {
    returnFocusRef.current = event.currentTarget;
    setOpen(true);
  }

  function closeSearch() {
    setOpen(false);
  }

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
              {intent.kind === 'invalid-address' ? (
                <p className="bread-inline-error">That contract address is incomplete or malformed.</p>
              ) : null}
              {intent.kind === 'idle' && value.trim().length > 0 ? (
                <p className="bread-search-hint">Type at least two characters, or paste a full contract address.</p>
              ) : null}
              {query.isPending && intent.kind === 'search' ? <p className="bread-search-hint">Searching…</p> : null}
              {query.isError ? <p className="bread-inline-error">Search is unavailable right now.</p> : null}
              {query.data?.data.length === 0 ? <p className="bread-search-hint">No indexed tokens found.</p> : null}

              {searchGroups.map((group) => (
                <section key={group.label}>
                  <h3 className="bread-search-hint">{group.label}</h3>
                  {group.results.map((result) => (
                    <SearchResultLink result={result} key={result.tokenAddress} />
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
