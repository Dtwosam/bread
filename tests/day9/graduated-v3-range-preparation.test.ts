import { describe, expect, it } from "vitest";

type RangeModule = Readonly<{
  prepareGraduatedV3Range?: (
    input: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
}>;

async function loadRangeModule(): Promise<RangeModule> {
  return (await import("../../apps/indexer/src/graduated-pools.js")) as RangeModule;
}

const chainId = 5042002;
const token = "0x1111111111111111111111111111111111111111";
const curve = "0x2222222222222222222222222222222222222222";
const coordinator = "0x3333333333333333333333333333333333333333";
const adapter = "0x4444444444444444444444444444444444444444";
const usdc = "0x5555555555555555555555555555555555555555";
const positionManager = "0x6666666666666666666666666666666666666666";
const factory = "0x7777777777777777777777777777777777777777";
const pool = "0x8888888888888888888888888888888888888888";
const persistedToken = "0x9999999999999999999999999999999999999999";
const persistedCurve = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const persistedPool = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const configHash = `0x${"ab".repeat(32)}`;
const poolId = `0x${"0".repeat(24)}${pool.slice(2)}`;

const context = {
  chainId,
  quoteAsset: usdc,
  graduatedTrading: {
    family: "UNISWAP_V3",
    factory,
    positionManager,
  },
} as const;

const launch = {
  chainId,
  tokenAddress: token,
  curveAddress: curve,
  graduationCoordinator: coordinator,
  graduationAdapter: adapter,
  graduationAdapterFamily: 2,
  graduationConfigHash: configHash,
} as const;

function completionEvent() {
  return {
    identity: {
      chainId,
      transactionHash: `0x${"12".repeat(32)}`,
      logIndex: 7,
    },
    blockNumber: 110n,
    transactionIndex: 4,
    contractAddress: coordinator,
    eventName: "GraduationCompleted",
    payload: {
      token,
      adapter,
      poolId,
      positionManager,
    },
  } as const;
}

function persistedRow() {
  return {
    chainId,
    tokenAddress: persistedToken,
    curveAddress: persistedCurve,
    graduatedVenueKind: "UNISWAP_V3",
    graduatedVenueAddress: persistedPool,
    graduatedVenueFeeTier: 3000,
    graduationCompletedBlock: 80n,
    graduationCompletedTransactionIndex: 1,
    graduationCompletedLogIndex: 2,
  } as const;
}

function client() {
  const logRequests: Array<Readonly<Record<string, unknown>>> = [];
  return {
    logRequests,
    value: {
      readContract: async (request: Readonly<Record<string, unknown>>) => {
        const address = String(request.address).toLowerCase();
        const functionName = String(request.functionName);
        const values: Record<string, unknown> = {
          [`${adapter}:family`]: 2n,
          [`${adapter}:coordinator`]: coordinator,
          [`${adapter}:configHash`]: configHash,
          [`${adapter}:usdc`]: usdc,
          [`${adapter}:positionManager`]: positionManager,
          [`${adapter}:v3Factory`]: factory,
          [`${adapter}:fee`]: 3000n,
          [`${factory}:getPool`]: pool,
          [`${pool}:token0`]: usdc,
          [`${pool}:token1`]: token,
          [`${pool}:fee`]: 3000n,
        };
        const key = `${address}:${functionName}`;
        if (!(key in values)) throw new Error(`unexpected read ${key}`);
        return values[key];
      },
      getLogs: async (request: Readonly<Record<string, unknown>>) => {
        logRequests.push(request);
        return [];
      },
    },
  };
}

async function prepare(
  module: RangeModule,
  input: Readonly<Record<string, unknown>>,
) {
  expect(module.prepareGraduatedV3Range).toBeTypeOf("function");
  return module.prepareGraduatedV3Range?.(input);
}

describe("Day 9 same-range graduated V3 preparation", () => {
  it("verifies a same-range completion before combining it with persisted verified pools for discovery", async () => {
    const module = await loadRangeModule();
    const chain = client();
    let readLaunchCalls = 0;

    const result = (await prepare(module, {
      client: chain.value,
      context,
      persistedRows: [persistedRow()],
      normalized: {
        events: [completionEvent()],
        launchSnapshots: new Map([["same-range", launch]]),
      },
      readLaunch: async () => {
        readLaunchCalls += 1;
        return undefined;
      },
      fromBlock: 100n,
      toBlock: 120n,
    })) as
      | Readonly<{
          registry: Readonly<{
            byToken: ReadonlyMap<string, Readonly<{ poolAddress: string }>>;
          }>;
          sameRangeVerified: readonly Readonly<{
            tokenAddress: string;
            poolAddress: string;
          }>[];
        }>
      | undefined;

    expect(readLaunchCalls).toBe(0);
    expect(result?.registry.byToken.get(token)?.poolAddress).toBe(pool);
    expect(result?.registry.byToken.get(persistedToken)?.poolAddress).toBe(
      persistedPool,
    );
    expect(result?.sameRangeVerified).toEqual([
      expect.objectContaining({ tokenAddress: token, poolAddress: pool }),
    ]);
    expect(chain.logRequests.map((request) => request.fromBlock)).toEqual([
      100n,
      110n,
    ]);
  });

  it("uses the persisted launch snapshot for an existing token that graduates in the current range", async () => {
    const module = await loadRangeModule();
    const chain = client();
    let requestedToken: string | undefined;

    const result = (await prepare(module, {
      client: chain.value,
      context,
      persistedRows: [],
      normalized: {
        events: [completionEvent()],
        launchSnapshots: new Map(),
      },
      readLaunch: async (value: string) => {
        requestedToken = value;
        return launch;
      },
      fromBlock: 100n,
      toBlock: 120n,
    })) as
      | Readonly<{
          registry: Readonly<{
            byToken: ReadonlyMap<string, Readonly<{ poolAddress: string }>>;
          }>;
        }>
      | undefined;

    expect(requestedToken).toBe(token);
    expect(result?.registry.byToken.get(token)?.poolAddress).toBe(pool);
  });

  it("fails closed when GraduationCompleted has no canonical launch snapshot", async () => {
    const module = await loadRangeModule();
    const chain = client();

    await expect(
      prepare(module, {
        client: chain.value,
        context,
        persistedRows: [],
        normalized: {
          events: [completionEvent()],
          launchSnapshots: new Map(),
        },
        readLaunch: async () => undefined,
        fromBlock: 100n,
        toBlock: 120n,
      }),
    ).rejects.toThrow(
      "missing canonical launch snapshot for GraduationCompleted",
    );
    expect(chain.logRequests).toHaveLength(0);
  });
});
