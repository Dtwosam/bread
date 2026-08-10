'use client';

import { Button } from '@bread/ui';
import { formatUnits } from 'viem';

import {
  BREAD_LAUNCH_TOKEN_DECIMALS,
  type BuyTradeReview,
  type SellTradeReview,
} from '@bread/protocol-sdk';
import type { TradeAction, TransactionState } from '../../lib/transactions/state';
import { TransactionStatus } from '../transaction-status';

type TradeReview = BuyTradeReview | SellTradeReview;
type Preset = '$25' | '$50' | '$100' | '25%' | '50%' | '75%' | 'MAX';

function formatAmount(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

function formatBps(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}

export function TradePanel({
  action,
  amount,
  slippageBps,
  review,
  transactionState,
  runtimeAvailable,
  busy,
  reviewError,
  onActionChange,
  onAmountChange,
  onSlippageChange,
  onPreset,
  onReview,
  onSubmit,
}: Readonly<{
  action: TradeAction;
  amount: string;
  slippageBps: number;
  review: TradeReview | null;
  transactionState: TransactionState;
  runtimeAvailable: boolean;
  busy: boolean;
  reviewError: string | null;
  onActionChange: (action: TradeAction) => void;
  onAmountChange: (amount: string) => void;
  onSlippageChange: (slippageBps: number) => void;
  onPreset: (preset: Preset) => void;
  onReview: () => void;
  onSubmit: () => void;
}>) {
  const presets: readonly Preset[] = action === 'BUY' ? ['$25', '$50', '$100', 'MAX'] : ['25%', '50%', '75%', 'MAX'];
  const outputDecimals = action === 'BUY' ? BREAD_LAUNCH_TOKEN_DECIMALS : 6;
  const quoteDecimals = 6;

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
            disabled={busy}
            onClick={() => onActionChange(side)}
          >
            {side === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <label className="bread-trade-field">
        <span>{action === 'BUY' ? 'USDC amount' : 'Token amount'}</span>
        <input
          className="bread-trade-input"
          aria-label="Trade amount"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          disabled={busy}
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
            disabled={busy || !runtimeAvailable}
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
          disabled={busy}
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
          <div><dt>Base fee</dt><dd>{formatAmount(review.baseFee, quoteDecimals)} USDC</dd></div>
          <div><dt>Creator tax</dt><dd>{formatAmount(review.creatorTax, quoteDecimals)} USDC</dd></div>
          <div><dt>Opening buy tax</dt><dd>{action === 'BUY' ? `${formatAmount(review.openingTax, quoteDecimals)} USDC (${formatBps(review.openingTaxBps)})` : '0.00% (sell unaffected)'}</dd></div>
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

      {reviewError ? <p className="bread-inline-error">{reviewError}</p> : null}

      <Button
        variant={action === 'BUY' ? 'buy' : 'sell'}
        disabled={busy || !runtimeAvailable || amount.trim() === ''}
        ariaLabel={review ? `${action === 'BUY' ? 'Buy' : 'Sell'} after reviewing current values` : `Review ${action === 'BUY' ? 'buy' : 'sell'}`}
        onClick={review ? onSubmit : onReview}
      >
        {!runtimeAvailable ? 'Connect wallet' : review ? (action === 'BUY' ? 'Buy' : 'Sell') : `Review ${action === 'BUY' ? 'Buy' : 'Sell'}`}
      </Button>

      <TransactionStatus state={transactionState} />
    </div>
  );
}
