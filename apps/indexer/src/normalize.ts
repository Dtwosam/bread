import { getAddress } from 'viem';

import type {
  Address,
  BreadCanonicalEventName,
  BreadContractRole,
  DecodedBreadEvent,
  Hex,
  Hex32,
} from '../../../packages/types/src/index.js';
import {
  breadAbiRegistry,
  classifyBreadLog,
  createBreadStackAbiBinding,
  decodeBreadLog,
  type ProtocolContext,
} from '../../../packages/protocol-sdk/src/index.js';

import type { RpcLog } from './discovery.js';
import { correlateCanonicalTrades, type NormalizedTrade } from './trades.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_DISPLAY_TEXT = 4_096;
const MAX_DISPLAY_URL = 2_048;

export type ChainReadClient = Readonly<{
  readContract: (request: Readonly<Record<string, unknown>>) => Promise<unknown>;
  getBlock?: (request: Readonly<{ blockNumber: bigint }>) => Promise<Readonly<{ timestamp: bigint }>>;
}>;

export type KnownLaunchIdentity = Readonly<{
  tokenAddress: string;
  curveAddress: string;
}>;

export type LaunchSnapshot = Readonly<{
  chainId: number;
  tokenAddress: Address;
  curveAddress: Address;
  stackVersion: string;
  factoryAddress: Address;
  deployerAddress: Address;
  creatorFeeRecipient: Address;
  creatorTaxBps: bigint;
  economicsDigest: Hex32;
  configVersion: bigint;
  launchTimestamp: bigint;
  name: string;
  symbol: string;
  metadata: Readonly<Record<string, unknown>>;
  quoteAsset: Address;
  initialSupply: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  protocolFeeRecipient: Address;
  tradeFeeBps: bigint;
  protocolFeeShareBps: bigint;
  maxCreatorTaxBps: bigint;
  graduationCoordinator: Address;
  graduationAdapter: Address;
  graduationAdapterFamily: number;
  graduationConfigHash: Hex32;
  reservedTokensBaseline: bigint;
  launchBlockNumber: bigint;
  launchTransactionHash: Hex32;
  launchLogIndex: number;
}>;

export type NormalizedRange = Readonly<{
  events: readonly DecodedBreadEvent[];
  launchSnapshots: ReadonlyMap<string, LaunchSnapshot>;
  trades: readonly NormalizedTrade[];
}>;

export type NormalizeTransactionLogsInput = Readonly<{
  client: ChainReadClient;
  context: ProtocolContext;
  knownLaunches?: readonly KnownLaunchIdentity[];
  logs: readonly RpcLog[];
  toBlock: bigint;
  toBlockTimestamp?: bigint;
}>;

function asAddress(value: unknown, label: string): Address {
  if (typeof value !== 'string') throw new Error(`${label} is not an address`);
  try {
    return getAddress(value).toLowerCase() as Address;
  } catch {
    throw new Error(`${label} is not an address`);
  }
}

function asHex32(value: unknown, label: string): Hex32 {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} is not bytes32`);
  return value.toLowerCase() as Hex32;
}

function asBigInt(value: unknown, label: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`${label} is not an exact integer`);
}

function asSmallNumber(value: unknown, label: string): number {
  const integer = asBigInt(value, label);
  const number = Number(integer);
  if (!Number.isSafeInteger(number)) throw new Error(`${label} exceeds safe integer range`);
  return number;
}

function bigintifyNumbers(value: unknown): unknown {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('decoded event contains unsafe numeric integer');
    return BigInt(value);
  }
  if (Array.isArray(value)) return value.map(bigintifyNumbers);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, bigintifyNumbers(item)]));
  }
  return value;
}

function sanitizeText(value: unknown, maximumLength = MAX_DISPLAY_TEXT): string {
  return String(value ?? '')
    .replace(/\\u0000/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maximumLength);
}

function sanitizeDisplayUrl(value: unknown): string {
  const candidate = sanitizeText(value, MAX_DISPLAY_URL);
  if (candidate.length === 0) return '';
  if (/^ipfs:\/\//i.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? candidate : '';
  } catch {
    return '';
  }
}

export function sanitizeDisplayMetadata(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const socialInput =
    input.socials && typeof input.socials === 'object'
      ? (input.socials as Readonly<Record<string, unknown>>)
      : {};
  return {
    logo: sanitizeDisplayUrl(input.logo),
    description: sanitizeText(input.description),
    socials: {
      twitter: sanitizeDisplayUrl(socialInput.twitter),
      telegram: sanitizeDisplayUrl(socialInput.telegram),
      discord: sanitizeDisplayUrl(socialInput.discord),
      website: sanitizeDisplayUrl(socialInput.website),
      farcaster: sanitizeDisplayUrl(socialInput.farcaster),
    },
  };
}

function eventKey(chainId: number, transactionHash: string, logIndex: number): string {
  return `${chainId}:${transactionHash.toLowerCase()}:${logIndex}`;
}

function decodeForRole(
  log: RpcLog,
  role: BreadContractRole,
  context: ProtocolContext,
): Readonly<{ eventName: string; args: Readonly<Record<string, unknown>>; disposition: string }> {
  if (log.eventName !== undefined) {
    return {
      eventName: log.eventName,
      args: log.args ?? {},
      disposition: classifyBreadLog(role, log.eventName),
    };
  }
  if (log.topics.length === 0) throw new Error('known Bread log is missing topic0');
  return decodeBreadLog({
    binding: createBreadStackAbiBinding(context.stackVersion),
    stackVersion: context.stackVersion,
    role,
    topics: log.topics,
    data: log.data,
  });
}

function coreRoleByAddress(context: ProtocolContext): Map<string, BreadContractRole> {
  return new Map<string, BreadContractRole>([
    [context.factoryAddress.toLowerCase(), 'FACTORY'],
    [context.addresses.feePolicy.toLowerCase(), 'FEE_POLICY'],
    [context.addresses.feeEscrow.toLowerCase(), 'FEE_ESCROW'],
    [context.addresses.emergencyController.toLowerCase(), 'EMERGENCY_CONTROLLER'],
    [context.addresses.coordinator.toLowerCase(), 'GRADUATION_COORDINATOR'],
    [context.addresses.locker.toLowerCase(), 'LOCKER'],
  ]);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error(`${label} returned invalid structured data`);
  return value as Record<string, unknown>;
}

async function read(
  client: ChainReadClient,
  address: Address,
  abi: readonly unknown[],
  functionName: string,
  args?: readonly unknown[],
): Promise<unknown> {
  return client.readContract({ address, abi, functionName, ...(args ? { args } : {}) });
}

async function buildLaunchSnapshot(
  client: ChainReadClient,
  context: ProtocolContext,
  launchLog: RpcLog,
  launchArgs: Readonly<Record<string, unknown>>,
  mintLog: RpcLog,
  mintArgs: Readonly<Record<string, unknown>>,
): Promise<LaunchSnapshot> {
  const token = asAddress(launchArgs.token, 'LaunchCreated.token');
  const curve = asAddress(launchArgs.curve, 'LaunchCreated.curve');
  const factoryRecord = record(
    await read(client, context.factoryAddress, breadAbiRegistry.factory, 'getLaunch', [token]),
    'Factory.getLaunch',
  );
  const onchainStackVersion = await read(client, context.factoryAddress, breadAbiRegistry.factory, 'stackVersion');
  if (String(onchainStackVersion) !== context.stackVersion) throw new Error('Factory stackVersion does not match ProtocolContext');

  if (asAddress(factoryRecord.token, 'Factory.getLaunch.token') !== token) throw new Error('Factory launch token mismatch');
  if (asAddress(factoryRecord.curve, 'Factory.getLaunch.curve') !== curve) throw new Error('Factory launch curve mismatch');
  if (asAddress(factoryRecord.deployer, 'Factory.getLaunch.deployer') !== asAddress(launchArgs.deployer, 'LaunchCreated.deployer')) {
    throw new Error('Factory launch deployer mismatch');
  }
  if (
    asAddress(factoryRecord.creatorFeeRecipient, 'Factory.getLaunch.creatorFeeRecipient') !==
    asAddress(launchArgs.creatorFeeRecipient, 'LaunchCreated.creatorFeeRecipient')
  ) {
    throw new Error('Factory creator fee recipient mismatch');
  }
  if (asBigInt(factoryRecord.creatorTaxBps, 'Factory.getLaunch.creatorTaxBps') !== asBigInt(launchArgs.creatorTaxBps, 'LaunchCreated.creatorTaxBps')) {
    throw new Error('Factory creator tax mismatch');
  }
  if (asHex32(factoryRecord.economicsDigest, 'Factory.getLaunch.economicsDigest') !== asHex32(launchArgs.economicsDigest, 'LaunchCreated.economicsDigest')) {
    throw new Error('Factory economics digest mismatch');
  }
  if (asBigInt(factoryRecord.configVersion, 'Factory.getLaunch.configVersion') !== asBigInt(launchArgs.configVersion, 'LaunchCreated.configVersion')) {
    throw new Error('Factory config version mismatch');
  }

  const [
    curveToken,
    pairToken,
    phantomQuote,
    graduationThreshold,
    protocolFeeRecipient,
    tradeFeeBps,
    protocolFeeShareBps,
    maxCreatorTaxBps,
    curveCreatorTaxBps,
    curveLaunchTimestamp,
    reservedTokens,
    curveCoordinator,
    tokenName,
    tokenSymbol,
    tokenCurve,
    tokenFactory,
    tokenDeployer,
    tokenLogo,
    tokenDescription,
    tokenSocials,
  ] = await Promise.all([
    read(client, curve, breadAbiRegistry.curve, 'token'),
    read(client, curve, breadAbiRegistry.curve, 'pairToken'),
    read(client, curve, breadAbiRegistry.curve, 'phantomQuote'),
    read(client, curve, breadAbiRegistry.curve, 'graduationThreshold'),
    read(client, curve, breadAbiRegistry.curve, 'protocolFeeRecipient'),
    read(client, curve, breadAbiRegistry.curve, 'tradeFeeBps'),
    read(client, curve, breadAbiRegistry.curve, 'protocolFeeShareBps'),
    read(client, curve, breadAbiRegistry.curve, 'maxCreatorTaxBps'),
    read(client, curve, breadAbiRegistry.curve, 'creatorTaxBps'),
    read(client, curve, breadAbiRegistry.curve, 'launchTimestamp'),
    read(client, curve, breadAbiRegistry.curve, 'reservedTokens'),
    read(client, curve, breadAbiRegistry.curve, 'graduationCoordinator'),
    read(client, token, breadAbiRegistry.launchToken, 'name'),
    read(client, token, breadAbiRegistry.launchToken, 'symbol'),
    read(client, token, breadAbiRegistry.launchToken, 'curve'),
    read(client, token, breadAbiRegistry.launchToken, 'launchFactory'),
    read(client, token, breadAbiRegistry.launchToken, 'deployer'),
    read(client, token, breadAbiRegistry.launchToken, 'logo'),
    read(client, token, breadAbiRegistry.launchToken, 'description'),
    read(client, token, breadAbiRegistry.launchToken, 'socials'),
  ]);

  if (asAddress(curveToken, 'curve.token') !== token) throw new Error('curve token mismatch');
  if (asAddress(pairToken, 'curve.pairToken') !== input.context.quoteAsset.toLowerCase()) throw new Error('curve quote asset mismatch');
  if (asAddress(curveCoordinator, 'curve.graduationCoordinator') !== asAddress(factoryRecord.graduationCoordinator, 'Factory.getLaunch.graduationCoordinator')) {
    throw new Error('curve graduation coordinator mismatch');
  }
  if (asBigInt(curveCreatorTaxBps, 'curve.creatorTaxBps') !== asBigInt(launchArgs.creatorTaxBps, 'LaunchCreated.creatorTaxBps')) {
    throw new Error('curve creator tax mismatch');
  }
  if (asBigInt(curveLaunchTimestamp, 'curve.launchTimestamp') !== asBigInt(factoryRecord.launchTimestamp, 'Factory.getLaunch.launchTimestamp')) {
    throw new Error('curve launch timestamp mismatch');
  }
  if (asAddress(tokenCurve, 'token.curve') !== curve) throw new Error('token curve mismatch');
  if (asAddress(tokenFactory, 'token.launchFactory') !== context.factoryAddress.toLowerCase()) throw new Error('token launchFactory mismatch');
  if (asAddress(tokenDeployer, 'token.deployer') !== asAddress(launchArgs.deployer, 'LaunchCreated.deployer')) throw new Error('token deployer mismatch');

  const mintFrom = asAddress(mintArgs.from, 'constructor mint from');
  const mintTo = asAddress(mintArgs.to, 'constructor mint to');
  if (mintFrom !== ZERO_ADDRESS || mintTo !== curve) throw new Error('contradictory constructor mint curve identity');
  const initialSupply = asBigInt(mintArgs.value, 'constructor mint value');
  if (initialSupply <= 0n) throw new Error('constructor mint supply must be positive');

  const socials = Array.isArray(tokenSocials) ? tokenSocials : [];
  const metadata = sanitizeDisplayMetadata({
    logo: tokenLogo,
    description: tokenDescription,
    socials: {
      twitter: socials[0],
      telegram: socials[1],
      discord: socials[2],
      website: socials[3],
      farcaster: socials[4],
    },
  });

  return {
    chainId: context.chainId,
    tokenAddress: token,
    curveAddress: curve,
    stackVersion: context.stackVersion,
    factoryAddress: context.factoryAddress.toLowerCase() as Address,
    deployerAddress: asAddress(launchArgs.deployer, 'LaunchCreated.deployer'),
    creatorFeeRecipient: asAddress(launchArgs.creatorFeeRecipient, 'LaunchCreated.creatorFeeRecipient'),
    creatorTaxBps: asBigInt(launchArgs.creatorTaxBps, 'LaunchCreated.creatorTaxBps'),
    economicsDigest: asHex32(launchArgs.economicsDigest, 'LaunchCreated.economicsDigest'),
    configVersion: asBigInt(launchArgs.configVersion, 'LaunchCreated.configVersion'),
    launchTimestamp: asBigInt(factoryRecord.launchTimestamp, 'Factory.getLaunch.launchTimestamp'),
    name: sanitizeText(tokenName, 256),
    symbol: sanitizeText(tokenSymbol, 64),
    metadata,
    quoteAsset: asAddress(pairToken, 'curve.pairToken'),
    initialSupply,
    phantomQuote: asBigInt(phantomQuote, 'curve.phantomQuote'),
    graduationThreshold: asBigInt(graduationThreshold, 'curve.graduationThreshold'),
    protocolFeeRecipient: asAddress(protocolFeeRecipient, 'curve.protocolFeeRecipient'),
    tradeFeeBps: asBigInt(tradeFeeBps, 'curve.tradeFeeBps'),
    protocolFeeShareBps: asBigInt(protocolFeeShareBps, 'curve.protocolFeeShareBps'),
    maxCreatorTaxBps: asBigInt(maxCreatorTaxBps, 'curve.maxCreatorTaxBps'),
    graduationCoordinator: asAddress(factoryRecord.graduationCoordinator, 'Factory.getLaunch.graduationCoordinator'),
    graduationAdapter: asAddress(factoryRecord.graduationAdapter, 'Factory.getLaunch.graduationAdapter'),
    graduationAdapterFamily: asSmallNumber(factoryRecord.graduationAdapterFamily, 'Factory.getLaunch.graduationAdapterFamily'),
    graduationConfigHash: asHex32(factoryRecord.graduationConfigHash, 'Factory.getLaunch.graduationConfigHash'),
    reservedTokensBaseline: asBigInt(reservedTokens, 'curve.reservedTokens'),
    launchBlockNumber: launchLog.blockNumber,
    launchTransactionHash: asHex32(launchLog.transactionHash, 'LaunchCreated transactionHash'),
    launchLogIndex: launchLog.logIndex,
  };
}

async function blockTimestamps(input: NormalizeTransactionLogsInput): Promise<Map<bigint, bigint>> {
  const result = new Map<bigint, bigint>();
  if (input.toBlockTimestamp !== undefined) result.set(input.toBlock, input.toBlockTimestamp);
  const missing = [...new Set(input.logs.map((log) => log.blockNumber))].filter((block) => !result.has(block));
  if (missing.length === 0) return result;
  if (!input.client.getBlock) throw new Error('exact block timestamp is required before DB apply');
  for (const blockNumber of missing) {
    const block = await input.client.getBlock({ blockNumber });
    result.set(blockNumber, block.timestamp);
  }
  return result;
}

export async function normalizeTransactionLogs(input: NormalizeTransactionLogsInput): Promise<NormalizedRange> {
  const factoryLogs = input.logs.filter((log) => log.address.toLowerCase() === input.context.factoryAddress.toLowerCase());
  const launches: Array<{ log: RpcLog; args: Readonly<Record<string, unknown>> }> = [];
  for (const log of factoryLogs) {
    const decoded = decodeForRole(log, 'FACTORY', input.context);
    if (decoded.disposition === 'UNKNOWN') throw new Error(`unknown Factory event: ${decoded.eventName}`);
    if (decoded.eventName === 'LaunchCreated') launches.push({ log, args: decoded.args });
  }

  const dynamicRoles = new Map<string, BreadContractRole>();
  for (const known of input.knownLaunches ?? []) {
    dynamicRoles.set(asAddress(known.tokenAddress, 'known launch token'), 'LAUNCH_TOKEN');
    dynamicRoles.set(asAddress(known.curveAddress, 'known launch curve'), 'CURVE');
  }
  const launchSnapshots = new Map<string, LaunchSnapshot>();

  for (const launch of launches) {
    const token = asAddress(launch.args.token, 'LaunchCreated.token');
    const curve = asAddress(launch.args.curve, 'LaunchCreated.curve');
    dynamicRoles.set(token, 'LAUNCH_TOKEN');
    dynamicRoles.set(curve, 'CURVE');

    const sameTransactionTokenLogs = input.logs.filter(
      (log) => log.transactionHash.toLowerCase() === launch.log.transactionHash.toLowerCase() && log.address.toLowerCase() === token,
    );
    let constructorMint: { log: RpcLog; args: Readonly<Record<string, unknown>> } | undefined;
    let observedMint = false;
    for (const log of sameTransactionTokenLogs) {
      const decoded = decodeForRole(log, 'LAUNCH_TOKEN', input.context);
      if (decoded.eventName !== 'Transfer') continue;
      const from = asAddress(decoded.args.from, 'Transfer.from');
      if (from !== ZERO_ADDRESS) continue;
      observedMint = true;
      const to = asAddress(decoded.args.to, 'Transfer.to');
      if (to === curve) constructorMint = { log, args: decoded.args };
    }
    if (!constructorMint) {
      throw new Error(observedMint ? 'contradictory constructor mint curve identity' : 'missing constructor mint for LaunchCreated');
    }
    if (constructorMint.log.logIndex >= launch.log.logIndex) throw new Error('constructor mint must precede LaunchCreated');

    const snapshot = await buildLaunchSnapshot(
      input.client,
      input.context,
      launch.log,
      launch.args,
      constructorMint.log,
      constructorMint.args,
    );
    launchSnapshots.set(eventKey(input.context.chainId, launch.log.transactionHash, launch.log.logIndex), snapshot);
  }

  const timestamps = await blockTimestamps(input);
  const roles = coreRoleByAddress(input.context);
  for (const [address, role] of dynamicRoles) roles.set(address, role);

  const events: DecodedBreadEvent[] = [];
  for (const log of [...input.logs].sort((left, right) => {
    if (left.blockNumber !== right.blockNumber) return left.blockNumber < right.blockNumber ? -1 : 1;
    if (left.transactionIndex !== right.transactionIndex) return left.transactionIndex - right.transactionIndex;
    return left.logIndex - right.logIndex;
  })) {
    const role = roles.get(log.address.toLowerCase());
    if (!role) throw new Error(`unregistered Bread log address: ${log.address}`);
    const decoded = decodeForRole(log, role, input.context);
    if (decoded.disposition === 'KNOWN_IGNORED') continue;
    if (decoded.disposition === 'UNKNOWN') throw new Error(`unknown ${role} event: ${decoded.eventName}`);
    const timestamp = timestamps.get(log.blockNumber);
    if (timestamp === undefined) throw new Error(`missing exact block timestamp for ${log.blockNumber}`);
    if (log.topics.length === 0) throw new Error('canonical Bread log is missing topic0');

    events.push({
      identity: {
        chainId: input.context.chainId,
        transactionHash: asHex32(log.transactionHash, 'transactionHash'),
        logIndex: log.logIndex,
      },
      blockNumber: log.blockNumber,
      blockHash: asHex32(log.blockHash, 'blockHash'),
      blockTimestamp: timestamp,
      transactionIndex: log.transactionIndex,
      contractAddress: asAddress(log.address, 'contractAddress'),
      contractRole: role,
      stackVersion: input.context.stackVersion,
      topic0: asHex32(log.topics[0], 'topic0'),
      topics: log.topics as readonly Hex[],
      data: log.data,
      eventName: decoded.eventName as BreadCanonicalEventName,
      payload: bigintifyNumbers(decoded.args),
    } as DecodedBreadEvent);
  }

  const tradeLaunches = [
    ...(input.knownLaunches ?? []),
    ...[...launchSnapshots.values()].map((snapshot) => ({
      tokenAddress: snapshot.tokenAddress,
      curveAddress: snapshot.curveAddress,
    })),
  ];
  const trades = correlateCanonicalTrades({
    context: input.context,
    knownLaunches: tradeLaunches,
    events,
  });

  return { events, launchSnapshots, trades };
}
