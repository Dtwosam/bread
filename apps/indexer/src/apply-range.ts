import { IndexerRepository, ReadRepository, type BreadDb } from '../../../packages/db/src/index.js';
import type { ProtocolContext } from '../../../packages/protocol-sdk/src/index.js';
import type { Hex32 } from '../../../packages/types/src/index.js';

import type { RpcLog } from './discovery.js';
import { normalizeTransactionLogs, type ChainReadClient } from './normalize.js';
import { createLaunchReducer, createTradeReducer } from './reducers.js';

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
  const readRepository = new ReadRepository(input.db);
  const knownLaunches = await readRepository.listLaunchIdentities(
    input.context.chainId,
    input.context.stackVersion,
    input.context.factoryAddress,
  );

  const normalized = await normalizeTransactionLogs({
    client: input.client,
    context: input.context,
    knownLaunches,
    logs: input.logs,
    toBlock: input.toBlock,
    toBlockTimestamp: input.toBlockTimestamp,
  });

  const repository = new IndexerRepository(input.db, [
    createLaunchReducer(normalized.launchSnapshots),
    createTradeReducer(normalized.trades),
  ]);
  return repository.applyCanonicalRange({
    context: input.context,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
    toBlockHash: input.toBlockHash,
    toBlockTimestamp: input.toBlockTimestamp,
    events: normalized.events,
  });
}
