'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import { FreshnessBanner } from '../freshness-banner';
import { TokenCard } from '../token-card';
import { createBreadApiClient, type FeedAge } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import styles from './explore-filters.module.css';
import {
  feedErrorPresentation,
  resolveExploreView,
  type ExploreView,
  type IndexedFeedCardFields,
} from './model';

const PAGE_SIZE = 25;
const VIEWS: readonly Readonly<{ value: ExploreView; label: string }>[] = [
  { value: 'new', label: 'New' },
  { value: 'trending', label: 'Trending' },
  { value: 'graduating', label: 'Almost Baked' },
  { value: 'graduated', label: 'Graduated' },
];
const AGE_OPTIONS: readonly Readonly<{ value: FeedAge; label: string }>[] = [
  { value: 'lt5m', label: '<5m' },
  { value: 'lt1h', label: '<1h' },
  { value: '1h-24h', label: '1–24h' },
  { value: '1d-7d', label: '1–7d' },
];

type ExploreFilters = Readonly<{
  age?: FeedAge;
  holdersMin?: string;
  holdersMax?: string;
}>;

function resolveFeedAge(value: string | null): FeedAge | undefined {
  return AGE_OPTIONS.find((option) => option.value === value)?.value;
}

function ageLabel(age: FeedAge): string {
  return AGE_OPTIONS.find((option) => option.value === age)?.label ?? age;
}

function holderLabel(min: string | undefined, max: string | undefined): string {
  if (min !== undefined && max !== undefined) return `${min}–${max}`;
  if (min !== undefined) return `≥${min}`;
  return `≤${max ?? ''}`;
}

function exploreHref(view: ExploreView, filters: ExploreFilters): string {
  const params = new URLSearchParams();
  if (view !== 'new') params.set('view', view);
  if (filters.age !== undefined) params.set('age', filters.age);
  if (filters.holdersMin !== undefined) params.set('holdersMin', filters.holdersMin);
  if (filters.holdersMax !== undefined) params.set('holdersMax', filters.holdersMax);
  return params.size > 0 ? `/explore?${params.toString()}` : '/explore';
}

export function ExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = resolveExploreView(searchParams.get('view'));
  const age = resolveFeedAge(searchParams.get('age'));
  const holdersMin = searchParams.get('holdersMin') ?? undefined;
  const holdersMax = searchParams.get('holdersMax') ?? undefined;
  const hasHolderFilter = holdersMin !== undefined || holdersMax !== undefined;
  const hasActiveFilters = age !== undefined || hasHolderFilter;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const api = useMemo(() => createBreadApiClient(), []);

  const query = useInfiniteQuery({
    queryKey: breadQueryKeys.feed({
      view,
      age,
      holdersMin,
      holdersMax,
      limit: PAGE_SIZE,
    }),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api.getFeed<readonly IndexedFeedCardFields[]>({
        view,
        age,
        holdersMin,
        holdersMax,
        limit: PAGE_SIZE,
        cursor: pageParam || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page?.hasMore ? lastPage.page.nextCursor : undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const latestMeta = query.data?.pages.at(-1)?.meta;
  const errorPresentation = query.isError ? feedErrorPresentation(query.error) : null;

  const navigateWithFilters = (filters: ExploreFilters) => {
    router.push(exploreHref(view, filters), { scroll: false });
  };

  return (
    <main className="bread-page bread-explore-page">
      <div className="bread-explore-heading">
        <div>
          <h1 className="bread-page__heading">Explore</h1>
          <p className="bread-page__supporting">Browse indexed Bread launches without per-card chain queries.</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <nav className="bread-explore-tabs" aria-label="Explore feed">
          {VIEWS.map((item) => (
            <a
              aria-current={item.value === view ? 'page' : undefined}
              className="bread-explore-tab"
              href={exploreHref(item.value, { age, holdersMin, holdersMax })}
              key={item.value}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button
          aria-controls="bread-explore-filters"
          aria-expanded={filtersOpen}
          className={styles.trigger}
          onClick={() => setFiltersOpen((open) => !open)}
          type="button"
        >
          Filters
        </button>
      </div>

      {hasActiveFilters ? (
        <div className={styles.activeFilters} aria-label="Active filters">
          {age !== undefined ? (
            <button
              aria-label={`Age: ${ageLabel(age)}`}
              className={styles.chip}
              onClick={() => navigateWithFilters({ holdersMin, holdersMax })}
              type="button"
            >
              <span>Age: {ageLabel(age)}</span>
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          {hasHolderFilter ? (
            <button
              aria-label={`Holders: ${holderLabel(holdersMin, holdersMax)}`}
              className={styles.chip}
              onClick={() => navigateWithFilters({ age })}
              type="button"
            >
              <span>Holders: {holderLabel(holdersMin, holdersMax)}</span>
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          <button
            aria-label="Reset filters"
            className={styles.reset}
            onClick={() => navigateWithFilters({})}
            type="button"
          >
            Reset
          </button>
        </div>
      ) : null}

      <div className={styles.layout}>
        <aside
          className={`${styles.panel}${filtersOpen ? ` ${styles.panelOpen}` : ''}`}
          id="bread-explore-filters"
        >
          <div className={styles.panelHeading}>
            <div>
              <h2>Filters</h2>
              <p>Refine the indexed feed.</p>
            </div>
            <button
              aria-label="Close filters"
              className={styles.close}
              onClick={() => setFiltersOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          <label className={styles.field} htmlFor="bread-explore-age">
            <span>Age</span>
            <select
              id="bread-explore-age"
              onChange={(event) => {
                const nextAge = resolveFeedAge(event.target.value);
                navigateWithFilters({ age: nextAge, holdersMin, holdersMax });
                setFiltersOpen(false);
              }}
              value={age ?? ''}
            >
              <option value="">Any</option>
              {AGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <form
            className={styles.holderForm}
            key={`${holdersMin ?? ''}:${holdersMax ?? ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const rawMin = String(form.get('holdersMin') ?? '').trim();
              const rawMax = String(form.get('holdersMax') ?? '').trim();
              navigateWithFilters({
                age,
                holdersMin: rawMin.length > 0 ? rawMin : undefined,
                holdersMax: rawMax.length > 0 ? rawMax : undefined,
              });
              setFiltersOpen(false);
            }}
          >
            <div className={styles.rangeFields}>
              <label className={styles.field} htmlFor="bread-explore-holders-min">
                <span>Holders min</span>
                <input
                  defaultValue={holdersMin ?? ''}
                  id="bread-explore-holders-min"
                  inputMode="numeric"
                  name="holdersMin"
                  pattern="[0-9]*"
                  type="text"
                />
              </label>
              <label className={styles.field} htmlFor="bread-explore-holders-max">
                <span>Holders max</span>
                <input
                  defaultValue={holdersMax ?? ''}
                  id="bread-explore-holders-max"
                  inputMode="numeric"
                  name="holdersMax"
                  pattern="[0-9]*"
                  type="text"
                />
              </label>
            </div>
            <button className={styles.apply} type="submit">
              Apply holder filter
            </button>
          </form>
        </aside>

        <section className={styles.feed} aria-label="Explore results">
          {latestMeta ? <FreshnessBanner meta={latestMeta} /> : null}

          {query.isPending ? (
            <div className="bread-token-grid" aria-label="Loading Explore feed">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} label="Loading token" />
              ))}
            </div>
          ) : null}

          {errorPresentation ? (
            <ErrorState title={errorPresentation.title} detail={errorPresentation.detail} />
          ) : null}

          {!query.isPending && !query.isError && items.length === 0 ? (
            <EmptyState title="No indexed launches yet" detail="New Bread launches will appear here after they are indexed." />
          ) : null}

          {items.length > 0 ? (
            <div className="bread-token-grid">
              {items.map((item) => (
                <TokenCard item={item} key={item.tokenAddress} />
              ))}
            </div>
          ) : null}

          {query.hasNextPage ? (
            <div className="bread-explore-more">
              <Button
                variant="secondary"
                loading={query.isFetchingNextPage}
                loadingLabel="Loading…"
                onClick={() => void query.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
