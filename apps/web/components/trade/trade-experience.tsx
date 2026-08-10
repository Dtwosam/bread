'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '@bread/ui';
import { useEffect, useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';

import { BREAD_LAUNCH_TOKEN_DECIMALS } from '../../../../packages/protocol-sdk/src/constants';
import type {
  BuyTradeReview,
  SellTradeReview,
} from '../../../../packages/protocol-sdk/src/trade-review';
import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { breadQueryKeys } from '../../lib/api/queries';
import {
  executeTradeLifecycle,
  prepareTradeReview,
} from '../../lib/transactions/controller';
import {
  canSubmitTransactionAction,
  createTransactionState,
  type TradeAction,
  type TransactionState,
} from '../../lib/transactions/state';
import { TradePanel } from './trade-panel';
import { useTradeRuntime, type TradeConnectionStatus } from './trade-runtime';

type TradeReview = BuyTradeReview | SellTradeReview;
type Preset = '$25' | '$50' | '$100' | '25%' | '50%' | '75%' | 'MAX';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Trade preparation failed.';
}

export function TradeExperience({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const runtime = useTradeRuntime();
  const queryClient = useQueryClient();
  const tokenAddress = token.tokenAddress as `0x${string}`;
  const curveAddress = token.curveAddress as `0x${string}`;
  const [action, setAction] = useState<TradeAction>('BUY');
  const [amount, setAmount] = useState('');
  const [slippageBps, setSlippageBps] = useState(50);
  const [review, setReview] = useState<TradeReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [transactionState, setTransactionState] = useState<TransactionState>(() =>
    createTransactionState('BUY', tokenAddress),
  );

  const transactionBusy = !canSubmitTransactionAction(transactionState);
  const busy = transactionBusy || reviewBusy;
  const connectionStatus: TradeConnectionStatus = runtime?.connectionStatus ?? 'DISCONNECTED';
  const walletReady = runtime !== null && connectionStatus === 'READY' && runtime.wallet !== null;

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
    [action, amount, slippageBps, review, transactionState, connectionStatus, runtime, busy, reviewError],
  );

  function resetReview(nextAction: TradeAction = action) {
    setReview(null);
    setReviewError(null);
    setTransactionState(createTransactionState(nextAction, tokenAddress));
  }

  function changeAction(nextAction: TradeAction) {
    if (busy || nextAction === action) return;
    setAction(nextAction);
    setAmount('');
    resetReview(nextAction);
  }

  function changeAmount(nextAmount: string) {
    if (busy) return;
    if (!/^\d*(?:\.\d*)?$/.test(nextAmount)) return;
    setAmount(nextAmount);
    resetReview();
  }

  function changeSlippage(nextSlippageBps: number) {
    if (busy) return;
    setSlippageBps(nextSlippageBps);
    resetReview();
  }

  async function handleConnectionAction() {
    if (!runtime || busy) return;
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
    if (!runtime || !walletReady || busy) return;
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
    if (!runtime || !runtime.wallet || !walletReady || busy) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const [account, walletChainId] = await Promise.all([
        runtime.wallet.getAccount(),
        runtime.wallet.getChainId(),
      ]);
      if (!account) throw new Error('Connect a wallet before reviewing this trade.');
      const prepared = await prepareTradeReview({
        client: runtime.client,
        context: runtime.context,
        walletChainId,
        account,
        action,
        tokenAddress,
        curveAddress,
        inputAmount: inputAmount(),
        slippageBps,
      });
      setReview(prepared.review);
      setTransactionState(createTransactionState(action, tokenAddress));
    } catch (error) {
      setReview(null);
      setReviewError(message(error));
    } finally {
      setReviewBusy(false);
    }
  }

  async function submitTrade() {
    if (!runtime || !runtime.wallet || !walletReady || !review || busy) return;
    setReviewError(null);
    const storage = runtime.storage ?? window.localStorage;
    const result = await executeTradeLifecycle({
      client: runtime.client,
      wallet: runtime.wallet,
      storage,
      context: runtime.context,
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
      setReviewError('Trade values changed during the final canonical reread. Review the updated values before opening your wallet.');
      return;
    }
    if (result.state.status === 'CONFIRMED') {
      setReview(null);
      setAmount('');
    }
  }

  function openSheet(nextAction: TradeAction = action) {
    if (busy) return;
    if (nextAction !== action) changeAction(nextAction);
    setSheetOpen(true);
  }

  return (
    <>
      <aside className="bread-token-trade-slot" aria-label="Trade">
        <Card>
          <TradePanel {...panelProps} />
        </Card>
      </aside>

      <div className="bread-token-tablet-trade-trigger">
        <Button variant="secondary" onClick={() => openSheet()} ariaLabel="Open trade panel">
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
        <Button variant="buy" disabled={busy} onClick={() => openSheet('BUY')} ariaLabel="Open buy panel">Buy</Button>
        <Button variant="sell" disabled={busy} onClick={() => openSheet('SELL')} ariaLabel="Open sell panel">Sell</Button>
      </div>
    </>
  );
}
