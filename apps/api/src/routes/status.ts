import type { FastifyInstance } from 'fastify';

import type { FreshnessMeta } from '../../../../packages/types/src/index.js';

import type { BreadReadRouteDeps } from './types.js';

type StatusCheckpoint = Readonly<{
  chainId: number;
  stackVersion: string;
  factoryAddress: string;
  deploymentStartBlock: bigint;
  indexedThroughBlock: bigint;
  indexedThroughBlockHash: string;
  indexedThroughBlockTimestamp: bigint | null;
  decoderSchemaVersion: string;
  status: string;
}>;

function indexerHealth(meta: FreshnessMeta): 'HEALTHY' | 'LAGGING' | 'REBUILDING' | 'DEGRADED' {
  switch (meta.status) {
    case 'FRESH':
      return 'HEALTHY';
    case 'LAGGING':
      return 'LAGGING';
    case 'REBUILDING':
      return 'REBUILDING';
    default:
      return 'DEGRADED';
  }
}

export function buildStatusData(checkpoint: StatusCheckpoint, meta: FreshnessMeta) {
  return {
    chainId: checkpoint.chainId,
    stackVersion: checkpoint.stackVersion,
    factoryAddress: checkpoint.factoryAddress,
    deploymentStartBlock: checkpoint.deploymentStartBlock.toString(10),
    indexedThroughBlock: checkpoint.indexedThroughBlock.toString(10),
    indexedThroughBlockHash: checkpoint.indexedThroughBlockHash,
    indexedThroughBlockTimestamp: checkpoint.indexedThroughBlockTimestamp?.toString(10) ?? null,
    observedHeadBlock: meta.observedHeadBlock ?? null,
    lagBlocks: meta.lagBlocks ?? null,
    ingestionHealth: checkpoint.status,
    decoderSchemaVersion: checkpoint.decoderSchemaVersion,
    rebuildMode: meta.status === 'REBUILDING',
    health: {
      db: 'HEALTHY',
      indexer: indexerHealth(meta),
      redis: meta.cache === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'UNKNOWN',
      rpc: 'UNKNOWN',
    },
    cache: meta.cache,
    fanout: 'UNKNOWN',
    reconciliation: 'UNAVAILABLE',
  } as const;
}

export function registerStatusRoute(app: FastifyInstance, deps: BreadReadRouteDeps): void {
  app.get('/v1/status', async (request, reply) => {
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
          requestId: request.id,
        },
      });
    }
    const meta = await deps.freshness();
    return { data: buildStatusData(checkpoint, meta), meta };
  });
}
