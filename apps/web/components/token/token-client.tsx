'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { Button, Card, ErrorState, Skeleton } from '@bread/ui';
import { BreadApiRequestError, createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import { FreshnessBanner } from '../freshness-banner';
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
  const [tabletTradeOpen, setTabletTradeOpen] = useState(false);
  const validAddress = EXACT_ADDRESS.test(address);
  const query = useQuery({
    queryKey: breadQueryKeys.token(address),
    queryFn: () => api.getToken<IndexedTokenDetail>(address),
    enabled: validAddress,
  });

  useEffect(() => {
    if (!tabletTradeOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTabletTradeOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tabletTradeOpen]);

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

        <aside className="bread-token-trade-slot" aria-label="Trade preparation">
          <Card>
            <div className="bread-token-trade-slot__content">
              <div>
                <h2>Trade</h2>
                <p>Wallet transaction controls are owned by the next Day-7 lane.</p>
              </div>
              <Button variant="buy" disabled ariaLabel="Buy unavailable until trade integration">
                Buy
              </Button>
              <Button variant="sell" disabled ariaLabel="Sell unavailable until trade integration">
                Sell
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      <div className="bread-token-tablet-trade-trigger">
        <Button variant="secondary" onClick={() => setTabletTradeOpen(true)} ariaLabel="Open trade preparation">
          Trade
        </Button>
      </div>

      {tabletTradeOpen ? (
        <div className="bread-token-tablet-trade-backdrop" onMouseDown={() => setTabletTradeOpen(false)}>
          <section
            className="bread-token-tablet-trade-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bread-token-tablet-trade-heading"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="bread-token-tablet-trade-sheet__heading">
              <div>
                <h2 id="bread-token-tablet-trade-heading">Trade</h2>
                <p>Wallet transaction controls are owned by the next Day-7 lane.</p>
              </div>
              <Button variant="small" onClick={() => setTabletTradeOpen(false)} ariaLabel="Close trade preparation">
                Close
              </Button>
            </div>
            <Button variant="buy" disabled ariaLabel="Buy unavailable until trade integration">
              Buy
            </Button>
            <Button variant="sell" disabled ariaLabel="Sell unavailable until trade integration">
              Sell
            </Button>
          </section>
        </div>
      ) : null}

      <div className="bread-token-mobile-actions" aria-label="Token trade actions">
        <Button variant="buy" disabled ariaLabel="Buy unavailable until trade integration">
          Buy
        </Button>
        <Button variant="sell" disabled ariaLabel="Sell unavailable until trade integration">
          Sell
        </Button>
      </div>
    </main>
  );
}
