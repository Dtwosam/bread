import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import { eventJournal } from '../schema/event-journal.js';
import { indexerCheckpoints, protocolStacks } from '../schema/projections.js';

export type CanonicalEventIdentity = Readonly<{
  chainId: number;
  transactionHash: string;
  logIndex: number;
}>;

export type CanonicalIndexedEvent = Readonly<{
  identity: CanonicalEventIdentity;
  blockNumber: bigint;
  blockHash: string;
  blockTimestamp: bigint;
  transactionIndex: number;
  contractAddress: string;
  contractRole: string;
  stackVersion: string;
  topic0: string;
  topics: readonly string[];
  data: string;
  eventName: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type IndexerProtocolContext = Readonly<{
  chainId: number;
  stackVersion: string;
  factoryAddress: string;
  quoteAsset: string;
  quoteDecimals: number;
  deploymentStartBlock: bigint;
  addresses: Readonly<Record<string, string | undefined>>;
}>;

export type ProjectionReducer = (
  transaction: unknown,
  event: CanonicalIndexedEvent,
) => Promise<void>;

export type ApplyCanonicalRangeInput = Readonly<{
  context: IndexerProtocolContext;
  fromBlock: bigint;
  toBlock: bigint;
  toBlockHash: string;
  events: readonly CanonicalIndexedEvent[];
}>;

export type ApplyCanonicalRangeResult = Readonly<{
  insertedEventIds: readonly string[];
  checkpointBlock: bigint;
}>;

type CheckpointRow = Readonly<{
  indexed_through_block: string;
  indexed_through_block_hash: string;
}>;

function eventId(identity: CanonicalEventIdentity): string {
  return `${identity.chainId}:${identity.transactionHash.toLowerCase()}:${identity.logIndex}`;
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString(10);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function validateRange(input: ApplyCanonicalRangeInput): void {
  if (input.toBlock < input.fromBlock) throw new Error('canonical range end precedes start');
  if (input.context.deploymentStartBlock < 0n) throw new Error('deploymentStartBlock must not be negative');
  for (const event of input.events) {
    if (event.identity.chainId !== input.context.chainId) throw new Error('event chainId does not match context');
    if (event.stackVersion !== input.context.stackVersion) throw new Error('event stackVersion does not match context');
    if (event.blockNumber < input.fromBlock || event.blockNumber > input.toBlock) {
      throw new Error('event block is outside canonical range');
    }
  }
}

export class IndexerRepository {
  constructor(
    private readonly db: BreadDb,
    private readonly reducers: readonly ProjectionReducer[] = [],
  ) {}

  async applyCanonicalRange(input: ApplyCanonicalRangeInput): Promise<ApplyCanonicalRangeResult> {
    validateRange(input);

    return this.db.transaction(async (tx) => {
      const lockKey = `bread-indexer:${input.context.chainId}:${input.context.stackVersion}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const checkpointResult = (await tx.execute(sql`
        SELECT indexed_through_block, indexed_through_block_hash
        FROM indexer_checkpoints
        WHERE chain_id = ${input.context.chainId}
          AND stack_version = ${input.context.stackVersion}
        FOR UPDATE
      `)) as unknown as { rows: CheckpointRow[] };
      const checkpoint = checkpointResult.rows[0];
      const currentBlock = checkpoint ? BigInt(checkpoint.indexed_through_block) : undefined;

      if (currentBlock === undefined) {
        if (input.fromBlock !== input.context.deploymentStartBlock) {
          throw new Error(
            `first canonical range must start at deploymentStartBlock ${input.context.deploymentStartBlock}`,
          );
        }
      } else {
        if (input.fromBlock > currentBlock + 1n) {
          throw new Error(`non-contiguous canonical range gap after checkpoint ${currentBlock}`);
        }
        if (
          input.toBlock === currentBlock &&
          checkpoint &&
          checkpoint.indexed_through_block_hash.toLowerCase() !== input.toBlockHash.toLowerCase()
        ) {
          throw new Error(`checkpoint hash contradiction at block ${currentBlock}`);
        }
      }

      await tx
        .insert(protocolStacks)
        .values({
          chainId: input.context.chainId,
          stackVersion: input.context.stackVersion,
          factoryAddress: input.context.factoryAddress,
          deploymentStartBlock: input.context.deploymentStartBlock.toString(10),
          quoteAsset: input.context.quoteAsset,
          quoteDecimals: input.context.quoteDecimals,
          addresses: jsonSafe(input.context.addresses) as Record<string, string | null>,
        })
        .onConflictDoNothing();

      const insertedEventIds: string[] = [];
      for (const event of input.events) {
        const inserted = await tx
          .insert(eventJournal)
          .values({
            chainId: event.identity.chainId,
            transactionHash: event.identity.transactionHash.toLowerCase(),
            logIndex: event.identity.logIndex,
            blockNumber: event.blockNumber.toString(10),
            blockHash: event.blockHash.toLowerCase(),
            blockTimestamp: event.blockTimestamp.toString(10),
            transactionIndex: event.transactionIndex,
            contractAddress: event.contractAddress.toLowerCase(),
            contractRole: event.contractRole,
            stackVersion: event.stackVersion,
            eventName: event.eventName,
            topic0: event.topic0.toLowerCase(),
            topics: event.topics.map((topic) => topic.toLowerCase()),
            data: event.data,
            payload: jsonSafe(event.payload) as Record<string, unknown>,
          })
          .onConflictDoNothing()
          .returning({
            chainId: eventJournal.chainId,
            transactionHash: eventJournal.transactionHash,
            logIndex: eventJournal.logIndex,
          });

        if (inserted.length === 0) continue;
        insertedEventIds.push(eventId(event.identity));
        for (const reducer of this.reducers) await reducer(tx, event);
      }

      let checkpointBlock = currentBlock ?? input.context.deploymentStartBlock - 1n;
      if (currentBlock === undefined || input.toBlock > currentBlock) {
        await tx
          .insert(indexerCheckpoints)
          .values({
            chainId: input.context.chainId,
            stackVersion: input.context.stackVersion,
            indexedThroughBlock: input.toBlock.toString(10),
            indexedThroughBlockHash: input.toBlockHash.toLowerCase(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [indexerCheckpoints.chainId, indexerCheckpoints.stackVersion],
            set: {
              indexedThroughBlock: input.toBlock.toString(10),
              indexedThroughBlockHash: input.toBlockHash.toLowerCase(),
              updatedAt: new Date(),
            },
          });
        checkpointBlock = input.toBlock;
      }

      return { insertedEventIds, checkpointBlock };
    });
  }
}
