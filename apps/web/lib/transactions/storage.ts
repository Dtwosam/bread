import type { SubmittedTransactionRecord } from './state.js';

const STORAGE_KEY = 'bread:submitted-transactions:v1';
const MAX_RECORDS = 20;
const RECOVERABLE = new Set<SubmittedTransactionRecord['status']>(['SUBMITTED', 'CONFIRMING', 'UNKNOWN']);
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function isRecord(value: unknown): value is SubmittedTransactionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Number.isInteger(record.chainId) &&
    typeof record.hash === 'string' &&
    HASH.test(record.hash) &&
    (record.action === 'BUY' || record.action === 'SELL') &&
    typeof record.tokenAddress === 'string' &&
    ADDRESS.test(record.tokenAddress) &&
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

export function loadRecoverableTransactions(storage: Storage): SubmittedTransactionRecord[] {
  return readAll(storage)
    .filter((record) => RECOVERABLE.has(record.status))
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
