import type { FastifyInstance } from "fastify";

import { stackFeedProjectionCacheChannel } from "../../../../packages/types/src/index.js";
import { markNoStore, markPublicProjectionCacheable } from "../http-cache.js";
import {
  decodeGraduatedFeedCursor,
  decodeNewFeedCursor,
  DEFAULT_FEED_LIMIT,
  encodeGraduatedFeedCursor,
  encodeNewFeedCursor,
  GRADUATED_FEED_CURSOR_VERSION,
  MAX_FEED_LIMIT,
  NEW_FEED_CURSOR_VERSION,
} from "../pagination.js";
import {
  serializeGraduationProgress,
  serializeLaunch,
  serializeTradeMetrics,
} from "./token.js";
import type { BreadReadRouteDeps } from "./types.js";

const SOURCE_VIEWS = new Set(["new", "trending", "graduating", "graduated"]);

export function registerFeedRoute(
  app: FastifyInstance,
  deps: BreadReadRouteDeps,
): void {
  app.get("/v1/feed", async (request, reply) => {
    markNoStore(reply);
    const query = request.query as {
      view?: string;
      limit?: string;
      cursor?: string;
    };
    const view = query.view ?? "new";
    if (!SOURCE_VIEWS.has(view)) {
      return reply.code(400).send({
        error: {
          code: "INVALID_FEED_VIEW",
          message: "Feed view is not supported.",
          requestId: request.id,
        },
      });
    }
    if (view !== "new" && view !== "graduated") {
      return reply.code(503).send({
        error: {
          code: "FEED_VIEW_NOT_READY",
          message: "This deterministic feed projection is not available yet.",
          requestId: request.id,
        },
      });
    }

    const parsedLimit =
      query.limit === undefined ? DEFAULT_FEED_LIMIT : Number(query.limit);
    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > MAX_FEED_LIMIT
    ) {
      return reply.code(400).send({
        error: {
          code: "INVALID_LIMIT",
          message: `Limit must be an integer from 1 to ${MAX_FEED_LIMIT}.`,
          requestId: request.id,
        },
      });
    }

    let newCursor:
      | Readonly<{
          launchBlockNumber: string;
          launchTimestamp: string;
          launchLogIndex: number;
          tokenAddress: string;
        }>
      | undefined;
    let graduatedCursor:
      | Readonly<{
          graduationCompletedBlock: string;
          graduationCompletedLogIndex: number;
          tokenAddress: string;
        }>
      | undefined;
    if (query.cursor !== undefined) {
      try {
        if (view === "graduated") {
          const decoded = decodeGraduatedFeedCursor(query.cursor);
          graduatedCursor = {
            graduationCompletedBlock: decoded.graduationCompletedBlock,
            graduationCompletedLogIndex: decoded.graduationCompletedLogIndex,
            tokenAddress: decoded.tokenAddress,
          };
        } else {
          const decoded = decodeNewFeedCursor(query.cursor);
          newCursor = {
            launchBlockNumber: decoded.launchBlockNumber,
            launchTimestamp: decoded.launchTimestamp,
            launchLogIndex: decoded.launchLogIndex,
            tokenAddress: decoded.tokenAddress,
          };
        }
      } catch {
        return reply.code(400).send({
          error: {
            code: "INVALID_CURSOR",
            message: "Feed cursor is malformed or unsupported.",
            requestId: request.id,
          },
        });
      }
    }

    if (deps.feedRateLimit) {
      const rate = await deps.feedRateLimit(request.ip);
      if (rate === "LIMITED") {
        return reply.code(429).send({
          error: {
            code: "FEED_RATE_LIMITED",
            message: "Feed request rate limit exceeded.",
            requestId: request.id,
          },
        });
      }
      // Cached feed is intentionally broadly serviceable. If Redis-backed
      // limiting is unavailable, the bounded DB gate + cache BYPASS path still
      // protects origin work instead of turning cache loss into a 500 storm.
    }

    const load = async () => {
      const fetched =
        view === "graduated"
          ? await deps.repository.listGraduatedLaunches(
              deps.context.chainId,
              deps.context.stackVersion,
              deps.context.factoryAddress,
              parsedLimit + 1,
              graduatedCursor,
            )
          : await deps.repository.listNewLaunches(
              deps.context.chainId,
              deps.context.stackVersion,
              deps.context.factoryAddress,
              parsedLimit + 1,
              newCursor,
            );
      const hasMore = fetched.length > parsedLimit;
      const launches = fetched.slice(0, parsedLimit);
      const last = launches.at(-1);
      let nextCursor: string | undefined;
      if (hasMore && last) {
        if (view === "graduated") {
          if (!("graduationCompletedBlock" in last) || !("graduationCompletedLogIndex" in last)) {
            throw new Error("Graduated-feed row is missing completion cursor state");
          }
          nextCursor = encodeGraduatedFeedCursor({
            version: GRADUATED_FEED_CURSOR_VERSION,
            graduationCompletedBlock: last.graduationCompletedBlock.toString(10),
            graduationCompletedLogIndex: last.graduationCompletedLogIndex,
            tokenAddress: last.tokenAddress,
          });
        } else {
          if (last.launchTimestamp === null)
            throw new Error("New-feed row is missing launch timestamp");
          nextCursor = encodeNewFeedCursor({
            version: NEW_FEED_CURSOR_VERSION,
            launchBlockNumber: last.launchBlockNumber.toString(10),
            launchTimestamp: last.launchTimestamp.toString(10),
            launchLogIndex: last.launchLogIndex,
            tokenAddress: last.tokenAddress,
          });
        }
      }

      const tokenAddresses = launches.map((launch) => launch.tokenAddress);
      const [metricRows, stateRows] = await Promise.all([
        deps.repository.listTokenMetrics(deps.context.chainId, tokenAddresses),
        deps.repository.listLaunchStates(deps.context.chainId, tokenAddresses),
      ]);
      const metricsByToken = new Map(
        metricRows.map((row) => [row.tokenAddress.toLowerCase(), row]),
      );
      const statesByToken = new Map(
        stateRows.map((row) => [row.tokenAddress.toLowerCase(), row]),
      );
      const meta = await deps.freshness();
      return {
        data: launches.map((launch) => {
          const tokenKey = launch.tokenAddress.toLowerCase();
          const metricRow = metricsByToken.get(tokenKey);
          const stateRow = statesByToken.get(tokenKey);
          return {
            ...serializeLaunch(launch),
            holderCount: metricRow?.holderCount?.toString(10) ?? null,
            graduatedVenueKind: stateRow?.graduatedVenueKind ?? null,
            metrics: serializeTradeMetrics(metricRow),
            progress: serializeGraduationProgress(metricRow),
          };
        }),
        meta,
        page: {
          hasMore,
          ...(nextCursor === undefined ? {} : { nextCursor }),
        },
      };
    };

    const cacheKey = `view=${view}&limit=${parsedLimit}&cursor=${query.cursor ?? ""}`;
    const cacheResult = deps.cache
      ? await deps.cache.getOrLoad({
          channel: stackFeedProjectionCacheChannel({
            chainId: deps.context.chainId,
            stackVersion: deps.context.stackVersion,
            factoryAddress: deps.context.factoryAddress,
          }),
          key: cacheKey,
          load,
        })
      : { value: await load(), cache: "BYPASS" as const };
    const now = (deps.now ?? (() => new Date()))();
    markPublicProjectionCacheable(reply);
    return {
      ...cacheResult.value,
      meta: {
        ...cacheResult.value.meta,
        servedAt: now.toISOString(),
        cache: cacheResult.cache,
      },
    };
  });
}
