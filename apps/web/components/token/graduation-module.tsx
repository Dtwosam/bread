'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import arcTestnetManifest from '../../../../config/networks/arc-testnet.json';
import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { Button } from '@bread/ui';
import { breadQueryKeys } from '../../lib/api/queries';
import {
  executeGraduationRetryLifecycle,
  recoverGraduationRetryTransactions,
} from '../../lib/transactions/graduation-controller';
import {
  createGraduationTransactionState,
  type TransactionState,
} from '../../lib/transactions/state';
import { TransactionStatus } from '../transaction-status';
import { useTradeRuntime } from '../trade/trade-runtime';
import { formatUsdcBaseUnits } from '../explore/model';

type Address = `0x${string}`;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function progressPercent(progressBps: string | null | undefined): number | null {
  if (!progressBps || !/^\d+$/.test(progressBps)) return null;
  const bps = Number(progressBps);
  if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) return null;
  return bps / 100;
}

function remainingQuote(
  realQuoteReserve: string | null | undefined,
  graduationThreshold: string | null | undefined,
): string | null {
  if (!realQuoteReserve || !graduationThreshold) return null;
  if (!/^\d+$/.test(realQuoteReserve) || !/^\d+$/.test(graduationThreshold)) return null;
  const reserve = BigInt(realQuoteReserve);
  const target = BigInt(graduationThreshold);
  return (target > reserve ? target - reserve : BigInt(0)).toString(10);
}

function graduatedVenueLabel(kind: string | null | undefined): string {
  if (kind === 'UNISWAP_V3') return 'Uniswap V3';
  return kind ?? '—';
}

function displayState(token: IndexedTokenDetail): 'Active' | 'Graduating' | 'Graduation pending' | 'Graduated' {
  if (token.curveState?.positionLocked === true) return 'Graduated';
  if (token.curveState?.graduationFailureReasonHash) return 'Graduation pending';
  const graduationPhase = token.curveState?.graduationPhase;
  if (
    token.curveState?.readyToGraduate ||
    (graduationPhase !== null && graduationPhase !== undefined && graduationPhase !== 'NOT_GRADUATED')
  ) {
    return 'Graduating';
  }
  return 'Active';
}

function recoveryEligible(token: IndexedTokenDetail): boolean {
  if (token.curveState?.positionLocked === true) return false;
  const phase = token.curveState?.graduationPhase ?? null;
  return Boolean(token.curveState?.graduationFailureReasonHash)
    || token.curveState?.readyToGraduate === true
    || phase === 'SWEPT';
}

function recoveryCopy(token: IndexedTokenDetail): string {
  if (token.curveState?.graduationFailureReasonHash) {
    return 'Your completed trade remains confirmed. Automatic graduation did not complete. The next permissionless graduation step can be retried from fresh onchain coordinator state.';
  }
  return 'The bonding curve is complete. Liquidity creation is in progress. Completed trades remain confirmed. The next permissionless graduation step re-reads fresh onchain coordinator state before the wallet opens.';
}

export function GraduationModule({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const queryClient = useQueryClient();
  const runtime = useTradeRuntime();
  const progressBps = token.progress?.progressBps ?? null;
  const percent = progressPercent(progressBps);
  const state = displayState(token);
  const graduationPhase = token.curveState?.graduationPhase ?? null;
  const poolId = token.curveState?.poolId ?? null;
  const positionLocked = token.curveState?.positionLocked ?? null;
  const positionManager = token.curveState?.positionManager ?? null;
  const positionManagerAddress = positionManager && ADDRESS.test(positionManager)
    ? positionManager as Address
    : null;
  const positionManagerHref = positionManagerAddress
    ? `${arcTestnetManifest.explorer}/address/${positionManagerAddress}`
    : null;
  const accumulatedQuote = token.curveState?.realQuoteReserve ?? null;
  const remainingQuoteAmount = remainingQuote(accumulatedQuote, token.graduationThreshold);
  const tokenAddress = ADDRESS.test(token.tokenAddress) ? token.tokenAddress as Address : null;
  const eligible = tokenAddress !== null && recoveryEligible(token);
  const initialToken = tokenAddress ?? ('0x0000000000000000000000000000000000000000' as Address);
  const [transactionState, setTransactionState] = useState<TransactionState>(
    createGraduationTransactionState(initialToken),
  );
  const recoveryStartedFor = useRef<string | null>(null);
  const busy = new Set(['VALIDATING', 'PREPARING', 'AWAITING_SIGNATURE', 'SUBMITTED', 'CONFIRMING', 'REPLACED', 'UNKNOWN'])
    .has(transactionState.status);

  useEffect(() => {
    if (!tokenAddress || !runtime?.storage || !runtime.client) return;
    if (recoveryStartedFor.current === tokenAddress.toLowerCase()) return;
    recoveryStartedFor.current = tokenAddress.toLowerCase();

    void recoverGraduationRetryTransactions({
      client: runtime.client,
      storage: runtime.storage,
      chainId: runtime.context.chainId,
      tokenAddress,
      onStateChange: setTransactionState,
      onConfirmed: async () => {
        await queryClient.invalidateQueries({ queryKey: breadQueryKeys.token(tokenAddress) });
      },
    });
  }, [queryClient, runtime, tokenAddress]);

  async function handleRecovery(): Promise<void> {
    if (!runtime || !tokenAddress) return;
    if (runtime.connectionStatus === 'DISCONNECTED') {
      try {
        await runtime.connectWallet();
      } catch (error) {
        setTransactionState({
          action: 'GRADUATION',
          tokenAddress,
          status: 'REJECTED',
          error: error instanceof Error ? error.message : 'Wallet connection failed.',
        });
      }
      return;
    }
    if (runtime.connectionStatus === 'WRONG_NETWORK') {
      try {
        await runtime.switchToTargetChain();
      } catch (error) {
        setTransactionState({
          action: 'GRADUATION',
          tokenAddress,
          status: 'REJECTED',
          error: error instanceof Error ? error.message : 'Network switch failed.',
        });
      }
      return;
    }
    if (!runtime.wallet || !runtime.protocolContext) {
      setTransactionState({
        action: 'GRADUATION',
        tokenAddress,
        status: 'REJECTED',
        error: 'Graduation retry requires the verified Arc wallet runtime.',
      });
      return;
    }

    const result = await executeGraduationRetryLifecycle({
      client: runtime.client,
      wallet: runtime.wallet,
      storage: runtime.storage,
      context: runtime.protocolContext,
      tokenAddress,
      onStateChange: setTransactionState,
      onConfirmed: async () => {
        await queryClient.invalidateQueries({ queryKey: breadQueryKeys.token(tokenAddress) });
      },
    });
    if (result.review?.kind === 'TERMINAL') {
      await queryClient.invalidateQueries({ queryKey: breadQueryKeys.token(tokenAddress) });
    }
  }

  const recoveryLabel = state === 'Graduating'
    ? 'Continue graduation'
    : runtime?.connectionStatus === 'DISCONNECTED'
      ? 'Connect wallet to retry'
      : runtime?.connectionStatus === 'WRONG_NETWORK'
        ? 'Switch to Arc'
        : 'Retry graduation';

  return (
    <section className="bread-graduation" aria-labelledby="bread-graduation-heading">
      <div className="bread-token-section-heading">
        <div>
          <h2 id="bread-graduation-heading">Graduation</h2>
          <p>
            {state} · Indexed state {token.progress?.state ?? graduationPhase ?? '—'}
          </p>
        </div>
        <strong>
          {state === 'Graduated'
            ? graduatedVenueLabel(token.graduatedVenueKind)
            : state === 'Active' && percent !== null
              ? `${percent.toFixed(1)}% baked`
              : progressBps === null
                ? '—'
                : `${progressBps} bps`}
        </strong>
      </div>

      <div className="bread-progress-track" aria-hidden="true">
        <span className="bread-progress-value" style={{ width: percent === null ? '0%' : `${percent}%` }} />
      </div>

      <dl className="bread-graduation__facts">
        {state === 'Active' ? (
          <>
            <div>
              <dt>Accumulated</dt>
              <dd>{formatUsdcBaseUnits(accumulatedQuote)}</dd>
            </div>
            <div>
              <dt>Snapshotted target</dt>
              <dd>{formatUsdcBaseUnits(token.graduationThreshold)}</dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd>{formatUsdcBaseUnits(remainingQuoteAmount)}</dd>
            </div>
          </>
        ) : state === 'Graduated' ? (
          <>
            <div>
              <dt>Venue</dt>
              <dd>{graduatedVenueLabel(token.graduatedVenueKind)}</dd>
            </div>
            <div>
              <dt>Liquidity USDC</dt>
              <dd>{formatUsdcBaseUnits(token.curveState?.usdcUsed ?? null)}</dd>
            </div>
            <div>
              <dt>Pool ID</dt>
              <dd>{poolId ?? '—'}</dd>
            </div>
            <div>
              <dt>Position manager</dt>
              <dd>
                {positionManagerHref && positionManagerAddress ? (
                  <a
                    href={positionManagerHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open position manager in Arcscan"
                  >
                    {positionManagerAddress}
                  </a>
                ) : positionManager ?? '—'}
              </dd>
            </div>
            <div>
              <dt>Adapter</dt>
              <dd>{token.curveState?.graduationAdapter ?? token.graduationAdapter ?? '—'}</dd>
            </div>
            <div>
              <dt>Permanent lock</dt>
              <dd>{positionLocked === true ? 'Indexed locked' : 'Not yet indexed locked'}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Tracked quote</dt>
              <dd>{formatUsdcBaseUnits(token.curveState?.trackedQuote ?? null)}</dd>
            </div>
            <div>
              <dt>Snapshotted target</dt>
              <dd>{formatUsdcBaseUnits(token.graduationThreshold)}</dd>
            </div>
            <div>
              <dt>Phase</dt>
              <dd>{graduationPhase ?? '—'}</dd>
            </div>
            <div>
              <dt>Adapter</dt>
              <dd>{token.curveState?.graduationAdapter ?? token.graduationAdapter ?? '—'}</dd>
            </div>
            <div>
              <dt>Pool</dt>
              <dd>{poolId ?? '—'}</dd>
            </div>
            <div>
              <dt>Permanent-lock evidence</dt>
              <dd>{positionLocked === null ? '—' : positionLocked ? 'Indexed locked' : 'Not yet indexed locked'}</dd>
            </div>
          </>
        )}
      </dl>

      {eligible ? (
        <div className="bread-graduation__recovery">
          <p className="bread-token-note">{recoveryCopy(token)}</p>
          <Button
            disabled={busy}
            ariaLabel={recoveryLabel}
            onClick={() => { void handleRecovery(); }}
          >
            {recoveryLabel}
          </Button>
          {transactionState.status === 'IDLE' ? null : <TransactionStatus state={transactionState} />}
        </div>
      ) : null}

      <p className="bread-token-note">
        {state === 'Graduated'
          ? 'Venue, pool and permanent-lock status reflect indexed protocol evidence. Permanent lock is not a safety guarantee or protocol security assessment.'
          : 'Graduation and lock labels reflect indexed protocol events. Retry preparation re-reads authoritative onchain coordinator state before the wallet opens. Status labels are evidence, not a protocol security assessment.'}
      </p>
    </section>
  );
}
