import { describe, expect, it } from "vitest";

import { poolAddressFromId } from "../../packages/protocol-sdk/src/v3-pool.js";

const pool = "0x1234567890abcdef1234567890abcdef12345678";
const encoded = `0x${"0".repeat(24)}${pool.slice(2)}`;

describe("Day 9 strict graduated V3 poolId decoding", () => {
  it("decodes the canonical zero-prefixed bytes32 address form", () => {
    expect(poolAddressFromId(encoded)).toBe(pool);
  });

  it.each([
    "0x",
    `0x${"0".repeat(63)}`,
    `0x${"1".repeat(24)}${pool.slice(2)}`,
    `0x${"0".repeat(64)}`,
  ])("fails closed for malformed or non-canonical poolId %s", (value) => {
    expect(() => poolAddressFromId(value)).toThrow(
      "invalid canonical graduated pool id",
    );
  });
});
