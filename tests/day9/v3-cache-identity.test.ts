import { describe, expect, it } from "vitest";

import type { Address } from "../../packages/types/src/index.js";

type CacheIdentityModule = Readonly<{
  BREAD_PROJECTION_CACHE_SCHEMA_VERSION?: string;
  tokenProjectionCacheChannel?: (input: Readonly<{
    chainId: number;
    tokenAddress: Address;
  }>) => string;
  stackFeedProjectionCacheChannel?: (input: Readonly<{
    chainId: number;
    stackVersion: string;
    factoryAddress: Address;
  }>) => string;
  projectionCacheGenerationKey?: (input: Readonly<{
    schemaVersion: string;
    channel: string;
  }>) => string;
}>;

async function loadModule(): Promise<CacheIdentityModule> {
  return (await import("../../packages/types/src/index.js")) as CacheIdentityModule;
}

const factoryA = "0x1111111111111111111111111111111111111111" as Address;
const factoryB = "0x2222222222222222222222222222222222222222" as Address;
const token = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD" as Address;

describe("Day 9 shared projection-cache identity", () => {
  it("owns one explicit cache schema marker separate from event decoder schema", async () => {
    const module = await loadModule();
    expect(module.BREAD_PROJECTION_CACHE_SCHEMA_VERSION).toBe(
      "bread-projection-v1",
    );
  });

  it("makes stack-feed identity factory-specific for the same chain and stack version", async () => {
    const module = await loadModule();
    expect(module.stackFeedProjectionCacheChannel).toBeTypeOf("function");

    const left = module.stackFeedProjectionCacheChannel?.({
      chainId: 5_042_002,
      stackVersion: "v3",
      factoryAddress: factoryA,
    });
    const right = module.stackFeedProjectionCacheChannel?.({
      chainId: 5_042_002,
      stackVersion: "v3",
      factoryAddress: factoryB,
    });

    expect(left).toBe(`stack:5042002:v3:${factoryA}:feed`);
    expect(right).toBe(`stack:5042002:v3:${factoryB}:feed`);
    expect(left).not.toBe(right);
  });

  it("canonicalizes token channels and builds the one shared Redis generation key", async () => {
    const module = await loadModule();
    expect(module.tokenProjectionCacheChannel).toBeTypeOf("function");
    expect(module.projectionCacheGenerationKey).toBeTypeOf("function");

    const channel = module.tokenProjectionCacheChannel?.({
      chainId: 5_042_002,
      tokenAddress: token,
    });
    expect(channel).toBe(`token:5042002:${token.toLowerCase()}`);
    expect(
      module.projectionCacheGenerationKey?.({
        schemaVersion: "bread-projection-v1",
        channel: channel ?? "",
      }),
    ).toBe(
      `bread:generation:bread-projection-v1:token:5042002:${token.toLowerCase()}`,
    );
  });

  it("fails closed on malformed chain, stack, address, schema, or channel identity", async () => {
    const module = await loadModule();
    const stackChannel = module.stackFeedProjectionCacheChannel;
    const tokenChannel = module.tokenProjectionCacheChannel;
    const generationKey = module.projectionCacheGenerationKey;
    expect(stackChannel).toBeTypeOf("function");
    expect(tokenChannel).toBeTypeOf("function");
    expect(generationKey).toBeTypeOf("function");

    expect(() =>
      stackChannel?.({
        chainId: 0,
        stackVersion: "v3",
        factoryAddress: factoryA,
      }),
    ).toThrow();
    expect(() =>
      stackChannel?.({
        chainId: 5_042_002,
        stackVersion: "",
        factoryAddress: factoryA,
      }),
    ).toThrow();
    expect(() =>
      tokenChannel?.({
        chainId: 5_042_002,
        tokenAddress: "0x1234" as Address,
      }),
    ).toThrow();
    expect(() =>
      generationKey?.({
        schemaVersion: "",
        channel: "token:5042002:bad",
      }),
    ).toThrow();
    expect(() =>
      generationKey?.({
        schemaVersion: "bread-projection-v1",
        channel: "",
      }),
    ).toThrow();
  });
});
