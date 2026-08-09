import {
  applyCanonicalTradeProjection,
  applyFeeAdminGraduationProjection,
  applyHolderTransferProjection,
  launches,
  projectCreatorTradeCount,
  projectCurveGraduationProgress,
  type BreadDb,
  type HolderProjectionContext,
  type IndexerProtocolContext,
  type ProjectionReducer,
} from '../../../packages/db/src/index.js';

import type { ProtocolContext } from '../../../packages/protocol-sdk/src/index.js';
import type { LaunchSnapshot } from './normalize.js';
import type { NormalizedTrade } from './trades.js';

type ReducerEventIdentity = Readonly<{
  identity: Readonly<{ chainId: number; transactionHash: string; logIndex: number }>;
}>;

function eventKey(event: ReducerEventIdentity): string {
  return `${event.identity.chainId}:${event.identity.transactionHash.toLowerCase()}:${event.identity.logIndex}`;
}

export function createLaunchReducer(snapshots: ReadonlyMap<string, LaunchSnapshot>): ProjectionReducer {
  return async (transaction, event) => {
    if (event.eventName !== 'LaunchCreated') return;
    const snapshot = snapshots.get(eventKey(event));
    if (!snapshot) throw new Error(`missing normalized launch snapshot for ${eventKey(event)}`);

    const tx = transaction as {
      insert: (table: unknown) => {
        values: (value: Readonly<Record<string, unknown>>) => Promise<unknown>;
      };
    };

    await tx.insert(launches).values({
      chainId: snapshot.chainId,
      tokenAddress: snapshot.tokenAddress,
      curveAddress: snapshot.curveAddress,
      stackVersion: snapshot.stackVersion,
      factoryAddress: snapshot.factoryAddress,
      deployerAddress: snapshot.deployerAddress,
      creatorFeeRecipient: snapshot.creatorFeeRecipient,
      creatorTaxBps: snapshot.creatorTaxBps.toString(10),
      economicsDigest: snapshot.economicsDigest,
      configVersion: snapshot.configVersion.toString(10),
      launchTimestamp: snapshot.launchTimestamp.toString(10),
      name: snapshot.name,
      symbol: snapshot.symbol,
      metadata: snapshot.metadata,
      quoteAsset: snapshot.quoteAsset,
      initialSupply: snapshot.initialSupply.toString(10),
      phantomQuote: snapshot.phantomQuote.toString(10),
      graduationThreshold: snapshot.graduationThreshold.toString(10),
      protocolFeeRecipient: snapshot.protocolFeeRecipient,
      tradeFeeBps: snapshot.tradeFeeBps.toString(10),
      protocolFeeShareBps: snapshot.protocolFeeShareBps.toString(10),
      maxCreatorTaxBps: snapshot.maxCreatorTaxBps.toString(10),
      graduationCoordinator: snapshot.graduationCoordinator,
      graduationAdapter: snapshot.graduationAdapter,
      graduationAdapterFamily: snapshot.graduationAdapterFamily,
      graduationConfigHash: snapshot.graduationConfigHash,
      reservedTokensBaseline: snapshot.reservedTokensBaseline.toString(10),
      launchBlockNumber: snapshot.launchBlockNumber.toString(10),
      launchTransactionHash: snapshot.launchTransactionHash,
      launchLogIndex: snapshot.launchLogIndex,
    });
  };
}

export function createTradeReducer(normalizedTrades: readonly NormalizedTrade[]): ProjectionReducer {
  const byEvent = new Map(normalizedTrades.map((trade) => [
    `${trade.id.chainId}:${trade.id.transactionHash.toLowerCase()}:${trade.id.logIndex}`,
    trade,
  ]));

  return async (transaction, event) => {
    if (event.eventName !== 'CurveBuy' && event.eventName !== 'CurveSell') return;
    const trade = byEvent.get(eventKey(event));
    if (!trade) throw new Error(`missing normalized trade for ${eventKey(event)}`);

    await applyCanonicalTradeProjection(transaction as BreadDb, {
      ...trade,
      stackVersion: event.stackVersion,
    });
  };
}

export function createFeeAdminGraduationReducer(input: Readonly<{ context: ProtocolContext }>): ProjectionReducer {
  const projectionContext: IndexerProtocolContext = {
    chainId: input.context.chainId,
    stackVersion: input.context.stackVersion,
    factoryAddress: input.context.factoryAddress,
    quoteAsset: input.context.quoteAsset,
    quoteDecimals: input.context.quoteDecimals,
    deploymentStartBlock: input.context.deploymentStartBlock,
    addresses: input.context.addresses,
  };
  return async (transaction, event) => {
    const db = transaction as BreadDb;
    await applyFeeAdminGraduationProjection(db, event, projectionContext);
    await projectCurveGraduationProgress(db, event);
    await projectCreatorTradeCount(db, event);
  };
}

export function createHolderReducer(input: Readonly<{
  context: ProtocolContext;
  launchProtocolAddresses?: ReadonlyMap<string, readonly string[]>;
}>): ProjectionReducer {
  const baseProtocolAddresses = [
    input.context.factoryAddress,
    ...Object.values(input.context.addresses).filter((value): value is AddressLike => typeof value === 'string'),
  ];
  const projectionContext: HolderProjectionContext = {
    chainId: input.context.chainId,
    baseProtocolAddresses,
    launchProtocolAddresses: input.launchProtocolAddresses,
  };
  return async (transaction, event) => {
    await applyHolderTransferProjection(transaction as BreadDb, event, projectionContext);
  };
}

type AddressLike = `0x${string}`;
