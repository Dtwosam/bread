import type { FastifyInstance } from "fastify";

import { stackFeedProjectionCacheChannel } from "../../../../packages/types/src/index.js";
import { markNoStore, markPublicProjectionCacheable } from "../http-cache.js";
import {
  decodeGraduatedFeedCursor,
  decodeNewFeedCursor,
  decodeTrendingFeedCursor,
  DEFAULT_FEED_LIMIT,
  encodeGraduatedFeedCursor,
  encodeNewFeedCursor,
  encodeTrendingFeedCursor,
  GRADUATED_FEED_CURSOR_VERSION,
  MAX_FEED_LIMIT,
  NEW_FEED_CURSOR_VERSION,
  TRENDING_FEED_CURSOR_VERSION,
} from "../pagination.js";
import {
  serializeGraduationProgress,
  serializeLaunch,
  serializeTradeMetrics,
} from "./token.js";
import type { BreadFeedRouteDeps } from "./types.js";

const SOURCE_VIEWS = new Set(["new", "trending", "graduating", "graduated"]);

export function registerFeedRoute(
  app: FastifyInstance,
  deps: BreadFeedRouteDeps,
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
    if (view === "graduating") {
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
    let trendingCursor:
      | Readonly<{
          quoteVolume1h: string;
          uniqueTraders1h: string;
          tradeCount1h: string;
          latestActivityBlockNumber: string;
          latestActivityLogIndex: number;
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
        } else if (view === "trending") {
          const decoded = decodeTrendingFeedCursor(query.cursor);
          trendingCursor = {
            quoteVolume1h: decoded.quoteVolume1h,
            uniqueTraders1h: decoded.uniqueTraders1h,
            tradeCount1h: decoded.tradeCount1h,
            latestActivityBlockNumber: decoded.latestActivityBlockNumber,
            latestActivityLogIndex: decoded.latestActivityLogIndex,
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
      const trendingMeta = view === "trending" ? await deps.freshness() : undefined;
      const fetched =
        view === "graduated"
          ? await deps.repository.listGraduatedLaunches(
              deps.context.chainId,
              deps.context.stackVersion,
              deps.context.factoryAddress,
              parsedLimit + 1,
              graduatedCursor,
            )
          : view === "trending"
            ? await deps.trendingRepository.listTrendingLaunches(
                deps.context.chainId,
                deps.context.stackVersion,
                deps.context.factoryAddress,
                trendingMeta!.indexedThroughBlockTimestamp,
                parsedLimit + 1,
                trendingCursor,
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
          const graduationCompletedBlock = last.graduationCompletedBlock;
          const graduationCompletedLogIndex = last.graduationCompletedLogIndex;
          if (typeof graduationCompletedBlock !== "bigint" || typeof graduationCompletedLogIndex !== "number") {
            throw new Error("Graduated-feed row has invalid completion cursor state");
          }
          nextCursor = encodeGraduatedFeedCursor({
            version: GRADUATED_FEED_CURSOR_VERSION,
            graduationCompletedBlock: graduationCompletedBlock.toString(10),
            graduationCompletedLogIndex,
            tokenAddress: last.tokenAddress,
          });
        } else if (view === "trending") {
          if (
            !("quoteVolume1h" in last) ||
            !("uniqueTraders1h" in last) ||
            !("tradeCount1h" in last) ||
            !("latestActivityBlockNumber" in last) ||
            !("latestActivityLogIndex" in last)
          ) {
            throw new Error("Trending-feed row is missing ranking cursor state");
          }
          const quoteVolume1h = last.quoteVolume1h;
          const uniqueTraders1h = last.uniqueTraders1h;
          const tradeCount1h = last.tradeCount1h;
          const latestActivityBlockNumber = last.latestActivityBlockNumber;
          const latestActivityLogIndex = last.latestActivityLogIndex;
          if (
            typeof quoteVolume1h !== "bigint" ||
            typeof uniqueTraders1h !== "bigint" ||
            typeof tradeCount1h !== "bigint" ||
            typeof latestActivityBlockNumber !== "bigint" ||
            typeof latestActivityLogIndex !== "number"
          ) {
            throw new Error("Trending-feed row has invalid ranking cursor state");
          }
          nextCursor = encodeTrendingFeedCursor({
            version: TRENDING_FEED_CURSOR_VERSION,
            quoteVolume1h: quoteVolume1h.toString(10),
            uniqueTraders1h: uniqueTraders1h.toString(10),
            tradeCount1h: tradeCount1h.toString(10),
            latestActivityBlockNumber: latestActivityBlockNumber.toString(10),
            latestActivityLogIndex,
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
      const meta = trendingMeta ?? await deps.freshness();
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
