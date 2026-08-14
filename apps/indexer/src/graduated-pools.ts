import {
  graduatedV3AdapterAbi,
  v3FactoryAbi,
  v3PoolAbi,
} from "../../../packages/protocol-sdk/src/v3-abi.js";
import { poolAddressFromId } from "../../../packages/protocol-sdk/src/v3-pool.js";

import type { LogClient, RpcLog } from "./discovery.js";
import { discoverGraduatedV3SwapLogs } from "./graduated-v3-discovery.js";

export { discoverGraduatedV3SwapLogs };

type UnknownRow = Readonly<Record<string, unknown>>;

type ReadContractClient = Readonly<{
  readContract: (
    request: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
}>;

type RangeClient = ReadContractClient & LogClient;

type VerificationContext = Readonly<{
  chainId: number;
  quoteAsset: string;
  graduatedTrading?: Readonly<{
    family: "UNISWAP_V3";
    factory: string;
    positionManager: string;
  }>;
}>;

type VerificationLaunch = Readonly<{
  chainId: number;
  tokenAddress: string;
  curveAddress: string;
  graduationCoordinator: string;
  graduationAdapter: string;
  graduationAdapterFamily: number;
  graduationConfigHash: string;
}>;

type VerificationCompletion = Readonly<{
  contractAddress: string;
  token: string;
  adapter: string;
  poolId: unknown;
  positionManager: string;
  blockNumber: bigint;
  transactionIndex: number;
  logIndex: number;
}>;

type PreparedRangeEvent = Readonly<{
  identity: Readonly<{
    chainId: number;
    logIndex: number;
  }>;
  blockNumber: bigint;
  transactionIndex: number;
  contractAddress: string;
  eventName: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type GraduatedPoolRegistryEntry = Readonly<{
  chainId: number;
  tokenAddress: string;
  curveAddress: string;
  poolAddress: string;
  feeTier: number;
  completion: Readonly<{
    blockNumber: bigint;
    transactionIndex: number;
    logIndex: number;
  }>;
}>;

export type GraduatedPoolRegistry = Readonly<{
  byToken: ReadonlyMap<string, GraduatedPoolRegistryEntry>;
  byPool: ReadonlyMap<string, GraduatedPoolRegistryEntry>;
}>;

export type PreparedGraduatedV3Range = Readonly<{
  registry: GraduatedPoolRegistry;
  sameRangeVerified: readonly GraduatedPoolRegistryEntry[];
  swapLogs: readonly RpcLog[];
}>;

function address(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(value) ||
    /^0x0{40}$/i.test(value)
  ) {
    throw new Error(`invalid graduated V3 registry ${label}`);
  }
  return value.toLowerCase();
}

function sameAddress(left: unknown, right: unknown): boolean {
  return (
    typeof left === "string" &&
    typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase()
  );
}

function bytes32(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`invalid graduated V3 ${label}`);
  }
  return value.toLowerCase();
}

function safeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid graduated V3 registry ${label}`);
  }
  return value;
}

function exactInteger(value: unknown, label: string): number {
  if (typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`invalid graduated V3 ${label}`);
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error(`invalid graduated V3 ${label}`);
  }
  return numeric;
}

function blockNumber(value: unknown): bigint {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new Error("invalid graduated V3 registry completion block");
}

function feeTier(value: unknown): number {
  const fee = safeInteger(value, "fee tier");
  if (fee > 0xffffff) throw new Error("invalid graduated V3 registry fee tier");
  return fee;
}

async function read(
  client: ReadContractClient,
  addressValue: string,
  abi: readonly unknown[],
  functionName: string,
  args?: readonly unknown[],
): Promise<unknown> {
  return client.readContract({
    address: addressValue,
    abi,
    functionName,
    ...(args === undefined ? {} : { args }),
  });
}

export async function verifyGraduatedV3Candidate(
  input: Readonly<{
    client: ReadContractClient;
    context: VerificationContext;
    launch: VerificationLaunch;
    completion: VerificationCompletion;
  }>,
): Promise<GraduatedPoolRegistryEntry> {
  const { client, context, launch, completion } = input;
  const dependencies = context.graduatedTrading;

  if (
    launch.chainId !== context.chainId ||
    launch.graduationAdapterFamily !== 2 ||
    dependencies?.family !== "UNISWAP_V3"
  ) {
    throw new Error("graduated launch is not UNISWAP_V3");
  }

  const tokenAddress = address(launch.tokenAddress, "token address");
  const curveAddress = address(launch.curveAddress, "curve address");
  const coordinator = address(
    launch.graduationCoordinator,
    "coordinator address",
  );
  const adapter = address(launch.graduationAdapter, "adapter address");
  const quoteAsset = address(context.quoteAsset, "quote asset");
  const expectedFactory = address(dependencies.factory, "factory address");
  const expectedPositionManager = address(
    dependencies.positionManager,
    "position manager address",
  );
  const launchConfigHash = bytes32(
    launch.graduationConfigHash,
    "launch config hash",
  );

  if (
    !sameAddress(completion.contractAddress, coordinator) ||
    !sameAddress(completion.token, tokenAddress) ||
    !sameAddress(completion.adapter, adapter) ||
    !sameAddress(completion.positionManager, expectedPositionManager)
  ) {
    throw new Error("graduation completion identity mismatch");
  }

  const poolAddress = poolAddressFromId(completion.poolId);
  const [
    liveFamily,
    liveCoordinator,
    liveConfigHash,
    liveUsdc,
    livePositionManager,
    liveFactory,
    liveFee,
  ] = await Promise.all([
    read(client, adapter, graduatedV3AdapterAbi, "family"),
    read(client, adapter, graduatedV3AdapterAbi, "coordinator"),
    read(client, adapter, graduatedV3AdapterAbi, "configHash"),
    read(client, adapter, graduatedV3AdapterAbi, "usdc"),
    read(client, adapter, graduatedV3AdapterAbi, "positionManager"),
    read(client, adapter, graduatedV3AdapterAbi, "v3Factory"),
    read(client, adapter, graduatedV3AdapterAbi, "fee"),
  ]);
  const fee = exactInteger(liveFee, "adapter fee");

  if (
    exactInteger(liveFamily, "adapter family") !== 2 ||
    !sameAddress(liveCoordinator, coordinator) ||
    bytes32(liveConfigHash, "adapter config hash") !== launchConfigHash ||
    !sameAddress(liveUsdc, quoteAsset) ||
    !sameAddress(livePositionManager, expectedPositionManager) ||
    !sameAddress(liveFactory, expectedFactory) ||
    fee <= 0 ||
    fee > 0xffffff
  ) {
    throw new Error("graduated adapter identity mismatch");
  }

  const factoryPool = await read(
    client,
    expectedFactory,
    v3FactoryAbi,
    "getPool",
    [quoteAsset, tokenAddress, fee],
  );
  if (!sameAddress(factoryPool, poolAddress)) {
    throw new Error("graduated pool identity mismatch");
  }

  const [token0, token1, poolFee] = await Promise.all([
    read(client, poolAddress, v3PoolAbi, "token0"),
    read(client, poolAddress, v3PoolAbi, "token1"),
    read(client, poolAddress, v3PoolAbi, "fee"),
  ]);
  const pairMatches =
    (sameAddress(token0, quoteAsset) && sameAddress(token1, tokenAddress)) ||
    (sameAddress(token0, tokenAddress) && sameAddress(token1, quoteAsset));
  if (!pairMatches || exactInteger(poolFee, "pool fee") !== fee) {
    throw new Error("graduated pool identity mismatch");
  }

  return {
    chainId: context.chainId,
    tokenAddress,
    curveAddress,
    poolAddress,
    feeTier: fee,
    completion: {
      blockNumber: blockNumber(completion.blockNumber),
      transactionIndex: safeInteger(
        completion.transactionIndex,
        "completion transaction index",
      ),
      logIndex: safeInteger(completion.logIndex, "completion log index"),
    },
  };
}

function entryFromRow(row: UnknownRow): GraduatedPoolRegistryEntry {
  if (row.graduatedVenueKind !== "UNISWAP_V3") {
    throw new Error("invalid graduated V3 registry venue kind");
  }

  return {
    chainId: safeInteger(row.chainId, "chain id"),
    tokenAddress: address(row.tokenAddress, "token address"),
    curveAddress: address(row.curveAddress, "curve address"),
    poolAddress: address(row.graduatedVenueAddress, "pool address"),
    feeTier: feeTier(row.graduatedVenueFeeTier),
    completion: {
      blockNumber: blockNumber(row.graduationCompletedBlock),
      transactionIndex: safeInteger(
        row.graduationCompletedTransactionIndex,
        "completion transaction index",
      ),
      logIndex: safeInteger(
        row.graduationCompletedLogIndex,
        "completion log index",
      ),
    },
  };
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

function conflict(): never {
  throw new Error("conflicting graduated V3 registry identity");
}

function buildRegistryFromEntries(
  entries: readonly GraduatedPoolRegistryEntry[],
): GraduatedPoolRegistry {
  const byToken = new Map<string, GraduatedPoolRegistryEntry>();
  const byPool = new Map<string, GraduatedPoolRegistryEntry>();

  for (const entry of entries) {
    const existingToken = byToken.get(entry.tokenAddress);
    const existingPool = byPool.get(entry.poolAddress);

    if (existingToken && !sameEntry(existingToken, entry)) conflict();
    if (existingPool && !sameEntry(existingPool, entry)) conflict();

    if (!existingToken) byToken.set(entry.tokenAddress, entry);
    if (!existingPool) byPool.set(entry.poolAddress, entry);
  }

  return { byToken, byPool };
}

export function buildGraduatedPoolRegistry(
  rows: readonly UnknownRow[],
): GraduatedPoolRegistry {
  return buildRegistryFromEntries(rows.map(entryFromRow));
}

function completionFromEvent(event: PreparedRangeEvent): VerificationCompletion {
  return {
    contractAddress: event.contractAddress,
    token: address(event.payload.token, "GraduationCompleted token"),
    adapter: address(event.payload.adapter, "GraduationCompleted adapter"),
    poolId: event.payload.poolId,
    positionManager: address(
      event.payload.positionManager,
      "GraduationCompleted position manager",
    ),
    blockNumber: event.blockNumber,
    transactionIndex: event.transactionIndex,
    logIndex: event.identity.logIndex,
  };
}

function compareCompletionEvents(
  left: PreparedRangeEvent,
  right: PreparedRangeEvent,
): number {
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber < right.blockNumber ? -1 : 1;
  }
  if (left.transactionIndex !== right.transactionIndex) {
    return left.transactionIndex - right.transactionIndex;
  }
  return left.identity.logIndex - right.identity.logIndex;
}

function sameRangeLaunchSnapshot(
  snapshots: ReadonlyMap<string, VerificationLaunch>,
  tokenAddress: string,
): VerificationLaunch | undefined {
  for (const snapshot of snapshots.values()) {
    if (sameAddress(snapshot.tokenAddress, tokenAddress)) return snapshot;
  }
  return undefined;
}

export async function prepareGraduatedV3Range(
  input: Readonly<{
    client: RangeClient;
    context: VerificationContext;
    persistedRows: readonly UnknownRow[];
    normalized: Readonly<{
      events: readonly PreparedRangeEvent[];
      launchSnapshots: ReadonlyMap<string, VerificationLaunch>;
    }>;
    readLaunch: (tokenAddress: string) => Promise<VerificationLaunch | undefined>;
    fromBlock: bigint;
    toBlock: bigint;
  }>,
): Promise<PreparedGraduatedV3Range> {
  const persistedEntries = input.persistedRows.map(entryFromRow);
  const completionEvents = input.normalized.events
    .filter((event) => event.eventName === "GraduationCompleted")
    .sort(compareCompletionEvents);
  const sameRangeVerified: GraduatedPoolRegistryEntry[] = [];

  for (const event of completionEvents) {
    if (event.identity.chainId !== input.context.chainId) {
      throw new Error("graduation completion chain mismatch");
    }
    const completion = completionFromEvent(event);
    const launch =
      sameRangeLaunchSnapshot(
        input.normalized.launchSnapshots,
        completion.token,
      ) ?? (await input.readLaunch(completion.token));
    if (!launch) {
      throw new Error(
        "missing canonical launch snapshot for GraduationCompleted",
      );
    }

    sameRangeVerified.push(
      await verifyGraduatedV3Candidate({
        client: input.client,
        context: input.context,
        launch,
        completion,
      }),
    );
  }

  const registry = buildRegistryFromEntries([
    ...persistedEntries,
    ...sameRangeVerified,
  ]);
  const swapLogs = await discoverGraduatedV3SwapLogs({
    client: input.client,
    chainId: input.context.chainId,
    entries: [...registry.byToken.values()],
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
  });

  return { registry, sameRangeVerified, swapLogs };
}
