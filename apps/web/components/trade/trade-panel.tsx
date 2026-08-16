'use client';

import styles from './trade.module.css';

import { Button } from '@bread/ui';
import { formatUnits } from 'viem';

import { BREAD_LAUNCH_TOKEN_DECIMALS } from '../../../../packages/protocol-sdk/src/constants';
import type { CanonicalTradeRoute } from '../../../../packages/protocol-sdk/src/trade-route';
import type {
  BuyTradeReview,
  SellTradeReview,
} from '../../../../packages/protocol-sdk/src/trade-review';
import type { V3TradeReview } from '../../../../packages/protocol-sdk/src/v3-trading';
import type { TradeAction, TransactionState } from '../../lib/transactions/state';
import { TransactionStatus } from '../transaction-status';
import type { TradeConnectionStatus } from './trade-runtime';

void styles;

type TradeReview = BuyTradeReview | SellTradeReview | V3TradeReview;
type Preset = '$25' | '$50' | '$100' | '25%' | '50%' | '75%' | 'MAX';

function formatAmount(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

function formatBps(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}

function formatV3Fee(value: number): string {
  return `${(value / 10_000).toFixed(2)}%`;
}

export function TradePanel({
  action,
  amount,
  slippageBps,
  review,
  reviewRoute,
  quoteNeedsRefresh,
  spendableBalance,
  tokenSymbol,
  transactionState,
  connectionStatus,
  busy,
  reviewError,
  routeUnavailableReason,
  onActionChange,
  onAmountChange,
  onSlippageChange,
  onPreset,
  onConnectionAction,
  onReview,
  onRefreshQuote,
  onSubmit,
}: Readonly<{
  action: TradeAction;
  amount: string;
  slippageBps: number;
  review: TradeReview | null;
  reviewRoute: CanonicalTradeRoute | null;
  quoteNeedsRefresh: boolean;
  spendableBalance: bigint | null;
  tokenSymbol: string | null;
  transactionState: TransactionState;
  connectionStatus: TradeConnectionStatus;
  busy: boolean;
  reviewError: string | null;
  routeUnavailableReason: string | null;
  onActionChange: (action: TradeAction) => void;
  onAmountChange: (amount: string) => void;
  onSlippageChange: (slippageBps: number) => void;
  onPreset: (preset: Preset) => void;
  onConnectionAction: () => void;
  onReview: () => void;
  onRefreshQuote: () => void;
  onSubmit: () => void;
}>) {
  const presets: readonly Preset[] = action === 'BUY' ? ['$25', '$50', '$100', 'MAX'] : ['25%', '50%', '75%', 'MAX'];
  const outputDecimals = action === 'BUY' ? BREAD_LAUNCH_TOKEN_DECIMALS : 6;
  const inputDecimals = action === 'BUY' ? 6 : BREAD_LAUNCH_TOKEN_DECIMALS;
  const normalizedTokenSymbol = tokenSymbol?.trim() || null;
  const inputAsset = action === 'BUY' ? 'USDC' : normalizedTokenSymbol ?? 'token';
  const actionLabel = action === 'BUY' ? 'Buy' : 'Sell';
  const reviewedActionLabel = normalizedTokenSymbol ? `${actionLabel} ${normalizedTokenSymbol}` : `${actionLabel} token`;
  const quoteDecimals = 6;
  const walletReady = connectionStatus === 'READY';
  const routeUnavailable = routeUnavailableReason !== null;
  const v3Review = review !== null && 'route' in review && review.route === 'V3_POOL';
  const routeLabel = reviewRoute?.kind === 'CURVE'
    ? 'Bonding curve'
    : reviewRoute?.kind === 'V3_POOL'
      ? 'Uniswap V3'
      : null;
  const primaryLabel = routeUnavailable
    ? 'Trading unavailable'
    : connectionStatus === 'DISCONNECTED'
      ? 'Connect wallet'
      : connectionStatus === 'WRONG_NETWORK'
        ? 'Switch to Arc'
        : quoteNeedsRefresh
          ? 'Refresh Quote'
          : review
            ? reviewedActionLabel
            : `Review ${actionLabel}`;
  const primaryAriaLabel = routeUnavailable
    ? 'Trading unavailable while graduation completes'
    : connectionStatus === 'DISCONNECTED'
      ? 'Connect wallet'
      : connectionStatus === 'WRONG_NETWORK'
        ? 'Switch wallet to Arc Testnet'
        : quoteNeedsRefresh
          ? 'Refresh Quote'
          : review
            ? `${reviewedActionLabel} after reviewing current values`
            : `Review ${actionLabel.toLowerCase()}`;

  return (
    <div className="bread-trade-panel">
      <div className="bread-trade-actions" role="tablist" aria-label="Trade side">
        {(['BUY', 'SELL'] as const).map((side) => (
          <button
            className="bread-trade-action"
            type="button"
            role="tab"
            aria-selected={action === side}
            key={side}
            disabled={busy || routeUnavailable}
            onClick={() => onActionChange(side)}
          >
            {side === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <label className="bread-trade-field">
        <span className="bread-trade-field__header">
          <span>{action === 'BUY' ? 'USDC amount' : 'Token amount'}</span>
          <span className="bread-trade-balance">
            {spendableBalance === null
              ? 'Balance —'
              : `Balance ${formatAmount(spendableBalance, inputDecimals)} ${inputAsset}`}
          </span>
        </span>
        <input
          className="bread-trade-input"
          aria-label="Trade amount"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          disabled={busy || routeUnavailable}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="0.00"
        />
      </label>

      <div className="bread-trade-presets" aria-label={`${action === 'BUY' ? 'Buy' : 'Sell'} amount presets`}>
        {presets.map((preset) => (
          <button
            className="bread-trade-preset"
            type="button"
            key={preset}
            disabled={busy || routeUnavailable || !walletReady}
            onClick={() => onPreset(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      <label className="bread-trade-field">
        <span>Slippage</span>
        <select
          className="bread-trade-input"
          aria-label="Slippage tolerance"
          value={slippageBps}
          disabled={busy || routeUnavailable}
          onChange={(event) => onSlippageChange(Number(event.target.value))}
        >
          <option value={25}>0.25%</option>
          <option value={50}>0.50%</option>
          <option value={100}>1.00%</option>
        </select>
      </label>

      {review ? (
        <dl className="bread-trade-review">
          <div><dt>Expected output</dt><dd>{formatAmount(review.expectedOutput, outputDecimals)}</dd></div>
          <div><dt>Minimum output</dt><dd>{formatAmount(review.minimumOutput, outputDecimals)}</dd></div>
          {routeLabel ? <div><dt>Route</dt><dd>{routeLabel}</dd></div> : null}
          {v3Review ? (
            <div><dt>V3 venue fee</dt><dd>{formatV3Fee(review.venueFee)}</dd></div>
          ) : (
            <>
              <div><dt>Base fee</dt><dd>{formatAmount(review.baseFee, quoteDecimals)} USDC</dd></div>
              <div><dt>Creator tax</dt><dd>{formatAmount(review.creatorTax, quoteDecimals)} USDC</dd></div>
              <div><dt>Opening buy tax</dt><dd>{action === 'BUY' ? `${formatAmount(review.openingTax, quoteDecimals)} USDC (${formatBps(review.openingTaxBps)})` : '0.00% (sell unaffected)'}</dd></div>
            </>
          )}
          <div><dt>Price impact</dt><dd>{formatBps(review.priceImpactBps)}</dd></div>
          <div><dt>Slippage</dt><dd>{formatBps(review.slippageBps)}</dd></div>
        </dl>
      ) : null}

      {review?.action === 'BUY' && review.openingTaxBps > 0 ? (
        <div className="bread-trade-warning" role="alert">
          <strong>Opening buy tax is active.</strong>
          <span>The current canonical opening tax is {formatBps(review.openingTaxBps)}. This value is re-read before the wallet opens.</span>
        </div>
      ) : null}

      {routeUnavailableReason ? <p className="bread-token-note">{routeUnavailableReason}</p> : null}
      {reviewError ? <p className="bread-inline-error">{reviewError}</p> : null}

      <Button
        variant={action === 'BUY' ? 'buy' : 'sell'}
        disabled={busy || routeUnavailable || (walletReady && amount.trim() === '')}
        ariaLabel={primaryAriaLabel}
        onClick={walletReady ? (quoteNeedsRefresh ? onRefreshQuote : review ? onSubmit : onReview) : onConnectionAction}
      >
        {primaryLabel}
      </Button>

      <TransactionStatus state={transactionState} />
    </div>
  );
}
