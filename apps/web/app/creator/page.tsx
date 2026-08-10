'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';

import type { IndexedCreatorOverview } from '../../../../packages/types/src/index';
import { Button, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import { ClaimPanel } from '../../components/creator/claim-panel';
import { FreshnessBanner } from '../../components/freshness-banner';
import { useTradeRuntime } from '../../components/trade/trade-runtime';
import { createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import { readClaimReview, type ClaimReview } from '../../lib/transactions/claim-controller';

type Address = `0x${string}`;

export default function CreatorPage() {
  const runtime = useTradeRuntime();
  const api = useMemo(() => createBreadApiClient(), []);
  const [account, setAccount] = useState<Address | null>(null);
  const [claimReview, setClaimReview] = useState<ClaimReview | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setClaimReview(null);
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
    queryKey: account ? breadQueryKeys.creator(account) : ['bread', 'creator', 'disconnected'],
    queryFn: () => api.getCreator<IndexedCreatorOverview>(account as Address),
    enabled: account !== null && runtime?.connectionStatus === 'READY',
  });

  if (!runtime || runtime.connectionStatus === 'DISCONNECTED') {
    return (
      <main className="bread-page bread-creator-page">
        <EmptyState
          title="Connect your wallet"
          detail="Connect the creator wallet to load its indexed launches and revenue."
          action={<Button onClick={() => void runtime?.connectWallet()}>Connect wallet</Button>}
        />
      </main>
    );
  }

  if (runtime.connectionStatus === 'WRONG_NETWORK') {
    return (
      <main className="bread-page bread-creator-page">
        <EmptyState
          title="Switch to Arc"
          detail="Switch the connected wallet to Arc before reviewing creator claims."
          action={<Button onClick={() => void runtime.switchToTargetChain()}>Switch to Arc</Button>}
        />
      </main>
    );
  }

  if (!account || query.isPending) {
    return <main className="bread-page bread-creator-page"><Skeleton label="Loading creator dashboard" /></main>;
  }

  if (query.isError) {
    return (
      <main className="bread-page bread-creator-page">
        <ErrorState title="Creator dashboard unavailable" detail="Bread could not load this wallet's indexed creator data right now." />
      </main>
    );
  }

  const creator = query.data.data;

  async function reviewClaim() {
    if (!runtime?.protocolContext || !account) {
      setClaimError('The canonical FeeEscrow deployment is unavailable in the current network manifest.');
      return;
    }
    setClaimBusy(true);
    setClaimError(null);
    try {
      setClaimReview(await readClaimReview(runtime.client, runtime.protocolContext, account));
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : 'Claim review failed.');
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <main className="bread-page bread-creator-page">
      <FreshnessBanner meta={query.data.meta} />
      <header>
        <p className="bread-eyebrow">Creator dashboard</p>
        <h1>Creator revenue</h1>
        <p className="bread-muted">{creator.address}</p>
      </header>

      <section aria-label="Creator summary">
        <div>
          <span>Total earned</span>
          <strong>{formatUnits(BigInt(creator.fees.credited), 6)} USDC</strong>
        </div>
        <div>
          <span>Indexed claimable</span>
          <strong>{formatUnits(BigInt(creator.fees.indexedClaimable), 6)} USDC</strong>
        </div>
        <div>
          <span>Active launches</span>
          <strong>—</strong>
        </div>
        <div>
          <span>Locked buyback tokens</span>
          <strong>—</strong>
        </div>
      </section>

      <ClaimPanel
        recipient={account}
        indexedClaimable={creator.fees.indexedClaimable}
        review={claimReview}
        busy={claimBusy}
        error={claimError}
        onReview={() => void reviewClaim()}
      />

      <section aria-label="Created launches">
        <h2>Created launches</h2>
        {creator.createdLaunches.length === 0 ? (
          <p className="bread-muted">No indexed launches for this creator wallet.</p>
        ) : (
          <ul>
            {creator.createdLaunches.map((launch) => {
              const earned = creator.perLaunchEarnedRevenue.find((row) => row.tokenAddress === launch.tokenAddress);
              return (
                <li key={launch.tokenAddress}>
                  <Link href={`/token/${launch.tokenAddress}`}>{launch.tokenAddress}</Link>
                  <span>{earned ? `${formatUnits(BigInt(earned.credited), 6)} USDC earned` : 'Revenue —'}</span>
                  <span>Market cap —</span>
                  <span>State —</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
