import { describe, expect, it } from "vitest";

type SwapModule = Readonly<{
  classifyV3SwapAmounts?: (input: Readonly<Record<string, unknown>>) => unknown;
}>;

async function loadSwapModule(): Promise<SwapModule> {
  try {
    return (await import("../../apps/indexer/src/v3-swaps.js")) as SwapModule;
  } catch {
    return {};
  }
}

const token = "0x1111111111111111111111111111111111111111";
const usdc = "0x2222222222222222222222222222222222222222";

async function classify(input: Readonly<Record<string, unknown>>) {
  const module = await loadSwapModule();
  expect(module.classifyV3SwapAmounts).toBeTypeOf("function");
  return module.classifyV3SwapAmounts?.(input);
}

describe("Day 9 graduated V3 Swap signed amount classification", () => {
  it.each([
    {
      label: "BUY when USDC is token0",
      token0: usdc,
      token1: token,
      amount0: 125n,
      amount1: -50n,
      side: "BUY",
      quoteAmount: 125n,
      tokenAmount: 50n,
    },
    {
      label: "SELL when USDC is token0",
      token0: usdc,
      token1: token,
      amount0: -125n,
      amount1: 50n,
      side: "SELL",
      quoteAmount: 125n,
      tokenAmount: 50n,
    },
    {
      label: "BUY when USDC is token1",
      token0: token,
      token1: usdc,
      amount0: -50n,
      amount1: 125n,
      side: "BUY",
      quoteAmount: 125n,
      tokenAmount: 50n,
    },
    {
      label: "SELL when USDC is token1",
      token0: token,
      token1: usdc,
      amount0: 50n,
      amount1: -125n,
      side: "SELL",
      quoteAmount: 125n,
      tokenAmount: 50n,
    },
  ])("classifies $label with exact quote/token amounts", async (fixture) => {
    await expect(
      classify({
        tokenAddress: token,
        quoteAsset: usdc,
        token0: fixture.token0,
        token1: fixture.token1,
        amount0: fixture.amount0,
        amount1: fixture.amount1,
      }),
    ).resolves.toEqual({
      disposition: "PRICED_TRADE",
      side: fixture.side,
      quoteAmount: fixture.quoteAmount,
      tokenAmount: fixture.tokenAmount,
    });
  });

  it.each([
    [1n, 0n],
    [0n, 1n],
  ])(
    "classifies fee-only positive/zero dust as journal-only (%s, %s)",
    async (amount0, amount1) => {
      await expect(
        classify({
          tokenAddress: token,
          quoteAsset: usdc,
          token0: usdc,
          token1: token,
          amount0,
          amount1,
        }),
      ).resolves.toEqual({ disposition: "JOURNAL_ONLY_DUST" });
    },
  );

  it.each([
    [0n, 0n],
    [1n, 1n],
    [-1n, -1n],
    [-1n, 0n],
    [0n, -1n],
  ])(
    "fails closed for invalid signed amount pair (%s, %s)",
    async (amount0, amount1) => {
      await expect(
        classify({
          tokenAddress: token,
          quoteAsset: usdc,
          token0: usdc,
          token1: token,
          amount0,
          amount1,
        }),
      ).rejects.toThrow("invalid canonical V3 Swap signed amounts");
    },
  );

  it("fails closed when verified TOKEN/USDC ordering is not exact", async () => {
    await expect(
      classify({
        tokenAddress: token,
        quoteAsset: usdc,
        token0: token,
        token1: token,
        amount0: -50n,
        amount1: 125n,
      }),
    ).rejects.toThrow("invalid canonical V3 pool token ordering");
  });

  it("fails closed for non-bigint Swap amounts", async () => {
    await expect(
      classify({
        tokenAddress: token,
        quoteAsset: usdc,
        token0: usdc,
        token1: token,
        amount0: "125",
        amount1: -50n,
      }),
    ).rejects.toThrow("invalid canonical V3 Swap signed amounts");
  });
});
