import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const RUN_DB = process.env.BREAD_DB_INTEGRATION === "1";
const describeDb = RUN_DB ? describe : describe.skip;
const address = (nibble: string) => `0x${nibble.repeat(40)}`;
const hash = (nibble: string) => `0x${nibble.repeat(64)}`;

const chainId = 5_042_002;
const stackVersion = "day9-v3-journal-reducer-red";
const factory = address("1");
const quoteAsset = address("2");
const token = address("3");
const curve = address("4");
const poolAddress = address("5");
const actor = address("6");
const recipient = address("7");
const creator = address("9");
const transactionHash = hash("a");
const blockHash = hash("b");
const topic0 = hash("c");
const blockNumber = 500n;
const blockTimestamp = 1_786_263_100n;

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

const context = {
  chainId,
  stackVersion,
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: blockNumber,
  addresses: {},
} as const;

function swapEvent(logIndex: number, amount0: bigint, amount1: bigint) {
  return {
    identity: { chainId, transactionHash, logIndex },
    blockNumber,
    blockHash,
    blockTimestamp,
    transactionIndex: 3,
    contractAddress: poolAddress,
    contractRole: "V3_POOL",
    stackVersion,
    topic0,
    topics: [topic0],
    data: "0x",
    eventName: "Swap",
    tokenAddress: token,
    curveAddress: curve,
    payload: {
      sender: address("8"),
      recipient,
      amount0,
      amount1,
      sqrtPriceX96: 123n,
      liquidity: 456n,
      tick: -7,
    },
  } as const;
}

function pricedTrade() {
  return {
    id: { chainId, transactionHash, logIndex: 8 },
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
    blockNumber,
    blockHash,
    blockTimestamp,
    transactionIndex: 3,
  } as const;
}

describeDb("Day 9 V3 Swap journal and priced-trade reducer", () => {
  const schemaName = `day9_v3_journal_${process.pid}`;
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
      "TRUNCATE event_journal, trades, market_candles, token_metrics, creator_rollups, launches, indexer_checkpoints, protocol_stacks CASCADE",
    );
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        creator_fee_recipient, launch_block_number, launch_transaction_hash, launch_log_index
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)`,
      [
        chainId,
        token,
        curve,
        stackVersion,
        factory,
        creator,
        blockNumber.toString(10),
        hash("d"),
      ],
    );
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await adminPool.end();
    }
  });

  it("journals priced and dust Swaps exactly once while projecting only the priced trade", async () => {
    const dbModule = await import("../../packages/db/src/index.ts");
    const reducers = await import("../../apps/indexer/src/reducers.ts");
    const db = dbModule.createBreadDb(pool);
    const repository = new dbModule.IndexerRepository(db, [
      reducers.createTradeReducer([pricedTrade()]),
    ]);
    const events = [swapEvent(8, 125n, -50n), swapEvent(9, 1n, 0n)];
    const input = {
      context,
      fromBlock: blockNumber,
      toBlock: blockNumber,
      toBlockHash: blockHash,
      toBlockTimestamp: blockTimestamp,
      events,
    } as const;

    const first = await repository.applyCanonicalRange(input);
    expect(first.insertedEventIds).toEqual([
      `${chainId}:${transactionHash}:8`,
      `${chainId}:${transactionHash}:9`,
    ]);

    const journal = await pool.query(
      `SELECT log_index, contract_role, event_name, token_address, curve_address
       FROM event_journal
       ORDER BY log_index`,
    );
    expect(journal.rows).toEqual([
      {
        log_index: 8,
        contract_role: "V3_POOL",
        event_name: "Swap",
        token_address: token,
        curve_address: curve,
      },
      {
        log_index: 9,
        contract_role: "V3_POOL",
        event_name: "Swap",
        token_address: token,
        curve_address: curve,
      },
    ]);

    const projected = await pool.query(
      `SELECT
        count(*)::int AS trade_count,
        min(venue_kind) AS venue_kind,
        min(venue_address) AS venue_address,
        min(venue_fee_tier)::int AS venue_fee_tier
       FROM trades`,
    );
    expect(projected.rows).toEqual([
      {
        trade_count: 1,
        venue_kind: "UNISWAP_V3",
        venue_address: poolAddress,
        venue_fee_tier: 3000,
      },
    ]);

    const market = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM market_candles) AS candles,
        (SELECT trade_count::text FROM token_metrics
         WHERE chain_id=$1 AND token_address=$2) AS metric_trade_count,
        (SELECT last_price_source FROM token_metrics
         WHERE chain_id=$1 AND token_address=$2) AS last_price_source`,
      [chainId, token],
    );
    expect(market.rows).toEqual([
      {
        candles: 3,
        metric_trade_count: "1",
        last_price_source: "V3_SWAP_EXECUTION",
      },
    ]);

    const creatorRollup = await pool.query(
      `SELECT trade_count::text AS trade_count,
              accrued_fees::text AS accrued_fees,
              claimed_fees::text AS claimed_fees
       FROM creator_rollups
       WHERE chain_id=$1 AND creator_address=$2 AND token_address=$3`,
      [chainId, creator, token],
    );
    expect(creatorRollup.rows).toEqual([
      {
        trade_count: "1",
        accrued_fees: "0",
        claimed_fees: "0",
      },
    ]);

    const replay = await repository.applyCanonicalRange(input);
    expect(replay.insertedEventIds).toEqual([]);

    const afterReplay = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM event_journal) AS journal_count,
        (SELECT count(*)::int FROM trades) AS trade_count,
        (SELECT count(*)::int FROM market_candles) AS candles,
        (SELECT trade_count::text FROM token_metrics
         WHERE chain_id=$1 AND token_address=$2) AS metric_trade_count,
        (SELECT trade_count::text FROM creator_rollups
         WHERE chain_id=$1 AND creator_address=$2 AND token_address=$3) AS creator_trade_count`,
      [chainId, creator, token],
    );
    expect(afterReplay.rows).toEqual([
      {
        journal_count: 2,
        trade_count: 1,
        candles: 3,
        metric_trade_count: "1",
        creator_trade_count: "1",
      },
    ]);
  });
});
