import { describe, expect, it } from "vitest";

import { createArcProviderSafeLogClient } from "../../apps/indexer/src/lan/chain-client.js";
import type { LogClient, RpcLog } from "../../apps/indexer/src/discovery.js";

function timeoutError(): Error & { details: string } {
  const error = new Error("The request took too long to respond.") as Error & {
    details: string;
  };
  error.details = "The request timed out.";
  return error;
}

function logAt(blockNumber: bigint): RpcLog {
  const hex = blockNumber.toString(16).padStart(64, "0");
  return {
    address: "0xddf400f7a376fb8a962eee6d74c1ba37efa644f7",
    blockNumber,
    blockHash: `0x${hex}`,
    transactionHash: `0x${hex}`,
    transactionIndex: 0,
    logIndex: 0,
    topics: [],
    data: "0x",
  } as RpcLog;
}

describe("Day 9 LAN eth_getLogs timeout fallback", () => {
  it("splits an exhausted large-range timeout into bounded contiguous subranges", async () => {
    const addresses = [
      "0xddf400f7a376fb8a962eee6d74c1ba37efa644f7",
      "0x388e534b94268e231a1badf14c4678f01bfc60e3",
    ] as const;
    const seen: Array<{
      fromBlock: bigint;
      toBlock: bigint;
      address: readonly string[];
    }> = [];
    const delays: number[] = [];
    let clock = 0;

    const raw: LogClient = {
      getLogs: async (request) => {
        const fromBlock = request.fromBlock as bigint;
        const toBlock = request.toBlock as bigint;
        const address = request.address as readonly string[];
        seen.push({ fromBlock, toBlock, address });

        if (toBlock - fromBlock + 1n > 256n) throw timeoutError();
        return [logAt(fromBlock), logAt(toBlock)];
      },
    };

    const client = createArcProviderSafeLogClient(raw, {
      maxTransientRetries: 1,
      transientBackoffMs: 10,
      minimumIntervalMs: 0,
      maxSplitDepth: 8,
      maxRpcAttempts: 8,
      now: () => clock,
      sleep: async (ms) => {
        delays.push(ms);
        clock += ms;
      },
    });

    const logs = await client.getLogs({
      fromBlock: 1n,
      toBlock: 512n,
      address: addresses,
    });

    expect(seen).toEqual([
      { fromBlock: 1n, toBlock: 512n, address: addresses },
      { fromBlock: 1n, toBlock: 512n, address: addresses },
      { fromBlock: 1n, toBlock: 256n, address: addresses },
      { fromBlock: 257n, toBlock: 512n, address: addresses },
    ]);
    expect(delays).toEqual([10]);
    expect(logs.map((log) => log.blockNumber)).toEqual([1n, 256n, 257n, 512n]);
  });
});
