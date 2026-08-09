import type { FastifyInstance } from 'fastify';

import { canonicalizeProtocolAddress } from '../../../../packages/protocol-sdk/src/index.js';
import {
  decodeTradeCursor,
  DEFAULT_TRADE_LIMIT,
  encodeTradeCursor,
  MAX_TRADE_LIMIT,
  TRADE_CURSOR_VERSION,
} from '../pagination.js';
import type { BreadReadRouteDeps } from './types.js';

export function registerTradesRoute(app: FastifyInstance, deps: BreadReadRouteDeps): void {
  app.get('/v1/tokens/:address/trades', async (request, reply) => {
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
    const parsedLimit = query.limit === undefined ? DEFAULT_TRADE_LIMIT : Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_TRADE_LIMIT) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_LIMIT',
          message: `Limit must be an integer from 1 to ${MAX_TRADE_LIMIT}.`,
          requestId: request.id,
        },
      });
    }

    let cursor:
      | Readonly<{
          blockNumber: string;
          transactionIndex: number;
          logIndex: number;
          transactionHash: string;
        }>
      | undefined;
    if (query.cursor !== undefined) {
      try {
        const decoded = decodeTradeCursor(query.cursor);
        cursor = {
          blockNumber: decoded.blockNumber,
          transactionIndex: decoded.transactionIndex,
          logIndex: decoded.logIndex,
          transactionHash: decoded.transactionHash,
        };
      } catch {
        return reply.code(400).send({
          error: {
            code: 'INVALID_CURSOR',
            message: 'Trade cursor is malformed or unsupported.',
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

    const fetched = await deps.repository.listTrades(
      deps.context.chainId,
      tokenAddress,
      parsedLimit + 1,
      cursor,
    );
    const hasMore = fetched.length > parsedLimit;
    const rows = fetched.slice(0, parsedLimit);
    const last = rows.at(-1);
    const nextCursor =
      hasMore && last
        ? encodeTradeCursor({
            version: TRADE_CURSOR_VERSION,
            blockNumber: last.blockNumber,
            transactionIndex: last.transactionIndex,
            logIndex: last.logIndex,
            transactionHash: last.transactionHash,
          })
        : undefined;

    return {
      data: rows.map((row) => ({
        id: {
          chainId: row.chainId,
          transactionHash: row.transactionHash,
          logIndex: row.logIndex,
        },
        side: row.side,
        tokenAddress: row.tokenAddress,
        curveAddress: row.curveAddress,
        actor: row.traderAddress,
        recipient: row.recipientAddress,
        tokenAmount: row.baseAmount,
        quoteAmount: row.quoteAmount,
        baseFee: row.feeAmount,
        creatorTax: row.taxAmount,
        offeredQuote: row.offeredQuote,
        openingTaxBps: row.openingTaxBps,
        openingTax: row.openingTaxAmount,
        launchBuyExempt: row.launchBuyExempt,
        refund: row.refundAmount,
        netCurveInput: row.netCurveInput,
        netQuoteOut: row.netQuoteOut,
        grossCurveQuoteOut: row.grossCurveQuoteOut,
        executionPrice: {
          numerator: row.executionPriceNumerator,
          denominator: row.executionPriceDenominator,
          source: 'CURVE_EXECUTION',
        },
        blockNumber: row.blockNumber,
        blockTimestamp: row.blockTimestamp,
        transactionIndex: row.transactionIndex,
        stackVersion: row.stackVersion,
      })),
      meta: await deps.freshness(),
      page: {
        hasMore,
        ...(nextCursor === undefined ? {} : { nextCursor }),
      },
    };
  });
}
