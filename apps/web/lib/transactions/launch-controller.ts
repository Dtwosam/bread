import {
  simulatePreparedTransaction,
} from '../../../../packages/protocol-sdk/src/builders';
import {
  prepareCanonicalLaunchReview,
  readLaunchReviewSnapshot,
  type CanonicalLaunchCreatorInput,
  type PreparedCanonicalLaunchReview,
} from '../../../../packages/protocol-sdk/src/launch-review';
import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/context';

import type { TradeWalletAdapter } from './controller';
import { AllowanceConfirmationUnknownError } from './wallet-adapter';
import {
  canSubmitTransactionAction,
  createLaunchTransactionState,
  transitionTransactionState,
  type LaunchAction,
  type SubmittedTransactionRecord,
  type TransactionState,
} from './state';
import {
  persistSubmittedTransaction,
  updatePersistedTransactionStatus,
} from './storage';

type Address = `0x${string}`;
type TransactionHash = `0x${string}`;
type LaunchPublicClient = Parameters<typeof readLaunchReviewSnapshot>[0];

const TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;

export type LaunchLifecycleResult = Readonly<{
  state: TransactionState;
  prepared?: PreparedCanonicalLaunchReview;
  reviewChanged: boolean;
}>;

function emit(
  state: TransactionState,
  onStateChange: ((state: TransactionState) => void) | undefined,
): TransactionState {
  onStateChange?.(state);
  return state;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Launch transaction request failed.';
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

function normalized(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString(10);
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalized(nested)]),
    );
  }
  return value;
}

function preparedFingerprint(prepared: PreparedCanonicalLaunchReview): string {
  return JSON.stringify(normalized({
    review: prepared.review,
    initialBuyReview: prepared.initialBuyReview,
    params: prepared.params,
  }));
}

function preparedMatches(
  approved: PreparedCanonicalLaunchReview,
  current: PreparedCanonicalLaunchReview,
): boolean {
  return preparedFingerprint(approved) === preparedFingerprint(current);
}

function creatorFromApproved(approved: PreparedCanonicalLaunchReview): CanonicalLaunchCreatorInput {
  return {
    name: approved.params.name,
    symbol: approved.params.symbol,
    logo: approved.params.logo,
    description: approved.params.description,
    twitter: approved.params.twitter,
    telegram: approved.params.telegram,
    website: approved.params.website,
    creatorFeeRecipient: approved.params.creatorFeeRecipient,
    creatorTaxBps: approved.params.creatorTaxBps,
  };
}

function actionFor(approved: PreparedCanonicalLaunchReview): LaunchAction {
  return approved.review.initialBuyQuoteIn > BigInt(0) ? 'LAUNCH_AND_BUY' : 'LAUNCH';
}

function slippageFor(approved: PreparedCanonicalLaunchReview): number {
  return approved.initialBuyReview?.slippageBps ?? 0;
}

async function freshPrepared(
  client: LaunchPublicClient,
  context: ProtocolContext,
  approved: PreparedCanonicalLaunchReview,
): Promise<PreparedCanonicalLaunchReview> {
  const snapshot = await readLaunchReviewSnapshot(client, context);
  return prepareCanonicalLaunchReview({
    context,
    snapshot,
    creator: creatorFromApproved(approved),
    initialBuyQuoteIn: approved.review.initialBuyQuoteIn,
    slippageBps: slippageFor(approved),
  });
}

function rejected(
  action: LaunchAction,
  launchIntentId: string,
  error: unknown,
  onStateChange: ((state: TransactionState) => void) | undefined,
): LaunchLifecycleResult {
  const state: TransactionState = {
    action,
    launchIntentId,
    status: 'REJECTED',
    error: errorMessage(error),
  };
  return { state: emit(state, onStateChange), reviewChanged: false };
}

function reverted(
  state: TransactionState,
  error: unknown,
  onStateChange: ((state: TransactionState) => void) | undefined,
): LaunchLifecycleResult {
  const failed: TransactionState = {
    ...state,
    status: 'REVERTED',
    error: errorMessage(error),
  };
  return { state: emit(failed, onStateChange), reviewChanged: false };
}

function unknownAllowance(
  state: TransactionState,
  context: ProtocolContext,
  error: AllowanceConfirmationUnknownError,
  onStateChange: ((state: TransactionState) => void) | undefined,
): LaunchLifecycleResult {
  const unknown: TransactionState = {
    ...state,
    status: 'UNKNOWN',
    chainId: context.chainId,
    hash: error.hash,
    error: error.message,
  };
  return { state: emit(unknown, onStateChange), reviewChanged: false };
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
    status,
    chainId: record.chainId,
    hash: record.hash,
    submittedAt: record.submittedAt,
    ...(record.launchIntentId === undefined ? {} : { launchIntentId: record.launchIntentId }),
    ...(record.tokenAddress === undefined ? {} : { tokenAddress: record.tokenAddress }),
  };
}

function reviewChangedResult(
  action: LaunchAction,
  launchIntentId: string,
  prepared: PreparedCanonicalLaunchReview,
): LaunchLifecycleResult {
  return {
    state: createLaunchTransactionState(action, launchIntentId),
    prepared,
    reviewChanged: true,
  };
}

export async function executeLaunchLifecycle({
  client,
  wallet,
  storage,
  context,
  approved,
  launchIntentId,
  now = () => new Date(),
  onStateChange,
  onConfirmed,
}: Readonly<{
  client: LaunchPublicClient;
  wallet: TradeWalletAdapter;
  storage: Storage;
  context: ProtocolContext;
  approved: PreparedCanonicalLaunchReview;
  launchIntentId: string;
  now?: () => Date;
  onStateChange?: (state: TransactionState) => void;
  onConfirmed?: (record: SubmittedTransactionRecord) => Promise<void> | void;
}>): Promise<LaunchLifecycleResult> {
  const action = actionFor(approved);
  let state = createLaunchTransactionState(action, launchIntentId);
  if (!canSubmitTransactionAction(state)) return { state, reviewChanged: false };

  state = emit(transitionTransactionState(state, { type: 'VALIDATE' }), onStateChange);

  const [account, walletChainId] = await Promise.all([
    wallet.getAccount(),
    wallet.getChainId(),
  ]);
  if (!account) return rejected(action, launchIntentId, new Error('Wallet is not connected.'), onStateChange);
  if (walletChainId !== context.chainId) {
    return rejected(
      action,
      launchIntentId,
      new Error(`Wrong network: wallet is on chain ${walletChainId}, expected ${context.chainId}.`),
      onStateChange,
    );
  }
  if (account.toLowerCase() !== approved.params.creatorFeeRecipient.toLowerCase()) {
    return rejected(
      action,
      launchIntentId,
      new Error('Connected wallet no longer matches the reviewed creator revenue wallet.'),
      onStateChange,
    );
  }

  state = emit(transitionTransactionState(state, { type: 'PREPARE' }), onStateChange);

  let prepared: PreparedCanonicalLaunchReview;
  try {
    prepared = await freshPrepared(client, context, approved);
  } catch (error) {
    return reverted(state, error, onStateChange);
  }
  if (!preparedMatches(approved, prepared)) {
    return reviewChangedResult(action, launchIntentId, prepared);
  }

  try {
    await wallet.ensurePreparedTransactionAllowance(prepared.transaction);
  } catch (error) {
    if (error instanceof AllowanceConfirmationUnknownError) {
      return unknownAllowance(state, context, error, onStateChange);
    }
    if (isWalletUserRejection(error)) return rejected(action, launchIntentId, error, onStateChange);
    return reverted(state, error, onStateChange);
  }

  try {
    prepared = await freshPrepared(client, context, approved);
  } catch (error) {
    return reverted(state, error, onStateChange);
  }
  if (!preparedMatches(approved, prepared)) {
    return reviewChangedResult(action, launchIntentId, prepared);
  }

  try {
    await simulatePreparedTransaction(client, prepared.transaction, account as Address);
  } catch (error) {
    return reverted(state, error, onStateChange);
  }

  state = emit(transitionTransactionState(state, { type: 'AWAIT_SIGNATURE' }), onStateChange);

  let transactionHash: TransactionHash;
  try {
    transactionHash = await wallet.sendPreparedTransaction(prepared.transaction);
  } catch (error) {
    if (isWalletUserRejection(error)) {
      state = emit(
        transitionTransactionState(state, { type: 'REJECT', error: errorMessage(error) }),
        onStateChange,
      );
      return { state, prepared, reviewChanged: false };
    }
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
    launchIntentId,
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

  let receipt: Awaited<ReturnType<LaunchPublicClient['waitForTransactionReceipt']>>;
  try {
    receipt = await client.waitForTransactionReceipt({
      hash: currentRecord.hash,
      onReplaced: (replacement) => {
        const nextHash = replacementHash(replacement);
        if (!nextHash || nextHash === currentRecord.hash) return;
        updatePersistedTransactionStatus(storage, currentRecord.hash, 'REPLACED');
        currentRecord = { ...currentRecord, hash: nextHash, status: 'CONFIRMING' };
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
      { ...stateFromRecord(currentRecord, 'REVERTED'), error: 'Launch transaction reverted onchain.' },
      onStateChange,
    );
    return { state, prepared, reviewChanged: false };
  }

  updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMED');
  state = emit(stateFromRecord(currentRecord, 'CONFIRMED'), onStateChange);
  await onConfirmed?.({ ...currentRecord, status: 'CONFIRMED' });
  return { state, prepared, reviewChanged: false };
}
