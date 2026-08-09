import type { FastifyInstance } from 'fastify';

import { canonicalizeProtocolAddress } from '../../../../packages/protocol-sdk/src/index.js';
import {
  decodeHolderCursor,
  DEFAULT_HOLDER_LIMIT,
  encodeHolderCursor,
  HOLDER_CURSOR_VERSION,
  MAX_HOLDER_LIMIT,
} from '../pagination.js';
import type { BreadReadRouteDeps } from './types.js';

export function registerHoldersRoute(app: FastifyInstance, deps: BreadReadRouteDeps): void {
  app.get('/v1/tokens/:address/holders', async (request, reply) => {
    let tokenAddress: string;
    try {
      const params = request.params as { address?: string };
      tokenAddress = canonicalizeProtocolAddress(params.address ?? '');
    } catch {
      return reply.code(400).send({
        error: { code: 'INVALID_ADDRESS', message: 'Token address is invalid.', requestId: request.id },
      });
    }

    const query = request.query as { limit?: string; cursor?: string };
    const parsedLimit = query.limit === undefined ? DEFAULT_HOLDER_LIMIT : Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_HOLDER_LIMIT) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_LIMIT',
          message: `Limit must be an integer from 1 to ${MAX_HOLDER_LIMIT}.`,
          requestId: request.id,
        },
      });
    }

    let cursor: Readonly<{ balance: string; holderAddress: string }> | undefined;
    if (query.cursor !== undefined) {
      try {
        const decoded = decodeHolderCursor(query.cursor);
        cursor = { balance: decoded.balance, holderAddress: decoded.holderAddress };
      } catch {
        return reply.code(400).send({
          error: {
            code: 'INVALID_CURSOR',
            message: 'Holder cursor is malformed or unsupported.',
            requestId: request.id,
          },
        });
      }
    }

    const launch = await deps.repository.getLaunch(deps.context.chainId, tokenAddress);
    if (!launch) {
      return reply.code(404).send({
        error: { code: 'TOKEN_NOT_INDEXED', message: 'Token is not indexed by Bread.', requestId: request.id },
      });
    }

    const [fetched, concentration] = await Promise.all([
      deps.repository.listHolders(deps.context.chainId, tokenAddress, parsedLimit + 1, cursor),
      deps.repository.getHolderConcentration(deps.context.chainId, tokenAddress),
    ]);
    const hasMore = fetched.length > parsedLimit;
    const rows = fetched.slice(0, parsedLimit);
    const last = rows.at(-1);
    const nextCursor = hasMore && last
      ? encodeHolderCursor({
          version: HOLDER_CURSOR_VERSION,
          balance: last.balance,
          holderAddress: last.holderAddress,
        })
      : undefined;

    return {
      data: {
        tokenAddress,
        holders: rows.map((row) => ({
          walletAddress: row.holderAddress,
          balance: row.balance,
          isProtocolAddress: row.isProtocolAddress,
          asOfBlockNumber: row.asOfBlockNumber,
          lastEvent:
            row.lastTransactionHash === null || row.lastLogIndex === null
              ? null
              : { transactionHash: row.lastTransactionHash, logIndex: row.lastLogIndex },
        })),
        concentration: {
          top10ExcludesProtocolAddresses: true,
          top10NonProtocolBalance: concentration.top10NonProtocolBalance,
          supply: concentration.supply,
          holderCount: concentration.holderCount,
          userHolderCount: concentration.userHolderCount,
        },
      },
      meta: await deps.freshness(),
      page: {
        hasMore,
        ...(nextCursor === undefined ? {} : { nextCursor }),
      },
    };
  });
}
