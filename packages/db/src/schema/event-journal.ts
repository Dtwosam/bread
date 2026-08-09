import { index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const eventJournal = pgTable(
  'event_journal',
  {
    chainId: integer('chain_id').notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    blockNumber: numeric('block_number', { precision: 78, scale: 0 }).notNull(),
    blockHash: text('block_hash').notNull(),
    blockTimestamp: numeric('block_timestamp', { precision: 78, scale: 0 }).notNull(),
    transactionIndex: integer('transaction_index').notNull(),
    contractAddress: text('contract_address').notNull(),
    contractRole: text('contract_role').notNull(),
    stackVersion: text('stack_version').notNull(),
    eventName: text('event_name').notNull(),
    topic0: text('topic0').notNull(),
    topics: jsonb('topics').$type<readonly string[]>().notNull(),
    data: text('data').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    insertedAt: timestamp('inserted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    index('event_journal_block_order_idx').on(
      table.chainId,
      table.blockNumber,
      table.transactionIndex,
      table.logIndex,
    ),
    index('event_journal_stack_idx').on(table.chainId, table.stackVersion, table.blockNumber),
  ],
);
