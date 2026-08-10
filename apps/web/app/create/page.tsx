'use client';

import { useEffect, useRef, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';

import { BREAD_LAUNCH_TOKEN_DECIMALS } from '../../../../packages/protocol-sdk/src/constants';
import {
  prepareCanonicalLaunchReview,
  readLaunchReviewSnapshot,
  type PreparedCanonicalLaunchReview,
} from '../../../../packages/protocol-sdk/src/launch-review';
import {
  EMPTY_CREATE_TOKEN_DRAFT,
  TokenForm,
  type CreateTokenDraft,
} from '../../components/create/token-form';
import {
  LaunchReview,
  type LaunchReviewModel,
} from '../../components/create/launch-review';
import styles from '../../components/create/create.module.css';
import { TransactionStatus } from '../../components/transaction-status';
import { useTradeRuntime } from '../../components/trade/trade-runtime';
import { normalizeExternalMetadataUrl } from '../../lib/security/external-url';
import {
  executeLaunchLifecycle,
  recoverLaunchTransactions,
} from '../../lib/transactions/launch-controller';
import {
  canSubmitTransactionAction,
  createLaunchTransactionState,
  type TransactionState,
} from '../../lib/transactions/state';

type CreateStep = 'FORM' | 'REVIEW' | 'SUCCESS';

const DEFAULT_SLIPPAGE_BPS = 50;

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Launch preparation failed.';
}

function parseCreatorTaxPercent(value: string): bigint {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(trimmed);
  if (!match) throw new Error('Creator tax must be a percentage with at most two decimal places.');
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  return whole * BigInt(100) + fraction;
}

function formatBps(value: number): string {
  const whole = Math.floor(value / 100);
  const fraction = value % 100;
  if (fraction === 0) return `${whole}%`;
  return `${whole}.${fraction.toString().padStart(2, '0').replace(/0+$/, '')}%`;
}

function usdc(value: bigint, decimals: number): string {
  return `${formatUnits(value, decimals)} USDC`;
}

function tokenAmount(value: bigint): string {
  return formatUnits(value, BREAD_LAUNCH_TOKEN_DECIMALS);
}

function mapPreparedReview(prepared: PreparedCanonicalLaunchReview): LaunchReviewModel {
  const { review, initialBuyReview } = prepared;
  const initialBuyConsequences = initialBuyReview
    ? {
        expectedOutput: `${tokenAmount(initialBuyReview.expectedOutput)} tokens`,
        minimumOutput: `${tokenAmount(initialBuyReview.minimumOutput)} tokens`,
        baseFee: usdc(initialBuyReview.baseFee, review.quoteDecimals),
        creatorTax: usdc(initialBuyReview.creatorTax, review.quoteDecimals),
        openingTax: `${usdc(initialBuyReview.openingTax, review.quoteDecimals)} — atomic Launch & Buy exemption`,
        priceImpact: formatBps(initialBuyReview.priceImpactBps),
        slippage: formatBps(initialBuyReview.slippageBps),
      }
    : undefined;

  return {
    fixedSupply: `${tokenAmount(review.fixedSupply)} tokens`,
    quoteCurrency: 'USDC',
    creatorTax: formatBps(review.creatorTaxBps),
    buyback: 'Off — unavailable in current Bread stack',
    initialBuy: review.initialBuyQuoteIn === BigInt(0)
      ? 'None'
      : usdc(review.initialBuyQuoteIn, review.quoteDecimals),
    launchFee: usdc(review.launchFeeUsdc, review.quoteDecimals),
    graduationTarget: usdc(review.graduationThreshold, review.quoteDecimals),
    creatorRevenueWallet: review.creatorRevenueWallet,
    permanentLiquidityLock: 'Liquidity is permanently locked after successful graduation.',
    launchAndBuy: review.initialBuyQuoteIn > BigInt(0),
    ...(initialBuyConsequences ? { initialBuyConsequences } : {}),
  };
}

export default function CreatePage() {
  const runtime = useTradeRuntime();
  const launchIntentId = useRef(`create:${Date.now()}`);
  const recoveryStarted = useRef(false);
  const [step, setStep] = useState<CreateStep>('FORM');
  const [draft, setDraft] = useState<CreateTokenDraft>(EMPTY_CREATE_TOKEN_DRAFT);
  const [prepared, setPrepared] = useState<PreparedCanonicalLaunchReview | null>(null);
  const [review, setReview] = useState<LaunchReviewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successToken, setSuccessToken] = useState<`0x${string}` | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [transactionState, setTransactionState] = useState<TransactionState>(() =>
    createLaunchTransactionState('LAUNCH', launchIntentId.current),
  );

  const connectionStatus = runtime?.connectionStatus ?? 'DISCONNECTED';
  const transactionBusy = !canSubmitTransactionAction(transactionState);
  const disabled = busy || transactionBusy;

  useEffect(() => {
    if (
      !runtime ||
      !runtime.protocolContext ||
      !runtime.storage ||
      recoveryStarted.current
    ) return;
    recoveryStarted.current = true;

    void recoverLaunchTransactions({
      client: runtime.client,
      storage: runtime.storage,
      context: runtime.protocolContext,
      onStateChange: setTransactionState,
      onConfirmed: (record) => {
        if (record.tokenAddress) {
          setSuccessToken(record.tokenAddress);
          setStep('SUCCESS');
        }
      },
    }).then((results) => {
      const confirmed = results.find((result) => result.tokenAddress)?.tokenAddress;
      if (confirmed) {
        setSuccessToken(confirmed);
        setStep('SUCCESS');
      }
    }).catch((recoveryError) => {
      setError(message(recoveryError));
    });
  }, [runtime]);

  function changeDraft(next: CreateTokenDraft) {
    setDraft(next);
    setPrepared(null);
    setReview(null);
    setError(null);
    setSuccessToken(null);
    setCopyStatus(null);
  }

  async function handleConnectionAction() {
    if (!runtime || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (connectionStatus === 'WRONG_NETWORK') {
        await runtime.switchToTargetChain();
      } else if (connectionStatus === 'DISCONNECTED') {
        await runtime.connectWallet();
      }
    } catch (connectionError) {
      setError(message(connectionError));
    } finally {
      setBusy(false);
    }
  }

  async function prepareReview() {
    if (!runtime) {
      setError('Launch runtime unavailable. The form is still editable, but Review cannot be prepared.');
      return;
    }
    if (connectionStatus === 'DISCONNECTED') {
      await handleConnectionAction();
      setError('Wallet connection requested. Select Review again after the wallet is connected.');
      return;
    }
    if (connectionStatus === 'WRONG_NETWORK') {
      await handleConnectionAction();
      setError('Arc network switch requested. Select Review again after the switch completes.');
      return;
    }
    if (!runtime.protocolContext) {
      setError('Launch runtime unavailable: the canonical Arc testnet protocol deployment is unavailable or unresolved. You can keep editing this form.');
      return;
    }
    if (!runtime.wallet) {
      setError('Wallet runtime is not ready yet.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const account = await runtime.wallet.getAccount();
      if (!account) throw new Error('Connect a wallet before preparing Review.');
      const creatorTaxBps = parseCreatorTaxPercent(draft.creatorTaxPercent);
      const initialBuyQuoteIn = draft.initialBuyUsdc.trim() === ''
        ? BigInt(0)
        : parseUnits(draft.initialBuyUsdc, runtime.protocolContext.quoteDecimals);
      if (draft.name.trim() === '') throw new Error('Name is required.');
      if (draft.ticker.trim() === '') throw new Error('Ticker is required.');

      const snapshot = await readLaunchReviewSnapshot(runtime.client, runtime.protocolContext);
      const nextPrepared = prepareCanonicalLaunchReview({
        context: runtime.protocolContext,
        snapshot,
        creator: {
          name: draft.name.trim(),
          symbol: draft.ticker.trim().toUpperCase(),
          logo: normalizeExternalMetadataUrl(draft.image, 'Image'),
          description: draft.description.trim(),
          twitter: normalizeExternalMetadataUrl(draft.x, 'X'),
          telegram: normalizeExternalMetadataUrl(draft.telegram, 'Telegram'),
          website: normalizeExternalMetadataUrl(draft.website, 'Website'),
          creatorFeeRecipient: account,
          creatorTaxBps,
        },
        initialBuyQuoteIn,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
      });

      setPrepared(nextPrepared);
      setReview(mapPreparedReview(nextPrepared));
      setTransactionState(createLaunchTransactionState(
        nextPrepared.review.initialBuyQuoteIn > BigInt(0) ? 'LAUNCH_AND_BUY' : 'LAUNCH',
        launchIntentId.current,
      ));
      setStep('REVIEW');
    } catch (reviewError) {
      setPrepared(null);
      setReview(null);
      setError(message(reviewError));
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    if (!runtime || !runtime.protocolContext || !runtime.wallet || !prepared || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const result = await executeLaunchLifecycle({
        client: runtime.client,
        wallet: runtime.wallet,
        storage: runtime.storage ?? window.localStorage,
        context: runtime.protocolContext,
        approved: prepared,
        launchIntentId: launchIntentId.current,
        onStateChange: setTransactionState,
      });

      setTransactionState(result.state);
      if (result.reviewChanged && result.prepared) {
        setPrepared(result.prepared);
        setReview(mapPreparedReview(result.prepared));
        setError('Launch economics changed during the final canonical reread. Review the updated values before continuing.');
        return;
      }
      if (result.tokenAddress) {
        setSuccessToken(result.tokenAddress);
        setStep('SUCCESS');
      }
    } catch (launchError) {
      setError(message(launchError));
    } finally {
      setBusy(false);
    }
  }

  function tokenLink(): string | null {
    if (!successToken || typeof window === 'undefined') return null;
    return `${window.location.origin}/token/${successToken}`;
  }

  function shareOnX() {
    const link = tokenLink();
    if (!link) return;
    window.open(`https://x.com/intent/tweet?url=${encodeURIComponent(link)}`, '_blank', 'noopener,noreferrer');
  }

  async function copyLink() {
    const link = tokenLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus('Link copied.');
    } catch {
      setCopyStatus('Copy failed.');
    }
  }

  return (
    <main className={`${styles.layout} bread-create-layout`}>
      {step === 'FORM' ? (
        <div className={`${styles.formRegion} bread-create-form-region`}>
          <TokenForm
            draft={draft}
            disabled={busy}
            onChange={changeDraft}
            onReview={() => void prepareReview()}
          />

          <div className="bread-create-runtime-status" role="status">
            {runtime?.protocolContext
              ? 'Canonical launch deployment loaded.'
              : 'Launch runtime unavailable: canonical protocol deployment is unavailable. Form editing remains available.'}
          </div>

          {connectionStatus === 'DISCONNECTED' ? (
            <button type="button" className="bread-create-secondary-action" disabled={busy} onClick={() => void handleConnectionAction()}>
              Connect wallet
            </button>
          ) : null}
          {connectionStatus === 'WRONG_NETWORK' ? (
            <button type="button" className="bread-create-secondary-action" disabled={busy} onClick={() => void handleConnectionAction()}>
              Switch to Arc
            </button>
          ) : null}
          {error ? <p className="bread-create-error" role="alert">{error}</p> : null}
        </div>
      ) : step === 'REVIEW' ? (
        <div className={`${styles.reviewRegion} bread-launch-review-region`}>
          <LaunchReview
            review={review}
            disabled={disabled}
            onBack={() => !disabled && setStep('FORM')}
            onLaunch={() => void launch()}
          />
          <TransactionStatus state={transactionState} />
          {error ? <p className="bread-create-error" role="alert">{error}</p> : null}
        </div>
      ) : (
        <section className={`${styles.reviewRegion} bread-create-success`} aria-labelledby="bread-create-success-heading">
          <p className="bread-create-eyebrow">Confirmed</p>
          <h1 id="bread-create-success-heading">Token launched</h1>
          {successToken ? <code className="bread-technical">{successToken}</code> : null}
          <div className="bread-launch-review__actions">
            {successToken ? (
              <a className="bread-create-primary-action" href={`/token/${successToken}`}>View token</a>
            ) : null}
            <button type="button" className="bread-create-secondary-action" onClick={shareOnX}>Share on X</button>
            <button type="button" className="bread-create-secondary-action" onClick={() => void copyLink()}>Copy link</button>
          </div>
          {copyStatus ? <p role="status">{copyStatus}</p> : null}
          <section aria-labelledby="bread-creator-economics-heading">
            <h2 id="bread-creator-economics-heading">Creator economics</h2>
            <p>Creator tax: {prepared ? formatBps(prepared.review.creatorTaxBps) : '—'}</p>
            <p>Buyback: Off — unavailable in current Bread stack.</p>
            <p>Revenue wallet: {prepared?.review.creatorRevenueWallet ?? '—'}</p>
          </section>
          <TransactionStatus state={transactionState} />
        </section>
      )}
    </main>
  );
}
