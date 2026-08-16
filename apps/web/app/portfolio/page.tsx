'use client';

import { useQuery } from '@tanstack/react-query';
import { Button, CreatorAttribution, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';

import type { IndexedPortfolio, IndexedPortfolioHolding } from '../../../../packages/types/src/index';
import { FreshnessBanner } from '../../components/freshness-banner';
import { PortfolioPosition } from '../../components/portfolio/position';
import { useTradeRuntime } from '../../components/trade/trade-runtime';
import { createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import { indexedWalletValueBaseUnits } from '../../lib/portfolio/value';

type Address = `0x${string}`;

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function holdingName(holding: IndexedPortfolioHolding): string {
  return holding.name ?? holding.symbol ?? `${holding.tokenAddress.slice(0, 6)}…${holding.tokenAddress.slice(-4)}`;
}

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
  const recentActivity = portfolio.holdings
    .filter((holding) => holding.activity.lastEvent !== null)
    .slice(0, 5);

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
          <span>24h change</span>
          <strong>—</strong>
        </div>
        <div>
          <span>Positions</span>
          <strong>{portfolio.holdings.length}</strong>
        </div>
      </section>

      <section className="bread-portfolio-holdings" aria-labelledby="bread-portfolio-holdings-heading">
        <div className="bread-portfolio-section-heading">
          <h2 id="bread-portfolio-holdings-heading">Holdings</h2>
          <p>Current values use only indexed execution prices. Cost basis and PnL stay hidden until complete history is available.</p>
        </div>
        {portfolio.holdings.length === 0 ? (
          <EmptyState title="No holdings yet" detail="Tokens held by this wallet will appear here after the indexer confirms them." />
        ) : (
          <table className="bread-portfolio-list" aria-label="Wallet holdings">
            <thead>
              <tr className="bread-portfolio-header">
                <th scope="col">Token</th>
                <th scope="col">Amount held</th>
                <th scope="col">Current value</th>
                <th scope="col">Trade</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.holdings.map((holding) => (
                <PortfolioPosition key={holding.tokenAddress} holding={holding} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bread-portfolio-activity" aria-labelledby="bread-portfolio-activity-heading">
        <div className="bread-portfolio-section-heading">
          <h2 id="bread-portfolio-activity-heading">Recent wallet activity</h2>
          <p>Latest indexed event per current Bread position.</p>
        </div>
        {recentActivity.length === 0 ? (
          <p className="bread-muted">No indexed wallet activity yet.</p>
        ) : (
          <ul>
            {recentActivity.map((holding) => {
              const event = holding.activity.lastEvent!;
              return (
                <li key={`${holding.tokenAddress}:${event.transactionHash}:${event.logIndex}`}>
                  <div>
                    <Link href={`/token/${holding.tokenAddress}`}><strong>{holdingName(holding)}</strong></Link>
                    <CreatorAttribution creatorAddress={holding.creatorAddress} />
                  </div>
                  <code title={event.transactionHash}>{shortHash(event.transactionHash)}</code>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
