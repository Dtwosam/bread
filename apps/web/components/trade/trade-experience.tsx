'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '@bread/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';

import {
  readCanonicalTradeReview,
  type CanonicalTradeReview,
} from '../../../../packages/protocol-sdk/src/canonical-trade-review';
import { BREAD_LAUNCH_TOKEN_DECIMALS } from '../../../../packages/protocol-sdk/src/constants';
import type { CanonicalTradeRoute } from '../../../../packages/protocol-sdk/src/trade-route';
import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { breadQueryKeys } from '../../lib/api/queries';
import { executeTradeLifecycle } from '../../lib/transactions/controller';
import {
  canSubmitTransactionAction,
  createTransactionState,
  type TradeAction,
  type TransactionState,
} from '../../lib/transactions/state';
import { TradePanel } from './trade-panel';
import { useTradeRuntime, type TradeConnectionStatus } from './trade-runtime';

type TradeReview = CanonicalTradeReview;
type Preset = '$25' | '$50' | '$100' | '25%' | '50%' | '75%' | 'MAX';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Trade preparation failed.';
}

function processingRouteUnavailableReason(token: IndexedTokenDetail): string | null {
  if (token.curveState?.positionLocked === true) return null;
  if (token.curveState?.graduationFailureReasonHash) return null;
  const graduationPhase = token.curveState?.graduationPhase;
  const graduationInProgress = token.curveState?.readyToGraduate === true
    || (graduationPhase !== null && graduationPhase !== undefined && graduationPhase !== 'NOT_GRADUATED');
  return graduationInProgress
    ? 'Trading is unavailable while graduation completes. The bonding curve is complete and liquidity creation is in progress.'
    : null;
}

export function TradeExperience({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const runtime = useTradeRuntime();
  const queryClient = useQueryClient();
  const tokenAddress = token.tokenAddress as `0x${string}`;
  const curveAddress = token.curveAddress as `0x${string}`;
  const routeUnavailableReason = processingRouteUnavailableReason(token);
  const adoptedRecoveryHash = useRef<`0x${string}` | null>(null);
  const [action, setAction] = useState<TradeAction>('BUY');
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50);
  const [review, setReview] = useState<TradeReview | null>(null);
  const [reviewRoute, setReviewRoute] = useState<CanonicalTradeRoute | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [transactionState, setTransactionState] = useState<TransactionState>(() =>
    createTransactionState('BUY', tokenAddress),
  );
  const recoveredTransactionState = useMemo(
    () =>
      runtime?.recoveredTradeStates.find(
        (state) =>
          (state.action === 'BUY' || state.action === 'SELL') &&
          state.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase(),
      ) ?? null,
    [runtime?.recoveredTradeStates, tokenAddress],
  );

  const transactionBusy = !canSubmitTransactionAction(transactionState);
  const busy = transactionBusy || reviewBusy;
  const connectionStatus: TradeConnectionStatus = runtime?.connectionStatus ?? 'DISCONNECTED';
  const walletReady = runtime !== null && connectionStatus === 'READY' && runtime.wallet !== null;

  useEffect(() => {
    if (!recoveredTransactionState?.hash) return;
    const recoveredHash = recoveredTransactionState.hash;
    const sameRecoveredTransaction =
      transactionState.hash !== undefined && transactionState.hash === recoveredHash;
    const firstAdoptionFromIdle =
      transactionState.status === 'IDLE' && adoptedRecoveryHash.current !== recoveredHash;
    if (!sameRecoveredTransaction && !firstAdoptionFromIdle) return;

    adoptedRecoveryHash.current = recoveredHash;
    setAction(recoveredTransactionState.action as TradeAction);
    setReview(null);
    setReviewRoute(null);
    setReviewError(null);
    setTransactionState(recoveredTransactionState);
  }, [recoveredTransactionState, transactionState.hash, transactionState.status]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setSheetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, sheetOpen]);

  const panelProps = useMemo(
    () => ({
      action,
      amount,
      slippageBps,
      review,
      transactionState,
      connectionStatus,
      busy,
      reviewError,
      routeUnavailableReason,
      onActionChange: changeAction,
      onAmountChange: changeAmount,
      onSlippageChange: changeSlippage,
      onPreset: applyPreset,
      onConnectionAction: handleConnectionAction,
      onReview: reviewTrade,
      onSubmit: submitTrade,
    }),
    // Handler identities are intentionally recreated from the latest state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action, amount, slippageBps, review, reviewRoute, transactionState, connectionStatus, runtime, busy, reviewError, routeUnavailableReason],
  );

  function resetReview(nextAction: TradeAction = action) {
    setReview(null);
    setReviewRoute(null);
    setReviewError(null);
    setTransactionState(createTransactionState(nextAction, tokenAddress));
  }

  function changeAction(nextAction: TradeAction) {
    if (busy || routeUnavailableReason !== null || nextAction === action) return;
    setAction(nextAction);
    setAmount('');
    resetReview(nextAction);
  }

  function changeAmount(nextAmount: string) {
    if (busy || routeUnavailableReason !== null) return;
    if (!/^\d*(?:\.\d*)?$/.test(nextAmount)) return;
    setAmount(nextAmount);
    resetReview();
  }

  function changeSlippage(nextSlippageBps: number) {
    if (busy || routeUnavailableReason !== null) return;
    setSlippageBps(nextSlippageBps);
    resetReview();
  }

  async function handleConnectionAction() {
    if (!runtime || busy || routeUnavailableReason !== null) return;
    setReviewError(null);
    setReviewBusy(true);
    try {
      if (runtime.connectionStatus === 'WRONG_NETWORK') {
        await runtime.switchToTargetChain();
      } else {
        await runtime.connectWallet();
      }
    } catch (error) {
      setReviewError(message(error));
    } finally {
      setReviewBusy(false);
    }
  }

  async function applyPreset(preset: Preset) {
    if (!runtime || !walletReady || busy || routeUnavailableReason !== null) return;
    setReviewError(null);

    if (action === 'BUY' && preset !== 'MAX') {
      setAmount(preset.slice(1));
      resetReview();
      return;
    }

    try {
      const balance = await runtime.getSpendableBalance(action, tokenAddress);
      if (action === 'BUY') {
        setAmount(formatUnits(balance, runtime.context.quoteDecimals));
      } else {
        const percent = preset === 'MAX' ? BigInt(100) : BigInt(Number.parseInt(preset, 10));
        const selected = (balance * percent) / BigInt(100);
        setAmount(formatUnits(selected, BREAD_LAUNCH_TOKEN_DECIMALS));
      }
      resetReview();
    } catch (error) {
      setReviewError(message(error));
    }
  }

  function inputAmount(): bigint {
    if (!runtime) throw new Error('Wallet runtime is not available.');
    if (amount.trim() === '') throw new Error('Enter an amount before reviewing the trade.');
    const decimals = action === 'BUY' ? runtime.context.quoteDecimals : BREAD_LAUNCH_TOKEN_DECIMALS;
    const parsed = parseUnits(amount, decimals);
    if (parsed <= BigInt(0)) throw new Error('Trade amount must be greater than zero.');
    return parsed;
  }

  async function reviewTrade() {
    if (!runtime || !runtime.wallet || !walletReady || busy || routeUnavailableReason !== null) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const protocolContext = runtime.protocolContext;
      if (!protocolContext) throw new Error('Canonical protocol context is not available.');

      const [account, walletChainId] = await Promise.all([
        runtime.wallet.getAccount(),
        runtime.wallet.getChainId(),
      ]);
      if (!account) throw new Error('Connect a wallet before reviewing this trade.');
      if (walletChainId !== protocolContext.chainId) {
        throw new Error(`Wrong network: wallet is on chain ${walletChainId}, expected ${protocolContext.chainId}.`);
      }

      const result = await readCanonicalTradeReview(runtime.client, protocolContext, {
        token: tokenAddress,
        action,
        inputAmount: inputAmount(),
        slippageBps,
      });
      setReview(result.review);
      setReviewRoute(result.route);
      setTransactionState(createTransactionState(action, tokenAddress));
    } catch (error) {
      setReview(null);
      setReviewRoute(null);
      setReviewError(message(error));
    } finally {
      setReviewBusy(false);
    }
  }

  async function submitTrade() {
    if (!runtime || !runtime.wallet || !walletReady || !review || busy || routeUnavailableReason !== null) return;
    setReviewError(null);

    const protocolContext = runtime.protocolContext;
    if (!protocolContext) {
      setReviewError('Canonical protocol context is not available.');
      return;
    }

    const storage = runtime.storage ?? window.localStorage;
    const result = await executeTradeLifecycle({
      client: runtime.client,
      wallet: runtime.wallet,
      storage,
      context: runtime.context,
      protocolContext,
      action,
      tokenAddress,
      curveAddress,
      inputAmount: inputAmount(),
      slippageBps,
      approvedReview: review,
      onStateChange: setTransactionState,
      onConfirmed: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: breadQueryKeys.token(tokenAddress) }),
          queryClient.invalidateQueries({ queryKey: breadQueryKeys.trades(tokenAddress, { limit: 25 }) }),
          queryClient.invalidateQueries({ queryKey: breadQueryKeys.holders(tokenAddress, { limit: 25 }) }),
        ]);
      },
    });

    setTransactionState(result.state);
    if (result.reviewChanged && result.prepared) {
      setReview(result.prepared.review);
      setReviewRoute(null);
      setReviewError('Trade values changed during the final canonical reread. Review the updated values before opening your wallet.');
      return;
    }
    if (result.state.status === 'CONFIRMED') {
      setReview(null);
      setReviewRoute(null);
      setAmount('');
    }
  }

  function openSheet(nextAction: TradeAction = action) {
    if (busy || routeUnavailableReason !== null) return;
    if (nextAction !== action) changeAction(nextAction);
    setSheetOpen(true);
  }

  const tradeSurfaceDisabled = busy || routeUnavailableReason !== null;

  return (
    <>
      <aside className="bread-token-trade-slot" aria-label="Trade">
        <Card>
          <TradePanel {...panelProps} />
        </Card>
      </aside>

      <div className="bread-token-tablet-trade-trigger">
        <Button
          variant="secondary"
          disabled={tradeSurfaceDisabled}
          onClick={() => openSheet()}
          ariaLabel={routeUnavailableReason === null ? 'Open trade panel' : 'Trading unavailable while graduation completes'}
        >
          Trade
        </Button>
      </div>

      {sheetOpen ? (
        <div className="bread-token-tablet-trade-backdrop bread-trade-sheet-backdrop" onMouseDown={() => !busy && setSheetOpen(false)}>
          <section
            className="bread-token-tablet-trade-sheet bread-trade-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bread-trade-sheet-heading"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="bread-trade-sheet__heading">
              <h2 id="bread-trade-sheet-heading">Trade</h2>
              <Button variant="small" disabled={busy} onClick={() => setSheetOpen(false)} ariaLabel="Close trade panel">
                Close
              </Button>
            </div>
            <TradePanel {...panelProps} />
          </section>
        </div>
      ) : null}

      <div className="bread-token-mobile-actions" aria-label="Token trade actions">
        <Button variant="buy" disabled={tradeSurfaceDisabled} onClick={() => openSheet('BUY')} ariaLabel="Open buy panel">Buy</Button>
        <Button variant="sell" disabled={tradeSurfaceDisabled} onClick={() => openSheet('SELL')} ariaLabel="Open sell panel">Sell</Button>
      </div>
    </>
  );
}