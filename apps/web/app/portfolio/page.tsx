'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import type { IndexedPortfolio } from '../../../../packages/types/src/index';
import { Button, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import { PortfolioPosition } from '../../components/portfolio/position';
import { FreshnessBanner } from '../../components/freshness-banner';
import { useTradeRuntime } from '../../components/trade/trade-runtime';
import { createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';

type Address = `0x${string}`;

export default function PortfolioPage() {
  const runtime = useTradeRuntime();
  const api = useMemo(() => createBreadApiClient(), []);
  const [account, setAccount] = useState<Address | null>(null);

  useEffect(() => {
    let active = true;
    if (runtime?.connectionStatus !== 'READY' || !runtime.wallet) {
      setAccount(null);
      return () => { active = false; };
    }
    void runtime.wallet.getAccount().then((next) => {
      if (active) setAccount(next);
    });
    return () => { active = false; };
  }, [runtime?.connectionStatus, runtime?.wallet]);

  const query = useQuery({
    queryKey: account ? breadQueryKeys.portfolio(account, { limit: 25 }) : ['bread', 'portfolio', 'disconnected'],
    queryFn: () => api.getPortfolio<IndexedPortfolio>(account as Address, { limit: 25 }),
    enabled: account !== null && runtime?.connectionStatus === 'READY',
  });

  if (!runtime || runtime.connectionStatus === 'DISCONNECTED') {
    return (
      <main className="bread-page bread-portfolio-page">
        <EmptyState
          title="Connect your wallet"
          detail="Bread needs your connected wallet address to load its indexed holdings and activity."
          action={<Button onClick={() => void runtime?.connectWallet()}>Connect wallet</Button>}
        />
      </main>
    );
  }

  if (runtime.connectionStatus === 'WRONG_NETWORK') {
    return (
      <main className="bread-page bread-portfolio-page">
        <EmptyState
          title="Switch to Arc"
          detail="Your wallet can stay connected. Switch networks to load this Bread portfolio."
          action={<Button onClick={() => void runtime.switchToTargetChain()}>Switch to Arc</Button>}
        />
      </main>
    );
  }

  if (!account || query.isPending) {
    return <main className="bread-page bread-portfolio-page"><Skeleton label="Loading wallet portfolio" /></main>;
  }

  if (query.isError) {
    return (
      <main className="bread-page bread-portfolio-page">
        <ErrorState title="Portfolio unavailable" detail="Bread could not load the indexed holdings for this wallet right now." />
      </main>
    );
  }

  const portfolio = query.data.data;

  return (
    <main className="bread-page bread-portfolio-page">
      <FreshnessBanner meta={query.data.meta} />
      <header>
        <p className="bread-eyebrow">Portfolio</p>
        <h1>Your Bread holdings</h1>
        <p className="bread-muted">{portfolio.walletAddress}</p>
      </header>

      {portfolio.holdings.length === 0 ? (
        <EmptyState title="No holdings yet" detail="Tokens held by this wallet will appear here after the indexer confirms them." />
      ) : (
        <section aria-label="Wallet holdings">
          {portfolio.holdings.map((holding) => (
            <PortfolioPosition key={holding.tokenAddress} holding={holding} />
          ))}
        </section>
      )}
    </main>
  );
}
