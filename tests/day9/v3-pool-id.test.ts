import { describe, expect, it } from "vitest";

const pool = "0x1234567890abcdef1234567890abcdef12345678";
const encoded = `0x${"0".repeat(24)}${pool.slice(2)}`;

type PoolAddressFromId = (value: unknown) => string;

async function loadPoolAddressFromId(): Promise<PoolAddressFromId | undefined> {
  try {
    const module = await import("../../packages/protocol-sdk/src/v3-pool.js");
    return module.poolAddressFromId as PoolAddressFromId | undefined;
  } catch {
    return undefined;
  }
}

describe("Day 9 strict graduated V3 poolId decoding", () => {
  it("exposes a Bread-owned strict poolId decoder", async () => {
    const poolAddressFromId = await loadPoolAddressFromId();
    expect(poolAddressFromId).toBeTypeOf("function");
  });

  it("decodes the canonical zero-prefixed bytes32 address form", async () => {
    const poolAddressFromId = await loadPoolAddressFromId();
    expect(poolAddressFromId).toBeTypeOf("function");
    expect(poolAddressFromId?.(encoded)).toBe(pool);
  });

  it.each([
    "0x",
    `0x${"0".repeat(63)}`,
    `0x${"1".repeat(24)}${pool.slice(2)}`,
    `0x${"0".repeat(64)}`,
  ])("fails closed for malformed or non-canonical poolId %s", async (value) => {
    const poolAddressFromId = await loadPoolAddressFromId();
    expect(poolAddressFromId).toBeTypeOf("function");
    expect(() => poolAddressFromId?.(value)).toThrow(
      "invalid canonical graduated pool id",
    );
  });
});
