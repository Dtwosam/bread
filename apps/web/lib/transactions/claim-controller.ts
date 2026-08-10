import type { PublicClient } from 'viem';

import { breadAbiRegistry } from '../../../../packages/protocol-sdk/src/abi/generated';
import {
  prepareClaim,
  simulatePreparedTransaction,
  type PreparedBreadTransaction,
} from '../../../../packages/protocol-sdk/src/builders';
import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/context';

import type { TradeWalletAdapter } from './controller';
import {
  createClaimTransactionState,
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

export type ClaimReview = Readonly<{
  recipient: Address;
  claimableUsdc: bigint;
  transaction: PreparedBreadTransaction | null;
}>;

export type ClaimLifecycleResult = Readonly<{
  state: TransactionState;
  review: ClaimReview;
  reviewChanged: boolean;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Claim transaction request failed.';
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
    action: record.action,
    status,
    chainId: record.chainId,
    hash: record.hash,
    submittedAt: record.submittedAt,
    ...(record.claimRecipient === undefined ? {} : { claimRecipient: record.claimRecipient }),
  };
}

function rejected(
  recipient: Address,
  error: string,
  review: ClaimReview,
  onStateChange?: (state: TransactionState) => void,
): ClaimLifecycleResult {
  const state: TransactionState = {
    action: 'CLAIM',
    claimRecipient: recipient,
    status: 'REJECTED',
    error,
  };
  return { state: emit(state, onStateChange), review, reviewChanged: false };
}

export async function readClaimReview(
  client: Pick<PublicClient, 'readContract'>,
  context: ProtocolContext,
  recipient: Address,
): Promise<ClaimReview> {
  const raw = await client.readContract({
    address: context.addresses.feeEscrow,
    abi: breadAbiRegistry.feeEscrow,
    functionName: 'balanceOf',
    args: [recipient],
  } as never);
  if (typeof raw !== 'bigint' || raw < 0n) throw new Error('FeeEscrow returned an invalid claimable balance.');

  return {
    recipient,
    claimableUsdc: raw,
    transaction: raw === 0n ? null : prepareClaim(context, { amount: raw }),
  };
}

export async function prepareClaimForSignature(
  client: PublicClient,
  context: ProtocolContext,
  approved: ClaimReview,
): Promise<Readonly<{ review: ClaimReview; reviewChanged: boolean }>> {
  const review = await readClaimReview(client, context, approved.recipient);
  if (review.claimableUsdc !== approved.claimableUsdc) {
    return { review, reviewChanged: true };
  }
  if (!review.transaction) throw new Error('There is no USDC available to claim.');
  await simulatePreparedTransaction(client, review.transaction, approved.recipient);
  return { review, reviewChanged: false };
}

export async function executeClaimLifecycle({
  client,
  wallet,
  storage,
  context,
  approved,
  now = () => new Date(),
  onStateChange,
  onConfirmed,
}: Readonly<{
  client: PublicClient;
  wallet: TradeWalletAdapter;
  storage: Storage;
  context: ProtocolContext;
  approved: ClaimReview;
  now?: () => Date;
  onStateChange?: (state: TransactionState) => void;
  onConfirmed?: (record: SubmittedTransactionRecord) => Promise<void> | void;
}>): Promise<ClaimLifecycleResult> {
  let state = createClaimTransactionState(approved.recipient);
  state = emit(transitionTransactionState(state, { type: 'VALIDATE' }), onStateChange);

  const [account, walletChainId] = await Promise.all([wallet.getAccount(), wallet.getChainId()]);
  if (!account) return rejected(approved.recipient, 'Wallet is not connected.', approved, onStateChange);
  if (walletChainId !== context.chainId) {
    return rejected(
      approved.recipient,
      `Wrong network: wallet is on chain ${walletChainId}, expected ${context.chainId}.`,
      approved,
      onStateChange,
    );
  }
  if (account.toLowerCase() !== approved.recipient.toLowerCase()) {
    return rejected(
      approved.recipient,
      'Connected wallet no longer matches the reviewed claim recipient.',
      approved,
      onStateChange,
    );
  }

  state = emit(transitionTransactionState(state, { type: 'PREPARE' }), onStateChange);

  let prepared: Awaited<ReturnType<typeof prepareClaimForSignature>>;
  try {
    prepared = await prepareClaimForSignature(client, context, approved);
  } catch (error) {
    const failed: TransactionState = {
      ...state,
      status: 'REVERTED',
      error: errorMessage(error),
    };
    return { state: emit(failed, onStateChange), review: approved, reviewChanged: false };
  }

  if (prepared.reviewChanged) {
    return {
      state: createClaimTransactionState(approved.recipient),
      review: prepared.review,
      reviewChanged: true,
    };
  }
  if (!prepared.review.transaction) {
    return {
      state: createClaimTransactionState(approved.recipient),
      review: prepared.review,
      reviewChanged: true,
    };
  }

  state = emit(transitionTransactionState(state, { type: 'AWAIT_SIGNATURE' }), onStateChange);

  let transactionHash: TransactionHash;
  try {
    transactionHash = await wallet.sendPreparedTransaction(prepared.review.transaction);
  } catch (error) {
    state = emit(
      transitionTransactionState(state, { type: 'REJECT', error: errorMessage(error) }),
      onStateChange,
    );
    return { state, review: prepared.review, reviewChanged: false };
  }

  let currentRecord: SubmittedTransactionRecord = {
    chainId: context.chainId,
    hash: transactionHash,
    action: 'CLAIM',
    claimRecipient: approved.recipient,
    submittedAt: now().toISOString(),
    status: 'SUBMITTED',
  };
  persistSubmittedTransaction(storage, currentRecord);
  state = emit(transitionTransactionState(state, { type: 'SUBMIT', record: currentRecord }), onStateChange);
  state = emit(transitionTransactionState(state, { type: 'CONFIRM' }), onStateChange);
  updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMING');
  currentRecord = { ...currentRecord, status: 'CONFIRMING' };

  let receipt: Awaited<ReturnType<PublicClient['waitForTransactionReceipt']>>;
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
    return { state, review: prepared.review, reviewChanged: false };
  }

  if (receipt.status === 'reverted') {
    updatePersistedTransactionStatus(storage, currentRecord.hash, 'REVERTED');
    state = emit(
      { ...stateFromRecord(currentRecord, 'REVERTED'), error: 'Claim transaction reverted onchain.' },
      onStateChange,
    );
    return { state, review: prepared.review, reviewChanged: false };
  }

  updatePersistedTransactionStatus(storage, currentRecord.hash, 'CONFIRMED');
  state = emit(stateFromRecord(currentRecord, 'CONFIRMED'), onStateChange);
  await onConfirmed?.({ ...currentRecord, status: 'CONFIRMED' });
  return { state, review: prepared.review, reviewChanged: false };
}

export async function recoverClaimTransactions({
  client,
  storage,
  chainId,
  onStateChange,
  onConfirmed,
}: Readonly<{
  client: Pick<PublicClient, 'waitForTransactionReceipt'>;
  storage: Storage;
  chainId: number;
  onStateChange?: (state: TransactionState) => void;
  onConfirmed?: (record: SubmittedTransactionRecord) => Promise<void> | void;
}>): Promise<TransactionState[]> {
  const records = loadRecoverableTransactions(storage, { actions: ['CLAIM'] })
    .filter((record) => record.chainId === chainId);
  const recovered: TransactionState[] = [];

  for (const originalRecord of records) {
    let currentRecord: SubmittedTransactionRecord = { ...originalRecord, status: 'CONFIRMING' };
    updatePersistedTransactionStatus(storage, originalRecord.hash, 'CONFIRMING');
    let state = emit(stateFromRecord(currentRecord, 'CONFIRMING'), onStateChange);

    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: currentRecord.hash,
        onReplaced: (replacement) => {
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
          { ...stateFromRecord(currentRecord, 'REVERTED'), error: 'Claim transaction reverted onchain.' },
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
