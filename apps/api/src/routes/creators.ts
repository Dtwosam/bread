import type { FastifyInstance } from 'fastify';

import type { CreatorRepository } from '../../../../packages/db/src/index.js';
import { canonicalizeProtocolAddress } from '../../../../packages/protocol-sdk/src/index.js';
import type { FreshnessMeta } from '../../../../packages/types/src/index.js';

export type CreatorRouteDeps = Readonly<{
  repository: CreatorRepository;
  chainId: number;
  freshness: () => Promise<FreshnessMeta>;
}>;

export function registerCreatorRoute(app: FastifyInstance, deps: CreatorRouteDeps): void {
  app.get('/v1/creators/:address', async (request, reply) => {
    const params = request.params as { address?: string };
    let creatorAddress: string;
    try {
      creatorAddress = canonicalizeProtocolAddress(params.address ?? '');
    } catch {
      return reply.code(400).send({
        error: { code: 'INVALID_ADDRESS', message: 'Creator address is malformed.', requestId: request.id },
      });
    }

    const data = await deps.repository.getCreatorOverview(deps.chainId, creatorAddress);
    return { data, meta: await deps.freshness() };
  });
}
