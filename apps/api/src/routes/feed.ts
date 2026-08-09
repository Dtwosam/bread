import type { FastifyInstance } from 'fastify';

import { serializeLaunch } from './token.js';
import type { BreadReadRouteDeps } from './types.js';

const SOURCE_VIEWS = new Set(['new', 'trending', 'graduating', 'graduated']);

export function registerFeedRoute(app: FastifyInstance, deps: BreadReadRouteDeps): void {
  app.get('/v1/feed', async (request, reply) => {
    const query = request.query as { view?: string; limit?: string };
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

    const parsedLimit = query.limit === undefined ? 25 : Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return reply.code(400).send({
        error: { code: 'INVALID_LIMIT', message: 'Limit must be an integer from 1 to 100.', requestId: request.id },
      });
    }

    const launches = await deps.repository.listNewLaunches(
      deps.context.chainId,
      deps.context.stackVersion,
      deps.context.factoryAddress,
      parsedLimit,
    );
    const meta = await deps.freshness();
    return {
      data: launches.map(serializeLaunch),
      meta,
      page: { hasMore: false },
    };
  });
}
