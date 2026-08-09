import type { IndexerProtocolContext } from '../../../packages/db/src/index.js';

export class CheckpointBlockHashMismatchError extends Error {
  readonly code = 'CHECKPOINT_BLOCK_HASH_MISMATCH' as const;
  readonly blockNumber: bigint;
  readonly expectedHash: string;
  readonly observedHash: string;

  constructor(input: Readonly<{ blockNumber: bigint; expectedHash: string; observedHash: string }>) {
    super(
      `checkpoint block hash mismatch at ${input.blockNumber.toString(10)}: expected ${input.expectedHash}, observed ${input.observedHash}`,
    );
    this.name = 'CheckpointBlockHashMismatchError';
    this.blockNumber = input.blockNumber;
    this.expectedHash = input.expectedHash.toLowerCase();
    this.observedHash = input.observedHash.toLowerCase();
  }
}

export async function verifyCheckpointAnchor(input: Readonly<{
  checkpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
  getBlockHash: (blockNumber: bigint) => Promise<string>;
}>): Promise<void> {
  const observedHash = (await input.getBlockHash(input.checkpoint.blockNumber)).toLowerCase();
  const expectedHash = input.checkpoint.blockHash.toLowerCase();
  if (observedHash !== expectedHash) {
    throw new CheckpointBlockHashMismatchError({
      blockNumber: input.checkpoint.blockNumber,
      expectedHash,
      observedHash,
    });
  }
}

export type LoadedReplayRange = Readonly<{
  fromBlock: bigint;
  toBlock: bigint;
  [key: string]: unknown;
}>;

export type ReplayApplyResult = Readonly<{
  insertedEventIds?: readonly string[];
  [key: string]: unknown;
}>;

export type ReplayOverlapResult<TApply extends ReplayApplyResult> = Readonly<{
  fromBlock: bigint;
  toBlock: bigint;
  applyResult: TApply;
  postCommit: 'SKIPPED_NO_CHANGES' | 'PUBLISHED' | 'DEGRADED';
  postCommitError?: string;
}>;

function boundedReplayStart(
  deploymentStartBlock: bigint,
  checkpointBlock: bigint,
  overlapBlocks: bigint,
): bigint {
  if (deploymentStartBlock < 0n) throw new Error('deploymentStartBlock must be non-negative');
  if (checkpointBlock < deploymentStartBlock) throw new Error('checkpoint precedes deployment start');
  if (overlapBlocks < 0n) throw new Error('overlapBlocks must be non-negative');
  if (overlapBlocks === 0n) return checkpointBlock;
  const candidate = checkpointBlock - overlapBlocks + 1n;
  return candidate < deploymentStartBlock ? deploymentStartBlock : candidate;
}

export async function replayOverlap<TApply extends ReplayApplyResult>(input: Readonly<{
  context: IndexerProtocolContext;
  checkpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
  getBlockHash: (blockNumber: bigint) => Promise<string>;
  targetBlock: bigint;
  overlapBlocks: bigint;
  loadRange: (fromBlock: bigint, toBlock: bigint) => Promise<LoadedReplayRange>;
  applyRange: (range: LoadedReplayRange) => Promise<TApply>;
  publish?: (result: TApply) => Promise<void>;
}>): Promise<ReplayOverlapResult<TApply>> {
  // Arc committed-block continuity is an integrity boundary, not a probabilistic
  // confirmation window. Verify the exact stored anchor before any log load or
  // projection transaction can begin.
  await verifyCheckpointAnchor({
    checkpoint: input.checkpoint,
    getBlockHash: input.getBlockHash,
  });

  if (input.targetBlock < input.checkpoint.blockNumber) {
    throw new Error('replay target cannot regress committed checkpoint');
  }

  const fromBlock = boundedReplayStart(
    input.context.deploymentStartBlock,
    input.checkpoint.blockNumber,
    input.overlapBlocks,
  );
  const loaded = await input.loadRange(fromBlock, input.targetBlock);
  if (loaded.fromBlock !== fromBlock || loaded.toBlock !== input.targetBlock) {
    throw new Error('replay loader returned a range different from the requested bounded overlap');
  }

  // applyRange owns the durable PostgreSQL transaction. Nothing below is
  // allowed to run until that transaction resolves successfully.
  const applyResult = await input.applyRange(loaded);
  const insertedEventIds = applyResult.insertedEventIds ?? [];
  if (insertedEventIds.length === 0 || !input.publish) {
    return {
      fromBlock,
      toBlock: input.targetBlock,
      applyResult,
      postCommit: 'SKIPPED_NO_CHANGES',
    };
  }

  try {
    await input.publish(applyResult);
    return {
      fromBlock,
      toBlock: input.targetBlock,
      applyResult,
      postCommit: 'PUBLISHED',
    };
  } catch (error) {
    // Cache/realtime is acceleration only. The DB transaction has already
    // committed, so publication failure is degraded presentation state and
    // never converted into a rollback/retry of the committed projection.
    return {
      fromBlock,
      toBlock: input.targetBlock,
      applyResult,
      postCommit: 'DEGRADED',
      postCommitError: error instanceof Error ? error.message : String(error),
    };
  }
}
