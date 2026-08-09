import type { Address, Hex } from '../../../packages/types/src/index.js';
import {
  createBreadStackAbiBinding,
  decodeBreadLog,
  type ProtocolContext,
} from '../../../packages/protocol-sdk/src/index.js';

import { DAY6_LOG_ADDRESS_CHUNK_SIZE } from './config.js';

export type RpcLog = Readonly<{
  address: Address;
  blockNumber: bigint;
  blockHash: Hex;
  transactionHash: Hex;
  transactionIndex: number;
  logIndex: number;
  topics: readonly Hex[];
  data: Hex;
  eventName?: string;
  args?: Readonly<Record<string, unknown>>;
}>;

export type LogClient = Readonly<{
  getLogs: (request: Readonly<Record<string, unknown>>) => Promise<readonly RpcLog[]>;
}>;

function normalizeAddress(value: unknown): Address | undefined {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) return undefined;
  return value.toLowerCase() as Address;
}

function launchCreatedArgs(log: RpcLog, context: ProtocolContext): Readonly<Record<string, unknown>> | undefined {
  if (log.eventName !== undefined) return log.eventName === 'LaunchCreated' ? (log.args ?? {}) : undefined;
  if (log.topics.length === 0) return undefined;
  const decoded = decodeBreadLog({
    binding: createBreadStackAbiBinding(context.stackVersion),
    stackVersion: context.stackVersion,
    role: 'FACTORY',
    topics: log.topics,
    data: log.data,
  });
  return decoded.eventName === 'LaunchCreated' ? decoded.args : undefined;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

function canonicalKey(chainId: number, log: RpcLog): string {
  return `${chainId}:${log.transactionHash.toLowerCase()}:${log.logIndex}`;
}

function compareLogs(left: RpcLog, right: RpcLog): number {
  if (left.blockNumber !== right.blockNumber) return left.blockNumber < right.blockNumber ? -1 : 1;
  if (left.transactionIndex !== right.transactionIndex) return left.transactionIndex - right.transactionIndex;
  return left.logIndex - right.logIndex;
}

/**
 * Two-pass discovery is required because a new launch token emits its constructor
 * mint before Factory.LaunchCreated in the same transaction. Pass 1 discovers
 * token/curve identities; pass 2 re-queries the complete bounded Bread address
 * set so the earlier constructor mint is captured.
 */
export async function discoverRange(
  client: LogClient,
  context: ProtocolContext,
  knownLaunchAddresses: readonly Address[],
  fromBlock: bigint,
  toBlock: bigint,
): Promise<readonly RpcLog[]> {
  if (toBlock < fromBlock) throw new Error('discovery range end precedes start');

  const firstPass = await client.getLogs({
    address: context.factoryAddress,
    fromBlock,
    toBlock,
  });

  const dynamic = new Set<string>(knownLaunchAddresses.map((value) => value.toLowerCase()));
  for (const log of firstPass) {
    const args = launchCreatedArgs(log, context);
    if (!args) continue;
    const token = normalizeAddress(args.token);
    const curve = normalizeAddress(args.curve);
    if (!token || !curve) throw new Error('LaunchCreated contains invalid token/curve identity');
    dynamic.add(token);
    dynamic.add(curve);
  }

  const core: Address[] = [
    context.factoryAddress,
    context.addresses.feePolicy,
    context.addresses.feeEscrow,
    context.addresses.emergencyController,
    context.addresses.coordinator,
    context.addresses.locker,
  ];
  const allAddresses = Array.from(new Set([...core.map((value) => value.toLowerCase()), ...dynamic])) as Address[];

  const secondPass: RpcLog[] = [];
  for (const addressChunk of chunks(allAddresses, DAY6_LOG_ADDRESS_CHUNK_SIZE)) {
    const logs = await client.getLogs({ address: addressChunk, fromBlock, toBlock });
    secondPass.push(...logs);
  }

  const byIdentity = new Map<string, RpcLog>();
  for (const log of [...firstPass, ...secondPass]) {
    const key = canonicalKey(context.chainId, log);
    const existing = byIdentity.get(key);
    if (existing && (existing.blockHash.toLowerCase() !== log.blockHash.toLowerCase() || existing.address.toLowerCase() !== log.address.toLowerCase())) {
      throw new Error(`contradictory canonical log identity: ${key}`);
    }
    byIdentity.set(key, existing ?? log);
  }

  return [...byIdentity.values()].sort(compareLogs);
}
