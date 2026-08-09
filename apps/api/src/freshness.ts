import type { FreshnessMeta, FreshnessStatus, Hex32 } from '../../../packages/types/src/index.js';

export type FreshnessCheckpoint = Readonly<{
  stackVersion: string;
  indexedThroughBlock: bigint;
  indexedThroughBlockHash: string;
  indexedThroughBlockTimestamp: bigint | null;
  decoderSchemaVersion: string;
  status: string;
}>;

export function buildFreshness(
  chainId: number,
  checkpoint: FreshnessCheckpoint,
  observedHeadBlock: bigint,
  now: Date,
): FreshnessMeta {
  if (checkpoint.indexedThroughBlockTimestamp === null) {
    throw new Error('checkpoint timestamp unavailable');
  }

  const lag = observedHeadBlock > checkpoint.indexedThroughBlock
    ? observedHeadBlock - checkpoint.indexedThroughBlock
    : 0n;
  let status: FreshnessStatus;
  if (checkpoint.status !== 'COMMITTED' || observedHeadBlock < checkpoint.indexedThroughBlock) {
    status = 'DEGRADED';
  } else if (lag > 0n) {
    status = 'LAGGING';
  } else {
    status = 'FRESH';
  }

  return {
    chainId,
    schemaVersion: checkpoint.decoderSchemaVersion,
    indexedThroughBlock: checkpoint.indexedThroughBlock.toString(10),
    indexedThroughBlockHash: checkpoint.indexedThroughBlockHash.toLowerCase() as Hex32,
    indexedThroughBlockTimestamp: checkpoint.indexedThroughBlockTimestamp.toString(10),
    servedAt: now.toISOString(),
    source: 'bread-indexer',
    status,
    observedHeadBlock: observedHeadBlock.toString(10),
    lagBlocks: lag.toString(10),
    cache: 'BYPASS',
    stackVersion: checkpoint.stackVersion,
  };
}
