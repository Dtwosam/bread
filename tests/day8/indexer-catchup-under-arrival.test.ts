import { describe, expect, it } from 'vitest';

import type { IndexerProtocolContext } from '../../packages/db/src/index.ts';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: bigint) => `0x${value.toString(16).padStart(64, '0')}`;

const context: IndexerProtocolContext = {
  chainId: 5_042_002,
  stackVersion: 'day8-catchup-test-only',
  factoryAddress: address(1),
  deploymentStartBlock: 100n,
  quoteAsset: address(2),
  quoteDecimals: 6,
};

type CatchUpModule = Readonly<{
  runIndexerCatchUp: (input: Readonly<{
    context: IndexerProtocolContext;
    initialCheckpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
    observeHeadBlock: () => Promise<bigint>;
    readCommittedCheckpoint: () => Promise<Readonly<{ blockNumber: bigint; blockHash: string }>>;
    getBlockHash: (blockNumber: bigint) => Promise<string>;
    overlapBlocks: bigint;
    maxBatchBlocks: bigint;
    maxCycles: number;
    loadRange: (fromBlock: bigint, toBlock: bigint) => Promise<Readonly<{ fromBlock: bigint; toBlock: bigint }>>;
    applyRange: (range: Readonly<{ fromBlock: bigint; toBlock: bigint }>) => Promise<Readonly<{ insertedEventIds: readonly string[] }>>;
  }>) => Promise<Readonly<{
    caughtUp: boolean;
    cycles: number;
    checkpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
    observedHeadBlock: bigint;
  }>>;
}>;

async function loadCatchUpModule(): Promise<CatchUpModule | null> {
  const path = '../../apps/indexer/src/catch-up.ts';
  try {
    return await import(/* @vite-ignore */ path) as CatchUpModule;
  } catch {
    return null;
  }
}

describe('Day 8 06I indexer outage catch-up', () => {
  it('drains a 200-block backlog while a CI-defined sustained arrival profile adds 15 more blocks', async () => {
    const module = await loadCatchUpModule();
    expect(module?.runIndexerCatchUp).toBeTypeOf('function');
    if (!module) return;

    let checkpoint = { blockNumber: 100n, blockHash: hash(100n) };
    let head = 300n;
    let observations = 0;
    const loaded: Array<readonly [bigint, bigint]> = [];
    let applyCalls = 0;

    const result = await module.runIndexerCatchUp({
      context,
      initialCheckpoint: checkpoint,
      observeHeadBlock: async () => {
        const observed = head;
        if (observations < 3) head += 5n;
        observations += 1;
        return observed;
      },
      readCommittedCheckpoint: async () => checkpoint,
      getBlockHash: async (blockNumber) => hash(blockNumber),
      overlapBlocks: 1n,
      maxBatchBlocks: 50n,
      maxCycles: 10,
      loadRange: async (fromBlock, toBlock) => {
        loaded.push([fromBlock, toBlock]);
        return { fromBlock, toBlock };
      },
      applyRange: async (range) => {
        applyCalls += 1;
        checkpoint = { blockNumber: range.toBlock, blockHash: hash(range.toBlock) };
        return { insertedEventIds: [`cycle-${applyCalls}`] };
      },
    });

    expect(result.caughtUp).toBe(true);
    expect(result.checkpoint.blockNumber).toBe(315n);
    expect(result.observedHeadBlock).toBe(315n);
    expect(result.cycles).toBe(5);
    expect(applyCalls).toBe(5);
    expect(loaded).toEqual([
      [100n, 150n],
      [150n, 200n],
      [200n, 250n],
      [250n, 300n],
      [300n, 315n],
    ]);

    const repeat = await module.runIndexerCatchUp({
      context,
      initialCheckpoint: checkpoint,
      observeHeadBlock: async () => 315n,
      readCommittedCheckpoint: async () => checkpoint,
      getBlockHash: async (blockNumber) => hash(blockNumber),
      overlapBlocks: 1n,
      maxBatchBlocks: 50n,
      maxCycles: 10,
      loadRange: async (fromBlock, toBlock) => ({ fromBlock, toBlock }),
      applyRange: async () => {
        throw new Error('already-caught-up replay must not execute');
      },
    });
    expect(repeat).toMatchObject({ caughtUp: true, cycles: 0, observedHeadBlock: 315n });
  });

  it('fails closed when a replay cycle does not advance the committed checkpoint', async () => {
    const module = await loadCatchUpModule();
    expect(module?.runIndexerCatchUp).toBeTypeOf('function');
    if (!module) return;

    const checkpoint = { blockNumber: 100n, blockHash: hash(100n) };
    await expect(module.runIndexerCatchUp({
      context,
      initialCheckpoint: checkpoint,
      observeHeadBlock: async () => 150n,
      readCommittedCheckpoint: async () => checkpoint,
      getBlockHash: async (blockNumber) => hash(blockNumber),
      overlapBlocks: 1n,
      maxBatchBlocks: 25n,
      maxCycles: 4,
      loadRange: async (fromBlock, toBlock) => ({ fromBlock, toBlock }),
      applyRange: async () => ({ insertedEventIds: [] }),
    })).rejects.toThrow('did not advance committed checkpoint');
  });
});
