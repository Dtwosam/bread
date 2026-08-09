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

export type ProtocolContext = Readonly<{
  network: string;
  chainId: number;
  stackVersion: string;
  factoryAddress: Address;
  quoteAsset: Address;
  quoteDecimals: 6;
  deploymentStartBlock: bigint;
  addresses: ProtocolAddresses;
}>;

export type ResolveProtocolContextInput = Readonly<{
  network: NetworkManifest;
  deployment: ProtocolDeploymentManifest;
  stackVersion: string;
}>;

function requiredAddress(name: string, value: string | null): Address {
  if (value === null) throw new Error(`unresolved protocol deployment: ${name}`);
  return getAddress(value) as Address;
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
      : { graduationAdapter: getAddress(deployment.adapter.adapter) as Address }),
  };

  return {
    network: network.network,
    chainId: network.chainId,
    stackVersion: input.stackVersion,
    factoryAddress: addresses.factory,
    quoteAsset: getAddress(network.usdc.address) as Address,
    quoteDecimals: 6,
    deploymentStartBlock: BigInt(deployment.deploymentStartBlock),
    addresses,
  };
}
