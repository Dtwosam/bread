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
} from "drizzle-orm/pg-core";

const amount = (name: string) => numeric(name, { precision: 78, scale: 0 });

export const protocolStacks = pgTable(
  "protocol_stacks",
  {
    chainId: integer("chain_id").notNull(),
    stackVersion: text("stack_version").notNull(),
    factoryAddress: text("factory_address").notNull(),
    deploymentStartBlock: amount("deployment_start_block").notNull(),
    quoteAsset: text("quote_asset").notNull(),
    quoteDecimals: integer("quote_decimals").notNull(),
    manifestHash: text("manifest_hash"),
    sourceHash: text("source_hash"),
    addresses: jsonb("addresses")
      .$type<Record<string, string | null>>()
      .notNull(),
    adapterState: jsonb("adapter_state").$type<Record<string, unknown>>(),
    runtimeCodeHashes: jsonb("runtime_code_hashes").$type<
      Record<string, string>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.stackVersion, table.factoryAddress],
    }),
  ],
);

export const launches = pgTable(
  "launches",
  {
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    curveAddress: text("curve_address").notNull(),
    stackVersion: text("stack_version").notNull(),
    factoryAddress: text("factory_address").notNull(),
    deployerAddress: text("deployer_address"),
    creatorFeeRecipient: text("creator_fee_recipient"),
    creatorTaxBps: amount("creator_tax_bps"),
    economicsDigest: text("economics_digest"),
    configVersion: amount("config_version"),
    launchTimestamp: amount("launch_timestamp"),
    name: text("name"),
    symbol: text("symbol"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    quoteAsset: text("quote_asset"),
    initialSupply: amount("initial_supply"),
    phantomQuote: amount("phantom_quote"),
    graduationThreshold: amount("graduation_threshold"),
    protocolFeeRecipient: text("protocol_fee_recipient"),
    tradeFeeBps: amount("trade_fee_bps"),
    protocolFeeShareBps: amount("protocol_fee_share_bps"),
    maxCreatorTaxBps: amount("max_creator_tax_bps"),
    graduationCoordinator: text("graduation_coordinator"),
    graduationAdapter: text("graduation_adapter"),
    graduationAdapterFamily: integer("graduation_adapter_family"),
    graduationConfigHash: text("graduation_config_hash"),
    reservedTokensBaseline: amount("reserved_tokens_baseline"),
    launchBlockNumber: amount("launch_block_number").notNull(),
    launchTransactionHash: text("launch_transaction_hash").notNull(),
    launchLogIndex: integer("launch_log_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.tokenAddress] }),
    unique("launches_chain_curve_unique").on(table.chainId, table.curveAddress),
    index("launches_stack_idx").on(
      table.chainId,
      table.stackVersion,
      table.launchBlockNumber,
    ),
  ],
);

export const launchState = pgTable(
  "launch_state",
  {
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    mode: text("mode"),
    quoteReserve: amount("quote_reserve"),
    tokenReserve: amount("token_reserve"),
    remainingSellableTokens: amount("remaining_sellable_tokens"),
    trackedSoldInventory: amount("tracked_sold_inventory"),
    readyToGraduate: boolean("ready_to_graduate"),
    graduationPhase: text("graduation_phase"),
    poolId: text("pool_id"),
    retryState: jsonb("retry_state").$type<Record<string, unknown>>(),
    trackedQuote: amount("tracked_quote"),
    trackedTokens: amount("tracked_tokens"),
    quoteFeeBalance: amount("quote_fee_balance"),
    creatorTaxBalance: amount("creator_tax_balance"),
    realQuoteReserve: amount("real_quote_reserve"),
    virtualQuoteReserve: amount("virtual_quote_reserve"),
    graduationAdapter: text("graduation_adapter"),
    sweptUsdcAmount: amount("swept_usdc_amount"),
    sweptTokenAmount: amount("swept_token_amount"),
    sweptAt: amount("swept_at"),
    graduationFailureReasonHash: text("graduation_failure_reason_hash"),
    graduationReleaseSeedUsdc: amount("graduation_release_seed_usdc"),
    graduationReleaseTokenOut: amount("graduation_release_token_out"),
    positionManager: text("position_manager"),
    positionId: amount("position_id"),
    usdcUsed: amount("usdc_used"),
    tokenUsed: amount("token_used"),
    tokenLocked: amount("token_locked"),
    usdcDust: amount("usdc_dust"),
    positionLocked: boolean("position_locked"),
    tokenSupplyLocked: amount("token_supply_locked"),
    rescueRecipient: text("rescue_recipient"),
    rescueUsdcAmount: amount("rescue_usdc_amount"),
    rescueTokenAmount: amount("rescue_token_amount"),
    graduationCompletedBlock: amount("graduation_completed_block"),
    graduationCompletedLogIndex: integer("graduation_completed_log_index"),
    latestBlockNumber: amount("latest_block_number"),
    latestTransactionHash: text("latest_transaction_hash"),
    latestLogIndex: integer("latest_log_index"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.tokenAddress] })],
);

export const trades = pgTable(
  "trades",
  {
    chainId: integer("chain_id").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    tokenAddress: text("token_address").notNull(),
    curveAddress: text("curve_address").notNull(),
    venueKind: text("venue_kind"),
    venueAddress: text("venue_address"),
    venueFeeTier: integer("venue_fee_tier"),
    side: text("side").notNull(),
    traderAddress: text("trader_address").notNull(),
    recipientAddress: text("recipient_address").notNull(),
    baseAmount: amount("base_amount").notNull(),
    quoteAmount: amount("quote_amount").notNull(),
    feeAmount: amount("fee_amount").notNull(),
    taxAmount: amount("tax_amount").notNull(),
    blockNumber: amount("block_number").notNull(),
    blockTimestamp: amount("block_timestamp"),
    transactionIndex: integer("transaction_index").notNull(),
    stackVersion: text("stack_version").notNull(),
    offeredQuote: amount("offered_quote"),
    openingTaxBps: amount("opening_tax_bps"),
    openingTaxAmount: amount("opening_tax_amount"),
    launchBuyExempt: boolean("launch_buy_exempt"),
    refundAmount: amount("refund_amount"),
    netCurveInput: amount("net_curve_input"),
    netQuoteOut: amount("net_quote_out"),
    grossCurveQuoteOut: amount("gross_curve_quote_out"),
    executionPriceNumerator: amount("execution_price_numerator"),
    executionPriceDenominator: amount("execution_price_denominator"),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.transactionHash, table.logIndex],
    }),
    index("trades_token_order_idx").on(
      table.chainId,
      table.tokenAddress,
      table.blockNumber,
      table.logIndex,
    ),
    index("trades_token_reverse_order_idx").on(
      table.chainId,
      table.tokenAddress,
      table.blockNumber,
      table.transactionIndex,
      table.logIndex,
    ),
    index("trades_token_time_idx").on(
      table.chainId,
      table.tokenAddress,
      table.blockTimestamp,
    ),
  ],
);

export const feeCredits = pgTable(
  "fee_credits",
  {
    chainId: integer("chain_id").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    recipientAddress: text("recipient_address").notNull(),
    creditorAddress: text("creditor_address"),
    amount: amount("amount").notNull(),
    recipientBalance: amount("recipient_balance"),
    totalOutstanding: amount("total_outstanding"),
    blockNumber: amount("block_number").notNull(),
    stackVersion: text("stack_version").notNull(),
    tokenAddress: text("token_address"),
    attributionStatus: text("attribution_status"),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.transactionHash, table.logIndex],
    }),
  ],
);

export const feeClaims = pgTable(
  "fee_claims",
  {
    chainId: integer("chain_id").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    recipientAddress: text("recipient_address").notNull(),
    amount: amount("amount").notNull(),
    remainingBalance: amount("remaining_balance"),
    totalOutstanding: amount("total_outstanding"),
    blockNumber: amount("block_number").notNull(),
    stackVersion: text("stack_version").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.transactionHash, table.logIndex],
    }),
  ],
);

export const creatorRollups = pgTable(
  "creator_rollups",
  {
    chainId: integer("chain_id").notNull(),
    creatorAddress: text("creator_address").notNull(),
    tokenAddress: text("token_address").notNull(),
    accruedFees: amount("accrued_fees").notNull().default("0"),
    claimedFees: amount("claimed_fees").notNull().default("0"),
    tradeCount: amount("trade_count").notNull().default("0"),
    latestBlockNumber: amount("latest_block_number"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.creatorAddress, table.tokenAddress],
    }),
  ],
);

export const holderSnapshots = pgTable(
  "holder_snapshots",
  {
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    holderAddress: text("holder_address").notNull(),
    balance: amount("balance").notNull(),
    isProtocolAddress: boolean("is_protocol_address").notNull().default(false),
    asOfBlockNumber: amount("as_of_block_number").notNull(),
    lastTransactionHash: text("last_transaction_hash"),
    lastLogIndex: integer("last_log_index"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.tokenAddress, table.holderAddress],
    }),
    index("holder_snapshots_token_balance_idx").on(
      table.chainId,
      table.tokenAddress,
      table.balance,
      table.holderAddress,
    ),
    index("holder_snapshots_wallet_idx").on(
      table.chainId,
      table.holderAddress,
      table.tokenAddress,
    ),
  ],
);

export const marketCandles = pgTable(
  "market_candles",
  {
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    intervalSeconds: integer("interval_seconds").notNull(),
    bucketStart: amount("bucket_start").notNull(),
    open: amount("open"),
    high: amount("high"),
    low: amount("low"),
    close: amount("close"),
    openPriceNumerator: amount("open_price_numerator"),
    openPriceDenominator: amount("open_price_denominator"),
    highPriceNumerator: amount("high_price_numerator"),
    highPriceDenominator: amount("high_price_denominator"),
    lowPriceNumerator: amount("low_price_numerator"),
    lowPriceDenominator: amount("low_price_denominator"),
    closePriceNumerator: amount("close_price_numerator"),
    closePriceDenominator: amount("close_price_denominator"),
    baseVolume: amount("base_volume").notNull(),
    quoteVolume: amount("quote_volume").notNull(),
    tradeCount: amount("trade_count").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.chainId,
        table.tokenAddress,
        table.intervalSeconds,
        table.bucketStart,
      ],
    }),
  ],
);

export const tokenMetrics = pgTable(
  "token_metrics",
  {
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    price: amount("price"),
    marketCap: amount("market_cap"),
    holderCount: amount("holder_count"),
    tradeCount: amount("trade_count"),
    quoteVolume: amount("quote_volume"),
    latestBlockNumber: amount("latest_block_number"),
    lastPriceNumerator: amount("last_price_numerator"),
    lastPriceDenominator: amount("last_price_denominator"),
    lastPriceSource: text("last_price_source"),
    quoteVolume5m: amount("quote_volume_5m"),
    quoteVolume1h: amount("quote_volume_1h"),
    quoteVolume24h: amount("quote_volume_24h"),
    tradeCount1h: amount("trade_count_1h"),
    tradeCount24h: amount("trade_count_24h"),
    uniqueTraders1h: amount("unique_traders_1h"),
    uniqueTraders24h: amount("unique_traders_24h"),
    lastActivityTransactionIndex: integer("last_activity_transaction_index"),
    lastActivityLogIndex: integer("last_activity_log_index"),
    graduationProgressBps: amount("graduation_progress_bps"),
    graduationState: text("graduation_state"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.tokenAddress] })],
);

export const indexerCheckpoints = pgTable(
  "indexer_checkpoints",
  {
    chainId: integer("chain_id").notNull(),
    stackVersion: text("stack_version").notNull(),
    factoryAddress: text("factory_address").notNull(),
    deploymentStartBlock: amount("deployment_start_block").notNull(),
    indexedThroughBlock: amount("indexed_through_block").notNull(),
    indexedThroughBlockHash: text("indexed_through_block_hash").notNull(),
    indexedThroughBlockTimestamp: amount("indexed_through_block_timestamp"),
    lastTransactionHash: text("last_transaction_hash"),
    lastLogIndex: integer("last_log_index"),
    decoderSchemaVersion: text("decoder_schema_version")
      .notNull()
      .default("day6-v1"),
    status: text("status").notNull().default("COMMITTED"),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.stackVersion, table.factoryAddress],
    }),
  ],
);

export const adminEvents = pgTable(
  "admin_events",
  {
    chainId: integer("chain_id").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    contractAddress: text("contract_address").notNull(),
    eventName: text("event_name").notNull(),
    actorAddress: text("actor_address"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    blockNumber: amount("block_number").notNull(),
    stackVersion: text("stack_version").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.transactionHash, table.logIndex],
    }),
  ],
);

export const metadata = pgTable(
  "metadata",
  {
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    metadataUri: text("metadata_uri"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    contentHash: text("content_hash"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.tokenAddress] })],
);
