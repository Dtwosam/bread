import { getAddress, type PublicClient } from "viem";

import type { Address, Hex32 } from "../../types/src/index.js";
import { breadAbiRegistry } from "./abi/generated.js";
import type { ProtocolContext } from "./context.js";
import {
  graduatedV3AdapterAbi,
  v3FactoryAbi,
  v3FactoryBoundDependencyAbi,
  v3PoolAbi,
} from "./v3-abi.js";
import { poolAddressFromId } from "./v3-pool.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const V3_FAMILY = 2;

export type CanonicalTradeRoute =
  | Readonly<{ kind: "CURVE"; curve: Address }>
  | Readonly<{
      kind: "V3_POOL";
      token: Address;
      quoteAsset: Address;
      pool: Address;
      fee: number;
      factory: Address;
      positionManager: Address;
      swapRouter: Address;
      swapRouterKind: "V3_SWAP_ROUTER" | "V3_SWAP_ROUTER_02";
      quoter: Address;
      quoterKind: "V3_QUOTER" | "V3_QUOTER_V2";
    }>;

type StructLike = readonly unknown[] | Record<string, unknown>;

function field(record: unknown, name: string, index: number): unknown {
  if (Array.isArray(record)) return record[index];
  if (typeof record === "object" && record !== null && name in record) {
    return (record as Record<string, unknown>)[name];
  }
  return undefined;
}

function addressField(
  record: unknown,
  name: string,
  index: number,
  label: string,
): Address {
  const value = field(record, name, index);
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(value) ||
    value.toLowerCase() === ZERO_ADDRESS
  ) {
    throw new Error(`invalid canonical ${label}`);
  }
  return getAddress(value).toLowerCase() as Address;
}

function bytes32Field(
  record: unknown,
  name: string,
  index: number,
  label: string,
): Hex32 {
  const value = field(record, name, index);
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`invalid canonical ${label}`);
  }
  return value.toLowerCase() as Hex32;
}

function integerField(
  record: unknown,
  name: string,
  index: number,
  label: string,
): number {
  const value = field(record, name, index);
  if (typeof value !== "number" && typeof value !== "bigint")
    throw new Error(`invalid canonical ${label}`);
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0)
    throw new Error(`invalid canonical ${label}`);
  return numeric;
}

function bigintValue(value: unknown, label: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return BigInt(value);
  throw new Error(`invalid canonical ${label}`);
}

function sameAddress(a: Address | string, b: Address | string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

async function read<T = unknown>(
  client: PublicClient,
  request: Parameters<PublicClient["readContract"]>[0],
): Promise<T> {
  return client.readContract(request as never) as Promise<T>;
}

/**
 * Resolves the canonical trading destination from fresh chain state.
 * Indexed state is deliberately excluded from route selection.
 *
 * - NOT_GRADUATED + !readyToGraduate => canonical bonding curve.
 * - NOT_GRADUATED + readyToGraduate or SWEPT => fail closed while graduation is pending.
 * - RESCUED => fail closed; there is no canonical public trading route.
 * - POOL_CREATED => verify the launch's snapshotted V3 adapter, network periphery,
 *   coordinator pool identity, pool pair/fee and active liquidity before returning V3_POOL.
 */
export async function resolveCanonicalTradeRoute(
  client: PublicClient,
  context: ProtocolContext,
  token: Address,
): Promise<CanonicalTradeRoute> {
  const launch = await read<StructLike>(client, {
    address: context.addresses.factory,
    abi: breadAbiRegistry.factory,
    functionName: "getLaunch",
    args: [token],
  } as never);

  const launchToken = addressField(launch, "token", 0, "launch token");
  if (!sameAddress(launchToken, token))
    throw new Error("canonical launch token mismatch");

  const curve = addressField(launch, "curve", 1, "launch curve");
  const coordinator = addressField(
    launch,
    "graduationCoordinator",
    8,
    "graduation coordinator",
  );
  const adapter = addressField(
    launch,
    "graduationAdapter",
    9,
    "graduation adapter",
  );
  const adapterFamily = integerField(
    launch,
    "graduationAdapterFamily",
    10,
    "graduation adapter family",
  );
  const launchConfigHash = bytes32Field(
    launch,
    "graduationConfigHash",
    11,
    "graduation config hash",
  );

  const graduation = await read<StructLike>(client, {
    address: coordinator,
    abi: breadAbiRegistry.coordinator,
    functionName: "getGraduation",
    args: [token],
  } as never);
  const phase = integerField(graduation, "phase", 0, "graduation phase");

  if (phase === 0) {
    const ready = await read<boolean>(client, {
      address: curve,
      abi: breadAbiRegistry.curve,
      functionName: "readyToGraduate",
      args: [],
    } as never);
    if (ready !== false) throw new Error("graduation is pending");
    return { kind: "CURVE", curve };
  }
  if (phase === 1) throw new Error("graduation is pending");
  if (phase === 3) throw new Error("graduation is unavailable");
  if (phase !== 2) throw new Error(`unsupported graduation phase: ${phase}`);

  if (adapterFamily !== V3_FAMILY)
    throw new Error("graduated route is not UNISWAP_V3");
  const dependencies = context.graduatedTrading;
  if (dependencies === undefined || dependencies.family !== "UNISWAP_V3") {
    throw new Error("graduated V3 dependencies are unavailable");
  }

  const [
    liveFamily,
    liveCoordinator,
    liveConfigHash,
    liveUsdc,
    livePositionManager,
    liveFactory,
    liveFee,
  ] = await Promise.all([
    read<number | bigint>(client, {
      address: adapter,
      abi: graduatedV3AdapterAbi,
      functionName: "family",
    } as never),
    read<Address>(client, {
      address: adapter,
      abi: graduatedV3AdapterAbi,
      functionName: "coordinator",
    } as never),
    read<Hex32>(client, {
      address: adapter,
      abi: graduatedV3AdapterAbi,
      functionName: "configHash",
    } as never),
    read<Address>(client, {
      address: adapter,
      abi: graduatedV3AdapterAbi,
      functionName: "usdc",
    } as never),
    read<Address>(client, {
      address: adapter,
      abi: graduatedV3AdapterAbi,
      functionName: "positionManager",
    } as never),
    read<Address>(client, {
      address: adapter,
      abi: graduatedV3AdapterAbi,
      functionName: "v3Factory",
    } as never),
    read<number | bigint>(client, {
      address: adapter,
      abi: graduatedV3AdapterAbi,
      functionName: "fee",
    } as never),
  ]);

  const liveFamilyNumber = Number(liveFamily);
  const fee = Number(liveFee);
  if (
    liveFamilyNumber !== V3_FAMILY ||
    !sameAddress(liveCoordinator, coordinator) ||
    liveConfigHash.toLowerCase() !== launchConfigHash.toLowerCase() ||
    !sameAddress(liveUsdc, context.quoteAsset) ||
    !sameAddress(liveFactory, dependencies.factory) ||
    !sameAddress(livePositionManager, dependencies.positionManager) ||
    !Number.isSafeInteger(fee) ||
    fee <= 0
  ) {
    throw new Error("graduated adapter identity mismatch");
  }

  const recordedPositionManager = addressField(
    graduation,
    "positionManager",
    6,
    "graduation position manager",
  );
  if (!sameAddress(recordedPositionManager, dependencies.positionManager)) {
    throw new Error("graduated adapter identity mismatch");
  }

  const [routerFactory, quoterFactory] = await Promise.all([
    read<Address>(client, {
      address: dependencies.swapRouter,
      abi: v3FactoryBoundDependencyAbi,
      functionName: "factory",
    } as never),
    read<Address>(client, {
      address: dependencies.quoter,
      abi: v3FactoryBoundDependencyAbi,
      functionName: "factory",
    } as never),
  ]);
  if (!sameAddress(routerFactory, dependencies.factory))
    throw new Error("swap router factory mismatch");
  if (!sameAddress(quoterFactory, dependencies.factory))
    throw new Error("quoter factory mismatch");

  const pool = poolAddressFromId(field(graduation, "poolId", 5));
  const factoryPool = await read<Address>(client, {
    address: dependencies.factory,
    abi: v3FactoryAbi,
    functionName: "getPool",
    args: [context.quoteAsset, token, fee],
  } as never);
  if (!sameAddress(factoryPool, pool))
    throw new Error("graduated pool identity mismatch");

  const [token0, token1, poolFee, liquidity] = await Promise.all([
    read<Address>(client, {
      address: pool,
      abi: v3PoolAbi,
      functionName: "token0",
    } as never),
    read<Address>(client, {
      address: pool,
      abi: v3PoolAbi,
      functionName: "token1",
    } as never),
    read<number | bigint>(client, {
      address: pool,
      abi: v3PoolAbi,
      functionName: "fee",
    } as never),
    read<bigint | number>(client, {
      address: pool,
      abi: v3PoolAbi,
      functionName: "liquidity",
    } as never),
  ]);

  const pairMatches =
    (sameAddress(token0, context.quoteAsset) && sameAddress(token1, token)) ||
    (sameAddress(token0, token) && sameAddress(token1, context.quoteAsset));
  if (!pairMatches || Number(poolFee) !== fee)
    throw new Error("graduated pool identity mismatch");
  if (bigintValue(liquidity, "graduated pool liquidity") <= BigInt(0)) {
    throw new Error("graduated pool has no active liquidity");
  }

  return {
    kind: "V3_POOL",
    token,
    quoteAsset: context.quoteAsset,
    pool,
    fee,
    factory: dependencies.factory,
    positionManager: dependencies.positionManager,
    swapRouter: dependencies.swapRouter,
    swapRouterKind: dependencies.swapRouterKind,
    quoter: dependencies.quoter,
    quoterKind: dependencies.quoterKind,
  };
}
