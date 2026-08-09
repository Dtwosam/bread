import type { FastifyInstance } from 'fastify';

import { canonicalizeProtocolAddress } from '../../../../packages/protocol-sdk/src/index.js';

import type { BreadReadRouteDeps } from './types.js';

type LaunchRow = Awaited<ReturnType<BreadReadRouteDeps['repository']['getLaunch']>>;

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

export function registerTokenRoute(app: FastifyInstance, deps: BreadReadRouteDeps): void {
  app.get('/v1/tokens/:address', async (request, reply) => {
    const params = request.params as { address?: string };
    let tokenAddress: string;
    try {
      tokenAddress = canonicalizeProtocolAddress(params.address ?? '');
    } catch {
      return reply.code(400).send({
        error: { code: 'INVALID_ADDRESS', message: 'Token address is malformed.', requestId: request.id },
      });
    }

    const launch = await deps.repository.getLaunch(deps.context.chainId, tokenAddress);
    if (!launch) {
      return reply.code(404).send({
        error: { code: 'TOKEN_NOT_FOUND', message: 'Token is not indexed by Bread.', requestId: request.id },
      });
    }

    const meta = await deps.freshness();
    return { data: serializeLaunch(launch), meta };
  });
}
