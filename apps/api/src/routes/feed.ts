import type { FastifyInstance } from 'fastify';

import {
  decodeNewFeedCursor,
  DEFAULT_FEED_LIMIT,
  encodeNewFeedCursor,
  MAX_FEED_LIMIT,
  NEW_FEED_CURSOR_VERSION,
} from '../pagination.js';
import { serializeLaunch } from './token.js';
import type { BreadReadRouteDeps } from './types.js';

const SOURCE_VIEWS = new Set(['new', 'trending', 'graduating', 'graduated']);

export function registerFeedRoute(app: FastifyInstance, deps: BreadReadRouteDeps): void {
  app.get('/v1/feed', async (request, reply) => {
    const query = request.query as { view?: string; limit?: string; cursor?: string };
    const view = query.view ?? 'new';
    if (!SOURCE_VIEWS.has(view)) {
      return reply.code(400).send({
        error: { code: 'INVALID_FEED_VIEW', message: 'Feed view is not supported.', requestId: request.id },
      });
    }
    if (view !== 'new') {
      return reply.code(503).send({
        error: {
          code: 'FEED_VIEW_NOT_READY',
          message: 'This deterministic feed projection is not available yet.',
          requestId: request.id,
        },
      });
    }

    const parsedLimit = query.limit === undefined ? DEFAULT_FEED_LIMIT : Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_FEED_LIMIT) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_LIMIT',
          message: `Limit must be an integer from 1 to ${MAX_FEED_LIMIT}.`,
          requestId: request.id,
        },
      });
    }

    let cursor:
      | Readonly<{
          launchBlockNumber: string;
          launchTimestamp: string;
          launchLogIndex: number;
          tokenAddress: string;
        }>
      | undefined;
    if (query.cursor !== undefined) {
      try {
        const decoded = decodeNewFeedCursor(query.cursor);
        cursor = {
          launchBlockNumber: decoded.launchBlockNumber,
          launchTimestamp: decoded.launchTimestamp,
          launchLogIndex: decoded.launchLogIndex,
          tokenAddress: decoded.tokenAddress,
        };
      } catch {
        return reply.code(400).send({
          error: {
            code: 'INVALID_CURSOR',
            message: 'Feed cursor is malformed or unsupported.',
            requestId: request.id,
          },
        });
      }
    }

    const fetched = await deps.repository.listNewLaunches(
      deps.context.chainId,
      deps.context.stackVersion,
      deps.context.factoryAddress,
      parsedLimit + 1,
      cursor,
    );
    const hasMore = fetched.length > parsedLimit;
    const launches = fetched.slice(0, parsedLimit);
    const last = launches.at(-1);
    let nextCursor: string | undefined;
    if (hasMore && last) {
      if (last.launchTimestamp === null) throw new Error('New-feed row is missing launch timestamp');
      nextCursor = encodeNewFeedCursor({
        version: NEW_FEED_CURSOR_VERSION,
        launchBlockNumber: last.launchBlockNumber.toString(10),
        launchTimestamp: last.launchTimestamp.toString(10),
        launchLogIndex: last.launchLogIndex,
        tokenAddress: last.tokenAddress,
      });
    }

    const meta = await deps.freshness();
    return {
      data: launches.map(serializeLaunch),
      meta,
      page: {
        hasMore,
        ...(nextCursor === undefined ? {} : { nextCursor }),
      },
    };
  });
}
