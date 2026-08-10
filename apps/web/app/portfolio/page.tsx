'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';

import type { IndexedPortfolio } from '../../../../packages/types/src/index';
import { Button, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import { PortfolioPosition } from '../../components/portfolio/position';
import { FreshnessBanner } from '../../components/freshness-banner';
import { useTradeRuntime } from '../../components/trade/trade-runtime';
import { createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import { indexedWalletValueBaseUnits } from '../../lib/portfolio/value';

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
        <div className="bread-wallet-action-state">
          <EmptyState
            title="Connect your wallet"
            detail="Bread needs your connected wallet address to load its indexed holdings and activity."
          />
          <Button disabled={!runtime} onClick={() => void runtime?.connectWallet()}>Connect wallet</Button>
        </div>
      </main>
    );
  }

  if (runtime.connectionStatus === 'WRONG_NETWORK') {
    return (
      <main className="bread-page bread-portfolio-page">
        <div className="bread-wallet-action-state">
          <EmptyState
            title="Switch to Arc"
            detail="Your wallet can stay connected. Switch networks to load this Bread portfolio."
          />
          <Button onClick={() => void runtime.switchToTargetChain()}>Switch to Arc</Button>
        </div>
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
  const walletValue = indexedWalletValueBaseUnits(portfolio.holdings);

  return (
    <main className="bread-page bread-portfolio-page">
      <FreshnessBanner meta={query.data.meta} />
      <header>
        <p className="bread-eyebrow">Portfolio</p>
        <h1>Your Bread holdings</h1>
        <p className="bread-muted">{portfolio.walletAddress}</p>
      </header>

      <section className="bread-portfolio-summary" aria-label="Portfolio summary">
        <div>
          <span>Wallet value</span>
          <strong>{walletValue === null ? '—' : `${formatUnits(walletValue, 6)} USDC`}</strong>
        </div>
        <div>
          <span>Indexed holdings</span>
          <strong>{portfolio.holdings.length}</strong>
        </div>
      </section>

      {portfolio.holdings.length === 0 ? (
        <EmptyState title="No holdings yet" detail="Tokens held by this wallet will appear here after the indexer confirms them." />
      ) : (
        <table className="bread-portfolio-list" aria-label="Wallet holdings">
          <thead>
            <tr className="bread-portfolio-header">
              <th scope="col">Token</th>
              <th scope="col">Balance</th>
              <th scope="col">Current value</th>
              <th scope="col">Movement</th>
              <th scope="col">Activity</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.holdings.map((holding) => (
              <PortfolioPosition key={holding.tokenAddress} holding={holding} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
