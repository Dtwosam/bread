import type { PublicClient } from 'viem';

import {
  prepareRetryGraduation,
  simulatePreparedTransaction,
  type RetryGraduationResult,
} from '../../../../packages/protocol-sdk/src/builders';
import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/context';

import type { TradeWalletAdapter } from './controller';
import {
  createGraduationTransactionState,
  transitionTransactionState,
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
const TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;

export type GraduationRetryReview = RetryGraduationResult;

export type GraduationRetryLifecycleResult = Readonly<{
  state: TransactionState;
  review?: GraduationRetryReview;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Graduation retry transaction request failed.';
}

function emit(
  state: TransactionState,
  onStateChange: ((state: TransactionState) => void) | undefined,
): TransactionState {
  onStateChange?.(state);
  return state;
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
    action: 'GRADUATION',
    status,
    chainId: record.chainId,
    hash: record.hash,
    submittedAt: record.submittedAt,
    ...(record.tokenAddress === undefined ? {} : { tokenAddress: record.tokenAddress }),
  };
}

function rejected(
  tokenAddress: Address,
  error: string,
  onStateChange?: (state: TransactionState) => void,
): GraduationRetryLifecycleResult {
  const state: TransactionState = {
    action: 'GRADUATION',
    tokenAddress,
    status: 'REJECTED',
    error,
  };
  return { state: emit(state, onStateChange) };
}

/**
 * Reads the canonical graduation owner before choosing the next retry step.
 * Indexed state is never accepted as financial authority here.
 */
export async function readGraduationRetryReview(
  client: PublicClient,
  context: ProtocolContext,
  tokenAddress: Address,
): Promise<GraduationRetryReview> {
  return prepareRetryGraduation(client, context, { token: tokenAddress });
}

export async function prepareGraduationRetryForSignature(
  client: PublicClient,
  context: ProtocolContext,
  tokenAddress: Address,
  account: Address,
): Promise<GraduationRetryReview> {
  const review = await readGraduationRetryReview(client, context, tokenAddress);
  if (review.kind === 'TRANSACTION') {
    await simulatePreparedTransaction(client, review.transaction, account);
  }
  return review;
}

/**
 * Permissionless graduation recovery for the source-required failed-auto path.
 * The next action is re-derived from coordinator/factory/curve state immediately
 * before the wallet opens, simulated, persisted after submission, and receipt-
 * confirmed before the caller refreshes indexed state.
 */
export async function executeGraduationRetryLifecycle({
  client,
  wallet,
  storage,
  context,
  tokenAddress,
  now = () => new Date(),
  onStateChange,
  onConfirmed,
}: Readonly<{
  client: PublicClient;
  wallet: TradeWalletAdapter;
  storage?: Storage;
  context: ProtocolContext;
  tokenAddress: Address;
  now?: () => Date;
  onStateChange?: (state: TransactionState) => void;
  onConfirmed?: (record: SubmittedTransactionRecord) => Promise<void> | void;
}>): Promise<GraduationRetryLifecycleResult> {
  let state = createGraduationTransactionState(tokenAddress);
  state = emit(transitionTransactionState(state, { type: 'VALIDATE' }), onStateChange);

  const [account, walletChainId] = await Promise.all([wallet.getAccount(), wallet.getChainId()]);
  if (!account) return rejected(tokenAddress, 'Wallet is not connected.', onStateChange);
  if (walletChainId !== context.chainId) {
    return rejected(
      tokenAddress,
      `Wrong network: wallet is on chain ${walletChainId}, expected ${context.chainId}.`,
      onStateChange,
    );
  }

  state = emit(transitionTransactionState(state, { type: 'PREPARE' }), onStateChange);

  let review: GraduationRetryReview;
  try {
    review = await prepareGraduationRetryForSignature(client, context, tokenAddress, account);
  } catch (error) {
    const failed: TransactionState = {
      ...state,
      status: 'REVERTED',
      error: errorMessage(error),
    };
    return { state: emit(failed, onStateChange) };
  }

  if (review.kind === 'TERMINAL') {
    const confirmed: TransactionState = {
      action: 'GRADUATION',
      tokenAddress,
      status: 'CONFIRMED',
    };
    return { state: emit(confirmed, onStateChange), review };
  }

  state = emit(transitionTransactionState(state, { type: 'AWAIT_SIGNATURE' }), onStateChange);

  let transactionHash: TransactionHash;
  try {
    transactionHash = await wallet.sendPreparedTransaction(review.transaction);
  } catch (error) {
    state = emit(
      transitionTransactionState(state, { type: 'REJECT', error: errorMessage(error) }),
      onStateChange,
    );
    return { state, review };
  }

  let currentRecord: SubmittedTransactionRecord = {
    chainId: context.chainId,
    hash: transactionHash,
    action: 'GRADUATION',
    tokenAddress,
    submittedAt: now().toISOString(),
    status: 'SUBMITTED',
  };
  if (storage) persistSubmittedTransaction(storage, currentRecord);
  state = emit(transitionTransactionState(state, { type: 'SUBMIT', record: currentRecord }), onStateChange);
  state = emit(transitionTransactionState(state, { type: 'CONFIRM' }), onStateChange);
  if (storage) updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMING');
  currentRecord = { ...currentRecord, status: 'CONFIRMING' };

  let receipt: Awaited<ReturnType<PublicClient['waitForTransactionReceipt']>>;
  try {
    receipt = await client.waitForTransactionReceipt({
      hash: currentRecord.hash,
      onReplaced: (replacement) => {
        const nextHash = replacementHash(replacement);
        if (!nextHash || nextHash === currentRecord.hash) return;
        if (storage) updatePersistedTransactionStatus(storage, currentRecord.hash, 'REPLACED');
        currentRecord = { ...currentRecord, hash: nextHash, status: 'CONFIRMING' };
        if (storage) persistSubmittedTransaction(storage, currentRecord);
        state = emit(stateFromRecord(currentRecord, 'REPLACED'), onStateChange);
      },
    });
  } catch {
    if (storage) updatePersistedTransactionStatus(storage, currentRecord.hash, 'UNKNOWN');
    state = emit(stateFromRecord(currentRecord, 'UNKNOWN'), onStateChange);
    return { state, review };
  }

  if (receipt.status === 'reverted') {
    if (storage) updatePersistedTransactionStatus(storage, currentRecord.hash, 'REVERTED');
    state = emit(
      {
        ...stateFromRecord(currentRecord, 'REVERTED'),
        error: 'Graduation retry transaction reverted onchain.',
      },
      onStateChange,
    );
    return { state, review };
  }

  if (storage) updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMED');
  state = emit(stateFromRecord(currentRecord, 'CONFIRMED'), onStateChange);
  await onConfirmed?.({ ...currentRecord, status: 'CONFIRMED' });
  return { state, review };
}

export async function recoverGraduationRetryTransactions({
  client,
  storage,
  chainId,
  tokenAddress,
  onStateChange,
  onConfirmed,
}: Readonly<{
  client: Pick<PublicClient, 'waitForTransactionReceipt'>;
  storage: Storage;
  chainId: number;
  tokenAddress?: Address;
  onStateChange?: (state: TransactionState) => void;
  onConfirmed?: (record: SubmittedTransactionRecord) => Promise<void> | void;
}>): Promise<TransactionState[]> {
  const records = loadRecoverableTransactions(storage, { actions: ['GRADUATION'] })
    .filter((record) => record.chainId === chainId)
    .filter((record) => tokenAddress === undefined || record.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase());
  const recovered: TransactionState[] = [];

  for (const originalRecord of records) {
    let currentRecord: SubmittedTransactionRecord = { ...originalRecord, status: 'CONFIRMING' };
    updatePersistedTransactionStatus(storage, originalRecord.hash, 'CONFIRMING');
    let state = emit(stateFromRecord(currentRecord, 'CONFIRMING'), onStateChange);

    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: currentRecord.hash,
        onReplaced: (replacement: unknown) => {
          const nextHash = replacementHash(replacement);
          if (!nextHash || nextHash === currentRecord.hash) return;
          updatePersistedTransactionStatus(storage, currentRecord.hash, 'REPLACED');
          currentRecord = { ...currentRecord, hash: nextHash, status: 'CONFIRMING' };
          persistSubmittedTransaction(storage, currentRecord);
          state = emit(stateFromRecord(currentRecord, 'REPLACED'), onStateChange);
        },
      } as never);

      if (receipt.status === 'reverted') {
        updatePersistedTransactionStatus(storage, currentRecord.hash, 'REVERTED');
        state = emit(
          {
            ...stateFromRecord(currentRecord, 'REVERTED'),
            error: 'Graduation retry transaction reverted onchain.',
          },
          onStateChange,
        );
        recovered.push(state);
        continue;
      }

      updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMED');
      state = emit(stateFromRecord(currentRecord, 'CONFIRMED'), onStateChange);
      await onConfirmed?.({ ...currentRecord, status: 'CONFIRMED' });
      recovered.push(state);
    } catch {
      updatePersistedTransactionStatus(storage, currentRecord.hash, 'UNKNOWN');
      state = emit(stateFromRecord(currentRecord, 'UNKNOWN'), onStateChange);
      recovered.push(state);
    }
  }

  return recovered;
}
