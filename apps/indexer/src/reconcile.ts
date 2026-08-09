import {
  RebuildRepository,
  type BreadDb,
  type IndexerProtocolContext,
  type ReconciliationLaunchStateRow,
} from '../../../packages/db/src/index.js';
import type { ProtocolContext } from '../../../packages/protocol-sdk/src/index.js';
import type {
  ReconciliationCheck,
  ReconciliationCheckId,
  ReconciliationReport,
} from '../../../packages/types/src/index.js';

import { applyRange } from './apply-range.js';

type ApplyRangeInput = Parameters<typeof applyRange>[0];

type LaunchCreatedIdentity = Readonly<{
  transactionHash: string;
  logIndex: number;
  tokenAddress: string;
}>;

type CanonicalEventIdentity = Readonly<{
  transactionHash: string;
  logIndex: number;
}>;

export type ReconciliationChainReader = Readonly<{
  countLaunchCreated: (input: Readonly<{ factoryAddress: string; fromBlock: bigint; toBlock: bigint }>) => Promise<bigint>;
  scanLaunchCreated: (input: Readonly<{ factoryAddress: string; fromBlock: bigint; toBlock: bigint }>) => Promise<readonly LaunchCreatedIdentity[]>;
  scanCanonicalEventIdentities: (input: Readonly<{ fromBlock: bigint; toBlock: bigint }>) => Promise<readonly CanonicalEventIdentity[]>;
  readCurveState: (input: Readonly<{ tokenAddress: string; curveAddress: string; blockNumber: bigint }>) => Promise<Readonly<{
    trackedQuote: bigint;
    trackedTokens: bigint;
    quoteFeeBalance: bigint;
    creatorTaxBalance: bigint;
    realQuoteReserve: bigint;
    virtualQuoteReserve: bigint;
    reservedTokens: bigint;
    remainingSellableTokens: bigint;
    readyToGraduate: boolean;
    graduated: boolean;
  }>>;
  readFeeEscrowState: (input: Readonly<{ feeEscrowAddress: string; quoteAsset: string; blockNumber: bigint }>) => Promise<Readonly<{
    totalOutstanding: bigint;
    custody: bigint;
  }>>;
  readGraduationState: (input: Readonly<{ tokenAddress: string; blockNumber: bigint }>) => Promise<Readonly<{
    phase: string;
    sweptTokenAmount: bigint;
    sweptUsdcAmount: bigint;
    poolId: string | null;
    positionId: bigint | null;
    positionLocked: boolean;
    tokenSupplyLocked: bigint;
  }>>;
  getRuntimeCodeHash: (address: string) => Promise<string | null>;
  getBlockHash: (blockNumber: bigint) => Promise<string>;
}>;

export type ReconcileStackInput = Readonly<{
  db: BreadDb;
  context: ProtocolContext;
  checkedBlock: bigint;
  chain: ReconciliationChainReader;
}>;

export type RebuildRange = Readonly<{
  fromBlock: bigint;
  toBlock: bigint;
  toBlockHash: string;
  toBlockTimestamp?: bigint;
  logs: ApplyRangeInput['logs'];
}>;

export type RebuildStackInput = Readonly<{
  db: BreadDb;
  client: ApplyRangeInput['client'];
  context: ProtocolContext;
  targetBlock: bigint;
  batchSize: bigint;
  loadRange: (fromBlock: bigint, toBlock: bigint) => Promise<RebuildRange>;
  chain?: ReconciliationChainReader;
  /** Deprecated test-only input. Rebuild success always requires authoritative reconciliation. */
  skipReconciliation?: boolean;
}>;

export type RebuildStackResult = Readonly<{
  fromBlock: string;
  toBlock: string;
  rangesApplied: number;
  reconciliation: ReconciliationReport;
}>;

function protocolContext(context: ProtocolContext): IndexerProtocolContext {
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

function text(value: unknown): string {
  if (typeof value === 'bigint') return value.toString(10);
  if (Array.isArray(value)) return `[${value.map(text).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${key}:${text(item)}`).join(',')}}`;
  }
  return String(value);
}

function check(
  id: ReconciliationCheckId,
  pass: boolean,
  expected: unknown,
  actual: unknown,
  detail: string,
): ReconciliationCheck {
  return {
    id,
    status: pass ? 'PASS' : 'FAIL',
    expected: text(expected),
    actual: text(actual),
    detail,
  };
}

function stateByToken(states: readonly ReconciliationLaunchStateRow[]): Map<string, ReconciliationLaunchStateRow> {
  return new Map(states.map((state) => [state.tokenAddress.toLowerCase(), state]));
}

function launchIdentityKey(value: LaunchCreatedIdentity): string {
  return `${value.transactionHash.toLowerCase()}:${value.logIndex}:${value.tokenAddress.toLowerCase()}`;
}

function eventIdentityKey(value: CanonicalEventIdentity): string {
  return `${value.transactionHash.toLowerCase()}:${value.logIndex}`;
}

function isAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export async function reconcileStack(input: ReconcileStackInput): Promise<ReconciliationReport> {
  const startedAt = new Date().toISOString();
  if (input.checkedBlock < input.context.deploymentStartBlock) throw new Error('reconciliation block precedes deployment start');
  const repository = new RebuildRepository(input.db);
  const snapshot = await repository.reconciliationSnapshot(protocolContext(input.context));
  const checks: ReconciliationCheck[] = [];

  const launchRange = {
    factoryAddress: input.context.factoryAddress,
    fromBlock: input.context.deploymentStartBlock,
    toBlock: input.checkedBlock,
  } as const;
  const [authoritativeLaunchCount, authoritativeLaunchEvents] = await Promise.all([
    input.chain.countLaunchCreated(launchRange),
    input.chain.scanLaunchCreated(launchRange),
  ]);
  const expectedLaunches = [...authoritativeLaunchEvents].map(launchIdentityKey).sort();
  const actualLaunches = snapshot.launches.map((launch) => launchIdentityKey({
    transactionHash: launch.launchTransactionHash,
    logIndex: launch.launchLogIndex,
    tokenAddress: launch.tokenAddress,
  })).sort();
  const launchIdentityMatch = expectedLaunches.length === actualLaunches.length
    && expectedLaunches.every((value, index) => value === actualLaunches[index]);
  checks.push(check(
    'REC-01',
    BigInt(snapshot.launches.length) === authoritativeLaunchCount && launchIdentityMatch,
    { count: authoritativeLaunchCount, launches: expectedLaunches },
    { count: BigInt(snapshot.launches.length), launches: actualLaunches },
    'Factory LaunchCreated count and canonical transaction/log/token identities must equal indexed launches for the selected stack.',
  ));

  const states = stateByToken(snapshot.states);
  const curveExpected: Array<Record<string, unknown>> = [];
  const curveActual: Array<Record<string, unknown>> = [];
  let curvesMatch = true;
  for (const launch of snapshot.launches) {
    const authoritative = await input.chain.readCurveState({
      tokenAddress: launch.tokenAddress,
      curveAddress: launch.curveAddress,
      blockNumber: input.checkedBlock,
    });
    const projected = states.get(launch.tokenAddress.toLowerCase());
    const expected = {
      token: launch.tokenAddress,
      trackedQuote: authoritative.trackedQuote,
      trackedTokens: authoritative.trackedTokens,
      quoteFeeBalance: authoritative.quoteFeeBalance,
      creatorTaxBalance: authoritative.creatorTaxBalance,
      realQuoteReserve: authoritative.realQuoteReserve,
      virtualQuoteReserve: authoritative.virtualQuoteReserve,
      reservedTokens: authoritative.reservedTokens,
      remainingSellableTokens: authoritative.remainingSellableTokens,
      readyToGraduate: authoritative.readyToGraduate,
    };
    const actual = {
      token: launch.tokenAddress,
      trackedQuote: projected?.trackedQuote ?? null,
      trackedTokens: projected?.trackedTokens ?? null,
      quoteFeeBalance: projected?.quoteFeeBalance ?? null,
      creatorTaxBalance: projected?.creatorTaxBalance ?? null,
      realQuoteReserve: projected?.realQuoteReserve ?? null,
      virtualQuoteReserve: projected?.virtualQuoteReserve ?? null,
      reservedTokens: launch.reservedTokensBaseline,
      remainingSellableTokens: projected?.remainingSellableTokens ?? null,
      readyToGraduate: projected?.readyToGraduate ?? null,
    };
    curveExpected.push(expected);
    curveActual.push(actual);
    if (
      !projected ||
      projected.trackedQuote !== authoritative.trackedQuote ||
      projected.trackedTokens !== authoritative.trackedTokens ||
      projected.quoteFeeBalance !== authoritative.quoteFeeBalance ||
      projected.creatorTaxBalance !== authoritative.creatorTaxBalance ||
      projected.realQuoteReserve !== authoritative.realQuoteReserve ||
      projected.virtualQuoteReserve !== authoritative.virtualQuoteReserve ||
      launch.reservedTokensBaseline !== authoritative.reservedTokens ||
      projected.remainingSellableTokens !== authoritative.remainingSellableTokens ||
      projected.readyToGraduate !== authoritative.readyToGraduate
    ) {
      curvesMatch = false;
    }
  }
  checks.push(check(
    'REC-02',
    curvesMatch,
    curveExpected,
    curveActual,
    'Projected tracked reserves, fee buckets, reserve components, remaining allocation and readiness must match authoritative curve state.',
  ));

  const feeEscrowAddress = input.context.addresses.feeEscrow;
  let feePass = false;
  let feeExpected: unknown = { configuredFeeEscrow: true };
  let feeActual: unknown = { configuredFeeEscrow: Boolean(feeEscrowAddress) };
  let feeDetail = 'FeeEscrow must be configured for reconciliation.';
  if (feeEscrowAddress) {
    const authoritative = await input.chain.readFeeEscrowState({
      feeEscrowAddress,
      quoteAsset: input.context.quoteAsset,
      blockNumber: input.checkedBlock,
    });
    const projectedOutstanding = snapshot.credited - snapshot.claimed;
    const surplus = authoritative.custody - authoritative.totalOutstanding;
    feePass = projectedOutstanding === authoritative.totalOutstanding && authoritative.custody >= authoritative.totalOutstanding;
    feeExpected = { totalOutstanding: authoritative.totalOutstanding, custodyAtLeast: authoritative.totalOutstanding };
    feeActual = { projectedOutstanding, onchainTotalOutstanding: authoritative.totalOutstanding, custody: authoritative.custody };
    feeDetail = `projected credits-claims must equal FeeEscrow totalOutstanding; custody must cover outstanding; surplus=${surplus.toString(10)}`;
  }
  checks.push(check('REC-03', feePass, feeExpected, feeActual, feeDetail));

  const graduationExpected: Array<Record<string, unknown>> = [];
  const graduationActual: Array<Record<string, unknown>> = [];
  let graduationMatch = true;
  for (const launch of snapshot.launches) {
    const authoritative = await input.chain.readGraduationState({ tokenAddress: launch.tokenAddress, blockNumber: input.checkedBlock });
    const projected = states.get(launch.tokenAddress.toLowerCase());
    graduationExpected.push({ token: launch.tokenAddress, ...authoritative });
    graduationActual.push({
      token: launch.tokenAddress,
      phase: projected?.graduationPhase ?? null,
      sweptTokenAmount: projected?.sweptTokenAmount ?? 0n,
      sweptUsdcAmount: projected?.sweptUsdcAmount ?? 0n,
      poolId: projected?.poolId ?? null,
      positionId: projected?.positionId ?? null,
      positionLocked: projected?.positionLocked ?? null,
      tokenSupplyLocked: projected?.tokenSupplyLocked ?? 0n,
    });
    if (
      !projected ||
      projected.graduationPhase !== authoritative.phase ||
      (projected.sweptTokenAmount ?? 0n) !== authoritative.sweptTokenAmount ||
      (projected.sweptUsdcAmount ?? 0n) !== authoritative.sweptUsdcAmount ||
      (projected.poolId ?? null)?.toLowerCase() !== (authoritative.poolId ?? null)?.toLowerCase() ||
      (projected.positionId ?? null) !== authoritative.positionId ||
      projected.positionLocked !== authoritative.positionLocked ||
      (projected.tokenSupplyLocked ?? 0n) !== authoritative.tokenSupplyLocked
    ) graduationMatch = false;
  }
  checks.push(check(
    'REC-04',
    graduationMatch,
    graduationExpected,
    graduationActual,
    'Coordinator/locker phase, swept amounts, pool/position identity and lock projection must match authoritative graduation state.',
  ));

  const expectedHashes = snapshot.stack?.runtimeCodeHashes ?? null;
  const registeredEntries = new Map<string, string>();
  registeredEntries.set('factory', input.context.factoryAddress.toLowerCase());
  for (const [role, target] of Object.entries(snapshot.stack?.addresses ?? {})) {
    if (isAddress(target)) registeredEntries.set(role, target.toLowerCase());
  }
  const expectedHashView: Record<string, string> = {};
  const observedHashes: Record<string, string> = {};
  let codeHashPass = Boolean(snapshot.stack && expectedHashes && registeredEntries.size > 0);
  for (const [role, target] of [...registeredEntries.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const expectedHash = expectedHashes?.[role];
    if (!expectedHash) {
      expectedHashView[role] = 'MISSING_EXPECTED_HASH';
      observedHashes[role] = 'NOT_CHECKED';
      codeHashPass = false;
      continue;
    }
    expectedHashView[role] = expectedHash.toLowerCase();
    const observed = await input.chain.getRuntimeCodeHash(target);
    observedHashes[role] = observed?.toLowerCase() ?? 'NO_RUNTIME_CODE';
    if (!observed || observed.toLowerCase() !== expectedHash.toLowerCase()) codeHashPass = false;
  }
  for (const [role, expectedHash] of Object.entries(expectedHashes ?? {})) {
    if (!registeredEntries.has(role)) {
      expectedHashView[role] = expectedHash.toLowerCase();
      observedHashes[role] = 'MISSING_REGISTERED_ADDRESS';
      codeHashPass = false;
    }
  }
  checks.push(check(
    'REC-05',
    codeHashPass,
    expectedHashView,
    observedHashes,
    'Every registered active-stack deployment must have a frozen expected runtime code hash and matching authoritative runtime code.',
  ));

  const checkpoint = snapshot.checkpoint;
  const observedCheckpointHash = await input.chain.getBlockHash(input.checkedBlock);
  const authoritativeEventIdentities = (await input.chain.scanCanonicalEventIdentities({
    fromBlock: input.context.deploymentStartBlock,
    toBlock: input.checkedBlock,
  })).map(eventIdentityKey).sort();
  const projectedEventIdentities = snapshot.journal
    .filter((item) => item.blockNumber <= input.checkedBlock)
    .map(eventIdentityKey)
    .sort();
  const journalIdentityMatch = authoritativeEventIdentities.length === projectedEventIdentities.length
    && authoritativeEventIdentities.every((value, index) => value === projectedEventIdentities[index]);
  const journalWithinCheckpoint = Boolean(checkpoint) && snapshot.journal.every((item) =>
    item.blockNumber >= input.context.deploymentStartBlock
    && item.blockNumber <= input.checkedBlock
    && item.blockNumber <= (checkpoint?.indexedThroughBlock ?? -1n));
  const checkpointPass = Boolean(
    checkpoint &&
    snapshot.stack &&
    checkpoint.deploymentStartBlock === input.context.deploymentStartBlock &&
    snapshot.stack.deploymentStartBlock === input.context.deploymentStartBlock &&
    checkpoint.indexedThroughBlock === input.checkedBlock &&
    checkpoint.indexedThroughBlockHash.toLowerCase() === observedCheckpointHash.toLowerCase() &&
    checkpoint.status === 'COMMITTED' &&
    journalWithinCheckpoint &&
    journalIdentityMatch
  );
  checks.push(check(
    'REC-06',
    checkpointPass,
    {
      deploymentStartBlock: input.context.deploymentStartBlock,
      indexedThroughBlock: input.checkedBlock,
      indexedThroughBlockHash: observedCheckpointHash.toLowerCase(),
      status: 'COMMITTED',
      canonicalEventIdentities: authoritativeEventIdentities,
    },
    {
      checkpoint: checkpoint ?? 'MISSING_CHECKPOINT',
      journalWithinCheckpoint,
      canonicalEventIdentities: projectedEventIdentities,
    },
    'Checkpoint must cover the selected stack contiguously, match the authoritative block hash, contain no journal rows beyond the checkpoint, and match the canonical chain event-identity set.',
  ));

  return {
    reportVersion: 'day6-reconciliation-v1',
    status: checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
    chainId: input.context.chainId,
    stackVersion: input.context.stackVersion,
    factoryAddress: input.context.factoryAddress,
    manifestHash: snapshot.stack?.manifestHash ?? null,
    sourceHash: snapshot.stack?.sourceHash ?? null,
    deploymentStartBlock: input.context.deploymentStartBlock.toString(10),
    checkedBlock: input.checkedBlock.toString(10),
    checkedBlockHash: observedCheckpointHash.toLowerCase(),
    startedAt,
    completedAt: new Date().toISOString(),
    checks,
  };
}

export async function rebuildStack(input: RebuildStackInput): Promise<RebuildStackResult> {
  if (input.targetBlock < input.context.deploymentStartBlock) throw new Error('rebuild target precedes deployment start');
  if (input.batchSize <= 0n) throw new Error('rebuild batchSize must be positive');
  if (input.skipReconciliation || !input.chain) {
    throw new Error('authoritative chain reader is required after rebuild; reconciliation cannot be skipped');
  }

  const repository = new RebuildRepository(input.db);
  await repository.deleteSelectedStackReadModel(protocolContext(input.context));

  let fromBlock = input.context.deploymentStartBlock;
  let rangesApplied = 0;
  while (fromBlock <= input.targetBlock) {
    const toBlock = fromBlock + input.batchSize - 1n > input.targetBlock
      ? input.targetBlock
      : fromBlock + input.batchSize - 1n;
    const loaded = await input.loadRange(fromBlock, toBlock);
    if (loaded.fromBlock !== fromBlock || loaded.toBlock !== toBlock) {
      throw new Error('rebuild loader returned a range different from the requested contiguous batch');
    }
    await applyRange({
      db: input.db,
      client: input.client,
      context: input.context,
      fromBlock,
      toBlock,
      toBlockHash: loaded.toBlockHash as `0x${string}`,
      ...(loaded.toBlockTimestamp === undefined ? {} : { toBlockTimestamp: loaded.toBlockTimestamp }),
      logs: loaded.logs,
    });
    rangesApplied += 1;
    fromBlock = toBlock + 1n;
  }

  const reconciliation = await reconcileStack({
    db: input.db,
    context: input.context,
    checkedBlock: input.targetBlock,
    chain: input.chain,
  });

  return {
    fromBlock: input.context.deploymentStartBlock.toString(10),
    toBlock: input.targetBlock.toString(10),
    rangesApplied,
    reconciliation,
  };
}