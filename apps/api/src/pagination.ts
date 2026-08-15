import { canonicalizeProtocolAddress } from '../../../packages/protocol-sdk/src/index.js';

export const NEW_FEED_CURSOR_VERSION = 1 as const;
export const TRENDING_FEED_CURSOR_VERSION = 1 as const;
export const GRADUATED_FEED_CURSOR_VERSION = 1 as const;
export const TRADE_CURSOR_VERSION = 1 as const;
export const HOLDER_CURSOR_VERSION = 1 as const;
export const PORTFOLIO_CURSOR_VERSION = 1 as const;
export const DEFAULT_FEED_LIMIT = 25 as const;
export const MAX_FEED_LIMIT = 100 as const;
export const DEFAULT_TRADE_LIMIT = DEFAULT_FEED_LIMIT;
export const MAX_TRADE_LIMIT = MAX_FEED_LIMIT;
export const DEFAULT_HOLDER_LIMIT = DEFAULT_FEED_LIMIT;
export const MAX_HOLDER_LIMIT = MAX_FEED_LIMIT;
export const DEFAULT_PORTFOLIO_LIMIT = DEFAULT_FEED_LIMIT;
export const MAX_PORTFOLIO_LIMIT = MAX_FEED_LIMIT;
export const MAX_CURSOR_LENGTH = 512 as const;
const MAX_CURSOR_JSON_LENGTH = 384;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export type NewFeedCursor = Readonly<{
  version: number;
  launchBlockNumber: string;
  launchTimestamp: string;
  launchLogIndex: number;
  tokenAddress: string;
}>;

export type TrendingFeedCursor = Readonly<{
  version: number;
  quoteVolume1h: string;
  uniqueTraders1h: string;
  tradeCount1h: string;
  latestActivityBlockNumber: string;
  latestActivityLogIndex: number;
  tokenAddress: string;
}>;

export type GraduatedFeedCursor = Readonly<{
  version: number;
  graduationCompletedBlock: string;
  graduationCompletedLogIndex: number;
  tokenAddress: string;
}>;

export type TradeCursor = Readonly<{
  version: number;
  blockNumber: string;
  transactionIndex: number;
  logIndex: number;
  transactionHash: string;
}>;

export type HolderCursor = Readonly<{
  version: number;
  balance: string;
  holderAddress: string;
}>;

export type PortfolioCursor = Readonly<{
  version: number;
  tokenAddress: string;
}>;

function encodeAsciiBase64Url(input: string): string {
  let output = '';
  for (let index = 0; index < input.length; index += 3) {
    const a = input.charCodeAt(index);
    const b = index + 1 < input.length ? input.charCodeAt(index + 1) : undefined;
    const c = index + 2 < input.length ? input.charCodeAt(index + 2) : undefined;
    if (a > 0x7f || (b !== undefined && b > 0x7f) || (c !== undefined && c > 0x7f)) {
      throw new Error('cursor payload must be ASCII');
    }
    const word = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    output += BASE64[(word >> 18) & 63];
    output += BASE64[(word >> 12) & 63];
    if (b !== undefined) output += BASE64[(word >> 6) & 63];
    if (c !== undefined) output += BASE64[word & 63];
  }
  return output.replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeAsciiBase64Url(input: string): string {
  if (input.length === 0 || input.length > MAX_CURSOR_LENGTH) throw new Error('cursor length is invalid');
  if (!/^[A-Za-z0-9_-]+$/.test(input) || input.length % 4 === 1) throw new Error('cursor encoding is invalid');
  const canonical = input.replace(/-/g, '+').replace(/_/g, '/');
  let output = '';
  for (let index = 0; index < canonical.length; index += 4) {
    const chars = canonical.slice(index, index + 4);
    const values = [...chars].map((char) => BASE64.indexOf(char));
    if (values.some((value) => value < 0)) throw new Error('cursor encoding is invalid');
    const a = values[0] ?? 0;
    const b = values[1] ?? 0;
    const c = values[2] ?? 0;
    const d = values[3] ?? 0;
    const word = (a << 18) | (b << 12) | (c << 6) | d;
    output += String.fromCharCode((word >> 16) & 0xff);
    if (chars.length >= 3) output += String.fromCharCode((word >> 8) & 0xff);
    if (chars.length >= 4) output += String.fromCharCode(word & 0xff);
    if (output.length > MAX_CURSOR_JSON_LENGTH) throw new Error('cursor payload is too large');
  }
  return output;
}

function exactDecimal(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{1,78}$/.test(value)) throw new Error(`cursor ${label} is invalid`);
  return value;
}

function exactIndex(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`cursor ${label} is invalid`);
  }
  return value;
}

function exactHash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`cursor ${label} is invalid`);
  return value.toLowerCase();
}

function encodeCursorJson(value: Readonly<Record<string, unknown>>): string {
  const json = JSON.stringify(value);
  if (json.length > MAX_CURSOR_JSON_LENGTH) throw new Error('cursor payload is too large');
  const encoded = encodeAsciiBase64Url(json);
  if (encoded.length > MAX_CURSOR_LENGTH) throw new Error('cursor length is invalid');
  return encoded;
}

function parseCursorJson(input: string): Record<string, unknown> {
  const decoded = decodeAsciiBase64Url(input);
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new Error('cursor payload is invalid');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('cursor payload is invalid');
  return parsed as Record<string, unknown>;
}

function normalizeFeedCursor(input: Readonly<Record<string, unknown>>): NewFeedCursor {
  const version = input.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('cursor version is invalid');
  }
  return {
    version,
    launchBlockNumber: exactDecimal(input.launchBlockNumber, 'launchBlockNumber'),
    launchTimestamp: exactDecimal(input.launchTimestamp, 'launchTimestamp'),
    launchLogIndex: exactIndex(input.launchLogIndex, 'launchLogIndex'),
    tokenAddress: canonicalizeProtocolAddress(String(input.tokenAddress ?? '')),
  };
}

export function encodeNewFeedCursor(input: Readonly<Record<string, unknown>>): string {
  const cursor = normalizeFeedCursor(input);
  return encodeCursorJson({
    version: cursor.version,
    launchBlockNumber: cursor.launchBlockNumber,
    launchTimestamp: cursor.launchTimestamp,
    launchLogIndex: cursor.launchLogIndex,
    tokenAddress: cursor.tokenAddress,
  });
}

export function decodeNewFeedCursor(input: string): NewFeedCursor {
  const cursor = normalizeFeedCursor(parseCursorJson(input));
  if (cursor.version !== NEW_FEED_CURSOR_VERSION) throw new Error(`unsupported cursor version: ${cursor.version}`);
  return cursor;
}

function normalizeTrendingFeedCursor(input: Readonly<Record<string, unknown>>): TrendingFeedCursor {
  const version = input.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('cursor version is invalid');
  }
  return {
    version,
    quoteVolume1h: exactDecimal(input.quoteVolume1h, 'quoteVolume1h'),
    uniqueTraders1h: exactDecimal(input.uniqueTraders1h, 'uniqueTraders1h'),
    tradeCount1h: exactDecimal(input.tradeCount1h, 'tradeCount1h'),
    latestActivityBlockNumber: exactDecimal(input.latestActivityBlockNumber, 'latestActivityBlockNumber'),
    latestActivityLogIndex: exactIndex(input.latestActivityLogIndex, 'latestActivityLogIndex'),
    tokenAddress: canonicalizeProtocolAddress(String(input.tokenAddress ?? '')),
  };
}

export function encodeTrendingFeedCursor(input: Readonly<Record<string, unknown>>): string {
  const cursor = normalizeTrendingFeedCursor(input);
  return encodeCursorJson({
    version: cursor.version,
    quoteVolume1h: cursor.quoteVolume1h,
    uniqueTraders1h: cursor.uniqueTraders1h,
    tradeCount1h: cursor.tradeCount1h,
    latestActivityBlockNumber: cursor.latestActivityBlockNumber,
    latestActivityLogIndex: cursor.latestActivityLogIndex,
    tokenAddress: cursor.tokenAddress,
  });
}

export function decodeTrendingFeedCursor(input: string): TrendingFeedCursor {
  const cursor = normalizeTrendingFeedCursor(parseCursorJson(input));
  if (cursor.version !== TRENDING_FEED_CURSOR_VERSION) throw new Error(`unsupported cursor version: ${cursor.version}`);
  return cursor;
}

function normalizeGraduatedFeedCursor(input: Readonly<Record<string, unknown>>): GraduatedFeedCursor {
  const version = input.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('cursor version is invalid');
  }
  return {
    version,
    graduationCompletedBlock: exactDecimal(input.graduationCompletedBlock, 'graduationCompletedBlock'),
    graduationCompletedLogIndex: exactIndex(input.graduationCompletedLogIndex, 'graduationCompletedLogIndex'),
    tokenAddress: canonicalizeProtocolAddress(String(input.tokenAddress ?? '')),
  };
}

export function encodeGraduatedFeedCursor(input: Readonly<Record<string, unknown>>): string {
  const cursor = normalizeGraduatedFeedCursor(input);
  return encodeCursorJson({
    version: cursor.version,
    graduationCompletedBlock: cursor.graduationCompletedBlock,
    graduationCompletedLogIndex: cursor.graduationCompletedLogIndex,
    tokenAddress: cursor.tokenAddress,
  });
}

export function decodeGraduatedFeedCursor(input: string): GraduatedFeedCursor {
  const cursor = normalizeGraduatedFeedCursor(parseCursorJson(input));
  if (cursor.version !== GRADUATED_FEED_CURSOR_VERSION) throw new Error(`unsupported cursor version: ${cursor.version}`);
  return cursor;
}

function normalizeTradeCursor(input: Readonly<Record<string, unknown>>): TradeCursor {
  const version = input.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('cursor version is invalid');
  }
  return {
    version,
    blockNumber: exactDecimal(input.blockNumber, 'blockNumber'),
    transactionIndex: exactIndex(input.transactionIndex, 'transactionIndex'),
    logIndex: exactIndex(input.logIndex, 'logIndex'),
    transactionHash: exactHash(input.transactionHash, 'transactionHash'),
  };
}

export function encodeTradeCursor(input: Readonly<Record<string, unknown>>): string {
  const cursor = normalizeTradeCursor(input);
  return encodeCursorJson({
    version: cursor.version,
    blockNumber: cursor.blockNumber,
    transactionIndex: cursor.transactionIndex,
    logIndex: cursor.logIndex,
    transactionHash: cursor.transactionHash,
  });
}

export function decodeTradeCursor(input: string): TradeCursor {
  const cursor = normalizeTradeCursor(parseCursorJson(input));
  if (cursor.version !== TRADE_CURSOR_VERSION) throw new Error(`unsupported cursor version: ${cursor.version}`);
  return cursor;
}

function normalizeHolderCursor(input: Readonly<Record<string, unknown>>): HolderCursor {
  const version = input.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('cursor version is invalid');
  }
  return {
    version,
    balance: exactDecimal(input.balance, 'balance'),
    holderAddress: canonicalizeProtocolAddress(String(input.holderAddress ?? '')),
  };
}

export function encodeHolderCursor(input: Readonly<Record<string, unknown>>): string {
  const cursor = normalizeHolderCursor(input);
  return encodeCursorJson({ version: cursor.version, balance: cursor.balance, holderAddress: cursor.holderAddress });
}

export function decodeHolderCursor(input: string): HolderCursor {
  const cursor = normalizeHolderCursor(parseCursorJson(input));
  if (cursor.version !== HOLDER_CURSOR_VERSION) throw new Error(`unsupported cursor version: ${cursor.version}`);
  return cursor;
}

function normalizePortfolioCursor(input: Readonly<Record<string, unknown>>): PortfolioCursor {
  const version = input.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('cursor version is invalid');
  }
  return {
    version,
    tokenAddress: canonicalizeProtocolAddress(String(input.tokenAddress ?? '')),
  };
}

export function encodePortfolioCursor(input: Readonly<Record<string, unknown>>): string {
  const cursor = normalizePortfolioCursor(input);
  return encodeCursorJson({ version: cursor.version, tokenAddress: cursor.tokenAddress });
}

export function decodePortfolioCursor(input: string): PortfolioCursor {
  const cursor = normalizePortfolioCursor(parseCursorJson(input));
  if (cursor.version !== PORTFOLIO_CURSOR_VERSION) throw new Error(`unsupported cursor version: ${cursor.version}`);
  return cursor;
}
