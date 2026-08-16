import { sql } from "drizzle-orm";

import type { BreadDb } from "../client.js";

type CommonTradeProjection = Readonly<{
  id: Readonly<{ chainId: number; transactionHash: string; logIndex: number }>;
  stackVersion: string;
  side: "BUY" | "SELL";
  token: string;
  curve: string;
  actor: string;
  recipient: string;
  quoteAmount: bigint;
  tokenAmount: bigint;
  baseFee: bigint;
  creatorTax: bigint;
  openingTaxBps: bigint;
  openingTax: bigint;
  executionPriceNumerator: bigint;
  executionPriceDenominator: bigint;
  blockNumber: bigint;
  blockTimestamp: bigint;
  transactionIndex: number;
}>;

type CurveTradeProjection = CommonTradeProjection &
  Readonly<{
    venueKind?: "BREAD_CURVE";
    venueAddress?: string;
    venueFeeTier?: null;
    offeredQuote: bigint;
    launchBuyExempt: boolean;
    refund: bigint;
    netCurveInput: bigint;
    netQuoteOut: bigint;
    grossCurveQuoteOut: bigint;
  }>;

type V3TradeProjection = CommonTradeProjection &
  Readonly<{
    venueKind: "UNISWAP_V3";
    venueAddress: string;
    venueFeeTier: number;
    offeredQuote: null;
    launchBuyExempt: null;
    refund: null;
    netCurveInput: null;
    netQuoteOut: null;
    grossCurveQuoteOut: null;
  }>;

export type CanonicalTradeProjection = CurveTradeProjection | V3TradeProjection;

type LaunchRow = Readonly<{
  initial_supply: string | null;
  reserved_tokens_baseline: string | null;
  phantom_quote: string | null;
}>;

type StateRow = Readonly<{
  tracked_quote: string | null;
  tracked_tokens: string | null;
  quote_fee_balance: string | null;
  creator_tax_balance: string | null;
}>;

type AggregateRow = Readonly<{
  total_trade_count: string;
  total_quote_volume: string;
  quote_volume_5m: string;
  quote_volume_1h: string;
  quote_volume_24h: string;
  trade_count_1h: string;
  trade_count_24h: string;
  unique_traders_1h: string;
  unique_traders_24h: string;
}>;

type TradeExecutionSource = "CURVE_EXECUTION" | "V3_SWAP_EXECUTION";

function rows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

function exact(value: string | null, label: string): bigint {
  if (value === null || !/^\d+$/.test(value))
    throw new Error(`${label} is unavailable or invalid`);
  return BigInt(value);
}

function decimal(value: bigint): string {
  if (value < 0n) throw new Error("negative read-model integer");
  return value.toString(10);
}

function decimalNullable(value: bigint | null): string | null {
  return value === null ? null : decimal(value);
}

function bucketStart(timestamp: bigint, intervalSeconds: bigint): bigint {
  return (timestamp / intervalSeconds) * intervalSeconds;
}

function isCurveTrade(
  trade: CanonicalTradeProjection,
): trade is CurveTradeProjection {
  return trade.venueKind !== "UNISWAP_V3";
}

async function projectCurveState(
  db: BreadDb,
  trade: CurveTradeProjection,
): Promise<void> {
  const launchResult = await db.execute(sql`
    SELECT initial_supply, reserved_tokens_baseline, phantom_quote
    FROM launches
    WHERE chain_id = ${trade.id.chainId}
      AND token_address = ${trade.token.toLowerCase()}
    LIMIT 1
  `);
  const launch = rows<LaunchRow>(launchResult)[0];
  if (!launch)
    throw new Error(`trade launch snapshot missing for ${trade.token}`);

  const initialSupply = exact(launch.initial_supply, "launch initial supply");
  const reservedTokens = exact(
    launch.reserved_tokens_baseline,
    "launch reserved tokens",
  );
  const phantomQuote = exact(launch.phantom_quote, "launch phantom quote");

  const stateResult = await db.execute(sql`
    SELECT tracked_quote, tracked_tokens, quote_fee_balance, creator_tax_balance
    FROM launch_state
    WHERE chain_id = ${trade.id.chainId}
      AND token_address = ${trade.token.toLowerCase()}
    FOR UPDATE
  `);
  const state = rows<StateRow>(stateResult)[0];

  let trackedQuote = state ? exact(state.tracked_quote, "tracked quote") : 0n;
  let trackedTokens = state
    ? exact(state.tracked_tokens, "tracked tokens")
    : initialSupply;
  let quoteFeeBalance = state
    ? exact(state.quote_fee_balance, "quote fee balance")
    : 0n;
  let creatorTaxBalance = state
    ? exact(state.creator_tax_balance, "creator tax balance")
    : 0n;

  if (trade.side === "BUY") {
    if (trackedTokens < trade.tokenAmount)
      throw new Error("BUY projection underflows tracked tokens");
    trackedQuote += trade.quoteAmount;
    trackedTokens -= trade.tokenAmount;
    quoteFeeBalance += trade.baseFee + trade.openingTax;
    creatorTaxBalance += trade.creatorTax;
  } else {
    if (trackedQuote < trade.netQuoteOut)
      throw new Error("SELL projection underflows tracked quote");
    trackedQuote -= trade.netQuoteOut;
    trackedTokens += trade.tokenAmount;
    quoteFeeBalance += trade.baseFee;
    creatorTaxBalance += trade.creatorTax;
  }

  const pendingFees = quoteFeeBalance + creatorTaxBalance;
  if (trackedQuote < pendingFees)
    throw new Error("projected fee balances exceed tracked quote");
  const realQuoteReserve = trackedQuote - pendingFees;
  const virtualQuoteReserve = phantomQuote + realQuoteReserve;
  const remainingSellable =
    trackedTokens > reservedTokens ? trackedTokens - reservedTokens : 0n;
  if (trackedTokens > initialSupply)
    throw new Error("projected tracked tokens exceed initial supply");
  const soldInventory = initialSupply - trackedTokens;

  await db.execute(sql`
    INSERT INTO launch_state (
      chain_id, token_address, mode, quote_reserve, token_reserve,
      remaining_sellable_tokens, tracked_sold_inventory, ready_to_graduate,
      tracked_quote, tracked_tokens, quote_fee_balance, creator_tax_balance,
      real_quote_reserve, virtual_quote_reserve,
      latest_block_number, latest_transaction_hash, latest_log_index, updated_at
    ) VALUES (
      ${trade.id.chainId}, ${trade.token.toLowerCase()}, 'ACTIVE',
      ${decimal(virtualQuoteReserve)}, ${decimal(trackedTokens)},
      ${decimal(remainingSellable)}, ${decimal(soldInventory)}, ${remainingSellable === 0n},
      ${decimal(trackedQuote)}, ${decimal(trackedTokens)}, ${decimal(quoteFeeBalance)}, ${decimal(creatorTaxBalance)},
      ${decimal(realQuoteReserve)}, ${decimal(virtualQuoteReserve)},
      ${decimal(trade.blockNumber)}, ${trade.id.transactionHash.toLowerCase()}, ${trade.id.logIndex}, now()
    )
    ON CONFLICT (chain_id, token_address) DO UPDATE SET
      mode = EXCLUDED.mode,
      quote_reserve = EXCLUDED.quote_reserve,
      token_reserve = EXCLUDED.token_reserve,
      remaining_sellable_tokens = EXCLUDED.remaining_sellable_tokens,
      tracked_sold_inventory = EXCLUDED.tracked_sold_inventory,
      ready_to_graduate = EXCLUDED.ready_to_graduate,
      tracked_quote = EXCLUDED.tracked_quote,
      tracked_tokens = EXCLUDED.tracked_tokens,
      quote_fee_balance = EXCLUDED.quote_fee_balance,
      creator_tax_balance = EXCLUDED.creator_tax_balance,
      real_quote_reserve = EXCLUDED.real_quote_reserve,
      virtual_quote_reserve = EXCLUDED.virtual_quote_reserve,
      latest_block_number = EXCLUDED.latest_block_number,
      latest_transaction_hash = EXCLUDED.latest_transaction_hash,
      latest_log_index = EXCLUDED.latest_log_index,
      updated_at = EXCLUDED.updated_at
  `);
}

async function projectCandles(
  db: BreadDb,
  trade: CanonicalTradeProjection,
): Promise<void> {
  for (const interval of [60n, 300n, 3600n] as const) {
    const bucket = bucketStart(trade.blockTimestamp, interval);
    await db.execute(sql`
      INSERT INTO market_candles (
        chain_id, token_address, interval_seconds, bucket_start,
        open, high, low, close,
        open_price_numerator, open_price_denominator,
        high_price_numerator, high_price_denominator,
        low_price_numerator, low_price_denominator,
        close_price_numerator, close_price_denominator,
        base_volume, quote_volume, trade_count
      ) VALUES (
        ${trade.id.chainId}, ${trade.token.toLowerCase()}, ${Number(interval)}, ${decimal(bucket)},
        NULL, NULL, NULL, NULL,
        ${decimal(trade.executionPriceNumerator)}, ${decimal(trade.executionPriceDenominator)},
        ${decimal(trade.executionPriceNumerator)}, ${decimal(trade.executionPriceDenominator)},
        ${decimal(trade.executionPriceNumerator)}, ${decimal(trade.executionPriceDenominator)},
        ${decimal(trade.executionPriceNumerator)}, ${decimal(trade.executionPriceDenominator)},
        ${decimal(trade.tokenAmount)}, ${decimal(trade.quoteAmount)}, '1'
      )
      ON CONFLICT (chain_id, token_address, interval_seconds, bucket_start) DO UPDATE SET
        high_price_numerator = CASE
          WHEN EXCLUDED.high_price_numerator * market_candles.high_price_denominator
             > market_candles.high_price_numerator * EXCLUDED.high_price_denominator
            THEN EXCLUDED.high_price_numerator ELSE market_candles.high_price_numerator END,
        high_price_denominator = CASE
          WHEN EXCLUDED.high_price_numerator * market_candles.high_price_denominator
             > market_candles.high_price_numerator * EXCLUDED.high_price_denominator
            THEN EXCLUDED.high_price_denominator ELSE market_candles.high_price_denominator END,
        low_price_numerator = CASE
          WHEN EXCLUDED.low_price_numerator * market_candles.low_price_denominator
             < market_candles.low_price_numerator * EXCLUDED.low_price_denominator
            THEN EXCLUDED.low_price_numerator ELSE market_candles.low_price_numerator END,
        low_price_denominator = CASE
          WHEN EXCLUDED.low_price_numerator * market_candles.low_price_denominator
             < market_candles.low_price_numerator * EXCLUDED.low_price_denominator
            THEN EXCLUDED.low_price_denominator ELSE market_candles.low_price_denominator END,
        close_price_numerator = EXCLUDED.close_price_numerator,
        close_price_denominator = EXCLUDED.close_price_denominator,
        base_volume = market_candles.base_volume + EXCLUDED.base_volume,
        quote_volume = market_candles.quote_volume + EXCLUDED.quote_volume,
        trade_count = market_candles.trade_count + EXCLUDED.trade_count
    `);
  }
}

async function projectMetrics(
  db: BreadDb,
  trade: CanonicalTradeProjection,
  executionSource: TradeExecutionSource,
): Promise<void> {
  if (trade.executionPriceDenominator <= 0n) {
    throw new Error("trade execution price denominator must be positive");
  }
  const launchResult = await db.execute(sql`
    SELECT initial_supply
    FROM launches
    WHERE chain_id = ${trade.id.chainId}
      AND token_address = ${trade.token.toLowerCase()}
    LIMIT 1
  `);
  const launch = rows<LaunchRow>(launchResult)[0];
  if (!launch) throw new Error(`trade launch snapshot missing for ${trade.token}`);
  const initialSupply = exact(launch.initial_supply, "launch initial supply");
  const marketCap =
    (trade.executionPriceNumerator * initialSupply) /
    trade.executionPriceDenominator;

  const fiveMinutesAgo =
    trade.blockTimestamp > 300n ? trade.blockTimestamp - 300n : 0n;
  const oneHourAgo =
    trade.blockTimestamp > 3600n ? trade.blockTimestamp - 3600n : 0n;
  const oneDayAgo =
    trade.blockTimestamp > 86_400n ? trade.blockTimestamp - 86_400n : 0n;
  const aggregateResult = await db.execute(sql`
    SELECT
      count(*)::text AS total_trade_count,
      COALESCE(sum(quote_amount), 0)::text AS total_quote_volume,
      COALESCE(sum(quote_amount) FILTER (WHERE block_timestamp >= ${decimal(fiveMinutesAgo)}), 0)::text AS quote_volume_5m,
      COALESCE(sum(quote_amount) FILTER (WHERE block_timestamp >= ${decimal(oneHourAgo)}), 0)::text AS quote_volume_1h,
      COALESCE(sum(quote_amount) FILTER (WHERE block_timestamp >= ${decimal(oneDayAgo)}), 0)::text AS quote_volume_24h,
      count(*) FILTER (WHERE block_timestamp >= ${decimal(oneHourAgo)})::text AS trade_count_1h,
      count(*) FILTER (WHERE block_timestamp >= ${decimal(oneDayAgo)})::text AS trade_count_24h,
      count(DISTINCT trader_address) FILTER (WHERE block_timestamp >= ${decimal(oneHourAgo)})::text AS unique_traders_1h,
      count(DISTINCT trader_address) FILTER (WHERE block_timestamp >= ${decimal(oneDayAgo)})::text AS unique_traders_24h
    FROM trades
    WHERE chain_id = ${trade.id.chainId}
      AND token_address = ${trade.token.toLowerCase()}
  `);
  const aggregate = rows<AggregateRow>(aggregateResult)[0];
  if (!aggregate) throw new Error("trade metric aggregation returned no row");

  await db.execute(sql`
    INSERT INTO token_metrics (
      chain_id, token_address,
      price, market_cap, holder_count,
      trade_count, quote_volume, latest_block_number,
      last_price_numerator, last_price_denominator, last_price_source,
      quote_volume_5m, quote_volume_1h, quote_volume_24h,
      trade_count_1h, trade_count_24h, unique_traders_1h, unique_traders_24h,
      last_activity_transaction_index, last_activity_log_index, updated_at
    ) VALUES (
      ${trade.id.chainId}, ${trade.token.toLowerCase()},
      NULL, ${decimal(marketCap)}, NULL,
      ${aggregate.total_trade_count}, ${aggregate.total_quote_volume}, ${decimal(trade.blockNumber)},
      ${decimal(trade.executionPriceNumerator)}, ${decimal(trade.executionPriceDenominator)}, ${executionSource},
      ${aggregate.quote_volume_5m}, ${aggregate.quote_volume_1h}, ${aggregate.quote_volume_24h},
      ${aggregate.trade_count_1h}, ${aggregate.trade_count_24h}, ${aggregate.unique_traders_1h}, ${aggregate.unique_traders_24h},
      ${trade.transactionIndex}, ${trade.id.logIndex}, now()
    )
    ON CONFLICT (chain_id, token_address) DO UPDATE SET
      market_cap = EXCLUDED.market_cap,
      trade_count = EXCLUDED.trade_count,
      quote_volume = EXCLUDED.quote_volume,
      latest_block_number = EXCLUDED.latest_block_number,
      last_price_numerator = EXCLUDED.last_price_numerator,
      last_price_denominator = EXCLUDED.last_price_denominator,
      last_price_source = EXCLUDED.last_price_source,
      quote_volume_5m = EXCLUDED.quote_volume_5m,
      quote_volume_1h = EXCLUDED.quote_volume_1h,
      quote_volume_24h = EXCLUDED.quote_volume_24h,
      trade_count_1h = EXCLUDED.trade_count_1h,
      trade_count_24h = EXCLUDED.trade_count_24h,
      unique_traders_1h = EXCLUDED.unique_traders_1h,
      unique_traders_24h = EXCLUDED.unique_traders_24h,
      last_activity_transaction_index = EXCLUDED.last_activity_transaction_index,
      last_activity_log_index = EXCLUDED.last_activity_log_index,
      updated_at = EXCLUDED.updated_at
  `);
}

export async function applyCanonicalTradeProjection(
  db: BreadDb,
  trade: CanonicalTradeProjection,
): Promise<void> {
  const venueKind = trade.venueKind ?? "BREAD_CURVE";
  const venueAddress = (trade.venueAddress ?? trade.curve).toLowerCase();
  const venueFeeTier = trade.venueFeeTier ?? null;

  const inserted = await db.execute(sql`
    INSERT INTO trades (
      chain_id, transaction_hash, log_index, token_address, curve_address,
      venue_kind, venue_address, venue_fee_tier,
      side, trader_address, recipient_address,
      base_amount, quote_amount, fee_amount, tax_amount,
      block_number, block_timestamp, transaction_index, stack_version,
      offered_quote, opening_tax_bps, opening_tax_amount, launch_buy_exempt,
      refund_amount, net_curve_input, net_quote_out, gross_curve_quote_out,
      execution_price_numerator, execution_price_denominator
    ) VALUES (
      ${trade.id.chainId}, ${trade.id.transactionHash.toLowerCase()}, ${trade.id.logIndex},
      ${trade.token.toLowerCase()}, ${trade.curve.toLowerCase()},
      ${venueKind}, ${venueAddress}, ${venueFeeTier},
      ${trade.side}, ${trade.actor.toLowerCase()}, ${trade.recipient.toLowerCase()},
      ${decimal(trade.tokenAmount)}, ${decimal(trade.quoteAmount)}, ${decimal(trade.baseFee)}, ${decimal(trade.creatorTax)},
      ${decimal(trade.blockNumber)}, ${decimal(trade.blockTimestamp)}, ${trade.transactionIndex}, ${trade.stackVersion},
      ${decimalNullable(trade.offeredQuote)}, ${decimal(trade.openingTaxBps)}, ${decimal(trade.openingTax)}, ${trade.launchBuyExempt},
      ${decimalNullable(trade.refund)}, ${decimalNullable(trade.netCurveInput)}, ${decimalNullable(trade.netQuoteOut)}, ${decimalNullable(trade.grossCurveQuoteOut)},
      ${decimal(trade.executionPriceNumerator)}, ${decimal(trade.executionPriceDenominator)}
    )
    ON CONFLICT (chain_id, transaction_hash, log_index) DO NOTHING
    RETURNING chain_id
  `);
  if (rows(inserted).length !== 1)
    throw new Error(
      "canonical trade projection already exists without journal dedupe",
    );

  if (isCurveTrade(trade)) await projectCurveState(db, trade);
  await projectCandles(db, trade);
  await projectMetrics(
    db,
    trade,
    venueKind === "UNISWAP_V3" ? "V3_SWAP_EXECUTION" : "CURVE_EXECUTION",
  );
}
