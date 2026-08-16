import type { FastifyInstance } from 'fastify';

import { canonicalizeProtocolAddress } from '../../../../packages/protocol-sdk/src/index.js';
import type { SearchRepository } from '../../../../packages/db/src/index.js';
import type { FreshnessMeta } from '../../../../packages/types/src/index.js';
import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/index.js';

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const MAX_SEARCH_TERM_LENGTH = 256;
const ADDRESS_SHAPE = /^0x[0-9a-fA-F]{40}$/;
const ADDRESS_LIKE = /^0x/i;

export type SearchRateLimitResult = 'ALLOWED' | 'LIMITED' | 'UNAVAILABLE';

function ageSecondsAtIndexedHead(
  launchTimestamp: string | null,
  indexedThroughBlockTimestamp: string,
): string | null {
  if (launchTimestamp === null) return null;
  const launch = BigInt(launchTimestamp);
  const indexedHead = BigInt(indexedThroughBlockTimestamp);
  return indexedHead > launch ? (indexedHead - launch).toString(10) : '0';
}

export function registerSearchRoute(app: FastifyInstance, deps: Readonly<{
  repository: SearchRepository;
  context: ProtocolContext;
  freshness: () => Promise<FreshnessMeta>;
  rateLimit: (subject: string) => Promise<SearchRateLimitResult>;
}>): void {
  app.get('/v1/search', async (request, reply) => {
    const query = request.query as { q?: string; limit?: string };
    const raw = (query.q ?? '').trim();
    if (raw.length === 0 || raw.length > MAX_SEARCH_TERM_LENGTH) {
      return reply.code(400).send({
        error: { code: 'INVALID_SEARCH_QUERY', message: 'Search query is empty or exceeds the bounded length.', requestId: request.id },
      });
    }

    const parsedLimit = query.limit === undefined ? DEFAULT_SEARCH_LIMIT : Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_SEARCH_LIMIT) {
      return reply.code(400).send({
        error: { code: 'INVALID_LIMIT', message: `Limit must be an integer from 1 to ${MAX_SEARCH_LIMIT}.`, requestId: request.id },
      });
    }

    let kind: 'ADDRESS' | 'TEXT';
    let normalized: string;
    if (ADDRESS_LIKE.test(raw)) {
      if (!ADDRESS_SHAPE.test(raw)) {
        return reply.code(400).send({
          error: { code: 'INVALID_SEARCH_QUERY', message: 'Address-like search query is malformed.', requestId: request.id },
        });
      }
      try {
        normalized = canonicalizeProtocolAddress(raw);
      } catch {
        return reply.code(400).send({
          error: { code: 'INVALID_SEARCH_QUERY', message: 'Address-like search query is malformed.', requestId: request.id },
        });
      }
      kind = 'ADDRESS';
    } else {
      normalized = raw.toLowerCase();
      if (normalized.length < 2) {
        return reply.code(400).send({
          error: { code: 'SEARCH_QUERY_TOO_SHORT', message: 'Text search requires at least two characters.', requestId: request.id },
        });
      }
      kind = 'TEXT';
    }

    const limitState = await deps.rateLimit(request.ip);
    if (limitState === 'UNAVAILABLE') {
      return reply.code(503).send({
        error: {
          code: 'SEARCH_LIMITER_UNAVAILABLE',
          message: 'Search protection is temporarily unavailable.',
          requestId: request.id,
        },
      });
    }
    if (limitState === 'LIMITED') {
      return reply.code(429).send({
        error: { code: 'SEARCH_RATE_LIMITED', message: 'Search request rate limit exceeded.', requestId: request.id },
      });
    }

    const rows = await deps.repository.searchLaunches({
      chainId: deps.context.chainId,
      stackVersion: deps.context.stackVersion,
      factoryAddress: deps.context.factoryAddress,
      query: normalized,
      kind,
      limit: parsedLimit,
    });
    const meta = await deps.freshness();
    return {
      data: rows.map((row) => ({
        tokenAddress: row.tokenAddress,
        curveAddress: row.curveAddress,
        deployerAddress: row.deployerAddress,
        creatorFeeRecipient: row.creatorFeeRecipient,
        name: row.name,
        symbol: row.symbol,
        matchKind: row.matchKind,
        ageSeconds: ageSecondsAtIndexedHead(row.launchTimestamp, meta.indexedThroughBlockTimestamp),
        holderCount: row.holderCount,
      })),
      meta,
    };
  });
}
