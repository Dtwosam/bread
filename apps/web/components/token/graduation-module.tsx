'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

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

function displayState(token: IndexedTokenDetail): 'Active' | 'Processing' | 'Pending' | 'Graduated' {
  if (token.curveState?.positionLocked === true) return 'Graduated';
  if (token.curveState?.graduationFailureReasonHash) return 'Pending';
  const graduationPhase = token.curveState?.graduationPhase;
  if (
    token.curveState?.readyToGraduate ||
    (graduationPhase !== null && graduationPhase !== undefined && graduationPhase !== 'NOT_GRADUATED')
  ) {
    return 'Processing';
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
  if (token.curveState?.graduationPhase === 'SWEPT') {
    return 'The curve sweep is complete. The next permissionless step can create and permanently lock the canonical liquidity position.';
  }
  return 'The curve is complete. Graduation can be advanced permissionlessly from fresh onchain coordinator state.';
}

export function GraduationModule({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const queryClient = useQueryClient();
  const runtime = useTradeRuntime();
  const progressBps = token.progress?.progressBps ?? null;
  const percent = progressPercent(progressBps);
  const graduationPhase = token.curveState?.graduationPhase ?? null;
  const poolId = token.curveState?.poolId ?? null;
  const positionLocked = token.curveState?.positionLocked ?? null;
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

  const recoveryLabel = runtime?.connectionStatus === 'DISCONNECTED'
    ? 'Connect wallet to retry'
    : runtime?.connectionStatus === 'WRONG_NETWORK'
      ? 'Switch to Arc'
      : graduationPhase === 'SWEPT'
        ? 'Continue graduation'
        : 'Retry graduation';

  return (
    <section className="bread-graduation" aria-labelledby="bread-graduation-heading">
      <div className="bread-token-section-heading">
        <div>
          <h2 id="bread-graduation-heading">Graduation</h2>
          <p>
            {displayState(token)} · Indexed state {token.progress?.state ?? graduationPhase ?? '—'}
          </p>
        </div>
        <strong>{progressBps === null ? '—' : `${progressBps} bps`}</strong>
      </div>

      <div className="bread-progress-track" aria-hidden="true">
        <span className="bread-progress-value" style={{ width: percent === null ? '0%' : `${percent}%` }} />
      </div>

      <dl className="bread-graduation__facts">
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
        Graduation and lock labels reflect indexed protocol events. Retry preparation re-reads authoritative onchain coordinator state before the wallet opens. Status labels are evidence, not a protocol security assessment.
      </p>
    </section>
  );
}
