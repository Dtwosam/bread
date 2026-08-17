import type { FastifyInstance } from 'fastify';

import type { SecondaryRepository } from '../../../../packages/db/src/index.js';
import { markNoStore, markPublicProjectionCacheable } from '../http-cache.js';
import type { BreadReadRouteDeps } from './types.js';

type SecondaryDeps = Readonly<{
  repository: SecondaryRepository;
  context: BreadReadRouteDeps['context'];
  freshness: BreadReadRouteDeps['freshness'];
}>;

const MAX_ACTIVITY_LIMIT = 100;
const DEFAULT_ACTIVITY_LIMIT = 50;

export function registerSecondaryRoutes(app: FastifyInstance, deps: SecondaryDeps): void {
  app.get('/v1/activity', async (request, reply) => {
    markNoStore(reply);
    const query = request.query as { limit?: string };
    const limit = query.limit === undefined ? DEFAULT_ACTIVITY_LIMIT : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ACTIVITY_LIMIT) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_LIMIT',
          message: `Limit must be an integer from 1 to ${MAX_ACTIVITY_LIMIT}.`,
          requestId: request.id,
        },
      });
    }
    const [data, meta] = await Promise.all([
      deps.repository.listPlatformActivity(
        deps.context.chainId,
        deps.context.stackVersion,
        deps.context.factoryAddress,
        limit,
      ),
      deps.freshness(),
    ]);
    markPublicProjectionCacheable(reply);
    return { data, meta };
  });

  app.get('/v1/stats', async (_request, reply) => {
    markNoStore(reply);
    const [stats, meta] = await Promise.all([
      deps.repository.getPlatformStats(
        deps.context.chainId,
        deps.context.stackVersion,
        deps.context.factoryAddress,
      ),
      deps.freshness(),
    ]);
    markPublicProjectionCacheable(reply);
    return {
      data: {
        scope: 'LIFETIME' as const,
        quoteVolume: stats.quoteVolume,
        launches: stats.launches,
        trades: stats.trades,
        graduations: stats.graduations,
      },
      meta,
    };
  });
}
