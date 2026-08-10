'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { IndexedSearchResult } from '../../../packages/types/src/index';
import { Button } from '@bread/ui';
import { createBreadApiClient } from '../lib/api/client';
import { breadQueryKeys } from '../lib/api/queries';
import { searchIntent } from './explore/model';
import { FreshnessBanner } from './freshness-banner';

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

  function openSearch() {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setOpen(true);
  }

  function closeSearch() {
    setOpen(false);
  }

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
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
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
      <Button variant="secondary" className={compact ? 'bread-search-trigger--compact' : undefined} onClick={openSearch}>
        Search
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

              {query.data?.data.map((result) => (
                <a
                  className="bread-search-result"
                  href={`/token/${encodeURIComponent(result.tokenAddress)}`}
                  key={result.tokenAddress}
                >
                  <span>
                    <strong>{result.name?.trim() || 'Unnamed token'}</strong>
                    <span>${result.symbol?.trim() || '—'}</span>
                  </span>
                  <code className="bread-technical">{result.tokenAddress}</code>
                </a>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
