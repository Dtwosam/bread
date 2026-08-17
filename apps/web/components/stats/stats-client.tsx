'use client';

import { useQuery } from '@tanstack/react-query';

import type { IndexedPlatformStats } from '../../../../packages/types/src/index';
import { ErrorState, Skeleton } from '@bread/ui';
import { createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import { formatUsdcBaseUnits } from '../explore/model';
import { FreshnessBanner } from '../freshness-banner';

export function StatsClient() {
  const api = createBreadApiClient();
  const query = useQuery({
    queryKey: breadQueryKeys.stats(),
    queryFn: () => api.getStats<IndexedPlatformStats>(),
  });

  if (query.isPending) {
    return <div className="bread-stats-grid" aria-label="Loading platform statistics">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} label="Loading statistic" />)}</div>;
  }
  if (query.isError) {
    return <ErrorState title="Platform statistics are unavailable" detail="Bread could not read the indexed aggregate projection." />;
  }

  const response = query.data;
  const stats = response.data;
  const metrics = [
    ['Volume', formatUsdcBaseUnits(stats.quoteVolume)],
    ['Launches', stats.launches],
    ['Trades', stats.trades],
    ['Graduations', stats.graduations],
  ] as const;

  return (
    <>
      <FreshnessBanner meta={response.meta} />
      <p className="bread-secondary-page__scope">Lifetime indexed Bread activity for the active canonical stack.</p>
      <dl className="bread-stats-grid">
        {metrics.map(([label, value]) => (
          <div className="bread-stat-card" key={label}>
            <dt>{label}</dt>
            <dd className="bread-financial-value">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
