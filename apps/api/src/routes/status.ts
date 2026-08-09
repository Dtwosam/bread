import type { FastifyInstance } from 'fastify';

import type { BreadReadRouteDeps } from './types.js';

export function registerStatusRoute(app: FastifyInstance, deps: BreadReadRouteDeps): void {
  app.get('/v1/status', async (_request, reply) => {
    const checkpoint = await deps.repository.getCheckpoint(
      deps.context.chainId,
      deps.context.stackVersion,
      deps.context.factoryAddress,
    );
    if (!checkpoint) {
      return reply.code(503).send({
        error: {
          code: 'INDEXER_NOT_READY',
          message: 'Bread indexer has no committed checkpoint for this stack.',
          requestId: _request.id,
        },
      });
    }
    const meta = await deps.freshness();
    return {
      data: {
        chainId: deps.context.chainId,
        stackVersion: deps.context.stackVersion,
        factoryAddress: deps.context.factoryAddress,
        deploymentStartBlock: checkpoint.deploymentStartBlock.toString(10),
        indexedThroughBlock: checkpoint.indexedThroughBlock.toString(10),
        indexedThroughBlockHash: checkpoint.indexedThroughBlockHash,
        indexedThroughBlockTimestamp: checkpoint.indexedThroughBlockTimestamp?.toString(10) ?? null,
        ingestionHealth: checkpoint.status,
        decoderSchemaVersion: checkpoint.decoderSchemaVersion,
      },
      meta,
    };
  });
}
