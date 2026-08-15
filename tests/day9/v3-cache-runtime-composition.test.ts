import { describe, expect, it, vi } from "vitest";

import { runIndexerCatchUp } from "../../apps/indexer/src/catch-up.js";
import { PostCommitPublisher } from "../../apps/indexer/src/post-commit.js";
import type { IndexerProtocolContext } from "../../packages/db/src/index.js";

type RuntimePublishInput = Readonly<{
  publisher: Pick<PostCommitPublisher, "publish">;
  insertedEventIds: readonly string[];
  channels: readonly string[];
  checkpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
}>;

type RuntimePublish = (input: RuntimePublishInput) => Promise<unknown>;

const address = (value: number) => `0x${value.toString(16).padStart(40, "0")}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, "0")}`;

async function runtimePublisher(): Promise<RuntimePublish> {
  const runner = await import("../../apps/indexer/src/lan/indexer-runner.js");
  expect(runner.publishProjectionCacheInvalidations).toBeTypeOf("function");
  return runner.publishProjectionCacheInvalidations as unknown as RuntimePublish;
}

describe("Day 9 V3 post-commit cache runtime composition", () => {
  it("routes deterministic <=128-channel chunks through the existing PostCommitPublisher", async () => {
    const publish = await runtimePublisher();
    const calls: Array<Readonly<{ channels: readonly string[] }>> = [];
    const publisher = {
      publish: vi.fn(
        async (input: Readonly<{ channels: readonly string[] }>) => {
          calls.push(input);
          return { channels: input.channels, failures: [] };
        },
      ),
    } as unknown as Pick<PostCommitPublisher, "publish">;
    const channels = Array.from(
      { length: 130 },
      (_, index) => `token:5042002:${address(130 - index)}`,
    );

    await publish({
      publisher,
      insertedEventIds: ["5042002:0x01:1"],
      channels,
      checkpoint: { blockNumber: 120n, blockHash: hash(120) },
    });

    expect(publisher.publish).toHaveBeenCalledTimes(2);
    expect(calls.map((call) => call.channels.length)).toEqual([128, 2]);
    expect(calls.flatMap((call) => call.channels)).toEqual(
      [...channels].sort(),
    );
  });

  it("uses PostCommitPublisher invalidation/fanout semantics instead of a second cache authority", async () => {
    const publish = await runtimePublisher();
    const invalidate = vi.fn(async (_channel: string) => undefined);
    const fanout = vi.fn(async (_hint: unknown) => undefined);
    const publisher = new PostCommitPublisher({ invalidate, fanout });
    const channels = [
      `stack:5042002:v3:${address(1)}:feed`,
      `token:5042002:${address(2)}`,
    ];

    await publish({
      publisher,
      insertedEventIds: ["5042002:0x01:1"],
      channels,
      checkpoint: { blockNumber: 120n, blockHash: hash(120) },
    });

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(fanout).toHaveBeenCalledTimes(2);
  });

  it("surfaces degraded post-commit cycles from catch-up without retrying committed projection", async () => {
    const context: IndexerProtocolContext = {
      chainId: 5_042_002,
      stackVersion: "v3-runtime-red",
      factoryAddress: address(1),
      quoteAsset: address(2),
      quoteDecimals: 6,
      deploymentStartBlock: 100n,
      addresses: { factory: address(1), feeEscrow: address(3) },
    };
    const applyRange = vi.fn(async () => ({ insertedEventIds: ["event-1"] }));
    const publish = vi.fn(async () => {
      throw new Error("redis unavailable");
    });

    const result = await runIndexerCatchUp({
      context,
      initialCheckpoint: { blockNumber: 100n, blockHash: hash(100) },
      observeHeadBlock: async () => 101n,
      readCommittedCheckpoint: async () => ({
        blockNumber: 101n,
        blockHash: hash(101),
      }),
      getBlockHash: async (blockNumber) => hash(Number(blockNumber)),
      overlapBlocks: 1n,
      maxBatchBlocks: 10n,
      maxCycles: 1,
      loadRange: async (fromBlock, toBlock) => ({ fromBlock, toBlock }),
      applyRange,
      publish,
    });

    expect(applyRange).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      caughtUp: true,
      cycles: 1,
      degradedPostCommitCycles: 1,
    });
  });
});
