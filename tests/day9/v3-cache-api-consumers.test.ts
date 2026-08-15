import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import type { Address } from "../../packages/types/src/index.js";

const requireFromApi = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const Fastify = requireFromApi("fastify") as (
  options?: Readonly<Record<string, unknown>>,
) => {
  inject: (input: Readonly<{ method: string; url: string }>) => Promise<{
    statusCode: number;
  }>;
  close: () => Promise<void>;
};

const factory = "0x1111111111111111111111111111111111111111" as Address;
const quoteAsset = "0x2222222222222222222222222222222222222222" as Address;

const context = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "v3",
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {},
} as const;

describe("Day 9 shared projection-cache API consumers", () => {
  it("uses the factory-aware shared stack-feed channel in the live feed route", async () => {
    const { registerFeedRoute } =
      await import("../../apps/api/src/routes/feed.js");
    const app = Fastify({ logger: false });
    const channels: string[] = [];

    registerFeedRoute(
      app as never,
      {
        repository: {
          listNewLaunches: async () => [],
          listTokenMetrics: async () => [],
        },
        context,
        freshness: async () => ({
          chainId: context.chainId,
          indexedThroughBlock: "100",
          observedHeadBlock: "100",
          lagBlocks: "0",
          status: "FRESH",
          source: "bread-indexer",
          servedAt: "2026-08-14T20:00:00.000Z",
        }),
        cache: {
          getOrLoad: async <T>(
            input: Readonly<{
              channel: string;
              key: string;
              load: () => Promise<T>;
            }>,
          ) => {
            channels.push(input.channel);
            return { value: await input.load(), cache: "MISS" as const };
          },
        },
        now: () => new Date("2026-08-14T20:00:00.000Z"),
      } as never,
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/feed?view=new&limit=1",
    });
    expect(response.statusCode).toBe(200);
    expect(channels).toEqual([
      `stack:${context.chainId}:${context.stackVersion}:${factory}:feed`,
    ]);
    await app.close();
  });

  it("makes BreadCache consume the shared generation-key owner instead of duplicating its literal", async () => {
    const source = await readFile(
      new URL("../../apps/api/src/cache.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("projectionCacheGenerationKey");
    expect(source).not.toContain(
      "`bread:generation:${this.input.schemaVersion}:",
    );
  });

  it("makes createBreadApi use the projection-cache schema marker rather than the event decoder schema", async () => {
    const source = await readFile(
      new URL("../../apps/api/src/server.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("BREAD_PROJECTION_CACHE_SCHEMA_VERSION");
    expect(source).not.toMatch(/schemaVersion:\s*["']day6-v1["']/);
  });
});
