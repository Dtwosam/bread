import { describe, expect, it, vi } from "vitest";

import type { IndexerProtocolContext } from "../../packages/db/src/index.js";
import { replayOverlap } from "../../apps/indexer/src/replay.js";

const address = (value: number) => `0x${value.toString(16).padStart(40, "0")}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, "0")}`;

const context: IndexerProtocolContext = {
  chainId: 5_042_002,
  stackVersion: "day9-v3-cache-runtime",
  factoryAddress: address(1),
  quoteAsset: address(2),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: { factory: address(1) },
};

type ApplyResult = Readonly<{
  insertedEventIds: readonly string[];
  projectionCacheChannels: readonly string[];
  checkpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
}>;

type PublishHook = (result: ApplyResult) => Promise<void>;

async function publishHook(
  input: Readonly<{
    redis: Readonly<{ incr: (key: string) => Promise<number> }>;
    schemaVersion: string;
  }>,
): Promise<PublishHook | undefined> {
  const runner =
    (await import("../../apps/indexer/src/lan/indexer-runner.js")) as Readonly<
      Record<string, unknown>
    >;
  const factory = runner.createProjectionCachePublishHook;
  expect(factory).toBeTypeOf("function");
  if (typeof factory !== "function") return undefined;
  return (factory as (value: typeof input) => PublishHook)(input);
}

describe("Day 9 indexer runtime V3 cache invalidation wiring", () => {
  it("publishes derived channels only after the replay apply transaction resolves", async () => {
    const order: string[] = [];
    const hook = await publishHook({
      redis: {
        incr: vi.fn(async () => {
          order.push("publish");
          return 1;
        }),
      },
      schemaVersion: "bread-projection-v1",
    });
    if (!hook) return;

    const result = await replayOverlap({
      context,
      checkpoint: { blockNumber: 100n, blockHash: hash(100) },
      getBlockHash: async () => hash(100),
      targetBlock: 101n,
      overlapBlocks: 1n,
      loadRange: async (fromBlock, toBlock) => ({ fromBlock, toBlock }),
      applyRange: async () => {
        order.push("apply");
        return {
          insertedEventIds: [`${context.chainId}:${hash(1)}:0`],
          projectionCacheChannels: [`token:${context.chainId}:${address(3)}`],
          checkpoint: { blockNumber: 101n, blockHash: hash(101) },
        };
      },
      publish: hook,
    });

    expect(order).toEqual(["apply", "publish"]);
    expect(result.postCommit).toBe("PUBLISHED");
  });

  it("never publishes when the durable range application fails", async () => {
    const incr = vi.fn(async () => 1);
    const hook = await publishHook({
      redis: { incr },
      schemaVersion: "bread-projection-v1",
    });
    if (!hook) return;

    await expect(
      replayOverlap({
        context,
        checkpoint: { blockNumber: 100n, blockHash: hash(100) },
        getBlockHash: async () => hash(100),
        targetBlock: 101n,
        overlapBlocks: 1n,
        loadRange: async (fromBlock, toBlock) => ({ fromBlock, toBlock }),
        applyRange: async () => {
          throw new Error("postgres rollback");
        },
        publish: hook,
      }),
    ).rejects.toThrow("postgres rollback");
    expect(incr).not.toHaveBeenCalled();
  });

  it("turns Redis invalidation failure into replay DEGRADED after the committed apply result", async () => {
    const hook = await publishHook({
      redis: {
        incr: async () => {
          throw new Error("redis unavailable");
        },
      },
      schemaVersion: "bread-projection-v1",
    });
    if (!hook) return;

    const result = await replayOverlap({
      context,
      checkpoint: { blockNumber: 100n, blockHash: hash(100) },
      getBlockHash: async () => hash(100),
      targetBlock: 101n,
      overlapBlocks: 1n,
      loadRange: async (fromBlock, toBlock) => ({ fromBlock, toBlock }),
      applyRange: async () => ({
        insertedEventIds: [`${context.chainId}:${hash(2)}:0`],
        projectionCacheChannels: [`token:${context.chainId}:${address(4)}`],
        checkpoint: { blockNumber: 101n, blockHash: hash(101) },
      }),
      publish: hook,
    });

    expect(result.postCommit).toBe("DEGRADED");
    expect(result.postCommitError).toContain(
      "projection cache invalidation degraded",
    );
    expect(result.applyResult.insertedEventIds).toHaveLength(1);
  });
});
