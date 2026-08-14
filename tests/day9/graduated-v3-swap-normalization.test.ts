import { describe, expect, it } from "vitest";

type SwapModule = Readonly<{
  normalizeGraduatedV3SwapLogs?: (
    input: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
}>;

async function loadSwapModule(): Promise<SwapModule> {
  return (await import("../../apps/indexer/src/v3-swaps.js")) as SwapModule;
}

const address = (nibble: string) => `0x${nibble.repeat(40)}`;
const hash = (nibble: string) => `0x${nibble.repeat(64)}`;

const chainId = 5_042_002;
const stackVersion = "day9-v3-swap-normalization-red";
const token = address("1");
const curve = address("2");
const usdc = address("3");
const pool = address("4");
const otherPool = address("5");
const router = address("6");
const actor = address("7");
const recipientA = address("8");
const recipientB = address("9");
const zeroAddress = address("0");
const blockHash = hash("a");
const transactionHash = hash("b");
const blockNumber = 500n;
const blockTimestamp = 1_786_262_900n;

function registryEntry(quoteIsToken0 = true) {
  return {
    chainId,
    tokenAddress: token,
    curveAddress: curve,
    poolAddress: pool,
    feeTier: 3000,
    quoteIsToken0,
    completion: {
      blockNumber: 400n,
      transactionIndex: 1,
      logIndex: 2,
    },
  } as const;
}

function swapLog(
  logIndex: number,
  amount0: bigint,
  amount1: bigint,
  recipient = recipientA,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    address: pool,
    blockNumber,
    blockHash,
    transactionHash,
    transactionIndex: 3,
    logIndex,
    topics: [hash("f")],
    data: "0x",
    eventName: "Swap",
    args: {
      sender: router,
      recipient,
      amount0,
      amount1,
      sqrtPriceX96: 123n,
      liquidity: 456n,
      tick: -7,
    },
    ...overrides,
  } as const;
}

function chainClient(
  overrides: Readonly<{
    transactionHash?: string;
    transactionBlockNumber?: bigint | null;
    from?: string;
  }> = {},
) {
  const transactionCalls: Array<Readonly<Record<string, unknown>>> = [];
  const blockCalls: Array<Readonly<Record<string, unknown>>> = [];
  return {
    transactionCalls,
    blockCalls,
    value: {
      getTransaction: async (request: Readonly<Record<string, unknown>>) => {
        transactionCalls.push(request);
        return {
          hash: overrides.transactionHash ?? transactionHash,
          blockNumber:
            overrides.transactionBlockNumber === undefined
              ? blockNumber
              : overrides.transactionBlockNumber,
          from: overrides.from ?? actor,
        };
      },
      getBlock: async (request: Readonly<Record<string, unknown>>) => {
        blockCalls.push(request);
        return { timestamp: blockTimestamp };
      },
    },
  };
}

async function normalize(
  module: SwapModule,
  input: Readonly<Record<string, unknown>>,
) {
  expect(module.normalizeGraduatedV3SwapLogs).toBeTypeOf("function");
  return module.normalizeGraduatedV3SwapLogs?.(input);
}

function baseInput(
  client: unknown,
  logs: readonly unknown[],
  quoteIsToken0 = true,
) {
  return {
    client,
    chainId,
    stackVersion,
    quoteAsset: usdc,
    entries: [registryEntry(quoteIsToken0)],
    logs,
  } as const;
}

describe("Day 9 graduated V3 Swap normalization", () => {
  it("normalizes priced Swaps with tx.from actor attribution and cached transaction/block reads", async () => {
    const module = await loadSwapModule();
    const chain = chainClient();

    const result = (await normalize(
      module,
      baseInput(chain.value, [
        swapLog(8, 125n, -50n, recipientA),
        swapLog(9, -75n, 30n, recipientB),
      ]),
    )) as
      | Readonly<{
          events: readonly Readonly<Record<string, unknown>>[];
          trades: readonly Readonly<Record<string, unknown>>[];
        }>
      | undefined;

    expect(chain.transactionCalls).toHaveLength(1);
    expect(chain.blockCalls).toHaveLength(1);
    expect(result?.events).toHaveLength(2);
    expect(result?.events[0]).toMatchObject({
      identity: { chainId, transactionHash, logIndex: 8 },
      blockNumber,
      blockHash,
      blockTimestamp,
      transactionIndex: 3,
      contractAddress: pool,
      contractRole: "V3_POOL",
      stackVersion,
      eventName: "Swap",
      tokenAddress: token,
      curveAddress: curve,
      payload: {
        sender: router,
        recipient: recipientA,
        amount0: 125n,
        amount1: -50n,
      },
    });
    expect(result?.trades).toEqual([
      expect.objectContaining({
        id: { chainId, transactionHash, logIndex: 8 },
        side: "BUY",
        token,
        curve,
        actor,
        recipient: recipientA,
        venueKind: "UNISWAP_V3",
        venueAddress: pool,
        venueFeeTier: 3000,
        quoteAmount: 125n,
        tokenAmount: 50n,
        baseFee: 0n,
        creatorTax: 0n,
        openingTaxBps: 0n,
        openingTax: 0n,
        offeredQuote: null,
        launchBuyExempt: null,
        refund: null,
        netCurveInput: null,
        netQuoteOut: null,
        grossCurveQuoteOut: null,
        executionPriceNumerator: 125n,
        executionPriceDenominator: 50n,
        blockTimestamp,
      }),
      expect.objectContaining({
        id: { chainId, transactionHash, logIndex: 9 },
        side: "SELL",
        actor,
        recipient: recipientB,
        quoteAmount: 75n,
        tokenAmount: 30n,
        executionPriceNumerator: 75n,
        executionPriceDenominator: 30n,
      }),
    ]);
    expect(result?.trades[0]?.actor).not.toBe(router);
  });

  it("uses verified quote-token ordering rather than address ordering", async () => {
    const module = await loadSwapModule();
    const chain = chainClient();

    const result = (await normalize(
      module,
      baseInput(chain.value, [swapLog(8, -50n, 125n)], false),
    )) as
      | Readonly<{
          trades: readonly Readonly<Record<string, unknown>>[];
        }>
      | undefined;

    expect(result?.trades).toEqual([
      expect.objectContaining({
        side: "BUY",
        quoteAmount: 125n,
        tokenAmount: 50n,
      }),
    ]);
  });

  it("retains fee-only positive/zero dust as journal-only without transaction lookup", async () => {
    const module = await loadSwapModule();
    const chain = chainClient();
    chain.value.getTransaction = async () => {
      throw new Error("dust must not read transaction originator");
    };

    const result = (await normalize(
      module,
      baseInput(chain.value, [swapLog(8, 1n, 0n)]),
    )) as
      | Readonly<{
          events: readonly Readonly<Record<string, unknown>>[];
          trades: readonly Readonly<Record<string, unknown>>[];
        }>
      | undefined;

    expect(chain.transactionCalls).toHaveLength(0);
    expect(chain.blockCalls).toHaveLength(1);
    expect(result?.events).toHaveLength(1);
    expect(result?.events[0]).toMatchObject({
      contractRole: "V3_POOL",
      eventName: "Swap",
      tokenAddress: token,
      curveAddress: curve,
    });
    expect(result?.trades).toEqual([]);
  });

  it("fails closed for contradictory transaction provenance", async () => {
    const module = await loadSwapModule();

    await expect(
      normalize(
        module,
        baseInput(chainClient({ transactionHash: hash("c") }).value, [
          swapLog(8, 125n, -50n),
        ]),
      ),
    ).rejects.toThrow("V3 Swap transaction hash mismatch");

    await expect(
      normalize(
        module,
        baseInput(
          chainClient({ transactionBlockNumber: blockNumber + 1n }).value,
          [swapLog(8, 125n, -50n)],
        ),
      ),
    ).rejects.toThrow("V3 Swap transaction block mismatch");

    await expect(
      normalize(
        module,
        baseInput(chainClient({ from: zeroAddress }).value, [
          swapLog(8, 125n, -50n),
        ]),
      ),
    ).rejects.toThrow("V3 Swap transaction sender is not an address");
  });

  it("fails closed for a Swap from an unregistered pool before chain reads", async () => {
    const module = await loadSwapModule();
    const chain = chainClient();

    await expect(
      normalize(
        module,
        baseInput(chain.value, [
          swapLog(8, 125n, -50n, recipientA, { address: otherPool }),
        ]),
      ),
    ).rejects.toThrow("unregistered graduated V3 pool");
    expect(chain.transactionCalls).toHaveLength(0);
    expect(chain.blockCalls).toHaveLength(0);
  });
});
