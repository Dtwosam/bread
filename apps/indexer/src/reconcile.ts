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

export type ReconciliationChainReader = Readonly<{
  countLaunchCreated: (input: Readonly<{ factoryAddress: string; fromBlock: bigint; toBlock: bigint }>) => Promise<bigint>;
  readCurveState: (input: Readonly<{ tokenAddress: string; curveAddress: string; blockNumber: bigint }>) => Promise<Readonly<{
    trackedQuote: bigint;
    trackedTokens: bigint;
  }>>;
  readFeeEscrowState: (input: Readonly<{ feeEscrowAddress: string; quoteAsset: string; blockNumber: bigint }>) => Promise<Readonly<{
    totalOutstanding: bigint;
    custody: bigint;
  }>>;
  readGraduationState: (input: Readonly<{ tokenAddress: string; blockNumber: bigint }>) => Promise<Readonly<{
    phase: string;
    poolId: string | null;
    positionLocked: boolean;
    tokenSupplyLocked: bigint;
  }>>;
  getRuntimeCodeHash: (address: string) => Promise<string>;
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

export async function reconcileStack(input: ReconcileStackInput): Promise<ReconciliationReport> {
  if (input.checkedBlock < input.context.deploymentStartBlock) throw new Error('reconciliation block precedes deployment start');
  const repository = new RebuildRepository(input.db);
  const snapshot = await repository.reconciliationSnapshot(protocolContext(input.context));
  const checks: ReconciliationCheck[] = [];

  const authoritativeLaunchCount = await input.chain.countLaunchCreated({
    factoryAddress: input.context.factoryAddress,
    fromBlock: input.context.deploymentStartBlock,
    toBlock: input.checkedBlock,
  });
  checks.push(check(
    'REC-01',
    BigInt(snapshot.launches.length) === authoritativeLaunchCount,
    authoritativeLaunchCount,
    BigInt(snapshot.launches.length),
    'Factory LaunchCreated count must equal indexed launch count for the selected stack.',
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
    curveExpected.push({ token: launch.tokenAddress, trackedQuote: authoritative.trackedQuote, trackedTokens: authoritative.trackedTokens });
    curveActual.push({ token: launch.tokenAddress, trackedQuote: projected?.trackedQuote ?? null, trackedTokens: projected?.trackedTokens ?? null });
    if (!projected || projected.trackedQuote !== authoritative.trackedQuote || projected.trackedTokens !== authoritative.trackedTokens) {
      curvesMatch = false;
    }
  }
  checks.push(check('REC-02', curvesMatch, curveExpected, curveActual, 'Projected tracked curve reserves must match authoritative curve state.'));

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
      poolId: projected?.poolId ?? null,
      positionLocked: projected?.positionLocked ?? null,
      tokenSupplyLocked: projected?.tokenSupplyLocked ?? null,
    });
    if (
      !projected ||
      projected.graduationPhase !== authoritative.phase ||
      (projected.poolId ?? null)?.toLowerCase() !== (authoritative.poolId ?? null)?.toLowerCase() ||
      projected.positionLocked !== authoritative.positionLocked ||
      (projected.tokenSupplyLocked ?? 0n) !== authoritative.tokenSupplyLocked
    ) graduationMatch = false;
  }
  checks.push(check('REC-04', graduationMatch, graduationExpected, graduationActual, 'Coordinator/locker projection must match authoritative graduation state.'));

  const expectedHashes = snapshot.stack?.runtimeCodeHashes ?? null;
  const observedHashes: Record<string, string> = {};
  let codeHashPass = Boolean(expectedHashes && Object.keys(expectedHashes).length > 0);
  if (expectedHashes) {
    for (const [role, expectedHash] of Object.entries(expectedHashes).sort(([a], [b]) => a.localeCompare(b))) {
      const target = role === 'factory'
        ? input.context.factoryAddress
        : snapshot.stack?.addresses[role] ?? (input.context.addresses as Readonly<Record<string, string | undefined>>)[role];
      if (!target) {
        observedHashes[role] = 'MISSING_ADDRESS';
        codeHashPass = false;
        continue;
      }
      const observed = (await input.chain.getRuntimeCodeHash(target)).toLowerCase();
      observedHashes[role] = observed;
      if (observed !== expectedHash.toLowerCase()) codeHashPass = false;
    }
  }
  checks.push(check(
    'REC-05',
    codeHashPass,
    expectedHashes ?? 'EXPECTED_RUNTIME_CODE_HASHES_REQUIRED',
    observedHashes,
    'Every expected registered deployment runtime code hash must be present and match authoritative chain code.',
  ));

  const checkpoint = snapshot.checkpoint;
  const observedCheckpointHash = await input.chain.getBlockHash(input.checkedBlock);
  const checkpointPass = Boolean(
    checkpoint &&
    snapshot.stack &&
    checkpoint.deploymentStartBlock === input.context.deploymentStartBlock &&
    snapshot.stack.deploymentStartBlock === input.context.deploymentStartBlock &&
    checkpoint.indexedThroughBlock === input.checkedBlock &&
    checkpoint.indexedThroughBlockHash.toLowerCase() === observedCheckpointHash.toLowerCase() &&
    checkpoint.status === 'COMMITTED'
  );
  checks.push(check(
    'REC-06',
    checkpointPass,
    {
      deploymentStartBlock: input.context.deploymentStartBlock,
      indexedThroughBlock: input.checkedBlock,
      indexedThroughBlockHash: observedCheckpointHash.toLowerCase(),
      status: 'COMMITTED',
    },
    checkpoint ?? 'MISSING_CHECKPOINT',
    'Checkpoint must cover the reconciliation head contiguously from the selected deployment start and match the authoritative block hash.',
  ));

  return {
    status: checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
    chainId: input.context.chainId,
    stackVersion: input.context.stackVersion,
    checkedBlock: input.checkedBlock.toString(10),
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