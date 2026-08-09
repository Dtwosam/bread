import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

const amount = (name: string) => numeric(name, { precision: 78, scale: 0 });

export const protocolStacks = pgTable(
  'protocol_stacks',
  {
    chainId: integer('chain_id').notNull(),
    stackVersion: text('stack_version').notNull(),
    factoryAddress: text('factory_address').notNull(),
    deploymentStartBlock: amount('deployment_start_block').notNull(),
    quoteAsset: text('quote_asset').notNull(),
    quoteDecimals: integer('quote_decimals').notNull(),
    manifestHash: text('manifest_hash'),
    sourceHash: text('source_hash'),
    addresses: jsonb('addresses').$type<Record<string, string | null>>().notNull(),
    adapterState: jsonb('adapter_state').$type<Record<string, unknown>>(),
    runtimeCodeHashes: jsonb('runtime_code_hashes').$type<Record<string, string>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.stackVersion, table.factoryAddress] })],
);

export const launches = pgTable(
  'launches',
  {
    chainId: integer('chain_id').notNull(),
    tokenAddress: text('token_address').notNull(),
    curveAddress: text('curve_address').notNull(),
    stackVersion: text('stack_version').notNull(),
    factoryAddress: text('factory_address').notNull(),
    deployerAddress: text('deployer_address'),
    creatorFeeRecipient: text('creator_fee_recipient'),
    creatorTaxBps: amount('creator_tax_bps'),
    economicsDigest: text('economics_digest'),
    configVersion: amount('config_version'),
    name: text('name'),
    symbol: text('symbol'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    launchBlockNumber: amount('launch_block_number').notNull(),
    launchTransactionHash: text('launch_transaction_hash').notNull(),
    launchLogIndex: integer('launch_log_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.tokenAddress] }),
    unique('launches_chain_curve_unique').on(table.chainId, table.curveAddress),
    index('launches_stack_idx').on(table.chainId, table.stackVersion, table.launchBlockNumber),
  ],
);

export const launchState = pgTable(
  'launch_state',
  {
    chainId: integer('chain_id').notNull(),
    tokenAddress: text('token_address').notNull(),
    mode: text('mode'),
    quoteReserve: amount('quote_reserve'),
    tokenReserve: amount('token_reserve'),
    remainingSellableTokens: amount('remaining_sellable_tokens'),
    trackedSoldInventory: amount('tracked_sold_inventory'),
    readyToGraduate: boolean('ready_to_graduate'),
    graduationPhase: text('graduation_phase'),
    poolId: text('pool_id'),
    retryState: jsonb('retry_state').$type<Record<string, unknown>>(),
    latestBlockNumber: amount('latest_block_number'),
    latestTransactionHash: text('latest_transaction_hash'),
    latestLogIndex: integer('latest_log_index'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.tokenAddress] })],
);

export const trades = pgTable(
  'trades',
  {
    chainId: integer('chain_id').notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    tokenAddress: text('token_address').notNull(),
    curveAddress: text('curve_address').notNull(),
    side: text('side').notNull(),
    traderAddress: text('trader_address').notNull(),
    recipientAddress: text('recipient_address').notNull(),
    baseAmount: amount('base_amount').notNull(),
    quoteAmount: amount('quote_amount').notNull(),
    feeAmount: amount('fee_amount').notNull(),
    taxAmount: amount('tax_amount').notNull(),
    blockNumber: amount('block_number').notNull(),
    transactionIndex: integer('transaction_index').notNull(),
    stackVersion: text('stack_version').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    index('trades_token_order_idx').on(table.chainId, table.tokenAddress, table.blockNumber, table.logIndex),
  ],
);

export const feeCredits = pgTable(
  'fee_credits',
  {
    chainId: integer('chain_id').notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    recipientAddress: text('recipient_address').notNull(),
    creditorAddress: text('creditor_address'),
    amount: amount('amount').notNull(),
    recipientBalance: amount('recipient_balance'),
    totalOutstanding: amount('total_outstanding'),
    blockNumber: amount('block_number').notNull(),
    stackVersion: text('stack_version').notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] })],
);

export const feeClaims = pgTable(
  'fee_claims',
  {
    chainId: integer('chain_id').notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    recipientAddress: text('recipient_address').notNull(),
    amount: amount('amount').notNull(),
    remainingBalance: amount('remaining_balance'),
    totalOutstanding: amount('total_outstanding'),
    blockNumber: amount('block_number').notNull(),
    stackVersion: text('stack_version').notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] })],
);

export const creatorRollups = pgTable(
  'creator_rollups',
  {
    chainId: integer('chain_id').notNull(),
    creatorAddress: text('creator_address').notNull(),
    tokenAddress: text('token_address').notNull(),
    accruedFees: amount('accrued_fees').notNull().default('0'),
    claimedFees: amount('claimed_fees').notNull().default('0'),
    tradeCount: amount('trade_count').notNull().default('0'),
    latestBlockNumber: amount('latest_block_number'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.creatorAddress, table.tokenAddress] })],
);

export const holderSnapshots = pgTable(
  'holder_snapshots',
  {
    chainId: integer('chain_id').notNull(),
    tokenAddress: text('token_address').notNull(),
    holderAddress: text('holder_address').notNull(),
    balance: amount('balance').notNull(),
    isProtocolAddress: boolean('is_protocol_address').notNull().default(false),
    asOfBlockNumber: amount('as_of_block_number').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.tokenAddress, table.holderAddress] })],
);

export const marketCandles = pgTable(
  'market_candles',
  {
    chainId: integer('chain_id').notNull(),
    tokenAddress: text('token_address').notNull(),
    intervalSeconds: integer('interval_seconds').notNull(),
    bucketStart: amount('bucket_start').notNull(),
    open: amount('open').notNull(),
    high: amount('high').notNull(),
    low: amount('low').notNull(),
    close: amount('close').notNull(),
    baseVolume: amount('base_volume').notNull(),
    quoteVolume: amount('quote_volume').notNull(),
    tradeCount: amount('trade_count').notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.tokenAddress, table.intervalSeconds, table.bucketStart] })],
);

export const tokenMetrics = pgTable(
  'token_metrics',
  {
    chainId: integer('chain_id').notNull(),
    tokenAddress: text('token_address').notNull(),
    price: amount('price'),
    marketCap: amount('market_cap'),
    holderCount: amount('holder_count'),
    tradeCount: amount('trade_count'),
    quoteVolume: amount('quote_volume'),
    latestBlockNumber: amount('latest_block_number'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.tokenAddress] })],
);

export const indexerCheckpoints = pgTable(
  'indexer_checkpoints',
  {
    chainId: integer('chain_id').notNull(),
    stackVersion: text('stack_version').notNull(),
    factoryAddress: text('factory_address').notNull(),
    deploymentStartBlock: amount('deployment_start_block').notNull(),
    indexedThroughBlock: amount('indexed_through_block').notNull(),
    indexedThroughBlockHash: text('indexed_through_block_hash').notNull(),
    indexedThroughBlockTimestamp: amount('indexed_through_block_timestamp'),
    lastTransactionHash: text('last_transaction_hash'),
    lastLogIndex: integer('last_log_index'),
    decoderSchemaVersion: text('decoder_schema_version').notNull().default('day6-v1'),
    status: text('status').notNull().default('COMMITTED'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.stackVersion, table.factoryAddress] })],
);

export const adminEvents = pgTable(
  'admin_events',
  {
    chainId: integer('chain_id').notNull(),
    transactionHash: text('transaction_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    contractAddress: text('contract_address').notNull(),
    eventName: text('event_name').notNull(),
    actorAddress: text('actor_address'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    blockNumber: amount('block_number').notNull(),
    stackVersion: text('stack_version').notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] })],
);

export const metadata = pgTable(
  'metadata',
  {
    chainId: integer('chain_id').notNull(),
    tokenAddress: text('token_address').notNull(),
    metadataUri: text('metadata_uri'),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>(),
    contentHash: text('content_hash'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.tokenAddress] })],
);
