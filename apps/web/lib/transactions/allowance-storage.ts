type Address = `0x${string}`;
type TransactionHash = `0x${string}`;

export type AllowanceTransactionStatus = 'SUBMITTED' | 'CONFIRMING' | 'UNKNOWN';

export type AllowanceTransactionRecord = Readonly<{
  chainId: number;
  hash: TransactionHash;
  account: Address;
  token: Address;
  spender: Address;
  amount: string;
  submittedAt: string;
  status: AllowanceTransactionStatus;
}>;

const STORAGE_KEY = 'bread:allowance-transactions:v1';
const MAX_RECORDS = 20;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const AMOUNT = /^\d+$/;

function isRecord(value: unknown): value is AllowanceTransactionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Number.isInteger(record.chainId) &&
    typeof record.hash === 'string' &&
    HASH.test(record.hash) &&
    typeof record.account === 'string' &&
    ADDRESS.test(record.account) &&
    typeof record.token === 'string' &&
    ADDRESS.test(record.token) &&
    typeof record.spender === 'string' &&
    ADDRESS.test(record.spender) &&
    typeof record.amount === 'string' &&
    AMOUNT.test(record.amount) &&
    typeof record.submittedAt === 'string' &&
    !Number.isNaN(Date.parse(record.submittedAt)) &&
    (record.status === 'SUBMITTED' || record.status === 'CONFIRMING' || record.status === 'UNKNOWN')
  );
}

function readAll(storage: Storage): AllowanceTransactionRecord[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function writeAll(storage: Storage, records: readonly AllowanceTransactionRecord[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
}

export function persistAllowanceTransaction(
  storage: Storage,
  record: AllowanceTransactionRecord,
): void {
  const existing = readAll(storage).filter((candidate) => candidate.hash !== record.hash);
  writeAll(storage, [...existing, record]);
}

export function loadRecoverableAllowanceTransactions(
  storage: Storage,
  chainId?: number,
): AllowanceTransactionRecord[] {
  return readAll(storage)
    .filter((record) => chainId === undefined || record.chainId === chainId)
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
}

/**
 * Any unresolved approval on the same account/token/spender lane is a
 * serialization barrier. A changed UI amount must not leapfrog an earlier
 * approval whose onchain outcome is still unknown.
 */
export function findRecoverableAllowanceTransaction(
  storage: Storage,
  input: Readonly<{
    chainId: number;
    account: Address;
    token: Address;
    spender: Address;
  }>,
): AllowanceTransactionRecord | undefined {
  return loadRecoverableAllowanceTransactions(storage, input.chainId).find(
    (record) =>
      record.account.toLowerCase() === input.account.toLowerCase() &&
      record.token.toLowerCase() === input.token.toLowerCase() &&
      record.spender.toLowerCase() === input.spender.toLowerCase(),
  );
}

export function updateAllowanceTransactionStatus(
  storage: Storage,
  hash: TransactionHash,
  status: AllowanceTransactionStatus,
): void {
  writeAll(
    storage,
    readAll(storage).map((record) => (record.hash === hash ? { ...record, status } : record)),
  );
}

export function removeAllowanceTransaction(storage: Storage, hash: TransactionHash): void {
  writeAll(storage, readAll(storage).filter((record) => record.hash !== hash));
}
