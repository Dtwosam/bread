import { canonicalizeProtocolAddress } from '../../../packages/protocol-sdk/src/index.js';
import type { ExplicitFeedSort } from '../../../packages/db/src/index.js';

const VERSION = 1;
const MAX_CURSOR_LENGTH = 512;

export type ExplicitSortFeedCursor = Readonly<{
  version: number;
  sort: ExplicitFeedSort;
  sortValue: string | null;
  launchTimestamp: string;
  tokenAddress: string;
}>;

function decimal(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{1,78}$/.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

export function encodeExplicitSortFeedCursor(input: Omit<ExplicitSortFeedCursor, 'version'>): string {
  const json = JSON.stringify({ version: VERSION, ...input });
  const encoded = Buffer.from(json, 'utf8').toString('base64url');
  if (encoded.length > MAX_CURSOR_LENGTH) throw new Error('cursor is too large');
  return encoded;
}

export function decodeExplicitSortFeedCursor(input: string, expectedSort: ExplicitFeedSort): ExplicitSortFeedCursor {
  if (input.length === 0 || input.length > MAX_CURSOR_LENGTH || !/^[A-Za-z0-9_-]+$/.test(input)) {
    throw new Error('cursor encoding is invalid');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(input, 'base64url').toString('utf8'));
  } catch {
    throw new Error('cursor payload is invalid');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('cursor payload is invalid');
  const value = parsed as Record<string, unknown>;
  if (value.version !== VERSION || value.sort !== expectedSort) throw new Error('cursor version or sort is invalid');
  if (value.sortValue !== null && (typeof value.sortValue !== 'string' || !/^\d{1,78}$/.test(value.sortValue))) {
    throw new Error('cursor sort value is invalid');
  }
  return {
    version: VERSION,
    sort: expectedSort,
    sortValue: value.sortValue as string | null,
    launchTimestamp: decimal(value.launchTimestamp, 'cursor launch timestamp'),
    tokenAddress: canonicalizeProtocolAddress(String(value.tokenAddress ?? '')),
  };
}
