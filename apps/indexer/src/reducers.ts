import type { ProjectionReducer } from '../../../packages/db/src/index.js';
import { launches } from '../../../packages/db/src/index.js';
import type { DecodedBreadEvent } from '../../../packages/types/src/index.js';

import type { LaunchSnapshot } from './normalize.js';

function eventKey(event: DecodedBreadEvent): string {
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
