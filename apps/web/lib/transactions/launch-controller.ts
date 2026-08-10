import { simulatePreparedTransaction } from '../../../../packages/protocol-sdk/src/builders';
import {
  createBreadStackAbiBinding,
  decodeBreadLog,
} from '../../../../packages/protocol-sdk/src/events';
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
  loadRecoverableTransactions,
  persistSubmittedTransaction,
  updatePersistedTransactionStatus,
} from './storage';

type Address = `0x${string}`;
type TransactionHash = `0x${string}`;
type Hex = `0x${string}`;
type LaunchPublicClient = Parameters<typeof readLaunchReviewSnapshot>[0];

const TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type LaunchLifecycleResult = Readonly<{
  state: TransactionState;
  prepared?: PreparedCanonicalLaunchReview;
  reviewChanged: boolean;
  tokenAddress?: Address;
}>;

export type LaunchRecoveryResult = Readonly<{
  state: TransactionState;
  tokenAddress?: Address;
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
    ) return true;
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
    slippageBps: approved.initialBuyReview?.slippageBps ?? 0,
  });
}

function preparedMatches(
  approved: PreparedCanonicalLaunchReview,
  current: PreparedCanonicalLaunchReview,
): boolean {
  return preparedFingerprint(approved) === preparedFingerprint(current);
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

function rejected(
  action: LaunchAction,
  launchIntentId: string,
  error: unknown,
  onStateChange?: (state: TransactionState) => void,
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
  onStateChange?: (state: TransactionState) => void,
): LaunchLifecycleResult {
  const failed: TransactionState = { ...state, status: 'REVERTED', error: errorMessage(error) };
  return { state: emit(failed, onStateChange), reviewChanged: false };
}

function reviewChanged(
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

function replacementHash(value: unknown): TransactionHash | null {
  if (!value || typeof value !== 'object') return null;
  const transaction = (value as { transaction?: unknown }).transaction;
  if (!transaction || typeof transaction !== 'object') return null;
  const hash = (transaction as { hash?: unknown }).hash;
  return typeof hash === 'string' && TRANSACTION_HASH.test(hash) ? hash as TransactionHash : null;
}

function canonicalAddress(value: unknown): Address | null {
  return typeof value === 'string' && ADDRESS.test(value) ? value as Address : null;
}

function decodedLaunchCreatedToken(log: unknown, context: ProtocolContext): Address | null {
  if (!log || typeof log !== 'object') return null;
  const candidate = log as Record<string, unknown>;
  const logAddress = canonicalAddress(candidate.address);
  if (!logAddress || logAddress.toLowerCase() !== context.addresses.factory.toLowerCase()) return null;

  if (candidate.eventName === 'LaunchCreated' && candidate.args && typeof candidate.args === 'object') {
    return canonicalAddress((candidate.args as Record<string, unknown>).token);
  }

  if (
    !Array.isArray(candidate.topics) ||
    candidate.topics.length === 0 ||
    !candidate.topics.every((topic) => typeof topic === 'string') ||
    typeof candidate.data !== 'string' ||
    !candidate.data.startsWith('0x')
  ) return null;

  try {
    const decoded = decodeBreadLog({
      binding: createBreadStackAbiBinding(context.stackVersion),
      stackVersion: context.stackVersion,
      role: 'FACTORY',
      topics: candidate.topics as [Hex, ...Hex[]],
      data: candidate.data as Hex,
    });
    if (decoded.eventName !== 'LaunchCreated' || decoded.disposition !== 'INDEXED_CANONICAL') return null;
    return canonicalAddress(decoded.args.token);
  } catch {
    return null;
  }
}

export function extractLaunchCreatedToken(
  receipt: Readonly<{ logs?: readonly unknown[] }>,
  context: ProtocolContext,
): Address {
  for (const log of receipt.logs ?? []) {
    const token = decodedLaunchCreatedToken(log, context);
    if (token) return token;
  }
  throw new Error('Canonical Factory LaunchCreated log is missing from the confirmed launch receipt.');
}

function confirmedRecord(
  record: SubmittedTransactionRecord,
  tokenAddress: Address,
): SubmittedTransactionRecord {
  return { ...record, tokenAddress, status: 'CONFIRMED' };
}

function identityUnknown(
  record: SubmittedTransactionRecord,
  error: unknown,
): TransactionState {
  return { ...stateFromRecord(record, 'UNKNOWN'), error: errorMessage(error) };
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
  const [account, walletChainId] = await Promise.all([wallet.getAccount(), wallet.getChainId()]);
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
  if (!preparedMatches(approved, prepared)) return reviewChanged(action, launchIntentId, prepared);

  try {
    await wallet.ensurePreparedTransactionAllowance(prepared.transaction);
  } catch (error) {
    if (error instanceof AllowanceConfirmationUnknownError) {
      const unknown: TransactionState = {
        ...state,
        status: 'UNKNOWN',
        chainId: context.chainId,
        hash: error.hash,
        error: error.message,
      };
      return { state: emit(unknown, onStateChange), reviewChanged: false };
    }
    if (isWalletUserRejection(error)) return rejected(action, launchIntentId, error, onStateChange);
    return reverted(state, error, onStateChange);
  }

  try {
    prepared = await freshPrepared(client, context, approved);
  } catch (error) {
    return reverted(state, error, onStateChange);
  }
  if (!preparedMatches(approved, prepared)) return reviewChanged(action, launchIntentId, prepared);

  try {
    await simulatePreparedTransaction(client, prepared.transaction, account);
  } catch (error) {
    return reverted(state, error, onStateChange);
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
    launchIntentId,
    submittedAt: now().toISOString(),
    status: 'SUBMITTED',
  };
  persistSubmittedTransaction(storage, currentRecord);
  state = emit(transitionTransactionState(state, { type: 'SUBMIT', record: currentRecord }), onStateChange);
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

  let tokenAddress: Address;
  try {
    tokenAddress = extractLaunchCreatedToken(receipt as unknown as { logs?: readonly unknown[] }, context);
  } catch (error) {
    updatePersistedTransactionStatus(storage, currentRecord.hash, 'UNKNOWN');
    state = emit(identityUnknown(currentRecord, error), onStateChange);
    return { state, prepared, reviewChanged: false };
  }

  const completed = confirmedRecord(currentRecord, tokenAddress);
  updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMED');
  state = emit(stateFromRecord(completed, 'CONFIRMED'), onStateChange);
  await onConfirmed?.(completed);
  return { state, prepared, reviewChanged: false, tokenAddress };
}

export async function recoverLaunchTransactions({
  client,
  storage,
  context,
  onStateChange,
  onConfirmed,
}: Readonly<{
  client: Pick<LaunchPublicClient, 'waitForTransactionReceipt'>;
  storage: Storage;
  context: ProtocolContext;
  onStateChange?: (state: TransactionState) => void;
  onConfirmed?: (record: SubmittedTransactionRecord) => Promise<void> | void;
}>): Promise<LaunchRecoveryResult[]> {
  const records = loadRecoverableTransactions(storage, { actions: ['LAUNCH', 'LAUNCH_AND_BUY'] })
    .filter((record) => record.chainId === context.chainId);
  const recovered: LaunchRecoveryResult[] = [];

  for (const originalRecord of records) {
    let currentRecord: SubmittedTransactionRecord = { ...originalRecord, status: 'CONFIRMING' };
    updatePersistedTransactionStatus(storage, originalRecord.hash, 'CONFIRMING');
    let state = emit(stateFromRecord(currentRecord, 'CONFIRMING'), onStateChange);

    const onReplaced = (replacement: unknown) => {
      const nextHash = replacementHash(replacement);
      if (!nextHash || nextHash === currentRecord.hash) return;
      updatePersistedTransactionStatus(storage, currentRecord.hash, 'REPLACED');
      currentRecord = { ...currentRecord, hash: nextHash, status: 'CONFIRMING' };
      persistSubmittedTransaction(storage, currentRecord);
      state = emit(stateFromRecord(currentRecord, 'REPLACED'), onStateChange);
    };

    let receipt: Awaited<ReturnType<LaunchPublicClient['waitForTransactionReceipt']>>;
    try {
      receipt = await client.waitForTransactionReceipt({ hash: currentRecord.hash, onReplaced } as never);
    } catch {
      updatePersistedTransactionStatus(storage, currentRecord.hash, 'UNKNOWN');
      state = emit(stateFromRecord(currentRecord, 'UNKNOWN'), onStateChange);
      recovered.push({ state });
      continue;
    }

    if (receipt.status === 'reverted') {
      updatePersistedTransactionStatus(storage, currentRecord.hash, 'REVERTED');
      state = emit(
        { ...stateFromRecord(currentRecord, 'REVERTED'), error: 'Launch transaction reverted onchain.' },
        onStateChange,
      );
      recovered.push({ state });
      continue;
    }

    let tokenAddress: Address;
    try {
      tokenAddress = extractLaunchCreatedToken(receipt as unknown as { logs?: readonly unknown[] }, context);
    } catch (error) {
      updatePersistedTransactionStatus(storage, currentRecord.hash, 'UNKNOWN');
      state = emit(identityUnknown(currentRecord, error), onStateChange);
      recovered.push({ state });
      continue;
    }

    const completed = confirmedRecord(currentRecord, tokenAddress);
    updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMED');
    state = emit(stateFromRecord(completed, 'CONFIRMED'), onStateChange);
    await onConfirmed?.(completed);
    recovered.push({ state, tokenAddress });
  }

  return recovered;
}
