import { v3SwapEvent } from "../../../packages/protocol-sdk/src/v3-abi.js";

import { DAY6_LOG_ADDRESS_CHUNK_SIZE } from "./config.js";
import type { LogClient, RpcLog } from "./discovery.js";
import type { GraduatedPoolRegistryEntry } from "./graduated-pools.js";

type DiscoveryInput = Readonly<{
  client: LogClient;
  chainId: number;
  entries: readonly GraduatedPoolRegistryEntry[];
  fromBlock: bigint;
  toBlock: bigint;
}>;

type EligibleGroup = Readonly<{
  fromBlock: bigint;
  entries: readonly GraduatedPoolRegistryEntry[];
}>;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

function canonicalKey(chainId: number, log: RpcLog): string {
  return `${chainId}:${log.transactionHash.toLowerCase()}:${log.logIndex}`;
}

function compareLogs(left: RpcLog, right: RpcLog): number {
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber < right.blockNumber ? -1 : 1;
  }
  if (left.transactionIndex !== right.transactionIndex) {
    return left.transactionIndex - right.transactionIndex;
  }
  return left.logIndex - right.logIndex;
}

function compareEntries(
  left: GraduatedPoolRegistryEntry,
  right: GraduatedPoolRegistryEntry,
): number {
  return left.poolAddress.localeCompare(right.poolAddress);
}

function sameEntry(
  left: GraduatedPoolRegistryEntry,
  right: GraduatedPoolRegistryEntry,
): boolean {
  return (
    left.chainId === right.chainId &&
    left.tokenAddress === right.tokenAddress &&
    left.curveAddress === right.curveAddress &&
    left.poolAddress === right.poolAddress &&
    left.feeTier === right.feeTier &&
    left.completion.blockNumber === right.completion.blockNumber &&
    left.completion.transactionIndex === right.completion.transactionIndex &&
    left.completion.logIndex === right.completion.logIndex
  );
}

function sameCanonicalLog(left: RpcLog, right: RpcLog): boolean {
  return (
    left.address.toLowerCase() === right.address.toLowerCase() &&
    left.blockHash.toLowerCase() === right.blockHash.toLowerCase() &&
    left.blockNumber === right.blockNumber &&
    left.transactionIndex === right.transactionIndex
  );
}

function afterCompletion(
  log: RpcLog,
  entry: GraduatedPoolRegistryEntry,
): boolean {
  const completion = entry.completion;
  if (log.blockNumber !== completion.blockNumber) {
    return log.blockNumber > completion.blockNumber;
  }
  if (log.transactionIndex !== completion.transactionIndex) {
    return log.transactionIndex > completion.transactionIndex;
  }
  return log.logIndex > completion.logIndex;
}

function normalizePoolAddress(value: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error("invalid graduated V3 discovery pool address");
  }
  return value.toLowerCase();
}

function canonicalEntries(
  chainId: number,
  entries: readonly GraduatedPoolRegistryEntry[],
): readonly GraduatedPoolRegistryEntry[] {
  const byPool = new Map<string, GraduatedPoolRegistryEntry>();
  const byToken = new Map<string, GraduatedPoolRegistryEntry>();

  for (const entry of entries) {
    if (entry.chainId !== chainId) {
      throw new Error("graduated V3 discovery chain mismatch");
    }
    const poolKey = normalizePoolAddress(entry.poolAddress);
    const tokenKey = entry.tokenAddress.toLowerCase();
    const existingPool = byPool.get(poolKey);
    const existingToken = byToken.get(tokenKey);
    if (existingPool && !sameEntry(existingPool, entry)) {
      throw new Error("conflicting graduated V3 registry identity");
    }
    if (existingToken && !sameEntry(existingToken, entry)) {
      throw new Error("conflicting graduated V3 registry identity");
    }
    if (!existingPool) byPool.set(poolKey, entry);
    if (!existingToken) byToken.set(tokenKey, entry);
  }

  return [...byPool.values()];
}

function eligibleGroups(
  entries: readonly GraduatedPoolRegistryEntry[],
  fromBlock: bigint,
  toBlock: bigint,
): readonly EligibleGroup[] {
  const groups = new Map<
    string,
    { fromBlock: bigint; entries: GraduatedPoolRegistryEntry[] }
  >();

  for (const entry of entries) {
    if (entry.completion.blockNumber > toBlock) continue;
    const startBlock =
      entry.completion.blockNumber > fromBlock
        ? entry.completion.blockNumber
        : fromBlock;
    const key = startBlock.toString();
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { fromBlock: startBlock, entries: [entry] });
  }

  return [...groups.values()]
    .sort((left, right) => {
      if (left.fromBlock === right.fromBlock) return 0;
      return left.fromBlock < right.fromBlock ? -1 : 1;
    })
    .map((group) => ({
      fromBlock: group.fromBlock,
      entries: [...group.entries].sort(compareEntries),
    }));
}

export async function discoverGraduatedV3SwapLogs(
  input: DiscoveryInput,
): Promise<readonly RpcLog[]> {
  const { client, chainId, entries, fromBlock, toBlock } = input;
  if (toBlock < fromBlock) {
    throw new Error("graduated V3 discovery range end precedes start");
  }

  const canonical = canonicalEntries(chainId, entries);
  const groups = eligibleGroups(canonical, fromBlock, toBlock);
  const deduped = new Map<string, RpcLog>();

  for (const group of groups) {
    const groupByPool = new Map(
      group.entries.map((entry) => [
        normalizePoolAddress(entry.poolAddress),
        entry,
      ]),
    );

    for (const entryChunk of chunks(
      group.entries,
      DAY6_LOG_ADDRESS_CHUNK_SIZE,
    )) {
      const poolAddresses = entryChunk.map((entry) =>
        normalizePoolAddress(entry.poolAddress),
      );
      const logs = await client.getLogs({
        address: poolAddresses,
        event: v3SwapEvent,
        fromBlock: group.fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const poolAddress = log.address.toLowerCase();
        const entry = groupByPool.get(poolAddress);
        if (!entry || !poolAddresses.includes(poolAddress)) {
          throw new Error("unexpected graduated V3 pool log address");
        }
        if (log.blockNumber < group.fromBlock || log.blockNumber > toBlock) {
          throw new Error("graduated V3 log outside requested range");
        }
        if (!afterCompletion(log, entry)) continue;

        const key = canonicalKey(chainId, log);
        const existing = deduped.get(key);
        if (existing) {
          if (!sameCanonicalLog(existing, log)) {
            throw new Error("contradictory canonical V3 log identity");
          }
          continue;
        }
        deduped.set(key, log);
      }
    }
  }

  return [...deduped.values()].sort(compareLogs);
}
