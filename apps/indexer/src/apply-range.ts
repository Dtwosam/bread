import { IndexerRepository, type BreadDb } from '../../../packages/db/src/index.js';
import type { ProtocolContext } from '../../../packages/protocol-sdk/src/index.js';
import type { Hex32 } from '../../../packages/types/src/index.js';

import type { RpcLog } from './discovery.js';
import { normalizeTransactionLogs, type ChainReadClient } from './normalize.js';
import { createLaunchReducer } from './reducers.js';

export type ApplyRangeInput = Readonly<{
  db: BreadDb;
  client: ChainReadClient;
  context: ProtocolContext;
  fromBlock: bigint;
  toBlock: bigint;
  toBlockHash: Hex32;
  toBlockTimestamp?: bigint;
  logs: readonly RpcLog[];
}>;

export async function applyRange(input: ApplyRangeInput) {
  const normalized = await normalizeTransactionLogs({
    client: input.client,
    context: input.context,
    logs: input.logs,
    toBlock: input.toBlock,
    toBlockTimestamp: input.toBlockTimestamp,
  });

  const repository = new IndexerRepository(input.db, [createLaunchReducer(normalized.launchSnapshots)]);
  return repository.applyCanonicalRange({
    context: input.context,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
    toBlockHash: input.toBlockHash,
    toBlockTimestamp: input.toBlockTimestamp,
    events: normalized.events,
  });
}
