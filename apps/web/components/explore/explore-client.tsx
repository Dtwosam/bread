'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import { FreshnessBanner } from '../freshness-banner';
import { TokenCard } from '../token-card';
import { createBreadApiClient, type FeedAge } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
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

function resolveFeedAge(value: string | null): FeedAge | undefined {
  return AGE_OPTIONS.find((option) => option.value === value)?.value;
}

function ageLabel(age: FeedAge): string {
  return AGE_OPTIONS.find((option) => option.value === age)?.label ?? age;
}

function exploreHref(view: ExploreView, age: FeedAge | undefined): string {
  const params = new URLSearchParams();
  if (view !== 'new') params.set('view', view);
  if (age !== undefined) params.set('age', age);
  return params.size > 0 ? `/explore?${params.toString()}` : '/explore';
}

export function ExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = resolveExploreView(searchParams.get('view'));
  const age = resolveFeedAge(searchParams.get('age'));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const api = useMemo(() => createBreadApiClient(), []);

  const query = useInfiniteQuery({
    queryKey: breadQueryKeys.feed({ view, age, limit: PAGE_SIZE }),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api.getFeed<readonly IndexedFeedCardFields[]>({
        view,
        age,
        limit: PAGE_SIZE,
        cursor: pageParam || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page?.hasMore ? lastPage.page.nextCursor : undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const latestMeta = query.data?.pages.at(-1)?.meta;
  const errorPresentation = query.isError ? feedErrorPresentation(query.error) : null;

  const navigateWithAge = (nextAge: FeedAge | undefined) => {
    router.push(exploreHref(view, nextAge), { scroll: false });
  };

  return (
    <main className="bread-page bread-explore-page">
      <div className="bread-explore-heading">
        <div>
          <h1 className="bread-page__heading">Explore</h1>
          <p className="bread-page__supporting">Browse indexed Bread launches without per-card chain queries.</p>
        </div>
      </div>

      <div className="bread-explore-toolbar">
        <nav className="bread-explore-tabs" aria-label="Explore feed">
          {VIEWS.map((item) => (
            <a
              aria-current={item.value === view ? 'page' : undefined}
              className="bread-explore-tab"
              href={exploreHref(item.value, age)}
              key={item.value}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button
          aria-controls="bread-explore-filters"
          aria-expanded={filtersOpen}
          className="bread-explore-filter-trigger"
          onClick={() => setFiltersOpen((open) => !open)}
          type="button"
        >
          Filters
        </button>
      </div>

      {age !== undefined ? (
        <div className="bread-explore-active-filters" aria-label="Active filters">
          <button
            aria-label={`Age: ${ageLabel(age)}`}
            className="bread-explore-filter-chip"
            onClick={() => navigateWithAge(undefined)}
            type="button"
          >
            <span>Age: {ageLabel(age)}</span>
            <span aria-hidden="true">×</span>
          </button>
          <button
            aria-label="Reset filters"
            className="bread-explore-reset"
            onClick={() => navigateWithAge(undefined)}
            type="button"
          >
            Reset
          </button>
        </div>
      ) : null}

      <div className="bread-explore-layout">
        <aside
          className={`bread-explore-filters${filtersOpen ? ' bread-explore-filters--open' : ''}`}
          id="bread-explore-filters"
        >
          <div className="bread-explore-filters__heading">
            <div>
              <h2>Filters</h2>
              <p>Refine the indexed feed.</p>
            </div>
            <button
              aria-label="Close filters"
              className="bread-explore-filter-close"
              onClick={() => setFiltersOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          <label className="bread-explore-filter-field" htmlFor="bread-explore-age">
            <span>Age</span>
            <select
              id="bread-explore-age"
              onChange={(event) => {
                const nextAge = resolveFeedAge(event.target.value);
                navigateWithAge(nextAge);
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
        </aside>

        <section className="bread-explore-feed" aria-label="Explore results">
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
