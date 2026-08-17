'use client';

import { useQuery } from '@tanstack/react-query';

import type { IndexedPlatformActivityItem } from '../../../../packages/types/src/index';
import { ActivityRow, CreatorAttribution, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import { createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import { formatIndexedAge, formatUsdcBaseUnits, shortAddress } from '../explore/model';
import { FreshnessBanner } from '../freshness-banner';

const ACTIVITY_LIMIT = 50;

function tokenLabel(item: IndexedPlatformActivityItem): string {
  const symbol = item.symbol?.trim();
  const name = item.name?.trim();
  return symbol ? `$${symbol}` : name || shortAddress(item.tokenAddress);
}

function primaryCopy(item: IndexedPlatformActivityItem): string {
  const token = tokenLabel(item);
  if (item.kind === 'LAUNCH') return `${token} launched`;
  if (item.kind === 'GRADUATION') return `${token} graduated`;
  return `${item.side?.toUpperCase() || 'Trade'} on ${token}`;
}

function financialMeta(item: IndexedPlatformActivityItem): string | null {
  if (item.kind !== 'TRADE') return null;
  if (item.quoteAmount !== null) return formatUsdcBaseUnits(item.quoteAmount);
  if (item.tokenAmount !== null) return `${item.tokenAmount} token base units`;
  return null;
}

export function ActivityClient() {
  const api = createBreadApiClient();
  const query = useQuery({
    queryKey: breadQueryKeys.activity(ACTIVITY_LIMIT),
    queryFn: () => api.getActivity<readonly IndexedPlatformActivityItem[]>(ACTIVITY_LIMIT),
  });

  if (query.isPending) {
    return <div className="bread-secondary-list" aria-label="Loading platform activity">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} label="Loading activity" />)}</div>;
  }
  if (query.isError) {
    return <ErrorState title="Activity is unavailable" detail="Bread could not read the indexed platform activity projection." />;
  }

  const response = query.data;
  const items = response.data;
  return (
    <>
      <FreshnessBanner meta={response.meta} />
      {items.length === 0 ? (
        <EmptyState title="No indexed activity yet" detail="Bread launches, trades, and completed graduations will appear here after they are indexed." />
      ) : (
        <div className="bread-secondary-list" aria-label="Platform activity">
          {items.map((item) => {
            const age = formatIndexedAge(item.blockTimestamp, response.meta.indexedThroughBlockTimestamp);
            const amount = financialMeta(item);
            return (
              <ActivityRow
                href={`/token/${encodeURIComponent(item.tokenAddress)}`}
                key={`${item.transactionHash}:${item.logIndex}:${item.kind}`}
                primary={primaryCopy(item)}
                secondary={item.creatorAddress ? <CreatorAttribution creatorAddress={item.creatorAddress} /> : `Token ${shortAddress(item.tokenAddress)}`}
                meta={<span>{amount ? `${amount} · ` : ''}{age} · block {item.blockNumber}</span>}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
