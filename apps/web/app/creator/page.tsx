'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, CreatorAttribution, EmptyState, ErrorState, Skeleton } from '@bread/ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits } from 'viem';

import type { IndexedCreatorLaunch, IndexedCreatorOverview } from '../../../../packages/types/src/index';
import { ClaimPanel } from '../../components/creator/claim-panel';
import { FreshnessBanner } from '../../components/freshness-banner';
import { TransactionStatus } from '../../components/transaction-status';
import { useTradeRuntime } from '../../components/trade/trade-runtime';
import { createBreadApiClient } from '../../lib/api/client';
import { breadQueryKeys } from '../../lib/api/queries';
import {
  executeClaimLifecycle,
  readClaimReview,
  recoverClaimTransactions,
  type ClaimReview,
} from '../../lib/transactions/claim-controller';
import { canSubmitTransactionAction, type TransactionState } from '../../lib/transactions/state';

type Address = `0x${string}`;

function launchName(launch: IndexedCreatorLaunch): string {
  return launch.name ?? launch.symbol ?? `${launch.tokenAddress.slice(0, 6)}…${launch.tokenAddress.slice(-4)}`;
}

function launchTicker(launch: IndexedCreatorLaunch): string {
  return launch.symbol ? `$${launch.symbol}` : launch.tokenAddress;
}

function marketCap(launch: IndexedCreatorLaunch): string {
  return launch.marketCap === null ? '—' : `${formatUnits(BigInt(launch.marketCap), 6)} USDC`;
}

function activeLaunchCount(launches: readonly IndexedCreatorLaunch[]): number | null {
  if (launches.some((launch) => launch.lifecycleState === null)) return null;
  return launches.filter((launch) => {
    const state = launch.lifecycleState?.toUpperCase();
    return state !== 'GRADUATED' && state !== 'POOL_CREATED';
  }).length;
}

export default function CreatorPage() {
  const runtime = useTradeRuntime();
  const api = useMemo(() => createBreadApiClient(), []);
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<Address | null>(null);
  const [claimReview, setClaimReview] = useState<ClaimReview | null>(null);
  const [claimState, setClaimState] = useState<TransactionState | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const recoveryKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setClaimReview(null);
    setClaimState(null);
    recoveryKey.current = null;
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

  useEffect(() => {
    if (
      !runtime ||
      runtime.connectionStatus !== 'READY' ||
      !runtime.protocolContext ||
      !runtime.storage ||
      !account
    ) return;

    const key = `${runtime.protocolContext.chainId}:${account.toLowerCase()}`;
    if (recoveryKey.current === key) return;
    recoveryKey.current = key;
    let active = true;

    void recoverClaimTransactions({
      client: runtime.client,
      storage: runtime.storage,
      chainId: runtime.protocolContext.chainId,
      recipient: account,
      onStateChange: (state) => {
        if (active) setClaimState(state);
      },
      onConfirmed: async () => {
        if (!active) return;
        setClaimReview(null);
        await queryClient.invalidateQueries({ queryKey: breadQueryKeys.creator(account) });
      },
    }).catch((error) => {
      if (!active) return;
      recoveryKey.current = null;
      setClaimError(error instanceof Error ? error.message : 'Claim recovery failed.');
    });

    return () => { active = false; };
  }, [account, queryClient, runtime]);

  if (!runtime || runtime.connectionStatus === 'DISCONNECTED') {
    return (
      <main className="bread-page bread-creator-page">
        <div className="bread-wallet-action-state">
          <EmptyState
            title="Connect your wallet"
            detail="Connect the creator wallet to load its indexed launches and revenue."
          />
          <Button disabled={!runtime} onClick={() => void runtime?.connectWallet()}>Connect wallet</Button>
        </div>
      </main>
    );
  }

  if (runtime.connectionStatus === 'WRONG_NETWORK') {
    return (
      <main className="bread-page bread-creator-page">
        <div className="bread-wallet-action-state">
          <EmptyState
            title="Switch to Arc"
            detail="Switch the connected wallet to Arc before reviewing creator claims."
          />
          <Button onClick={() => void runtime.switchToTargetChain()}>Switch to Arc</Button>
        </div>
      </main>
    );
  }

  const readyRuntime = runtime;

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
  const claimUnlocked = claimState === null || canSubmitTransactionAction(claimState);
  const activeLaunches = activeLaunchCount(creator.createdLaunches);

  async function reviewClaim() {
    if (!readyRuntime.protocolContext || !account) {
      setClaimError('The canonical FeeEscrow deployment is unavailable in the current network manifest.');
      return;
    }
    if (!claimUnlocked) {
      setClaimError('The previous claim is still unresolved. Bread will not prepare a duplicate claim.');
      return;
    }
    setClaimBusy(true);
    setClaimError(null);
    try {
      setClaimReview(await readClaimReview(readyRuntime.client, readyRuntime.protocolContext, account));
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : 'Claim review failed.');
    } finally {
      setClaimBusy(false);
    }
  }

  async function claimUsdc() {
    if (!readyRuntime.protocolContext || !readyRuntime.storage || !readyRuntime.wallet || !account || !claimReview) {
      setClaimError('Review the current onchain claim before signing.');
      return;
    }
    if (!claimUnlocked) {
      setClaimError('The previous claim is still unresolved. Bread will not submit a duplicate claim.');
      return;
    }

    setClaimBusy(true);
    setClaimError(null);
    try {
      const result = await executeClaimLifecycle({
        client: readyRuntime.client,
        wallet: readyRuntime.wallet,
        storage: readyRuntime.storage,
        context: readyRuntime.protocolContext,
        approved: claimReview,
        onStateChange: setClaimState,
        onConfirmed: async () => {
          await queryClient.invalidateQueries({ queryKey: breadQueryKeys.creator(account) });
        },
      });
      setClaimState(result.state);
      if (result.reviewChanged) {
        setClaimReview(result.review);
        setClaimError('Claimable USDC changed onchain. Review the updated amount before signing.');
      } else if (result.state.status === 'CONFIRMED') {
        setClaimReview(null);
      } else {
        setClaimReview(result.review);
      }
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : 'Claim request failed.');
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

      <section className="bread-creator-summary" aria-label="Creator summary">
        <div>
          <span>Total earned</span>
          <strong>{formatUnits(BigInt(creator.fees.credited), 6)} USDC</strong>
        </div>
        <div>
          <span>Claimable USDC</span>
          <strong>{formatUnits(BigInt(creator.fees.indexedClaimable), 6)} USDC</strong>
          <small>Indexed; the claim review rereads FeeEscrow onchain.</small>
        </div>
        <div>
          <span>Active launches</span>
          <strong>{activeLaunches ?? '—'}</strong>
        </div>
      </section>

      <ClaimPanel
        recipient={account}
        indexedClaimable={creator.fees.indexedClaimable}
        review={claimReview}
        busy={claimBusy}
        locked={!claimUnlocked}
        error={claimError}
        onReview={() => void reviewClaim()}
        onClaim={() => void claimUsdc()}
      />

      {claimState ? <TransactionStatus state={claimState} /> : null}

      <section className="bread-creator-launches" aria-labelledby="bread-creator-launches-heading">
        <div className="bread-portfolio-section-heading">
          <h2 id="bread-creator-launches-heading">Created launches</h2>
          <p>Revenue is indexed per launch. Claims remain recipient-level because FeeEscrow does not assign withdrawals back to individual launches.</p>
        </div>
        {creator.createdLaunches.length === 0 ? (
          <p className="bread-muted">No indexed launches for this creator wallet.</p>
        ) : (
          <ul className="bread-creator-launch-list">
            {creator.createdLaunches.map((launch) => {
              const earned = creator.perLaunchEarnedRevenue.find((row) => row.tokenAddress === launch.tokenAddress);
              return (
                <li key={launch.tokenAddress}>
                  <div className="bread-creator-launch-identity">
                    <span className="bread-portfolio-position-token__image" aria-hidden="true">
                      {launchName(launch).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <Link href={`/token/${launch.tokenAddress}`}><strong>{launchName(launch)}</strong></Link>
                      <code>{launchTicker(launch)}</code>
                      <CreatorAttribution creatorAddress={creator.address} isCurrentUser />
                    </div>
                  </div>
                  <span><small>Market cap</small><strong>{marketCap(launch)}</strong></span>
                  <span><small>Lifecycle</small><strong>{launch.lifecycleState ?? '—'}</strong></span>
                  <span><small>Revenue</small><strong>{earned ? `${formatUnits(BigInt(earned.credited), 6)} USDC` : '—'}</strong></span>
                  <span title="FeeEscrow claims are recipient-level, so Bread cannot truthfully attribute claimed amounts to one launch.">
                    <small>Claim status</small><strong>Recipient-level</strong>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
