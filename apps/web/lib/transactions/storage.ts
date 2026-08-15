import type { SubmittedTransactionRecord, TransactionAction } from './state.js';

const STORAGE_KEY = 'bread:submitted-transactions:v1';
const MAX_RECORDS = 20;
const RECOVERABLE = new Set<SubmittedTransactionRecord['status']>(['SUBMITTED', 'CONFIRMING', 'UNKNOWN']);
const DEFAULT_TRADE_ACTIONS: readonly TransactionAction[] = ['BUY', 'SELL'];
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function isTradeAction(action: unknown): action is Extract<TransactionAction, 'BUY' | 'SELL'> {
  return action === 'BUY' || action === 'SELL';
}

function isLaunchAction(action: unknown): action is Extract<TransactionAction, 'LAUNCH' | 'LAUNCH_AND_BUY'> {
  return action === 'LAUNCH' || action === 'LAUNCH_AND_BUY';
}

function isClaimAction(action: unknown): action is Extract<TransactionAction, 'CLAIM'> {
  return action === 'CLAIM';
}

function isGraduationAction(action: unknown): action is Extract<TransactionAction, 'GRADUATION'> {
  return action === 'GRADUATION';
}

function hasValidSubject(record: Record<string, unknown>): boolean {
  if (isTradeAction(record.action) || isGraduationAction(record.action)) {
    return typeof record.tokenAddress === 'string' && ADDRESS.test(record.tokenAddress);
  }
  if (isLaunchAction(record.action)) {
    return typeof record.launchIntentId === 'string' && record.launchIntentId.trim().length > 0;
  }
  if (isClaimAction(record.action)) {
    return typeof record.claimRecipient === 'string' && ADDRESS.test(record.claimRecipient);
  }
  return false;
}

function isRecord(value: unknown): value is SubmittedTransactionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Number.isInteger(record.chainId) &&
    typeof record.hash === 'string' &&
    HASH.test(record.hash) &&
    (isTradeAction(record.action) || isLaunchAction(record.action) || isClaimAction(record.action) || isGraduationAction(record.action)) &&
    hasValidSubject(record) &&
    typeof record.submittedAt === 'string' &&
    !Number.isNaN(Date.parse(record.submittedAt)) &&
    typeof record.status === 'string'
  );
}

function readAll(storage: Storage): SubmittedTransactionRecord[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

function writeAll(storage: Storage, records: readonly SubmittedTransactionRecord[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
}

export function persistSubmittedTransaction(
  storage: Storage,
  record: SubmittedTransactionRecord,
): void {
  const existing = readAll(storage).filter((candidate) => candidate.hash !== record.hash);
  writeAll(storage, [...existing, record]);
}

/**
 * Trade recovery remains the default for the existing global Task-5 provider.
 * New transaction surfaces must request their action ownership explicitly so
 * one recovery consumer cannot accidentally claim another surface's records.
 */
export function loadRecoverableTransactions(
  storage: Storage,
  options?: Readonly<{ actions?: readonly TransactionAction[] }>,
): SubmittedTransactionRecord[] {
  const actions = new Set(options?.actions ?? DEFAULT_TRADE_ACTIONS);
  return readAll(storage)
    .filter((record) => RECOVERABLE.has(record.status))
    .filter((record) => actions.has(record.action))
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
}

export function updatePersistedTransactionStatus(
  storage: Storage,
  hash: `0x${string}`,
  status: SubmittedTransactionRecord['status'],
): void {
  const records = readAll(storage).map((record) =>
    record.hash === hash ? { ...record, status } : record,
  );
  writeAll(storage, records);
}
