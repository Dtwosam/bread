import { getAddress, type PublicClient } from "viem";

import type { Address, Hex32 } from "../../types/src/index.js";
import { breadAbiRegistry } from "./abi/generated.ts";
import type { ProtocolContext } from "./context.js";
import {
  graduatedV3AdapterAbi,
  v3FactoryAbi,
  v3FactoryBoundDependencyAbi,
  v3PoolAbi,
} from "./v3-abi.ts";
import { poolAddressFromId } from "./v3-pool.ts";

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
  const snapshottedAdapterConfigHash = bytes32Field(
    launch,
    "adapterConfigHash",
    10,
    "adapter config hash",
  );

  if (!sameAddress(coordinator, context.addresses.graduationCoordinator)) {
    throw new Error("canonical launch coordinator mismatch");
  }

  const [phaseRaw, readyRaw] = await Promise.all([
    read<unknown>(client, {
      address: context.addresses.graduationCoordinator,
      abi: breadAbiRegistry.graduationCoordinator,
      functionName: "phaseOf",
      args: [token],
    } as never),
    read<unknown>(client, {
      address: curve,
      abi: breadAbiRegistry.curve,
      functionName: "readyToGraduate",
    } as never),
  ]);

  const phase = integerField([phaseRaw], "phase", 0, "graduation phase");
  const readyToGraduate = readyRaw === true;

  if (phase === 0) {
    if (readyToGraduate) {
      throw new Error("graduation pending; canonical route unavailable");
    }
    return { kind: "CURVE", curve };
  }
  if (phase === 1) {
    throw new Error("graduation pending; canonical route unavailable");
  }
  if (phase === 3) {
    throw new Error("rescued launch has no canonical public trading route");
  }
  if (phase !== 2) {
    throw new Error("invalid canonical graduation phase");
  }

  const graduated = context.graduatedTrading;
  if (graduated === undefined)
    throw new Error("canonical graduated trading dependencies are unavailable");
  if (graduated.kind !== "UNISWAP_V3")
    throw new Error("unsupported canonical graduated trading family");
  if (!sameAddress(adapter, graduated.adapter))
    throw new Error("canonical launch graduation adapter mismatch");

  const [adapterConfigHash, familyRaw, factory, positionManager, feeRaw] = await Promise.all([
    read<Hex32>(client, {
      address: adapter,
      abi: v3FactoryBoundDependencyAbi,
      functionName: "adapterConfigHash",
    } as never),
    read<unknown>(client, {
      address: adapter,
      abi: graduatedV3AdapterAbi,
      functionName: "family",
    } as never),
    read<Address>(client, {
      address: adapter,
      abi: v3FactoryBoundDependencyAbi,
      functionName: "factory",
    } as never),
    read<Address>(client, {
      address: adapter,
      abi: v3FactoryBoundDependencyAbi,
      functionName: "positionManager",
    } as never),
    read<unknown>(client, {
      address: adapter,
      abi: v3FactoryBoundDependencyAbi,
      functionName: "fee",
    } as never),
  ]);

  const family = integerField([familyRaw], "family", 0, "V3 adapter family");
  const fee = integerField([feeRaw], "fee", 0, "V3 fee");
  if (family !== V3_FAMILY) throw new Error("unsupported canonical graduation family");
  if (adapterConfigHash.toLowerCase() !== snapshottedAdapterConfigHash)
    throw new Error("canonical V3 adapter config hash mismatch");
  if (!sameAddress(factory, graduated.factory))
    throw new Error("canonical V3 factory mismatch");
  if (!sameAddress(positionManager, graduated.positionManager))
    throw new Error("canonical V3 position manager mismatch");
  if (fee !== graduated.fee) throw new Error("canonical V3 fee mismatch");

  const [poolId, pool, quoteAsset, token0, token1, poolFeeRaw, liquidityRaw] = await Promise.all([
    read<Hex32>(client, {
      address: context.addresses.graduationCoordinator,
      abi: breadAbiRegistry.graduationCoordinator,
      functionName: "poolIdOf",
      args: [token],
    } as never),
    read<Address>(client, {
      address: factory,
      abi: v3FactoryAbi,
      functionName: "getPool",
      args: [token, context.usdc, fee],
    } as never),
    Promise.resolve(context.usdc),
    read<Address>(client, {
      address: poolAddressFromId(await read<Hex32>(client, {
        address: context.addresses.graduationCoordinator,
        abi: breadAbiRegistry.graduationCoordinator,
        functionName: "poolIdOf",
        args: [token],
      } as never)),
      abi: v3PoolAbi,
      functionName: "token0",
    } as never),
    read<Address>(client, {
      address: poolAddressFromId(await read<Hex32>(client, {
        address: context.addresses.graduationCoordinator,
        abi: breadAbiRegistry.graduationCoordinator,
        functionName: "poolIdOf",
        args: [token],
      } as never)),
      abi: v3PoolAbi,
      functionName: "token1",
    } as never),
    read<unknown>(client, {
      address: poolAddressFromId(await read<Hex32>(client, {
        address: context.addresses.graduationCoordinator,
        abi: breadAbiRegistry.graduationCoordinator,
        functionName: "poolIdOf",
        args: [token],
      } as never)),
      abi: v3PoolAbi,
      functionName: "fee",
    } as never),
    read<unknown>(client, {
      address: poolAddressFromId(await read<Hex32>(client, {
        address: context.addresses.graduationCoordinator,
        abi: breadAbiRegistry.graduationCoordinator,
        functionName: "poolIdOf",
        args: [token],
      } as never)),
      abi: v3PoolAbi,
      functionName: "liquidity",
    } as never),
  ]);

  const expectedPool = poolAddressFromId(poolId);
  if (!sameAddress(pool, expectedPool)) throw new Error("canonical V3 pool mismatch");
  const poolFee = integerField([poolFeeRaw], "fee", 0, "V3 pool fee");
  const liquidity = bigintValue(liquidityRaw, "V3 pool liquidity");
  if (poolFee !== fee) throw new Error("canonical V3 pool fee mismatch");
  if (liquidity <= 0n) throw new Error("canonical V3 pool has no active liquidity");

  const tokenPair = [token0.toLowerCase(), token1.toLowerCase()].sort();
  const expectedPair = [token.toLowerCase(), quoteAsset.toLowerCase()].sort();
  if (tokenPair[0] !== expectedPair[0] || tokenPair[1] !== expectedPair[1]) {
    throw new Error("canonical V3 pool pair mismatch");
  }

  return {
    kind: "V3_POOL",
    token,
    quoteAsset,
    pool: expectedPool,
    fee,
    factory,
    positionManager,
    swapRouter: graduated.swapRouter,
    swapRouterKind: graduated.swapRouterKind,
    quoter: graduated.quoter,
    quoterKind: graduated.quoterKind,
  };
}
