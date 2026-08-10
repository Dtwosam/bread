'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { ErrorState, Skeleton } from '@bread/ui';
import { BreadApiRequestError, createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import { FreshnessBanner } from '../freshness-banner';
import { TradeExperience } from '../trade/trade-experience';
import { GraduationModule } from './graduation-module';
import { TokenIdentity } from './token-identity';
import { TokenStats } from './token-stats';

const TokenChart = dynamic(() => import('./token-chart').then((module) => module.TokenChart), {
  loading: () => <Skeleton label="Loading price context" />,
});
const TokenTabs = dynamic(() => import('./token-tabs').then((module) => module.TokenTabs), {
  loading: () => <Skeleton label="Loading token activity" />,
});

const EXACT_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function TokenClient({ address }: Readonly<{ address: string }>) {
  const api = useMemo(() => createBreadApiClient(), []);
  const validAddress = EXACT_ADDRESS.test(address);
  const query = useQuery({
    queryKey: breadQueryKeys.token(address),
    queryFn: () => api.getToken<IndexedTokenDetail>(address),
    enabled: validAddress,
  });

  if (!validAddress) {
    return (
      <main className="bread-page">
        <ErrorState
          title="Invalid token address"
          detail="Bread token routes require one complete 20-byte EVM contract address."
        />
      </main>
    );
  }

  if (query.isPending) {
    return (
      <main className="bread-page bread-token-page" aria-label="Loading token">
        <div className="bread-token-loading">
          <Skeleton label="Loading token identity" />
          <Skeleton label="Loading token market state" />
          <Skeleton label="Loading token context" />
        </div>
      </main>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof BreadApiRequestError && error.code === 'TOKEN_NOT_FOUND') {
      return (
        <main className="bread-page">
          <ErrorState
            title="Not a Bread launch"
            detail="This is a valid-looking contract address, but it is not present in Bread's indexed launch registry."
          />
        </main>
      );
    }

    return (
      <main className="bread-page">
        <ErrorState
          title="Token data unavailable"
          detail="The indexed Bread read service could not load this token right now."
        />
      </main>
    );
  }

  const token = query.data.data;

  return (
    <main className="bread-page bread-token-page">
      <FreshnessBanner meta={query.data.meta} />
      <TokenIdentity token={token} />
      <TokenStats token={token} />

      <div className="bread-token-layout">
        <div className="bread-token-context">
          <TokenChart price={token.metrics?.lastPrice ?? null} />
          <GraduationModule token={token} />
          <TokenTabs token={token} />
        </div>
        <TradeExperience token={token} />
      </div>
    </main>
  );
}
