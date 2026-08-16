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
  shortAddress,
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
const CANONICAL_BPS = /^\d{1,5}$/;
const PERCENT_INPUT = /^\d{1,3}(?:\.\d{1,2})?$/;
const ADDRESS_SHAPE = /^0x[0-9a-fA-F]{40}$/;

type ExploreFilters = Readonly<{
  age?: FeedAge;
  holdersMin?: string;
  holdersMax?: string;
  progressMinBps?: string;
  progressMaxBps?: string;
  creator?: string;
}>;

function resolveFeedAge(value: string | null): FeedAge | undefined {
  return AGE_OPTIONS.find((option) => option.value === value)?.value;
}

function resolveProgressBps(value: string | null): string | undefined {
  if (value === null || !CANONICAL_BPS.test(value)) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000) return undefined;
  return String(parsed);
}

function ageLabel(age: FeedAge): string {
  return AGE_OPTIONS.find((option) => option.value === age)?.label ?? age;
}

function holderLabel(min: string | undefined, max: string | undefined): string {
  if (min !== undefined && max !== undefined) return `${min}–${max}`;
  if (min !== undefined) return `≥${min}`;
  return `≤${max ?? ''}`;
}

function percentToBps(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!PERCENT_INPUT.test(trimmed)) return undefined;
  const [whole = '0', fraction = ''] = trimmed.split('.');
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) return undefined;
  return String(bps);
}

function bpsToPercent(value: string | undefined): string {
  if (value === undefined) return '';
  const bps = Number(value);
  const percent = (bps / 100).toFixed(2);
  return percent.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function progressLabel(minBps: string | undefined, maxBps: string | undefined): string {
  const min = bpsToPercent(minBps);
  const max = bpsToPercent(maxBps);
  if (minBps !== undefined && maxBps !== undefined) return `${min}–${max}%`;
  if (minBps !== undefined) return `≥${min}%`;
  return `≤${max}%`;
}

function exploreHref(view: ExploreView, filters: ExploreFilters): string {
  const params = new URLSearchParams();
  if (view !== 'new') params.set('view', view);
  if (filters.age !== undefined) params.set('age', filters.age);
  if (filters.holdersMin !== undefined) params.set('holdersMin', filters.holdersMin);
  if (filters.holdersMax !== undefined) params.set('holdersMax', filters.holdersMax);
  if (filters.progressMinBps !== undefined) params.set('progressMinBps', filters.progressMinBps);
  if (filters.progressMaxBps !== undefined) params.set('progressMaxBps', filters.progressMaxBps);
  if (filters.creator !== undefined) params.set('creator', filters.creator);
  return params.size > 0 ? `/explore?${params.toString()}` : '/explore';
}

export function ExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = resolveExploreView(searchParams.get('view'));
  const age = resolveFeedAge(searchParams.get('age'));
  const holdersMin = searchParams.get('holdersMin') ?? undefined;
  const holdersMax = searchParams.get('holdersMax') ?? undefined;
  const progressMinBps = resolveProgressBps(searchParams.get('progressMinBps'));
  const progressMaxBps = resolveProgressBps(searchParams.get('progressMaxBps'));
  const creatorParam = searchParams.get('creator');
  const creator = creatorParam === null ? undefined : creatorParam.toLowerCase();
  const hasHolderFilter = holdersMin !== undefined || holdersMax !== undefined;
  const hasProgressFilter = progressMinBps !== undefined || progressMaxBps !== undefined;
  const hasCreatorFilter = creator !== undefined;
  const hasActiveFilters =
    age !== undefined || hasHolderFilter || hasProgressFilter || hasCreatorFilter;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const api = useMemo(() => createBreadApiClient(), []);

  const query = useInfiniteQuery({
    queryKey: breadQueryKeys.feed({
      view,
      age,
      holdersMin,
      holdersMax,
      progressMinBps,
      progressMaxBps,
      creator,
      limit: PAGE_SIZE,
    }),
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api.getFeed<readonly IndexedFeedCardFields[]>({
        view,
        age,
        holdersMin,
        holdersMax,
        progressMinBps,
        progressMaxBps,
        creator,
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
          <p className="bread-page__supporting">
            Browse indexed Bread launches without per-card chain queries.
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <nav className="bread-explore-tabs" aria-label="Explore feed">
          {VIEWS.map((item) => (
            <a
              aria-current={item.value === view ? 'page' : undefined}
              className="bread-explore-tab"
              href={exploreHref(item.value, {
                age,
                holdersMin,
                holdersMax,
                progressMinBps,
                progressMaxBps,
                creator,
              })}
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
              onClick={() =>
                navigateWithFilters({
                  holdersMin,
                  holdersMax,
                  progressMinBps,
                  progressMaxBps,
                  creator,
                })
              }
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
              onClick={() =>
                navigateWithFilters({ age, progressMinBps, progressMaxBps, creator })
              }
              type="button"
            >
              <span>Holders: {holderLabel(holdersMin, holdersMax)}</span>
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          {hasProgressFilter ? (
            <button
              aria-label={`Baked progress: ${progressLabel(progressMinBps, progressMaxBps)}`}
              className={styles.chip}
              onClick={() => navigateWithFilters({ age, holdersMin, holdersMax, creator })}
              type="button"
            >
              <span>Baked progress: {progressLabel(progressMinBps, progressMaxBps)}</span>
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          {hasCreatorFilter ? (
            <button
              aria-label={`Creator: ${creator}`}
              className={styles.chip}
              onClick={() =>
                navigateWithFilters({
                  age,
                  holdersMin,
                  holdersMax,
                  progressMinBps,
                  progressMaxBps,
                })
              }
              type="button"
            >
              <span>Creator: {shortAddress(creator)}</span>
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
                navigateWithFilters({
                  age: nextAge,
                  holdersMin,
                  holdersMax,
                  progressMinBps,
                  progressMaxBps,
                  creator,
                });
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
            key={`holders:${holdersMin ?? ''}:${holdersMax ?? ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const rawMin = String(form.get('holdersMin') ?? '').trim();
              const rawMax = String(form.get('holdersMax') ?? '').trim();
              navigateWithFilters({
                age,
                holdersMin: rawMin.length > 0 ? rawMin : undefined,
                holdersMax: rawMax.length > 0 ? rawMax : undefined,
                progressMinBps,
                progressMaxBps,
                creator,
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

          <form
            className={styles.holderForm}
            key={`progress:${progressMinBps ?? ''}:${progressMaxBps ?? ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const rawMin = String(form.get('progressMin') ?? '').trim();
              const rawMax = String(form.get('progressMax') ?? '').trim();
              const nextMinBps = percentToBps(rawMin);
              const nextMaxBps = percentToBps(rawMax);
              if (
                (rawMin.length > 0 && nextMinBps === undefined) ||
                (rawMax.length > 0 && nextMaxBps === undefined)
              ) {
                return;
              }
              if (
                nextMinBps !== undefined &&
                nextMaxBps !== undefined &&
                Number(nextMinBps) > Number(nextMaxBps)
              ) {
                return;
              }
              navigateWithFilters({
                age,
                holdersMin,
                holdersMax,
                progressMinBps: nextMinBps,
                progressMaxBps: nextMaxBps,
                creator,
              });
              setFiltersOpen(false);
            }}
          >
            <div className={styles.rangeFields}>
              <label className={styles.field} htmlFor="bread-explore-progress-min">
                <span>Baked progress min</span>
                <input
                  defaultValue={bpsToPercent(progressMinBps)}
                  id="bread-explore-progress-min"
                  inputMode="decimal"
                  max="100"
                  min="0"
                  name="progressMin"
                  step="0.01"
                  type="number"
                />
              </label>
              <label className={styles.field} htmlFor="bread-explore-progress-max">
                <span>Baked progress max</span>
                <input
                  defaultValue={bpsToPercent(progressMaxBps)}
                  id="bread-explore-progress-max"
                  inputMode="decimal"
                  max="100"
                  min="0"
                  name="progressMax"
                  step="0.01"
                  type="number"
                />
              </label>
            </div>
            <button className={styles.apply} type="submit">
              Apply baked progress filter
            </button>
          </form>

          <form
            className={styles.holderForm}
            key={`creator:${creator ?? ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const rawCreator = String(form.get('creator') ?? '').trim();
              if (rawCreator.length > 0 && !ADDRESS_SHAPE.test(rawCreator)) return;
              navigateWithFilters({
                age,
                holdersMin,
                holdersMax,
                progressMinBps,
                progressMaxBps,
                creator: rawCreator.length > 0 ? rawCreator.toLowerCase() : undefined,
              });
              setFiltersOpen(false);
            }}
          >
            <label className={styles.field} htmlFor="bread-explore-creator">
              <span>Creator wallet</span>
              <input
                autoCapitalize="none"
                autoComplete="off"
                defaultValue={creator ?? ''}
                id="bread-explore-creator"
                name="creator"
                pattern="0x[0-9a-fA-F]{40}"
                spellCheck={false}
                type="text"
              />
            </label>
            <button className={styles.apply} type="submit">
              Apply creator filter
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
            <EmptyState
              title="No indexed launches yet"
              detail="New Bread launches will appear here after they are indexed."
            />
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