import type { FastifyInstance } from "fastify";

import { canonicalizeProtocolAddress } from "../../../../packages/protocol-sdk/src/index.js";
import {
  decodePortfolioCursor,
  DEFAULT_PORTFOLIO_LIMIT,
  encodePortfolioCursor,
  MAX_PORTFOLIO_LIMIT,
  PORTFOLIO_CURSOR_VERSION,
} from "../pagination.js";
import type { BreadReadRouteDeps } from "./types.js";

function isGraduated(phase: string | null, state: string | null): boolean {
  return (
    phase === "POOL_CREATED" ||
    state === "POOL_CREATED" ||
    state === "GRADUATED"
  );
}

export function registerPortfolioRoute(
  app: FastifyInstance,
  deps: BreadReadRouteDeps,
): void {
  app.get("/v1/portfolio/:address", async (request, reply) => {
    let walletAddress: string;
    try {
      const params = request.params as { address?: string };
      walletAddress = canonicalizeProtocolAddress(params.address ?? "");
    } catch {
      return reply.code(400).send({
        error: {
          code: "INVALID_ADDRESS",
          message: "Wallet address is invalid.",
          requestId: request.id,
        },
      });
    }

    const query = request.query as { limit?: string; cursor?: string };
    const parsedLimit =
      query.limit === undefined ? DEFAULT_PORTFOLIO_LIMIT : Number(query.limit);
    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > MAX_PORTFOLIO_LIMIT
    ) {
      return reply.code(400).send({
        error: {
          code: "INVALID_LIMIT",
          message: `Limit must be an integer from 1 to ${MAX_PORTFOLIO_LIMIT}.`,
          requestId: request.id,
        },
      });
    }

    let cursor: Readonly<{ tokenAddress: string }> | undefined;
    if (query.cursor !== undefined) {
      try {
        const decoded = decodePortfolioCursor(query.cursor);
        cursor = { tokenAddress: decoded.tokenAddress };
      } catch {
        return reply.code(400).send({
          error: {
            code: "INVALID_CURSOR",
            message: "Portfolio cursor is malformed or unsupported.",
            requestId: request.id,
          },
        });
      }
    }

    const fetched = await deps.repository.listPortfolio(
      deps.context.chainId,
      walletAddress,
      parsedLimit + 1,
      cursor,
    );
    const hasMore = fetched.length > parsedLimit;
    const rows = fetched.slice(0, parsedLimit);
    const last = rows.at(-1);
    const nextCursor =
      hasMore && last
        ? encodePortfolioCursor({
            version: PORTFOLIO_CURSOR_VERSION,
            tokenAddress: last.tokenAddress,
          })
        : undefined;

    return {
      data: {
        walletAddress,
        holdings: rows.map((row) => {
          const graduated = isGraduated(
            row.graduationPhase,
            row.graduationState,
          );
          const hasCompleteIndexedPrice =
            row.lastPriceNumerator !== null &&
            row.lastPriceDenominator !== null;
          const hasIndexedCurvePrice =
            !graduated &&
            hasCompleteIndexedPrice &&
            row.lastPriceSource === "CURVE_EXECUTION";
          const hasIndexedV3Price =
            graduated &&
            hasCompleteIndexedPrice &&
            row.lastPriceSource === "V3_SWAP_EXECUTION";

          const price = hasIndexedCurvePrice
            ? {
                status: "AVAILABLE" as const,
                source: "CURVE_EXECUTION" as const,
                numerator: row.lastPriceNumerator as string,
                denominator: row.lastPriceDenominator as string,
              }
            : hasIndexedV3Price
              ? {
                  status: "AVAILABLE" as const,
                  source: "V3_SWAP_EXECUTION" as const,
                  numerator: row.lastPriceNumerator as string,
                  denominator: row.lastPriceDenominator as string,
                }
              : {
                  status: "UNAVAILABLE" as const,
                  reason: graduated
                    ? ("NO_RATIFIED_LIVE_DEX_PRICE_SOURCE" as const)
                    : ("NO_INDEXED_CURVE_PRICE" as const),
                };

          const hasIndexedPrice = hasIndexedCurvePrice || hasIndexedV3Price;
          const currentValue = hasIndexedPrice
            ? {
                status: "AVAILABLE" as const,
                source: hasIndexedV3Price
                  ? ("V3_SWAP_EXECUTION" as const)
                  : ("INDEXED_CURVE_EXECUTION" as const),
                numerator: (
                  BigInt(row.balance) * BigInt(row.lastPriceNumerator as string)
                ).toString(10),
                denominator: row.lastPriceDenominator as string,
              }
            : {
                status: "UNAVAILABLE" as const,
                reason: graduated
                  ? ("NO_RATIFIED_LIVE_DEX_PRICE_SOURCE" as const)
                  : ("NO_INDEXED_CURVE_PRICE" as const),
              };

          return {
            tokenAddress: row.tokenAddress,
            name: row.name,
            symbol: row.symbol,
            balance: row.balance,
            isProtocolAddress: row.isProtocolAddress,
            graduationState: row.graduationState ?? row.graduationPhase,
            price,
            currentValue,
            activity: {
              asOfBlockNumber: row.asOfBlockNumber,
              lastEvent:
                row.lastTransactionHash === null || row.lastLogIndex === null
                  ? null
                  : {
                      transactionHash: row.lastTransactionHash,
                      logIndex: row.lastLogIndex,
                    },
            },
          };
        }),
      },
      meta: await deps.freshness(),
      page: {
        hasMore,
        ...(nextCursor === undefined ? {} : { nextCursor }),
      },
    };
  });
}
