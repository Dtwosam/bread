import { describe, expect, it } from "vitest";

import {
  projectionCacheGenerationKey,
} from "../../packages/types/src/index.js";

type PublishResult = Readonly<{
  status: "PUBLISHED" | "DEGRADED";
  invalidatedChannels: readonly string[];
  failedChannels: readonly string[];
}>;

type Publisher = (
  input: Readonly<{
    redis: Readonly<{ incr: (key: string) => Promise<number> }>;
    schemaVersion: string;
    channels: readonly string[];
  }>,
) => Promise<PublishResult>;

async function publisher(): Promise<Publisher | undefined> {
  const runner = (await import(
    "../../apps/indexer/src/lan/indexer-runner.js"
  )) as Readonly<Record<string, unknown>>;
  const candidate = runner.publishProjectionCacheInvalidations;
  expect(candidate).toBeTypeOf("function");
  return candidate as Publisher | undefined;
}

function generationKey(channel: string): string {
  return projectionCacheGenerationKey({
    schemaVersion: "bread-projection-v1",
    channel,
  });
}

describe("Day 9 post-commit projection cache invalidation publisher", () => {
  it(
    "deduplicates and sorts channels deterministically before invalidating them",
    async () => {
      const publish = await publisher();
      const calls: string[] = [];

      const result = await publish?.({
        redis: {
          incr: async (key) => {
            calls.push(key);
            return 1;
          },
        },
        schemaVersion: "bread-projection-v1",
        channels: [
          "token:5:0xbbb",
          "stack:5:v1:0xaaa:feed",
          "token:5:0xbbb",
        ],
      });

      expect(calls).toEqual([
        generationKey("stack:5:v1:0xaaa:feed"),
        generationKey("token:5:0xbbb"),
      ]);
      expect(result).toEqual({
        status: "PUBLISHED",
        invalidatedChannels: [
          "stack:5:v1:0xaaa:feed",
          "token:5:0xbbb",
        ],
        failedChannels: [],
      });
    },
  );

  it(
    "bounds one invalidation batch to at most 128 concurrent Redis increments",
    async () => {
      const publish = await publisher();
      const channels = Array.from({ length: 130 }, (_, index) =>
        `token:5:0x${index.toString(16).padStart(40, "0")}`,
      );
      let active = 0;
      let maxActive = 0;

      const result = await publish?.({
        redis: {
          incr: async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise((resolve) => setTimeout(resolve, 1));
            active -= 1;
            return 1;
          },
        },
        schemaVersion: "bread-projection-v1",
        channels,
      });

      expect(maxActive).toBeLessThanOrEqual(128);
      expect(result?.status).toBe("PUBLISHED");
      expect(result?.invalidatedChannels).toHaveLength(130);
      expect(result?.failedChannels).toEqual([]);
    },
  );

  it("is a no-op for an empty channel set", async () => {
    const publish = await publisher();
    let calls = 0;

    const result = await publish?.({
      redis: {
        incr: async () => {
          calls += 1;
          return 1;
        },
      },
      schemaVersion: "bread-projection-v1",
      channels: [],
    });

    expect(calls).toBe(0);
    expect(result).toEqual({
      status: "PUBLISHED",
      invalidatedChannels: [],
      failedChannels: [],
    });
  });

  it(
    "reports DEGRADED after Redis invalidation failure without throwing",
    async () => {
      const publish = await publisher();
      const channels = ["stack:5:v1:0xaaa:feed", "token:5:0xbbb"];

      const result = await publish?.({
        redis: {
          incr: async (key) => {
            if (key === generationKey("token:5:0xbbb")) {
              throw new Error("redis unavailable");
            }
            return 1;
          },
        },
        schemaVersion: "bread-projection-v1",
        channels,
      });

      expect(result).toEqual({
        status: "DEGRADED",
        invalidatedChannels: ["stack:5:v1:0xaaa:feed"],
        failedChannels: ["token:5:0xbbb"],
      });
    },
  );
});
