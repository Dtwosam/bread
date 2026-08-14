import {
  IndexerRepository,
  ReadRepository,
  type BreadDb,
  type VerifiedGraduatedVenueProjection,
} from "../../../packages/db/src/index.js";
import {
  getGraduatedV3VerificationLaunch,
  listGraduatedV3RegistryRows,
} from "../../../packages/db/src/repositories/graduated-v3-read.js";
import type { ProtocolContext } from "../../../packages/protocol-sdk/src/index.js";
import {
  canonicalEventId,
  stackFeedProjectionCacheChannel,
  tokenProjectionCacheChannel,
  type Hex32,
} from "../../../packages/types/src/index.js";

import type { LogClient, RpcLog } from "./discovery.js";
import {
  prepareGraduatedV3Range,
  type GraduatedPoolRegistryEntry,
} from "./graduated-pools.js";
import { normalizeTransactionLogs, type ChainReadClient } from "./normalize.js";
import {
  createFeeAdminGraduationReducer,
  createHolderReducer,
  createLaunchReducer,
  createTradeReducer,
} from "./reducers.js";
import { normalizeGraduatedV3SwapLogs } from "./v3-swaps.js";

type ApplyRangeClient = ChainReadClient &
  Readonly<{
    getLogs?: LogClient["getLogs"];
    getTransaction?: (request: Readonly<{ hash: Hex32 }>) => Promise<
      Readonly<{
        hash?: unknown;
        blockNumber?: unknown;
        from?: unknown;
      }>
    >;
  }>;

type V3RangeClient = ChainReadClient &
  Readonly<{
    getLogs: LogClient["getLogs"];
    getTransaction: NonNullable<ApplyRangeClient["getTransaction"]>;
    getBlock: NonNullable<ChainReadClient["getBlock"]>;
  }>;

export type ApplyRangeInput = Readonly<{
  db: BreadDb;
  client: ApplyRangeClient;
  context: ProtocolContext;
  fromBlock: bigint;
  toBlock: bigint;
  toBlockHash: Hex32;
  toBlockTimestamp?: bigint;
  logs: readonly RpcLog[];
}>;

function requireV3RangeClient(client: ApplyRangeClient): V3RangeClient {
  if (
    typeof client.getLogs !== "function" ||
    typeof client.getTransaction !== "function" ||
    typeof client.getBlock !== "function"
  ) {
    throw new Error(
      "graduated V3 indexing requires getLogs, getTransaction, and getBlock",
    );
  }
  return client as V3RangeClient;
}

function appendLaunchProtocolAddress(
  addresses: Map<string, readonly string[]>,
  tokenAddress: string,
  protocolAddress: string,
): void {
  const key = tokenAddress.toLowerCase();
  const values = addresses.get(key) ?? [];
  const canonical = protocolAddress.toLowerCase();
  if (values.some((value) => value.toLowerCase() === canonical)) return;
  addresses.set(key, [...values, canonical]);
}

function compareCanonicalOrder(
  left: Readonly<{
    blockNumber: bigint;
    transactionIndex: number;
    identity: Readonly<{ logIndex: number }>;
  }>,
  right: Readonly<{
    blockNumber: bigint;
    transactionIndex: number;
    identity: Readonly<{ logIndex: number }>;
  }>,
): number {
  if (left.blockNumber !== right.blockNumber)
    return left.blockNumber < right.blockNumber ? -1 : 1;
  if (left.transactionIndex !== right.transactionIndex)
    return left.transactionIndex - right.transactionIndex;
  return left.identity.logIndex - right.identity.logIndex;
}

function verifiedVenueProjection(
  entry: GraduatedPoolRegistryEntry,
): VerifiedGraduatedVenueProjection {
  return {
    venueKind: "UNISWAP_V3",
    chainId: entry.chainId,
    tokenAddress: entry.tokenAddress,
    poolAddress: entry.poolAddress,
    feeTier: entry.feeTier,
    quoteIsToken0: entry.quoteIsToken0,
    completion: entry.completion,
  };
}

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

  const persistedV3Rows = await listGraduatedV3RegistryRows(input.db, {
    chainId: input.context.chainId,
    stackVersion: input.context.stackVersion,
    factoryAddress: input.context.factoryAddress,
  });
  const hasSameRangeCompletion = normalized.events.some(
    (event) => event.eventName === "GraduationCompleted",
  );
  let verifiedV3Entries: readonly GraduatedPoolRegistryEntry[] = [];
  let sameRangeVerified: readonly GraduatedPoolRegistryEntry[] = [];
  let v3Events = [] as Awaited<
    ReturnType<typeof normalizeGraduatedV3SwapLogs>
  >["events"];
  let v3Trades = [] as Awaited<
    ReturnType<typeof normalizeGraduatedV3SwapLogs>
  >["trades"];

  if (persistedV3Rows.length > 0 || hasSameRangeCompletion) {
    if (input.context.graduatedTrading?.family !== "UNISWAP_V3") {
      if (persistedV3Rows.length > 0) {
        throw new Error(
          "persisted graduated V3 registry requires UNISWAP_V3 context",
        );
      }
    } else {
      const v3Client = requireV3RangeClient(input.client);
      const prepared = await prepareGraduatedV3Range({
        client: v3Client,
        context: input.context,
        persistedRows: persistedV3Rows,
        normalized,
        readLaunch: async (tokenAddress) =>
          getGraduatedV3VerificationLaunch(input.db, {
            chainId: input.context.chainId,
            stackVersion: input.context.stackVersion,
            factoryAddress: input.context.factoryAddress,
            tokenAddress,
          }),
        fromBlock: input.fromBlock,
        toBlock: input.toBlock,
      });
      verifiedV3Entries = [...prepared.registry.byToken.values()];
      sameRangeVerified = prepared.sameRangeVerified;
      const normalizedV3 = await normalizeGraduatedV3SwapLogs({
        client: v3Client,
        chainId: input.context.chainId,
        stackVersion: input.context.stackVersion,
        quoteAsset: input.context.quoteAsset,
        entries: verifiedV3Entries,
        logs: prepared.swapLogs,
      });
      v3Events = normalizedV3.events;
      v3Trades = normalizedV3.trades;
    }
  }

  const launchProtocolAddresses = new Map<string, readonly string[]>();
  for (const launch of knownLaunches) {
    launchProtocolAddresses.set(launch.tokenAddress.toLowerCase(), [
      launch.curveAddress,
    ]);
  }
  for (const snapshot of normalized.launchSnapshots.values()) {
    launchProtocolAddresses.set(snapshot.tokenAddress.toLowerCase(), [
      snapshot.curveAddress,
      snapshot.graduationCoordinator,
      snapshot.graduationAdapter,
    ]);
  }
  for (const entry of verifiedV3Entries) {
    appendLaunchProtocolAddress(
      launchProtocolAddresses,
      entry.tokenAddress,
      entry.poolAddress,
    );
  }

  const verifiedGraduatedVenues = new Map<
    string,
    VerifiedGraduatedVenueProjection
  >();
  for (const entry of sameRangeVerified) {
    verifiedGraduatedVenues.set(
      entry.tokenAddress.toLowerCase(),
      verifiedVenueProjection(entry),
    );
  }

  const repository = new IndexerRepository(input.db, [
    createLaunchReducer(normalized.launchSnapshots),
    createTradeReducer([...normalized.trades, ...v3Trades]),
    createFeeAdminGraduationReducer({
      context: input.context,
      verifiedGraduatedVenues,
    }),
    createHolderReducer({ context: input.context, launchProtocolAddresses }),
  ]);
  const result = await repository.applyCanonicalRange({
    context: input.context,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
    toBlockHash: input.toBlockHash,
    toBlockTimestamp: input.toBlockTimestamp,
    events: [...normalized.events, ...v3Events].sort(compareCanonicalOrder),
  });

  const insertedEventIds = new Set(result.insertedEventIds);
  const projectionCacheChannels = new Set<string>();
  for (const trade of v3Trades) {
    if (!insertedEventIds.has(canonicalEventId(trade.id))) continue;
    projectionCacheChannels.add(
      stackFeedProjectionCacheChannel({
        chainId: input.context.chainId,
        stackVersion: input.context.stackVersion,
        factoryAddress: input.context.factoryAddress,
      }),
    );
    projectionCacheChannels.add(
      tokenProjectionCacheChannel({
        chainId: input.context.chainId,
        tokenAddress: trade.token,
      }),
    );
  }

  return {
    ...result,
    checkpoint: {
      blockNumber: input.toBlock,
      blockHash: input.toBlockHash,
    },
    projectionCacheChannels: [...projectionCacheChannels],
  };
}
