'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { Button, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import { FreshnessBanner } from '../freshness-banner';
import { TokenCard } from '../token-card';
import { createBreadApiClient } from '../../lib/api/client';
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

export function ExploreClient() {
  const searchParams = useSearchParams();
  const view = resolveExploreView(searchParams.get('view'));
  const api = useMemo(() => createBreadApiClient(), []);

  const query = useInfiniteQuery({
    queryKey: breadQueryKeys.feed({ view, limit: PAGE_SIZE }),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api.getFeed<readonly IndexedFeedCardFields[]>({
        view,
        limit: PAGE_SIZE,
        cursor: pageParam || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page?.hasMore ? lastPage.page.nextCursor : undefined,
  });

  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const latestMeta = query.data?.pages.at(-1)?.meta;
  const errorPresentation = query.isError ? feedErrorPresentation(query.error) : null;

  return (
    <main className="bread-page bread-explore-page">
      <div className="bread-explore-heading">
        <div>
          <h1 className="bread-page__heading">Explore</h1>
          <p className="bread-page__supporting">Browse indexed Bread launches without per-card chain queries.</p>
        </div>
      </div>

      <nav className="bread-explore-tabs" aria-label="Explore feed">
        {VIEWS.map((item) => (
          <a
            aria-current={item.value === view ? 'page' : undefined}
            className="bread-explore-tab"
            href={item.value === 'new' ? '/explore' : `/explore?view=${item.value}`}
            key={item.value}
          >
            {item.label}
          </a>
        ))}
      </nav>

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
    </main>
  );
}
