import { describe, expect, it } from "vitest";

import { launchState } from "../../packages/db/src/schema/projections.js";

type RegistryModule = Readonly<{
  buildGraduatedPoolRegistry?: (rows: readonly Record<string, unknown>[]) => unknown;
}>;

async function loadRegistryModule(): Promise<RegistryModule> {
  try {
    return (await import("../../apps/indexer/src/graduated-pools.js")) as RegistryModule;
  } catch {
    return {};
  }
}

const tokenA = "0x1111111111111111111111111111111111111111";
const tokenB = "0x2222222222222222222222222222222222222222";
const curveA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const curveB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const poolA = "0x3333333333333333333333333333333333333333";
const poolB = "0x4444444444444444444444444444444444444444";

function row(tokenAddress: string, curveAddress: string, poolAddress: string) {
  return {
    chainId: 5042002,
    tokenAddress,
    curveAddress,
    graduatedVenueKind: "UNISWAP_V3",
    graduatedVenueAddress: poolAddress,
    graduatedVenueFeeTier: 3000,
    graduationCompletedBlock: 123n,
    graduationCompletedTransactionIndex: 4,
    graduationCompletedLogIndex: 7,
  } as const;
}

describe("Day 9 canonical graduated V3 registry", () => {
  it("exposes additive durable venue identity on launch_state", () => {
    const schema = launchState as unknown as Record<string, unknown>;
    expect(schema.graduatedVenueKind).toBeDefined();
    expect(schema.graduatedVenueAddress).toBeDefined();
    expect(schema.graduatedVenueFeeTier).toBeDefined();
  });

  it("builds an exact token/pool registry from canonical persisted rows", async () => {
    const module = await loadRegistryModule();
    expect(module.buildGraduatedPoolRegistry).toBeTypeOf("function");

    const registry = module.buildGraduatedPoolRegistry?.([
      row(tokenA, curveA, poolA),
      row(tokenB, curveB, poolB),
    ]) as
      | Readonly<{
          byToken: ReadonlyMap<string, Readonly<{ poolAddress: string; feeTier: number }>>;
          byPool: ReadonlyMap<string, Readonly<{ tokenAddress: string }>>;
        }>
      | undefined;

    expect(registry?.byToken.get(tokenA)?.poolAddress).toBe(poolA);
    expect(registry?.byToken.get(tokenA)?.feeTier).toBe(3000);
    expect(registry?.byPool.get(poolB)?.tokenAddress).toBe(tokenB);
  });

  it("fails closed when one Bread token maps to two pools", async () => {
    const module = await loadRegistryModule();
    expect(module.buildGraduatedPoolRegistry).toBeTypeOf("function");
    expect(() =>
      module.buildGraduatedPoolRegistry?.([
        row(tokenA, curveA, poolA),
        row(tokenA, curveA, poolB),
      ]),
    ).toThrow("conflicting graduated V3 registry identity");
  });

  it("fails closed when one pool maps to two Bread tokens", async () => {
    const module = await loadRegistryModule();
    expect(module.buildGraduatedPoolRegistry).toBeTypeOf("function");
    expect(() =>
      module.buildGraduatedPoolRegistry?.([
        row(tokenA, curveA, poolA),
        row(tokenB, curveB, poolA),
      ]),
    ).toThrow("conflicting graduated V3 registry identity");
  });
});
