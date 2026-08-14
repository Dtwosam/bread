import { describe, expect, it } from "vitest";

type VerificationModule = Readonly<{
  verifyGraduatedV3Candidate?: (
    input: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
}>;

async function loadVerificationModule(): Promise<VerificationModule> {
  return (await import("../../apps/indexer/src/graduated-pools.js")) as VerificationModule;
}

const token = "0x1111111111111111111111111111111111111111";
const curve = "0x2222222222222222222222222222222222222222";
const coordinator = "0x3333333333333333333333333333333333333333";
const adapter = "0x4444444444444444444444444444444444444444";
const usdc = "0x5555555555555555555555555555555555555555";
const positionManager = "0x6666666666666666666666666666666666666666";
const factory = "0x7777777777777777777777777777777777777777";
const pool = "0x8888888888888888888888888888888888888888";
const other = "0x9999999999999999999999999999999999999999";
const configHash = `0x${"ab".repeat(32)}`;
const poolId = `0x${"0".repeat(24)}${pool.slice(2)}`;

const context = {
  chainId: 5042002,
  quoteAsset: usdc,
  graduatedTrading: {
    family: "UNISWAP_V3",
    factory,
    positionManager,
  },
} as const;

const launch = {
  chainId: 5042002,
  tokenAddress: token,
  curveAddress: curve,
  graduationCoordinator: coordinator,
  graduationAdapter: adapter,
  graduationAdapterFamily: 2,
  graduationConfigHash: configHash,
} as const;

const completion = {
  contractAddress: coordinator,
  token,
  adapter,
  poolId,
  positionManager,
  blockNumber: 123n,
  transactionIndex: 4,
  logIndex: 7,
} as const;

type Override = Readonly<{
  address?: string;
  functionName: string;
  value: unknown;
}>;

function fakeClient(overrides: readonly Override[] = []) {
  const calls: Array<Readonly<{ address: string; functionName: string }>> = [];
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
  for (const override of overrides) {
    values[`${override.address ?? adapter}:${override.functionName}`] =
      override.value;
  }

  return {
    calls,
    client: {
      readContract: async (request: Readonly<Record<string, unknown>>) => {
        const address = String(request.address).toLowerCase();
        const functionName = String(request.functionName);
        calls.push({ address, functionName });
        if (functionName === "liquidity") {
          throw new Error("historical verification must not read liquidity");
        }
        const key = `${address}:${functionName}`;
        if (!(key in values)) throw new Error(`unexpected read ${key}`);
        return values[key];
      },
    },
  };
}

async function verify(
  module: VerificationModule,
  client: unknown,
  launchOverride: Readonly<Record<string, unknown>> = {},
  completionOverride: Readonly<Record<string, unknown>> = {},
) {
  expect(module.verifyGraduatedV3Candidate).toBeTypeOf("function");
  return module.verifyGraduatedV3Candidate?.({
    client,
    context,
    launch: { ...launch, ...launchOverride },
    completion: { ...completion, ...completionOverride },
  });
}

describe("Day 9 immutable graduated V3 candidate verification", () => {
  it("verifies exact adapter/factory/pair/fee/pool identity without consulting liquidity", async () => {
    const module = await loadVerificationModule();
    const { client, calls } = fakeClient();

    const result = (await verify(module, client)) as
      Readonly<{ poolAddress: string; feeTier: number }> | undefined;

    expect(result?.poolAddress).toBe(pool);
    expect(result?.feeTier).toBe(3000);
    expect(calls.some((call) => call.functionName === "liquidity")).toBe(false);
  });

  it("fails closed for launch/completion authority mismatch", async () => {
    const module = await loadVerificationModule();
    const { client } = fakeClient();

    await expect(
      verify(module, client, { graduationAdapterFamily: 1 }),
    ).rejects.toThrow("graduated launch is not UNISWAP_V3");
    await expect(
      verify(module, client, {}, { contractAddress: other }),
    ).rejects.toThrow("graduation completion identity mismatch");
    await expect(
      verify(module, client, {}, { adapter: other }),
    ).rejects.toThrow("graduation completion identity mismatch");
    await expect(
      verify(module, client, {}, { positionManager: other }),
    ).rejects.toThrow("graduation completion identity mismatch");
  });

  it("fails closed for immutable adapter identity mismatch", async () => {
    const module = await loadVerificationModule();
    const { client } = fakeClient([
      { functionName: "configHash", value: `0x${"cd".repeat(32)}` },
    ]);

    await expect(verify(module, client)).rejects.toThrow(
      "graduated adapter identity mismatch",
    );
  });

  it("fails closed for factory or pool pair/fee mismatch", async () => {
    const module = await loadVerificationModule();
    const wrongFactory = fakeClient([
      { address: factory, functionName: "getPool", value: other },
    ]);
    await expect(verify(module, wrongFactory.client)).rejects.toThrow(
      "graduated pool identity mismatch",
    );

    const wrongPair = fakeClient([
      { address: pool, functionName: "token1", value: other },
    ]);
    await expect(verify(module, wrongPair.client)).rejects.toThrow(
      "graduated pool identity mismatch",
    );
  });

  it("reuses the strict canonical poolId decoder", async () => {
    const module = await loadVerificationModule();
    const { client } = fakeClient();

    await expect(
      verify(module, client, {}, { poolId: `0x${"1".repeat(64)}` }),
    ).rejects.toThrow("invalid canonical graduated pool id");
  });
});
