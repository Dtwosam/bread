import type { NetworkManifest, ProtocolDeploymentManifest } from '../../config/src/index.js';
import type { Address } from '../../types/src/index.js';
import { getAddress } from 'viem';

export type ProtocolAddresses = Readonly<{
  factory: Address;
  deployer: Address;
  feePolicy: Address;
  feeEscrow: Address;
  emergencyController: Address;
  locker: Address;
  coordinator: Address;
  graduationAdapter?: Address;
}>;

export type V3SwapRouterKind = 'V3_SWAP_ROUTER' | 'V3_SWAP_ROUTER_02';
export type V3QuoterKind = 'V3_QUOTER' | 'V3_QUOTER_V2';

export type GraduatedTradingDependencies = Readonly<{
  family: 'UNISWAP_V3';
  factory: Address;
  positionManager: Address;
  swapRouter: Address;
  swapRouterKind: V3SwapRouterKind;
  quoter: Address;
  quoterKind: V3QuoterKind;
}>;

export type ProtocolContext = Readonly<{
  network: string;
  chainId: number;
  stackVersion: string;
  factoryAddress: Address;
  quoteAsset: Address;
  quoteDecimals: 6;
  deploymentStartBlock: bigint;
  addresses: ProtocolAddresses;
  graduatedTrading?: GraduatedTradingDependencies;
}>;

export type ResolveProtocolContextInput = Readonly<{
  network: NetworkManifest;
  deployment: ProtocolDeploymentManifest;
  stackVersion: string;
}>;

export function canonicalizeProtocolAddress(value: string): Address {
  return getAddress(value).toLowerCase() as Address;
}

function requiredAddress(name: string, value: string | null): Address {
  if (value === null) throw new Error(`unresolved protocol deployment: ${name}`);
  return canonicalizeProtocolAddress(value);
}

function resolveGraduatedTradingDependencies(
  network: NetworkManifest,
): GraduatedTradingDependencies | undefined {
  const { dex } = network;

  if (dex.type !== 'UNISWAP_V3') return undefined;

  if (
    dex.factory === null ||
    dex.positionManager === null ||
    dex.swapRouter === undefined ||
    dex.swapRouter === null ||
    dex.swapRouterKind === undefined ||
    dex.swapRouterKind === null ||
    dex.quoter === undefined ||
    dex.quoter === null ||
    dex.quoterKind === undefined ||
    dex.quoterKind === null
  ) {
    return undefined;
  }

  return {
    family: 'UNISWAP_V3',
    factory: canonicalizeProtocolAddress(dex.factory),
    positionManager: canonicalizeProtocolAddress(dex.positionManager),
    swapRouter: canonicalizeProtocolAddress(dex.swapRouter),
    swapRouterKind: dex.swapRouterKind,
    quoter: canonicalizeProtocolAddress(dex.quoter),
    quoterKind: dex.quoterKind,
  };
}

export function resolveProtocolContext(input: ResolveProtocolContextInput): ProtocolContext {
  const { network, deployment } = input;
  if (input.stackVersion.trim().length === 0) throw new Error('stackVersion is required');
  if (network.network !== deployment.network) throw new Error('network/deployment identity mismatch');
  if (network.chainId === null || deployment.chainId === null) {
    throw new Error('unresolved protocol deployment: chainId');
  }
  if (network.chainId !== deployment.chainId) throw new Error('network/deployment chainId mismatch');
  if (network.usdc.address === null || network.usdc.decimals !== 6) {
    throw new Error('unresolved protocol deployment: canonical USDC');
  }
  if (deployment.deploymentStartBlock === null) {
    throw new Error('unresolved protocol deployment: deploymentStartBlock');
  }
  if (
    network.deploymentStartBlock !== null &&
    network.deploymentStartBlock !== deployment.deploymentStartBlock
  ) {
    throw new Error('network/deployment start block mismatch');
  }

  const addresses: ProtocolAddresses = {
    factory: requiredAddress('factory', deployment.core.factory),
    deployer: requiredAddress('deployer', deployment.core.deployer),
    feePolicy: requiredAddress('feePolicy', deployment.core.feePolicy),
    feeEscrow: requiredAddress('feeEscrow', deployment.core.feeEscrow),
    emergencyController: requiredAddress('emergencyController', deployment.core.emergencyController),
    locker: requiredAddress('locker', deployment.core.locker),
    coordinator: requiredAddress('coordinator', deployment.core.coordinator),
    ...(deployment.adapter.adapter === null
      ? {}
      : { graduationAdapter: canonicalizeProtocolAddress(deployment.adapter.adapter) }),
  };
  const graduatedTrading = resolveGraduatedTradingDependencies(network);

  return {
    network: network.network,
    chainId: network.chainId,
    stackVersion: input.stackVersion,
    factoryAddress: addresses.factory,
    quoteAsset: canonicalizeProtocolAddress(network.usdc.address),
    quoteDecimals: 6,
    deploymentStartBlock: BigInt(deployment.deploymentStartBlock),
    addresses,
    ...(graduatedTrading === undefined ? {} : { graduatedTrading }),
  };
}
