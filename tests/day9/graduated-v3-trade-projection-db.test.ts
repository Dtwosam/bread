import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const RUN_DB = process.env.BREAD_DB_INTEGRATION === "1";
const describeDb = RUN_DB ? describe : describe.skip;
const address = (nibble: string) => `0x${nibble.repeat(40)}`;
const hash = (nibble: string) => `0x${nibble.repeat(64)}`;

const chainId = 5_042_002;
const stackVersion = "day9-v3-trade-projection-red";
const factory = address("1");
const token = address("2");
const curve = address("3");
const poolAddress = address("4");
const actor = address("5");
const recipient = address("6");
const transactionHash = hash("a");
const blockTimestamp = 1_786_262_900n;

type TestPool = {
  query: (
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(
  new URL("../../packages/db/package.json", import.meta.url),
);
const { Pool } = requireFromDb("pg") as {
  Pool: new (config: Record<string, unknown>) => TestPool;
};

const sentinelColumns = `
  mode,
  quote_reserve::text,
  token_reserve::text,
  remaining_sellable_tokens::text,
  tracked_sold_inventory::text,
  ready_to_graduate,
  tracked_quote::text,
  tracked_tokens::text,
  quote_fee_balance::text,
  creator_tax_balance::text,
  real_quote_reserve::text,
  virtual_quote_reserve::text,
  latest_block_number::text,
  latest_transaction_hash,
  latest_log_index
`;

describeDb("Day 9 venue-neutral V3 trade PostgreSQL projection", () => {
  const schemaName = `day9_v3_trade_projection_${process.pid}`;
  let adminPool: TestPool;
  let pool: TestPool;

  beforeAll(async () => {
    const connectionString =
      process.env.BREAD_DATABASE_URL ??
      "postgresql://bread:bread_local_only@127.0.0.1:5432/bread";
    adminPool = new Pool({ connectionString });
    await adminPool.query("SELECT 1");
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await adminPool.query(`CREATE SCHEMA ${schemaName}`);
    pool = new Pool({
      connectionString,
      options: `-c search_path=${schemaName}`,
    });

    const dbModule = await import("../../packages/db/src/index.ts");
    await dbModule.migrateBreadDb(pool);
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE trades, market_candles, token_metrics, launch_state, launches CASCADE",
    );
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        initial_supply, phantom_quote, reserved_tokens_baseline,
        launch_block_number, launch_transaction_hash, launch_log_index
      ) VALUES ($1,$2,$3,$4,$5,'1000','100','200','100',$6,0)`,
      [chainId, token, curve, stackVersion, factory, hash("b")],
    );
    await pool.query(
      `INSERT INTO launch_state (
        chain_id, token_address, mode,
        quote_reserve, token_reserve, remaining_sellable_tokens,
        tracked_sold_inventory, ready_to_graduate,
        tracked_quote, tracked_tokens, quote_fee_balance, creator_tax_balance,
        real_quote_reserve, virtual_quote_reserve,
        latest_block_number, latest_transaction_hash, latest_log_index
      ) VALUES (
        $1,$2,'ACTIVE',
        '574','200','0','800',true,
        '500','200','17','9','474','574',
        '499',$3,12
      )`,
      [chainId, token, hash("c")],
    );
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await adminPool.end();
    }
  });

  it("persists one V3 trade with null curve-only fields, shared market projections, and no curve-state mutation", async () => {
    const before = await pool.query(
      `SELECT ${sentinelColumns}
       FROM launch_state WHERE chain_id=$1 AND token_address=$2`,
      [chainId, token],
    );

    const dbModule = await import("../../packages/db/src/index.ts");
    const db = dbModule.createBreadDb(pool);
    await dbModule.applyCanonicalTradeProjection(db, {
      id: { chainId, transactionHash, logIndex: 7 },
      stackVersion,
      side: "BUY",
      token,
      curve,
      actor,
      recipient,
      venueKind: "UNISWAP_V3",
      venueAddress: poolAddress,
      venueFeeTier: 3000,
      offeredQuote: null,
      quoteAmount: 125n,
      tokenAmount: 50n,
      baseFee: 0n,
      creatorTax: 0n,
      openingTaxBps: 0n,
      openingTax: 0n,
      launchBuyExempt: null,
      refund: null,
      netCurveInput: null,
      netQuoteOut: null,
      grossCurveQuoteOut: null,
      executionPriceNumerator: 125n,
      executionPriceDenominator: 50n,
      blockNumber: 500n,
      blockTimestamp,
      transactionIndex: 3,
    } as never);

    const trade = await pool.query(
      `SELECT
        venue_kind,
        venue_address,
        venue_fee_tier,
        offered_quote::text,
        opening_tax_bps::text,
        opening_tax_amount::text,
        launch_buy_exempt,
        refund_amount::text,
        net_curve_input::text,
        net_quote_out::text,
        gross_curve_quote_out::text,
        fee_amount::text,
        tax_amount::text,
        execution_price_numerator::text,
        execution_price_denominator::text
       FROM trades
       WHERE chain_id=$1 AND transaction_hash=$2 AND log_index=7`,
      [chainId, transactionHash],
    );
    expect(trade.rows).toEqual([
      {
        venue_kind: "UNISWAP_V3",
        venue_address: poolAddress,
        venue_fee_tier: 3000,
        offered_quote: null,
        opening_tax_bps: "0",
        opening_tax_amount: "0",
        launch_buy_exempt: null,
        refund_amount: null,
        net_curve_input: null,
        net_quote_out: null,
        gross_curve_quote_out: null,
        fee_amount: "0",
        tax_amount: "0",
        execution_price_numerator: "125",
        execution_price_denominator: "50",
      },
    ]);

    const after = await pool.query(
      `SELECT ${sentinelColumns}
       FROM launch_state WHERE chain_id=$1 AND token_address=$2`,
      [chainId, token],
    );
    expect(after.rows).toEqual(before.rows);

    const candles = await pool.query(
      `SELECT interval_seconds, quote_volume::text, base_volume::text, trade_count::text,
              close_price_numerator::text, close_price_denominator::text
       FROM market_candles
       WHERE chain_id=$1 AND token_address=$2
       ORDER BY interval_seconds`,
      [chainId, token],
    );
    expect(candles.rows).toEqual([
      {
        interval_seconds: 60,
        quote_volume: "125",
        base_volume: "50",
        trade_count: "1",
        close_price_numerator: "125",
        close_price_denominator: "50",
      },
      {
        interval_seconds: 300,
        quote_volume: "125",
        base_volume: "50",
        trade_count: "1",
        close_price_numerator: "125",
        close_price_denominator: "50",
      },
      {
        interval_seconds: 3600,
        quote_volume: "125",
        base_volume: "50",
        trade_count: "1",
        close_price_numerator: "125",
        close_price_denominator: "50",
      },
    ]);

    const metric = await pool.query(
      `SELECT
        trade_count::text,
        quote_volume::text,
        last_price_numerator::text,
        last_price_denominator::text,
        last_price_source,
        quote_volume_5m::text,
        quote_volume_1h::text,
        quote_volume_24h::text,
        trade_count_1h::text,
        trade_count_24h::text,
        unique_traders_1h::text,
        unique_traders_24h::text
       FROM token_metrics
       WHERE chain_id=$1 AND token_address=$2`,
      [chainId, token],
    );
    expect(metric.rows).toEqual([
      {
        trade_count: "1",
        quote_volume: "125",
        last_price_numerator: "125",
        last_price_denominator: "50",
        last_price_source: "V3_SWAP_EXECUTION",
        quote_volume_5m: "125",
        quote_volume_1h: "125",
        quote_volume_24h: "125",
        trade_count_1h: "1",
        trade_count_24h: "1",
        unique_traders_1h: "1",
        unique_traders_24h: "1",
      },
    ]);
  });
});
