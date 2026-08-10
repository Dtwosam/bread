import type { IndexerProtocolContext } from '../../../packages/db/src/index.js';
import {
  replayOverlap,
  type LoadedReplayRange,
  type ReplayApplyResult,
} from './replay.js';

export type IndexerCheckpoint = Readonly<{
  blockNumber: bigint;
  blockHash: string;
}>;

export type IndexerCatchUpResult = Readonly<{
  caughtUp: boolean;
  cycles: number;
  checkpoint: IndexerCheckpoint;
  observedHeadBlock: bigint;
}>;

type CatchUpInput<TApply extends ReplayApplyResult> = Readonly<{
  context: IndexerProtocolContext;
  initialCheckpoint: IndexerCheckpoint;
  observeHeadBlock: () => Promise<bigint>;
  readCommittedCheckpoint: () => Promise<IndexerCheckpoint>;
  getBlockHash: (blockNumber: bigint) => Promise<string>;
  overlapBlocks: bigint;
  maxBatchBlocks: bigint;
  maxCycles: number;
  loadRange: (fromBlock: bigint, toBlock: bigint) => Promise<LoadedReplayRange>;
  applyRange: (range: LoadedReplayRange) => Promise<TApply>;
  publish?: (result: TApply) => Promise<void>;
}>;

function requirePositiveBigint(value: bigint, label: string): bigint {
  if (value <= 0n) throw new Error(`${label} must be positive`);
  return value;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function boundedTarget(checkpoint: bigint, observedHead: bigint, maxBatchBlocks: bigint): bigint {
  const candidate = checkpoint + maxBatchBlocks;
  return candidate < observedHead ? candidate : observedHead;
}

/**
 * Day-8 outage recovery controller for the existing replay/apply transaction
 * boundary. Runtime callers retain ownership of RPC selection, committed-head
 * observation, DB checkpoint reads, and range application. This controller
 * only bounds catch-up work and refuses to spin when durable progress stalls.
 */
export async function runIndexerCatchUp<TApply extends ReplayApplyResult>(
  input: CatchUpInput<TApply>,
): Promise<IndexerCatchUpResult> {
  const maxBatchBlocks = requirePositiveBigint(input.maxBatchBlocks, 'maxBatchBlocks');
  const maxCycles = requirePositiveInteger(input.maxCycles, 'maxCycles');
  if (input.overlapBlocks < 0n) throw new Error('overlapBlocks must be non-negative');

  let checkpoint = input.initialCheckpoint;
  let observedHeadBlock = await input.observeHeadBlock();
  if (observedHeadBlock < checkpoint.blockNumber) {
    throw new Error('observed head regressed below committed checkpoint');
  }

  let cycles = 0;
  while (checkpoint.blockNumber < observedHeadBlock && cycles < maxCycles) {
    const priorCheckpoint = checkpoint;
    const targetBlock = boundedTarget(priorCheckpoint.blockNumber, observedHeadBlock, maxBatchBlocks);

    await replayOverlap({
      context: input.context,
      checkpoint: priorCheckpoint,
      getBlockHash: input.getBlockHash,
      targetBlock,
      overlapBlocks: input.overlapBlocks,
      loadRange: input.loadRange,
      applyRange: input.applyRange,
      publish: input.publish,
    });

    const committed = await input.readCommittedCheckpoint();
    if (committed.blockNumber < priorCheckpoint.blockNumber) {
      throw new Error('indexer catch-up regressed committed checkpoint');
    }
    if (committed.blockNumber < targetBlock) {
      throw new Error('indexer catch-up replay did not advance committed checkpoint to the requested target');
    }

    checkpoint = committed;
    cycles += 1;

    const nextObservedHead = await input.observeHeadBlock();
    if (nextObservedHead < checkpoint.blockNumber) {
      throw new Error('observed head regressed below committed checkpoint during catch-up');
    }
    if (nextObservedHead < observedHeadBlock) {
      throw new Error('observed head regressed during catch-up');
    }
    observedHeadBlock = nextObservedHead;
  }

  return {
    caughtUp: checkpoint.blockNumber >= observedHeadBlock,
    cycles,
    checkpoint,
    observedHeadBlock,
  };
}
