import Fastify from "fastify";

import {
  AlmostBakedRepository,
  CreatorRepository,
  ExplicitSortRepository,
  ExploreAgeReadRepository,
  ReadRepository,
  SearchRepository,
  SecondaryRepository,
  TrendingRepository,
  type BreadDb,
} from "../../../packages/db/src/index.js";
import type { ProtocolContext } from "../../../packages/protocol-sdk/src/index.js";
import { BREAD_PROJECTION_CACHE_SCHEMA_VERSION } from "../../../packages/types/src/index.js";

import { BreadCache, type CacheRedis } from "./cache.js";
import {
  BoundedReadGate,
  ReadCapacityExceededError,
  boundRepository,
  type ReadCapacityConfig,
} from "./capacity.js";
import { buildFreshness } from "./freshness.js";
import {
  FileSystemTokenMediaStore,
  type TokenMediaStore,
} from "./media/token-image.js";
import {
  IsolatedRateLimiter,
  type RateLimitPolicy,
  type RateLimitRedis,
} from "./rate-limit.js";
import { registerCreatorRoute } from "./routes/creators.js";
import { registerFeedRoute } from "./routes/feed.js";
import { registerHoldersRoute } from "./routes/holders.js";
import { registerTokenMediaRoutes } from "./routes/media.js";
import { registerPortfolioRoute } from "./routes/portfolio.js";
import { registerSearchRoute } from "./routes/search.js";
import { registerSecondaryRoutes } from "./routes/secondary.js";
import { registerStatusRoute } from "./routes/status.js";
import { registerTokenRoute } from "./routes/token.js";
import { registerTradesRoute } from "./routes/trades.js";

type ApiRedis = CacheRedis & RateLimitRedis;

const DEFAULT_CAPACITY: ReadCapacityConfig = {
  dbMaxActive: 16,
  dbMaxQueued: 64,
  dbQueueTimeoutMs: 250,
};

const DEFAULT_RATE_LIMITS: Readonly<
  Record<"feed" | "search", RateLimitPolicy>
> = {
  feed: { maxRequests: 500, windowMs: 1_000 },
  search: { maxRequests: 30, windowMs: 1_000 },
};

function unavailableRedis(): ApiRedis {
  const unavailable = async () => {
    throw new Error("Redis unavailable");
  };
  return {
    get: unavailable,
    set: unavailable,
    incr: unavailable,
    eval: unavailable,
    pExpire: unavailable,
  };
}

function configuredTokenMediaStore(): TokenMediaStore | undefined {
  const directory = process.env.BREAD_MEDIA_STORAGE_DIR?.trim();
  const publicBaseUrl = process.env.BREAD_MEDIA_PUBLIC_BASE_URL?.trim();
  if (!directory || !publicBaseUrl) return undefined;
  return new FileSystemTokenMediaStore(directory, publicBaseUrl);
}

export type CreateBreadApiInput = Readonly<{
  db: BreadDb;
  context: ProtocolContext;
  observedHeadBlock: () => Promise<bigint>;
  now?: () => Date;
  redis?: ApiRedis;
  capacity?: ReadCapacityConfig;
  rateLimits?: Readonly<Record<"feed" | "search", RateLimitPolicy>>;
  tokenMediaStore?: TokenMediaStore;
  trustedMediaBaseUrl?: string;
}>;

export function createBreadApi(input: CreateBreadApiInput) {
  const app = Fastify({ logger: false });
  const now = input.now ?? (() => new Date());
  const redis = input.redis ?? unavailableRedis();
  const gate = new BoundedReadGate(input.capacity ?? DEFAULT_CAPACITY);
  const repository = boundRepository(new ReadRepository(input.db), gate);
  const exploreAgeRepository = boundRepository(
    new ExploreAgeReadRepository(input.db),
    gate,
  );
  const almostBakedRepository = boundRepository(
    new AlmostBakedRepository(input.db),
    gate,
  );
  const trendingRepository = boundRepository(
    new TrendingRepository(input.db),
    gate,
  );
  const explicitSortRepository = boundRepository(
    new ExplicitSortRepository(input.db),
    gate,
  );
  const creatorRepository = boundRepository(
    new CreatorRepository(input.db),
    gate,
  );
  const searchRepository = boundRepository(
    new SearchRepository(input.db),
    gate,
  );
  const secondaryRepository = boundRepository(
    new SecondaryRepository(input.db),
    gate,
  );
  const cache = new BreadCache({
    redis,
    schemaVersion: BREAD_PROJECTION_CACHE_SCHEMA_VERSION,
  });
  const limiter = new IsolatedRateLimiter({
    redis,
    policies: input.rateLimits ?? DEFAULT_RATE_LIMITS,
    nowMs: () => now().getTime(),
  });

  const freshness = async () => {
    const checkpoint = await repository.getCheckpoint(
      input.context.chainId,
      input.context.stackVersion,
      input.context.factoryAddress,
    );
    if (!checkpoint) throw new Error("indexer checkpoint unavailable");
    const observedHead = await input.observedHeadBlock();
    return buildFreshness(
      input.context.chainId,
      checkpoint,
      observedHead,
      now(),
    );
  };

  const deps = {
    repository,
    exploreAgeRepository,
    almostBakedRepository,
    trendingRepository,
    explicitSortRepository,
    context: input.context,
    freshness,
    cache,
    feedRateLimit: (subject: string) => limiter.take("feed", subject),
    now,
    trustedMediaBaseUrl:
      input.trustedMediaBaseUrl ??
      process.env.BREAD_MEDIA_PUBLIC_BASE_URL?.trim() ??
      undefined,
  } as const;
  registerStatusRoute(app, deps);
  registerFeedRoute(app, deps);
  registerTokenRoute(app, deps);
  registerTradesRoute(app, deps);
  registerHoldersRoute(app, deps);
  registerPortfolioRoute(app, deps);
  registerSecondaryRoutes(app, {
    repository: secondaryRepository,
    context: input.context,
    freshness,
  });
  registerCreatorRoute(app, {
    repository: creatorRepository,
    chainId: input.context.chainId,
    freshness,
  });
  registerSearchRoute(app, {
    repository: searchRepository,
    context: input.context,
    freshness,
    rateLimit: (subject: string) => limiter.take("search", subject),
  });
  registerTokenMediaRoutes(app, {
    store: input.tokenMediaStore ?? configuredTokenMediaStore(),
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      { err: error, requestId: request.id },
      "Bread read API request failed",
    );
    if (error instanceof ReadCapacityExceededError) {
      void reply.code(503).send({
        error: {
          code: "READ_CAPACITY_EXCEEDED",
          message: "Bread read capacity is temporarily saturated.",
          requestId: request.id,
        },
      });
      return;
    }
    void reply.code(500).send({
      error: {
        code: "READ_API_FAILURE",
        message: "Bread read API could not serve this request.",
        requestId: request.id,
      },
    });
  });

  return app;
}
