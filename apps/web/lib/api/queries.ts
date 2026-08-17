import type { CursorParams, FeedParams, SearchParams } from './client';

const normalizeAddress = (address: string) => address.toLowerCase();
const normalizeCursor = (cursor: string | undefined) => cursor ?? '';

export const breadQueryKeys = {
  all: ['bread'] as const,

  feed(input: FeedParams = {}) {
    return [
      'bread',
      'feed',
      input.view ?? 'new',
      input.sort ?? 'default',
      input.lifecycle ?? '',
      input.age ?? 'any',
      input.holdersMin ?? '',
      input.holdersMax ?? '',
      input.progressMinBps ?? '',
      input.progressMaxBps ?? '',
      input.creator === undefined ? '' : normalizeAddress(input.creator),
      input.volumeMinQuote ?? '',
      input.volumeMaxQuote ?? '',
      input.marketCapMinQuote ?? '',
      input.marketCapMaxQuote ?? '',
      input.limit ?? 25,
      normalizeCursor(input.cursor),
    ] as const;
  },

  search(input: SearchParams) {
    return ['bread', 'search', input.q.trim().toLowerCase(), input.limit ?? 10] as const;
  },

  activity(limit = 50) {
    return ['bread', 'activity', limit] as const;
  },

  stats() {
    return ['bread', 'stats'] as const;
  },

  token(address: string) {
    return ['bread', 'token', normalizeAddress(address)] as const;
  },

  trades(address: string, input: CursorParams = {}) {
    return ['bread', 'token', normalizeAddress(address), 'trades', input.limit ?? 25, normalizeCursor(input.cursor)] as const;
  },

  holders(address: string, input: CursorParams = {}) {
    return ['bread', 'token', normalizeAddress(address), 'holders', input.limit ?? 25, normalizeCursor(input.cursor)] as const;
  },

  portfolio(address: string, input: CursorParams = {}) {
    return ['bread', 'portfolio', normalizeAddress(address), input.limit ?? 25, normalizeCursor(input.cursor)] as const;
  },

  creator(address: string) {
    return ['bread', 'creator', normalizeAddress(address)] as const;
  },

  status() {
    return ['bread', 'status'] as const;
  },
} as const;
