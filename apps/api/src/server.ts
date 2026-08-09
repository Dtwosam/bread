import Fastify from 'fastify';

import { ReadRepository, type BreadDb } from '../../../packages/db/src/index.js';
import type { ProtocolContext } from '../../../packages/protocol-sdk/src/index.js';

import { buildFreshness } from './freshness.js';
import { registerFeedRoute } from './routes/feed.js';
import { registerStatusRoute } from './routes/status.js';
import { registerTokenRoute } from './routes/token.js';
import { registerTradesRoute } from './routes/trades.js';

export type CreateBreadApiInput = Readonly<{
  db: BreadDb;
  context: ProtocolContext;
  observedHeadBlock: () => Promise<bigint>;
  now?: () => Date;
}>;

export function createBreadApi(input: CreateBreadApiInput) {
  const app = Fastify({ logger: false });
  const repository = new ReadRepository(input.db);
  const now = input.now ?? (() => new Date());

  const freshness = async () => {
    const checkpoint = await repository.getCheckpoint(
      input.context.chainId,
      input.context.stackVersion,
      input.context.factoryAddress,
    );
    if (!checkpoint) throw new Error('indexer checkpoint unavailable');
    const observedHead = await input.observedHeadBlock();
    return buildFreshness(input.context.chainId, checkpoint, observedHead, now());
  };

  const deps = { repository, context: input.context, freshness } as const;
  registerStatusRoute(app, deps);
  registerFeedRoute(app, deps);
  registerTokenRoute(app, deps);
  registerTradesRoute(app, deps);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, 'Bread read API request failed');
    void reply.code(500).send({
      error: {
        code: 'READ_API_FAILURE',
        message: 'Bread read API could not serve this request.',
        requestId: request.id,
      },
    });
  });

  return app;
}
