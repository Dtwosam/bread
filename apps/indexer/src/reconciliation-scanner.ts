import {
  ReadRepository,
  type BreadDb,
  type IndexerProtocolContext,
} from "../../../packages/db/src/index.js";
import { readReconciliationGraduatedVenues } from "../../../packages/db/src/repositories/graduation-reconciliation.js";
import type { ProtocolContext } from "../../../packages/protocol-sdk/src/index.js";
import type { Address } from "../../../packages/types/src/index.js";

import { discoverRange, type LogClient, type RpcLog } from "./discovery.js";
import { discoverGraduatedV3SwapLogs } from "./graduated-v3-discovery.js";
import type { GraduatedPoolRegistryEntry } from "./graduated-pools.js";
import { normalizeTransactionLogs, type ChainReadClient } from "./normalize.js";

export type ReconciliationCanonicalEventIdentity = Readonly<{
  transactionHash: string;
  logIndex: number;
}>;

type ScannerInput = Readonly<{
  db: BreadDb;
  client: LogClient & ChainReadClient;
  context: ProtocolContext;
}>;

type CanonicalScanLog = Readonly<{
  transactionHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockHash: string;
  transactionIndex: number;
  address: string;
}>;

function indexerContext(context: ProtocolContext): IndexerProtocolContext {
  return {
    chainId: context.chainId,
    stackVersion: context.stackVersion,
    factoryAddress: context.factoryAddress,
    quoteAsset: context.quoteAsset,
    quoteDecimals: context.quoteDecimals,
    deploymentStartBlock: context.deploymentStartBlock,
    addresses: context.addresses,
  };
}

function address(value: unknown, label: string): Address {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(value) ||
    /^0x0{40}$/i.test(value)
  ) {
    throw new Error(`invalid reconciliation ${label}`);
  }
  return value.toLowerCase() as Address;
}

function feeTier(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > 0xffffff
  ) {
    throw new Error("invalid reconciliation V3 fee tier");
  }
  return value;
}

function nonnegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid reconciliation ${label}`);
  }
  return value;
}

function compareLogs(left: CanonicalScanLog, right: CanonicalScanLog): number {
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber < right.blockNumber ? -1 : 1;
  }
  if (left.transactionIndex !== right.transactionIndex) {
    return left.transactionIndex - right.transactionIndex;
  }
  if (left.logIndex !== right.logIndex) return left.logIndex - right.logIndex;
  return left.transactionHash.localeCompare(right.transactionHash);
}

function sameCanonicalLog(
  left: CanonicalScanLog,
  right: CanonicalScanLog,
): boolean {
  return (
    left.address.toLowerCase() === right.address.toLowerCase() &&
    left.blockNumber === right.blockNumber &&
    left.blockHash.toLowerCase() === right.blockHash.toLowerCase() &&
    left.transactionIndex === right.transactionIndex
  );
}

function canonicalKey(chainId: number, log: CanonicalScanLog): string {
  return `${chainId}:${log.transactionHash.toLowerCase()}:${log.logIndex}`;
}

function rpcScanLog(log: RpcLog): CanonicalScanLog {
  return {
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionIndex: log.transactionIndex,
    address: log.address,
  };
}

export function createReconciliationCanonicalEventScanner(input: ScannerInput) {
  const context = indexerContext(input.context);

  return async (
    fromBlock: bigint,
    toBlock: bigint,
  ): Promise<readonly ReconciliationCanonicalEventIdentity[]> => {
    if (toBlock < fromBlock) {
      throw new Error("reconciliation scan range end precedes start");
    }

    const readRepository = new ReadRepository(input.db);
    const launches = await readRepository.listLaunchIdentities(
      context.chainId,
      context.stackVersion,
      context.factoryAddress,
    );
    const knownLaunchAddresses = launches.flatMap((launch) => [
      address(launch.tokenAddress, "launch token"),
      address(launch.curveAddress, "launch curve"),
    ]);
    const curveByToken = new Map(
      launches.map((launch) => [
        address(launch.tokenAddress, "launch token"),
        address(launch.curveAddress, "launch curve"),
      ]),
    );

    const breadLogs = await discoverRange(
      input.client,
      input.context,
      knownLaunchAddresses,
      fromBlock,
      toBlock,
    );
    const normalizedBread = await normalizeTransactionLogs({
      client: input.client,
      context: input.context,
      knownLaunches: launches,
      logs: breadLogs,
      toBlock,
    });
    const breadCanonicalLogs: CanonicalScanLog[] = normalizedBread.events.map(
      (event) => ({
        transactionHash: event.identity.transactionHash,
        logIndex: event.identity.logIndex,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        transactionIndex: event.transactionIndex,
        address: event.contractAddress,
      }),
    );

    const venues = await readReconciliationGraduatedVenues(input.db, context);
    const v3Entries: GraduatedPoolRegistryEntry[] = [];
    for (const venue of venues) {
      if (venue.graduatedVenueKind === null) continue;
      if (venue.graduatedVenueKind !== "UNISWAP_V3") continue;

      const tokenAddress = address(venue.tokenAddress, "V3 token");
      const curveAddress = curveByToken.get(tokenAddress);
      if (curveAddress === undefined) {
        throw new Error(
          "reconciliation V3 venue has no selected launch identity",
        );
      }
      if (
        venue.graduatedVenueAddress === null ||
        venue.graduatedVenueFeeTier === null ||
        venue.graduatedVenueQuoteIsToken0 === null ||
        venue.graduationCompletedBlock === null ||
        venue.graduationCompletedTransactionIndex === null ||
        venue.graduationCompletedLogIndex === null
      ) {
        throw new Error("incomplete reconciliation V3 venue identity");
      }

      v3Entries.push({
        chainId: context.chainId,
        tokenAddress,
        curveAddress,
        poolAddress: address(venue.graduatedVenueAddress, "V3 pool"),
        feeTier: feeTier(venue.graduatedVenueFeeTier),
        quoteIsToken0: venue.graduatedVenueQuoteIsToken0,
        completion: {
          blockNumber: venue.graduationCompletedBlock,
          transactionIndex: nonnegativeInteger(
            venue.graduationCompletedTransactionIndex,
            "V3 completion transaction index",
          ),
          logIndex: nonnegativeInteger(
            venue.graduationCompletedLogIndex,
            "V3 completion log index",
          ),
        },
      });
    }

    const v3Logs = await discoverGraduatedV3SwapLogs({
      client: input.client,
      chainId: context.chainId,
      entries: v3Entries,
      fromBlock,
      toBlock,
    });

    const byIdentity = new Map<string, CanonicalScanLog>();
    for (const log of [
      ...breadCanonicalLogs,
      ...v3Logs.map((log) => rpcScanLog(log)),
    ]) {
      const key = canonicalKey(context.chainId, log);
      const existing = byIdentity.get(key);
      if (existing && !sameCanonicalLog(existing, log)) {
        throw new Error(
          `contradictory reconciliation canonical log identity: ${key}`,
        );
      }
      byIdentity.set(key, existing ?? log);
    }

    return [...byIdentity.values()].sort(compareLogs).map((log) => ({
      transactionHash: log.transactionHash.toLowerCase(),
      logIndex: log.logIndex,
    }));
  };
}
