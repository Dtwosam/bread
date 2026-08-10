import type { FastifyInstance } from 'fastify';

import { canonicalizeProtocolAddress } from '../../../../packages/protocol-sdk/src/index.js';

import { markNoStore, markPublicProjectionCacheable } from '../http-cache.js';
import type { BreadReadRouteDeps } from './types.js';

type LaunchRow = Awaited<ReturnType<BreadReadRouteDeps['repository']['getLaunch']>>;
type LaunchStateRow = Awaited<ReturnType<BreadReadRouteDeps['repository']['getLaunchState']>>;
type TokenMetricRow = Awaited<ReturnType<BreadReadRouteDeps['repository']['getTokenMetrics']>>;

export function serializeLaunch(row: NonNullable<LaunchRow>) {
  return {
    tokenAddress: row.tokenAddress,
    curveAddress: row.curveAddress,
    stackVersion: row.stackVersion,
    factoryAddress: row.factoryAddress,
    deployerAddress: row.deployerAddress,
    creatorFeeRecipient: row.creatorFeeRecipient,
    creatorTaxBps: row.creatorTaxBps?.toString(10) ?? null,
    economicsDigest: row.economicsDigest,
    configVersion: row.configVersion?.toString(10) ?? null,
    launchTimestamp: row.launchTimestamp?.toString(10) ?? null,
    name: row.name,
    symbol: row.symbol,
    metadata: row.metadata,
    quoteAsset: row.quoteAsset,
    initialSupply: row.initialSupply?.toString(10) ?? null,
    phantomQuote: row.phantomQuote?.toString(10) ?? null,
    graduationThreshold: row.graduationThreshold?.toString(10) ?? null,
    protocolFeeRecipient: row.protocolFeeRecipient,
    tradeFeeBps: row.tradeFeeBps?.toString(10) ?? null,
    protocolFeeShareBps: row.protocolFeeShareBps?.toString(10) ?? null,
    maxCreatorTaxBps: row.maxCreatorTaxBps?.toString(10) ?? null,
    graduationCoordinator: row.graduationCoordinator,
    graduationAdapter: row.graduationAdapter,
    graduationAdapterFamily: row.graduationAdapterFamily,
    graduationConfigHash: row.graduationConfigHash,
    reservedTokensBaseline: row.reservedTokensBaseline?.toString(10) ?? null,
    launchBlockNumber: row.launchBlockNumber.toString(10),
    launchTransactionHash: row.launchTransactionHash,
    launchLogIndex: row.launchLogIndex,
  } as const;
}

export function serializeTradeMetrics(row: NonNullable<TokenMetricRow> | undefined) {
  if (!row || row.lastPriceNumerator === null || row.lastPriceDenominator === null || row.lastPriceSource === null) {
    return null;
  }
  return {
    lastPrice: {
      numerator: row.lastPriceNumerator.toString(10),
      denominator: row.lastPriceDenominator.toString(10),
      source: row.lastPriceSource,
    },
    quoteVolume: {
      m5: row.quoteVolume5m?.toString(10) ?? null,
      h1: row.quoteVolume1h?.toString(10) ?? null,
      h24: row.quoteVolume24h?.toString(10) ?? null,
    },
    tradeCount: {
      h1: row.tradeCount1h?.toString(10) ?? null,
      h24: row.tradeCount24h?.toString(10) ?? null,
    },
    uniqueTraders: {
      h1: row.uniqueTraders1h?.toString(10) ?? null,
      h24: row.uniqueTraders24h?.toString(10) ?? null,
    },
  } as const;
}

export function serializeGraduationProgress(
  row:
    | Readonly<{
        graduationProgressBps: bigint | null;
        graduationState: string | null;
      }>
    | null
    | undefined,
) {
  if (!row) return null;
  return {
    progressBps: row.graduationProgressBps?.toString(10) ?? null,
    state: row.graduationState ?? null,
  } as const;
}

export function serializeCurveState(row: NonNullable<LaunchStateRow> | undefined) {
  if (!row) return null;
  return {
    mode: row.mode,
    trackedQuote: row.trackedQuote?.toString(10) ?? null,
    trackedTokens: row.trackedTokens?.toString(10) ?? null,
    quoteFeeBalance: row.quoteFeeBalance?.toString(10) ?? null,
    creatorTaxBalance: row.creatorTaxBalance?.toString(10) ?? null,
    realQuoteReserve: row.realQuoteReserve?.toString(10) ?? null,
    virtualQuoteReserve: row.virtualQuoteReserve?.toString(10) ?? null,
    remainingSellableTokens: row.remainingSellableTokens?.toString(10) ?? null,
    trackedSoldInventory: row.trackedSoldInventory?.toString(10) ?? null,
    readyToGraduate: row.readyToGraduate,
    graduationPhase: row.graduationPhase,
    poolId: row.poolId,
    graduationAdapter: row.graduationAdapter,
    sweptUsdcAmount: row.sweptUsdcAmount?.toString() ?? null,
    sweptTokenAmount: row.sweptTokenAmount?.toString() ?? null,
    graduationFailureReasonHash: row.graduationFailureReasonHash,
    positionManager: row.positionManager,
    positionId: row.positionId?.toString() ?? null,
    usdcUsed: row.usdcUsed?.toString() ?? null,
    tokenUsed: row.tokenUsed?.toString() ?? null,
    tokenLocked: row.tokenLocked?.toString() ?? null,
    usdcDust: row.usdcDust?.toString() ?? null,
    positionLocked: row.positionLocked,
    tokenSupplyLocked: row.tokenSupplyLocked?.toString() ?? null,
    graduationCompletedBlock: row.graduationCompletedBlock?.toString() ?? null,
    graduationCompletedLogIndex: row.graduationCompletedLogIndex,
    latestBlockNumber: row.latestBlockNumber?.toString(10) ?? null,
    latestTransactionHash: row.latestTransactionHash,
    latestLogIndex: row.latestLogIndex,
  } as const;
}

export function registerTokenRoute(app: FastifyInstance, deps: BreadReadRouteDeps): void {
  app.get('/v1/tokens/:address', async (request, reply) => {
    markNoStore(reply);
    const params = request.params as { address?: string };
    let tokenAddress: string;
    try {
      tokenAddress = canonicalizeProtocolAddress(params.address ?? '');
    } catch {
      return reply.code(400).send({
        error: { code: 'INVALID_ADDRESS', message: 'Token address is malformed.', requestId: request.id },
      });
    }

    const load = async () => {
      const launch = await deps.repository.getLaunch(deps.context.chainId, tokenAddress);
      if (!launch) return { found: false as const };

      const [state, metrics] = await Promise.all([
        deps.repository.getLaunchState(deps.context.chainId, tokenAddress),
        deps.repository.getTokenMetrics(deps.context.chainId, tokenAddress),
      ]);
      const meta = await deps.freshness();
      return {
        found: true as const,
        data: {
          ...serializeLaunch(launch),
          curveState: serializeCurveState(state),
          metrics: serializeTradeMetrics(metrics),
          progress: serializeGraduationProgress(metrics),
        },
        meta,
      };
    };

    const cacheResult = deps.cache
      ? await deps.cache.getOrLoad({
          channel: `token:${deps.context.chainId}:${tokenAddress}`,
          key: 'detail',
          load,
        })
      : { value: await load(), cache: 'BYPASS' as const };

    if (!cacheResult.value.found) {
      return reply.code(404).send({
        error: { code: 'TOKEN_NOT_FOUND', message: 'Token is not indexed by Bread.', requestId: request.id },
      });
    }

    const now = (deps.now ?? (() => new Date()))();
    markPublicProjectionCacheable(reply);
    return {
      data: cacheResult.value.data,
      meta: {
        ...cacheResult.value.meta,
        servedAt: now.toISOString(),
        cache: cacheResult.cache,
      },
    };
  });
}
