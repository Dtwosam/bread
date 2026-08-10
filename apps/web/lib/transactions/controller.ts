import {
  prepareBuy,
  prepareSell,
  simulatePreparedTransaction,
  type PreparedBreadTransaction,
} from '../../../../packages/protocol-sdk/src/builders';
import {
  estimateBuyTradeReview,
  estimateSellTradeReview,
  readTradeReviewSnapshot,
  type BuyTradeReview,
  type SellTradeReview,
} from '../../../../packages/protocol-sdk/src/trade-review';

import {
  canSubmitTransactionAction,
  createTransactionState,
  transitionTransactionState,
  type SubmittedTransactionRecord,
  type TradeAction,
  type TransactionState,
} from './state';
import {
  loadRecoverableTransactions,
  persistSubmittedTransaction,
  updatePersistedTransactionStatus,
} from './storage';

type Address = `0x${string}`;
type TransactionHash = `0x${string}`;
type TradePublicClient = Parameters<typeof readTradeReviewSnapshot>[0];
type ApprovedTradeReview = BuyTradeReview | SellTradeReview;

export type TradeExecutionContext = Readonly<{
  chainId: number;
  quoteAsset: Address;
  quoteDecimals: number;
}>;

export type TradePreparationInput = Readonly<{
  client: TradePublicClient;
  context: TradeExecutionContext;
  walletChainId: number;
  account: Address;
  action: TradeAction;
  tokenAddress: Address;
  curveAddress: Address;
  inputAmount: bigint;
  slippageBps: number;
}>;

const TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;
const ZERO = BigInt(0);

export type PreparedTradeForSignature = Readonly<{
  review: ApprovedTradeReview;
  transaction: PreparedBreadTransaction;
}>;

export type TradeWalletAdapter = Readonly<{
  getAccount: () => Promise<Address | null>;
  getChainId: () => Promise<number>;
  ensurePreparedTransactionAllowance: (transaction: PreparedBreadTransaction) => Promise<void>;
  sendPreparedTransaction: (transaction: PreparedBreadTransaction) => Promise<TransactionHash>;
}>;

export type TradeLifecycleResult = Readonly<{
  state: TransactionState;
  prepared?: PreparedTradeForSignature;
  reviewChanged: boolean;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Transaction request failed.';
}

function isWalletUserRejection(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: unknown; name?: unknown; cause?: unknown };
    if (
      candidate.code === 4001 ||
      candidate.code === 'ACTION_REJECTED' ||
      candidate.name === 'UserRejectedRequestError'
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

function allowanceUnknownHash(error: unknown): TransactionHash | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { name?: unknown; hash?: unknown };
  return candidate.name === 'AllowanceConfirmationUnknownError' &&
    typeof candidate.hash === 'string' &&
    TRANSACTION_HASH.test(candidate.hash)
    ? candidate.hash as TransactionHash
    : null;
}

function emit(
  state: TransactionState,
  onStateChange: ((state: TransactionState) => void) | undefined,
): TransactionState {
  onStateChange?.(state);
  return state;
}

function reviewFingerprint(review: ApprovedTradeReview): string {
  return JSON.stringify(
    Object.entries(review)
      .map(([key, value]) => [key, typeof value === 'bigint' ? value.toString(10) : value] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function reviewsMatch(
  approved: ApprovedTradeReview | undefined,
  current: ApprovedTradeReview,
): boolean {
  return approved !== undefined &&
    approved.action === current.action &&
    reviewFingerprint(approved) === reviewFingerprint(current);
}

function rejectedBeforeSignature(
  action: TradeAction,
  tokenAddress: Address,
  error: string,
  onStateChange: ((state: TransactionState) => void) | undefined,
): TradeLifecycleResult {
  const state: TransactionState = {
    action,
    tokenAddress,
    status: 'REJECTED',
    error,
  };
  emit(state, onStateChange);
  return { state, reviewChanged: false };
}

function revertedBeforeSignature(
  state: TransactionState,
  error: unknown,
  onStateChange: ((state: TransactionState) => void) | undefined,
): TradeLifecycleResult {
  const failed: TransactionState = {
    ...state,
    status: 'REVERTED',
    error: errorMessage(error),
  };
  return { state: emit(failed, onStateChange), reviewChanged: false };
}

function replacementHash(value: unknown): TransactionHash | null {
  if (!value || typeof value !== 'object') return null;
  const transaction = (value as { transaction?: unknown }).transaction;
  if (!transaction || typeof transaction !== 'object') return null;
  const hash = (transaction as { hash?: unknown }).hash;
  return typeof hash === 'string' && TRANSACTION_HASH.test(hash) ? hash as TransactionHash : null;
}

function stateFromRecord(
  record: SubmittedTransactionRecord,
  status: TransactionState['status'],
): TransactionState {
  return {
    action: record.action,
    tokenAddress: record.tokenAddress,
    chainId: record.chainId,
    hash: record.hash,
    submittedAt: record.submittedAt,
    status,
  };
}

function prepareAllowanceProbe({
  context,
  account,
  action,
  tokenAddress,
  curveAddress,
  inputAmount,
}: Pick<
  TradePreparationInput,
  'context' | 'account' | 'action' | 'tokenAddress' | 'curveAddress' | 'inputAmount'
>): PreparedBreadTransaction {
  if (action === 'BUY') {
    return prepareBuy(context, {
      curve: curveAddress,
      quoteIn: inputAmount,
      minTokensOut: ZERO,
      recipient: account,
    });
  }

  return prepareSell(context, {
    token: tokenAddress,
    curve: curveAddress,
    tokensIn: inputAmount,
    minQuoteOut: ZERO,
    recipient: account,
  });
}

/**
 * Reads the canonical transaction-critical curve state and builds the exact
 * transaction/review without simulating it. The user-facing Review screen uses
 * this path so a first-time wallet is not required to have allowance merely to
 * inspect current financial consequences.
 */
export async function prepareTradeReview({
  client,
  context,
  walletChainId,
  account,
  action,
  tokenAddress,
  curveAddress,
  inputAmount,
  slippageBps,
}: TradePreparationInput): Promise<PreparedTradeForSignature> {
  if (walletChainId !== context.chainId) {
    throw new Error(`Wrong network: wallet is on chain ${walletChainId}, expected ${context.chainId}.`);
  }

  const snapshot = await readTradeReviewSnapshot(client, curveAddress);

  if (action === 'BUY') {
    const review = estimateBuyTradeReview({ quoteIn: inputAmount, slippageBps, snapshot });
    const transaction = prepareBuy(context, {
      curve: curveAddress,
      quoteIn: inputAmount,
      minTokensOut: review.minimumOutput,
      recipient: account,
    });
    return { review, transaction };
  }

  const review = estimateSellTradeReview({ tokensIn: inputAmount, slippageBps, snapshot });
  const transaction = prepareSell(context, {
    token: tokenAddress,
    curve: curveAddress,
    tokensIn: inputAmount,
    minQuoteOut: review.minimumOutput,
    recipient: account,
  });
  return { review, transaction };
}

/**
 * Final signature preparation. This must run only after required allowance is
 * confirmed, then performs a fresh canonical reread and simulation immediately
 * before the trade-signature boundary.
 */
export async function prepareTradeForSignature(
  input: TradePreparationInput,
): Promise<PreparedTradeForSignature> {
  const prepared = await prepareTradeReview(input);
  await simulatePreparedTransaction(input.client, prepared.transaction, input.account);
  return prepared;
}

export async function executeTradeLifecycle({
  client,
  wallet,
  storage,
  context,
  action,
  tokenAddress,
  curveAddress,
  inputAmount,
  slippageBps,
  approvedReview,
  now = () => new Date(),
  onStateChange,
  onConfirmed,
}: Readonly<{
  client: TradePublicClient;
  wallet: TradeWalletAdapter;
  storage: Storage;
  context: TradeExecutionContext;
  action: TradeAction;
  tokenAddress: Address;
  curveAddress: Address;
  inputAmount: bigint;
  slippageBps: number;
  approvedReview: ApprovedTradeReview | undefined;
  now?: () => Date;
  onStateChange?: (state: TransactionState) => void;
  onConfirmed?: (record: SubmittedTransactionRecord) => Promise<void> | void;
}>): Promise<TradeLifecycleResult> {
  let state = createTransactionState(action, tokenAddress);
  if (!canSubmitTransactionAction(state)) return { state, reviewChanged: false };

  state = emit(transitionTransactionState(state, { type: 'VALIDATE' }), onStateChange);

  const [account, walletChainId] = await Promise.all([
    wallet.getAccount(),
    wallet.getChainId(),
  ]);
  if (!account) {
    return rejectedBeforeSignature(action, tokenAddress, 'Wallet is not connected.', onStateChange);
  }
  if (walletChainId !== context.chainId) {
    return rejectedBeforeSignature(
      action,
      tokenAddress,
      `Wrong network: wallet is on chain ${walletChainId}, expected ${context.chainId}.`,
      onStateChange,
    );
  }

  state = emit(transitionTransactionState(state, { type: 'PREPARE' }), onStateChange);

  try {
    const allowanceProbe = prepareAllowanceProbe({
      context,
      account,
      action,
      tokenAddress,
      curveAddress,
      inputAmount,
    });
    await wallet.ensurePreparedTransactionAllowance(allowanceProbe);
  } catch (error) {
    const unknownHash = allowanceUnknownHash(error);
    if (unknownHash) {
      const unknown: TransactionState = {
        ...state,
        status: 'UNKNOWN',
        chainId: context.chainId,
        hash: unknownHash,
        error: errorMessage(error),
      };
      return { state: emit(unknown, onStateChange), reviewChanged: false };
    }
    if (isWalletUserRejection(error)) {
      return rejectedBeforeSignature(action, tokenAddress, errorMessage(error), onStateChange);
    }
    return revertedBeforeSignature(state, error, onStateChange);
  }

  let prepared: PreparedTradeForSignature;
  try {
    prepared = await prepareTradeForSignature({
      client,
      context,
      walletChainId,
      account,
      action,
      tokenAddress,
      curveAddress,
      inputAmount,
      slippageBps,
    });
  } catch (error) {
    return revertedBeforeSignature(state, error, onStateChange);
  }

  if (!reviewsMatch(approvedReview, prepared.review)) {
    return {
      state: createTransactionState(action, tokenAddress),
      prepared,
      reviewChanged: true,
    };
  }

  state = emit(transitionTransactionState(state, { type: 'AWAIT_SIGNATURE' }), onStateChange);

  let transactionHash: TransactionHash;
  try {
    transactionHash = await wallet.sendPreparedTransaction(prepared.transaction);
  } catch (error) {
    state = emit(
      transitionTransactionState(state, { type: 'REJECT', error: errorMessage(error) }),
      onStateChange,
    );
    return { state, prepared, reviewChanged: false };
  }

  let currentRecord: SubmittedTransactionRecord = {
    chainId: context.chainId,
    hash: transactionHash,
    action,
    tokenAddress,
    submittedAt: now().toISOString(),
    status: 'SUBMITTED',
  };

  persistSubmittedTransaction(storage, currentRecord);
  state = emit(
    transitionTransactionState(state, { type: 'SUBMIT', record: currentRecord }),
    onStateChange,
  );
  state = emit(transitionTransactionState(state, { type: 'CONFIRM' }), onStateChange);
  updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMING');
  currentRecord = { ...currentRecord, status: 'CONFIRMING' };

  let receipt: Awaited<ReturnType<TradePublicClient['waitForTransactionReceipt']>>;
  try {
    receipt = await client.waitForTransactionReceipt({
      hash: currentRecord.hash,
      onReplaced: (replacement) => {
        const nextHash = replacementHash(replacement);
        if (!nextHash || nextHash === currentRecord.hash) return;

        updatePersistedTransactionStatus(storage, currentRecord.hash, 'REPLACED');
        currentRecord = {
          ...currentRecord,
          hash: nextHash,
          status: 'CONFIRMING',
        };
        persistSubmittedTransaction(storage, currentRecord);
        state = emit(stateFromRecord(currentRecord, 'REPLACED'), onStateChange);
      },
    });
  } catch {
    updatePersistedTransactionStatus(storage, currentRecord.hash, 'UNKNOWN');
    state = emit(stateFromRecord(currentRecord, 'UNKNOWN'), onStateChange);
    return { state, prepared, reviewChanged: false };
  }

  if (receipt.status === 'reverted') {
    updatePersistedTransactionStatus(storage, currentRecord.hash, 'REVERTED');
    state = emit(
      { ...stateFromRecord(currentRecord, 'REVERTED'), error: 'Transaction reverted onchain.' },
      onStateChange,
    );
    return { state, prepared, reviewChanged: false };
  }

  updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMED');
  state = emit(stateFromRecord(currentRecord, 'CONFIRMED'), onStateChange);
  await onConfirmed?.({ ...currentRecord, status: 'CONFIRMED' });
  return { state, prepared, reviewChanged: false };
}

export async function recoverPersistedTransactions({
  client,
  storage,
  chainId,
  onStateChange,
  onConfirmed,
}: Readonly<{
  client: TradePublicClient;
  storage: Storage;
  chainId: number;
  onStateChange?: (state: TransactionState) => void;
  onConfirmed?: (record: SubmittedTransactionRecord) => Promise<void> | void;
}>): Promise<TransactionState[]> {
  const records = loadRecoverableTransactions(storage).filter((record) => record.chainId === chainId);
  const recovered: TransactionState[] = [];

  for (const originalRecord of records) {
    let currentRecord: SubmittedTransactionRecord = {
      ...originalRecord,
      status: 'CONFIRMING',
    };
    updatePersistedTransactionStatus(storage, originalRecord.hash, 'CONFIRMING');
    let state = emit(stateFromRecord(currentRecord, 'CONFIRMING'), onStateChange);

    let receipt: Awaited<ReturnType<TradePublicClient['waitForTransactionReceipt']>>;
    try {
      receipt = await client.waitForTransactionReceipt({
        hash: currentRecord.hash,
        onReplaced: (replacement) => {
          const nextHash = replacementHash(replacement);
          if (!nextHash || nextHash === currentRecord.hash) return;

          updatePersistedTransactionStatus(storage, currentRecord.hash, 'REPLACED');
          currentRecord = {
            ...currentRecord,
            hash: nextHash,
            status: 'CONFIRMING',
          };
          persistSubmittedTransaction(storage, currentRecord);
          state = emit(stateFromRecord(currentRecord, 'REPLACED'), onStateChange);
        },
      });
    } catch {
      updatePersistedTransactionStatus(storage, currentRecord.hash, 'UNKNOWN');
      state = emit(stateFromRecord(currentRecord, 'UNKNOWN'), onStateChange);
      recovered.push(state);
      continue;
    }

    if (receipt.status === 'reverted') {
      updatePersistedTransactionStatus(storage, currentRecord.hash, 'REVERTED');
      state = emit(
        { ...stateFromRecord(currentRecord, 'REVERTED'), error: 'Transaction reverted onchain.' },
        onStateChange,
      );
      recovered.push(state);
      continue;
    }

    updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMED');
    state = emit(stateFromRecord(currentRecord, 'CONFIRMED'), onStateChange);
    await onConfirmed?.({ ...currentRecord, status: 'CONFIRMED' });
    recovered.push(state);
  }

  return recovered;
}
