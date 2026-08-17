import type {
  ApiError,
  FreshnessMeta,
  FreshnessStatus,
  IndexedResponse,
} from '../../../../packages/types/src/index';

const MAX_FEED_LIMIT = 100;
const MAX_SEARCH_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;
const MAX_CURSOR_LENGTH = 512;
const MAX_SEARCH_TERM_LENGTH = 256;
const FEED_VIEWS = new Set(['new', 'trending', 'graduating', 'graduated']);
const FEED_AGES = new Set(['lt5m', 'lt1h', '1h-24h', '1d-7d']);
const ADDRESS_LIKE = /^0x/i;
const ADDRESS_SHAPE = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL_INTEGER = /^\d+$/;
const EXACT_QUOTE_INTEGER = /^\d{1,78}$/;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type FeedView = 'new' | 'trending' | 'graduating' | 'graduated';
export type FeedAge = 'lt5m' | 'lt1h' | '1h-24h' | '1d-7d';

export type FeedParams = Readonly<{
  view?: FeedView;
  age?: FeedAge;
  holdersMin?: string;
  holdersMax?: string;
  progressMinBps?: string;
  progressMaxBps?: string;
  creator?: string;
  volumeMinQuote?: string;
  volumeMaxQuote?: string;
  limit?: number;
  cursor?: string;
}>;

export type SearchParams = Readonly<{
  q: string;
  limit?: number;
}>;

export type CursorParams = Readonly<{
  limit?: number;
  cursor?: string;
}>;

export type BreadApiClientOptions = Readonly<{
  baseUrl?: string;
  fetchImpl?: FetchLike;
}>;

export class BreadApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details?: ApiError['error']['details'];

  constructor(status: number, error: ApiError['error']) {
    super(error.message);
    this.name = 'BreadApiRequestError';
    this.status = status;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
  }
}

function assertIntegerInRange(value: number | undefined, label: string, maximum: number): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${label} must be an integer from 1 to ${maximum}.`);
  }
}

function assertCursor(cursor: string | undefined): void {
  if (cursor === undefined) return;
  if (cursor.length < 1 || cursor.length > MAX_CURSOR_LENGTH) {
    throw new RangeError(`cursor must be from 1 to ${MAX_CURSOR_LENGTH} characters.`);
  }
}

function parseBps(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!DECIMAL_INTEGER.test(value)) {
    throw new RangeError(`${label} must be an integer from 0 to 10000.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new RangeError(`${label} must be an integer from 0 to 10000.`);
  }
  return parsed;
}

function canonicalInteger(value: string): string {
  return value.replace(/^0+(?=\d)/, '');
}

function compareCanonicalIntegers(left: string, right: string): number {
  const a = canonicalInteger(left);
  const b = canonicalInteger(right);
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function assertExactQuoteBounds(
  min: string | undefined,
  max: string | undefined,
  minLabel: string,
  maxLabel: string,
): void {
  if (min !== undefined && !EXACT_QUOTE_INTEGER.test(min)) {
    throw new RangeError(`${minLabel} must be a non-negative integer quote amount.`);
  }
  if (max !== undefined && !EXACT_QUOTE_INTEGER.test(max)) {
    throw new RangeError(`${maxLabel} must be a non-negative integer quote amount.`);
  }
  if (min !== undefined && max !== undefined && compareCanonicalIntegers(min, max) > 0) {
    throw new RangeError(`${minLabel} must not exceed ${maxLabel}.`);
  }
}

function assertFeedParams(params: FeedParams): void {
  if (params.view !== undefined && !FEED_VIEWS.has(params.view)) {
    throw new RangeError('feed view is not supported.');
  }
  if (params.age !== undefined && !FEED_AGES.has(params.age)) {
    throw new RangeError('feed age is not supported.');
  }
  const progressMin = parseBps(params.progressMinBps, 'progressMinBps');
  const progressMax = parseBps(params.progressMaxBps, 'progressMaxBps');
  if (progressMin !== undefined && progressMax !== undefined && progressMin > progressMax) {
    throw new RangeError('progressMinBps must not exceed progressMaxBps.');
  }
  if (params.creator !== undefined && !ADDRESS_SHAPE.test(params.creator)) {
    throw new RangeError('creator must be a valid address.');
  }
  assertExactQuoteBounds(params.volumeMinQuote, params.volumeMaxQuote, 'volumeMinQuote', 'volumeMaxQuote');
  assertIntegerInRange(params.limit, 'limit', MAX_FEED_LIMIT);
  assertCursor(params.cursor);
}

function assertSearchParams(params: SearchParams): void {
  const query = params.q.trim();
  if (query.length < 1 || query.length > MAX_SEARCH_TERM_LENGTH) {
    throw new RangeError(`search query must be from 1 to ${MAX_SEARCH_TERM_LENGTH} characters.`);
  }
  if (ADDRESS_LIKE.test(query) && !ADDRESS_SHAPE.test(query)) {
    throw new RangeError('address-like search query is malformed.');
  }
  if (!ADDRESS_LIKE.test(query) && query.length < 2) {
    throw new RangeError('text search requires at least two characters.');
  }
  assertIntegerInRange(params.limit, 'limit', MAX_SEARCH_LIMIT);
}

function assertCursorParams(params: CursorParams): void {
  assertIntegerInRange(params.limit, 'limit', MAX_PAGE_LIMIT);
  assertCursor(params.cursor);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isApiError(value: unknown): value is ApiError {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  return typeof value.error.code === 'string' && typeof value.error.message === 'string' && typeof value.error.requestId === 'string';
}

function isIndexedResponse(value: unknown): value is IndexedResponse<unknown> {
  if (!isRecord(value) || !('data' in value) || !isRecord(value.meta)) return false;
  return (
    typeof value.meta.chainId === 'number' &&
    typeof value.meta.schemaVersion === 'string' &&
    typeof value.meta.indexedThroughBlock === 'string' &&
    typeof value.meta.indexedThroughBlockHash === 'string' &&
    typeof value.meta.indexedThroughBlockTimestamp === 'string' &&
    typeof value.meta.servedAt === 'string' &&
    value.meta.source === 'bread-indexer' &&
    ['FRESH', 'LAGGING', 'REBUILDING', 'DEGRADED'].includes(String(value.meta.status))
  );
}

function buildUrl(baseUrl: string, path: string, params?: URLSearchParams): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const query = params && params.size > 0 ? `?${params.toString()}` : '';
  return `${base}${path}${query}`;
}

function addOptional(params: URLSearchParams, name: string, value: string | number | undefined): void {
  if (value !== undefined) params.set(name, String(value));
}

async function decodeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function classifyFreshness(meta: FreshnessMeta): FreshnessStatus {
  return meta.status;
}

export function createBreadApiClient(options: BreadApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(path: string, params?: URLSearchParams): Promise<IndexedResponse<T>> {
    const response = await fetchImpl(buildUrl(baseUrl, path, params), {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const body = await decodeJson(response);
    if (!response.ok) {
      if (isApiError(body)) throw new BreadApiRequestError(response.status, body.error);
      throw new BreadApiRequestError(response.status, {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'Bread API request failed.',
        requestId: response.headers.get('x-request-id') ?? 'unknown',
      });
    }
    if (!isIndexedResponse(body)) throw new Error('Bread API returned an invalid indexed response envelope.');
    return body as IndexedResponse<T>;
  }

  return {
    async getFeed<T = unknown>(input: FeedParams = {}): Promise<IndexedResponse<T>> {
      assertFeedParams(input);
      const params = new URLSearchParams();
      addOptional(params, 'view', input.view);
      addOptional(params, 'age', input.age);
      addOptional(params, 'holdersMin', input.holdersMin);
      addOptional(params, 'holdersMax', input.holdersMax);
      addOptional(params, 'progressMinBps', input.progressMinBps);
      addOptional(params, 'progressMaxBps', input.progressMaxBps);
      addOptional(params, 'creator', input.creator);
      addOptional(params, 'volumeMinQuote', input.volumeMinQuote);
      addOptional(params, 'volumeMaxQuote', input.volumeMaxQuote);
      addOptional(params, 'limit', input.limit);
      addOptional(params, 'cursor', input.cursor);
      return request<T>('/v1/feed', params);
    },

    async search<T = unknown>(input: SearchParams): Promise<IndexedResponse<T>> {
      assertSearchParams(input);
      const params = new URLSearchParams();
      params.set('q', input.q.trim());
      addOptional(params, 'limit', input.limit);
      return request<T>('/v1/search', params);
    },

    async getActivity<T = unknown>(limit = 50): Promise<IndexedResponse<T>> {
      assertIntegerInRange(limit, 'limit', MAX_PAGE_LIMIT);
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      return request<T>('/v1/activity', params);
    },

    async getStats<T = unknown>(): Promise<IndexedResponse<T>> {
      return request<T>('/v1/stats');
    },

    async getToken<T = unknown>(address: string): Promise<IndexedResponse<T>> {
      return request<T>(`/v1/tokens/${encodeURIComponent(address)}`);
    },

    async getTrades<T = unknown>(address: string, input: CursorParams = {}): Promise<IndexedResponse<T>> {
      assertCursorParams(input);
      const params = new URLSearchParams();
      addOptional(params, 'limit', input.limit);
      addOptional(params, 'cursor', input.cursor);
      return request<T>(`/v1/tokens/${encodeURIComponent(address)}/trades`, params);
    },

    async getHolders<T = unknown>(address: string, input: CursorParams = {}): Promise<IndexedResponse<T>> {
      assertCursorParams(input);
      const params = new URLSearchParams();
      addOptional(params, 'limit', input.limit);
      addOptional(params, 'cursor', input.cursor);
      return request<T>(`/v1/tokens/${encodeURIComponent(address)}/holders`, params);
    },

    async getPortfolio<T = unknown>(address: string, input: CursorParams = {}): Promise<IndexedResponse<T>> {
      assertCursorParams(input);
      const params = new URLSearchParams();
      addOptional(params, 'limit', input.limit);
      addOptional(params, 'cursor', input.cursor);
      return request<T>(`/v1/portfolio/${encodeURIComponent(address)}`, params);
    },

    async getCreator<T = unknown>(address: string): Promise<IndexedResponse<T>> {
      return request<T>(`/v1/creators/${encodeURIComponent(address)}`);
    },

    async getStatus<T = unknown>(): Promise<IndexedResponse<T>> {
      return request<T>('/v1/status');
    },
  } as const;
}

export type BreadApiClient = ReturnType<typeof createBreadApiClient>;