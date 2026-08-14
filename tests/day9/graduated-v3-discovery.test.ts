import { describe, expect, it } from "vitest";

type RpcLog = Readonly<{
  address: string;
  blockNumber: bigint;
  blockHash: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  topics: readonly string[];
  data: string;
  eventName?: string;
  args?: Readonly<Record<string, unknown>>;
}>;

type RegistryEntry = Readonly<{
  chainId: number;
  tokenAddress: string;
  curveAddress: string;
  poolAddress: string;
  feeTier: number;
  completion: Readonly<{
    blockNumber: bigint;
    transactionIndex: number;
    logIndex: number;
  }>;
}>;

type DiscoveryModule = Readonly<{
  discoverGraduatedV3SwapLogs?: (input: Readonly<{
    client: Readonly<{
      getLogs: (
        request: Readonly<Record<string, unknown>>,
      ) => Promise<readonly RpcLog[]>;
    }>;
    chainId: number;
    entries: readonly RegistryEntry[];
    fromBlock: bigint;
    toBlock: bigint;
  }>) => Promise<readonly RpcLog[]>;
}>;

async function loadDiscoveryModule(): Promise<DiscoveryModule> {
  return (await import("../../apps/indexer/src/graduated-pools.js")) as DiscoveryModule;
}

function address(value: number): string {
  return `0x${value.toString(16).padStart(40, "0")}`;
}

function hash(value: number): string {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function entry(
  index: number,
  completionBlock: bigint,
  transactionIndex = 0,
  logIndex = 0,
): RegistryEntry {
  return {
    chainId: 5042002,
    tokenAddress: address(1000 + index),
    curveAddress: address(2000 + index),
    poolAddress: address(3000 + index),
    feeTier: 3000,
    completion: {
      blockNumber: completionBlock,
      transactionIndex,
      logIndex,
    },
  };
}

function log(
  poolAddress: string,
  blockNumber: bigint,
  transactionHashSeed: number,
  transactionIndex: number,
  logIndex: number,
  blockHashSeed = Number(blockNumber),
): RpcLog {
  return {
    address: poolAddress,
    blockNumber,
    blockHash: hash(blockHashSeed),
    transactionHash: hash(transactionHashSeed),
    transactionIndex,
    logIndex,
    topics: [],
    data: "0x",
    eventName: "Swap",
    args: {},
  };
}

async function discover(
  module: DiscoveryModule,
  input: Parameters<NonNullable<DiscoveryModule["discoverGraduatedV3SwapLogs"]>>[0],
) {
  expect(module.discoverGraduatedV3SwapLogs).toBeTypeOf("function");
  return module.discoverGraduatedV3SwapLogs?.(input);
}

describe("Day 9 bounded exact graduated V3 Swap discovery", () => {
  it("queries only eligible verified pools from each pool's own completion boundary", async () => {
    const module = await loadDiscoveryModule();
    const entries = [entry(1, 90n), entry(2, 110n, 4, 7), entry(3, 130n)];
    const requests: Array<Readonly<Record<string, unknown>>> = [];
    const client = {
      getLogs: async (request: Readonly<Record<string, unknown>>) => {
        requests.push(request);
        if (request.fromBlock === 100n) {
          return [log(entries[0].poolAddress, 101n, 1, 0, 1)];
        }
        if (request.fromBlock === 110n) {
          return [log(entries[1].poolAddress, 111n, 2, 0, 1)];
        }
        return [];
      },
    };

    const result = await discover(module, {
      client,
      chainId: 5042002,
      entries,
      fromBlock: 100n,
      toBlock: 120n,
    });

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.fromBlock)).toEqual([100n, 110n]);
    expect(requests.every((request) => request.toBlock === 120n)).toBe(true);
    expect(JSON.stringify(requests)).not.toContain(entries[2].poolAddress);
    expect(result?.map((item) => item.address)).toEqual([
      entries[0].poolAddress,
      entries[1].poolAddress,
    ]);
  });

  it("retains same-block pool logs only when they are strictly after GraduationCompleted", async () => {
    const module = await loadDiscoveryModule();
    const graduated = entry(1, 110n, 4, 7);
    const candidateLogs = [
      log(graduated.poolAddress, 110n, 1, 4, 6),
      log(graduated.poolAddress, 110n, 2, 4, 7),
      log(graduated.poolAddress, 110n, 3, 4, 8),
      log(graduated.poolAddress, 110n, 4, 5, 0),
      log(graduated.poolAddress, 111n, 5, 0, 0),
    ];

    const result = await discover(module, {
      client: { getLogs: async () => candidateLogs },
      chainId: 5042002,
      entries: [graduated],
      fromBlock: 100n,
      toBlock: 120n,
    });

    expect(
      result?.map((item) => [
        item.blockNumber,
        item.transactionIndex,
        item.logIndex,
      ]),
    ).toEqual([
      [110n, 4, 8],
      [110n, 5, 0],
      [111n, 0, 0],
    ]);
  });

  it("deduplicates canonical log identities and fails closed on contradictions", async () => {
    const module = await loadDiscoveryModule();
    const first = entry(1, 90n);
    const second = entry(2, 90n);
    const duplicate = log(first.poolAddress, 101n, 9, 0, 3);

    const deduped = await discover(module, {
      client: { getLogs: async () => [duplicate, duplicate] },
      chainId: 5042002,
      entries: [first],
      fromBlock: 100n,
      toBlock: 120n,
    });
    expect(deduped).toEqual([duplicate]);

    await expect(
      discover(module, {
        client: {
          getLogs: async () => [
            duplicate,
            { ...duplicate, address: second.poolAddress },
          ],
        },
        chainId: 5042002,
        entries: [first, second],
        fromBlock: 100n,
        toBlock: 120n,
      }),
    ).rejects.toThrow("contradictory canonical V3 log identity");
  });

  it("chunks exact pool addresses deterministically at the existing provider-safe bound", async () => {
    const module = await loadDiscoveryModule();
    const entries = Array.from({ length: 65 }, (_, index) => entry(index + 1, 1n)).reverse();
    const requests: Array<Readonly<Record<string, unknown>>> = [];

    await discover(module, {
      client: {
        getLogs: async (request) => {
          requests.push(request);
          return [];
        },
      },
      chainId: 5042002,
      entries,
      fromBlock: 10n,
      toBlock: 20n,
    });

    expect(requests).toHaveLength(2);
    expect((requests[0].address as readonly string[])).toHaveLength(64);
    expect((requests[1].address as readonly string[])).toHaveLength(1);
    const queried = requests.flatMap(
      (request) => request.address as readonly string[],
    );
    expect(queried).toEqual(entries.map((item) => item.poolAddress).sort());
  });

  it("fails closed for an inverted discovery range before issuing RPC work", async () => {
    const module = await loadDiscoveryModule();
    let calls = 0;

    await expect(
      discover(module, {
        client: {
          getLogs: async () => {
            calls += 1;
            return [];
          },
        },
        chainId: 5042002,
        entries: [entry(1, 1n)],
        fromBlock: 20n,
        toBlock: 10n,
      }),
    ).rejects.toThrow("graduated V3 discovery range end precedes start");
    expect(calls).toBe(0);
  });
});
