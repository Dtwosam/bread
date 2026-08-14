import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ProtocolContext } from "../../packages/protocol-sdk/src/context.js";
import type { Address, Hex32 } from "../../packages/types/src/index.js";

const RUN_DB = process.env.BREAD_DB_INTEGRATION === "1";
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address("1");
const token = address("2");
const curve = address("3");
const poolAddress = address("4");
const trader = address("5");
const recipient = address("6");
const dexFactory = address("7");
const quoteAsset = address("8");
const positionManager = address("9");
const swapRouter = address("a");
const quoter = address("b");
const graduationAdapter = address("c");
const coordinator = address("d");
const swapSender = address("e");

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-apply-range",
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address("f"),
    feePolicy: address("1"),
    feeEscrow: address("2"),
    emergencyController: address("3"),
    locker: address("4"),
    coordinator,
    graduationAdapter,
  },
  graduatedTrading: {
    family: "UNISWAP_V3",
    factory: dexFactory,
    positionManager,
    swapRouter,
    swapRouterKind: "V3_SWAP_ROUTER_02",
    quoter,
    quoterKind: "V3_QUOTER_V2",
  },
};

const swapTransactionHash = hash("a");
const swapBlockHash = hash("b");
const swapTopic0 = hash("c");
const swapTimestamp = 1_786_262_520n;

const swapLog = {
  address: poolAddress,
  blockNumber: 111n,
  blockHash: swapBlockHash,
  transactionHash: swapTransactionHash,
  transactionIndex: 2,
  logIndex: 3,
  eventName: "Swap",
  args: {
    sender: swapSender,
    recipient,
    amount0: 500n,
    amount1: -50n,
    sqrtPriceX96: 1n,
    liquidity: 10_000n,
    tick: 0,
  },
  topics: [swapTopic0],
  data: "0x" as const,
};

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const { Pool } = requireFromDb("pg") as {
  Pool: new (config: Record<string, unknown>) => TestPool;
};

async function seedPersistedGraduatedLaunch(pool: TestPool): Promise<void> {
  await pool.query(
    `INSERT INTO launches (
      chain_id, token_address, curve_address, stack_version, factory_address, quote_asset,
      graduation_coordinator, graduation_adapter, graduation_adapter_family, graduation_config_hash,
      launch_block_number, launch_transaction_hash, launch_log_index
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,2,$9,'100',$10,1)`,
    [
      context.chainId,
      token,
      curve,
      context.stackVersion,
      factory,
      quoteAsset,
      coordinator,
      graduationAdapter,
      hash("d"),
      hash("e"),
    ],
  );
  await pool.query(
    `INSERT INTO launch_state (
      chain_id, token_address, mode, graduation_phase,
      graduated_venue_kind, graduated_venue_address, graduated_venue_fee_tier,
      graduated_venue_quote_is_token0, graduation_completed_block,
      graduation_completed_transaction_index, graduation_completed_log_index
    ) VALUES ($1,$2,'GRADUATED','POOL_CREATED','UNISWAP_V3',$3,3000,true,'105',1,5)`,
    [context.chainId, token, poolAddress],
  );
  await pool.query(
    `INSERT INTO indexer_checkpoints (
      chain_id, stack_version, factory_address, deployment_start_block,
      indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
      decoder_schema_version, status
    ) VALUES ($1,$2,$3,'100','110',$4,$5,'day6-v1','COMMITTED')`,
    [
      context.chainId,
      context.stackVersion,
      factory,
      hash("f"),
      (swapTimestamp - 1n).toString(10),
    ],
  );
}

describe.skipIf(!RUN_DB)("Day 9 persisted graduated V3 applyRange orchestration", () => {
  const schemaName = `day9_v3_apply_range_${process.pid}`;
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
    pool = new Pool({ connectionString, options: `-c search_path=${schemaName}` });
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await adminPool.end();
    }
  });

  beforeEach(async () => {
    const dbModule = await import("../../packages/db/src/index.ts");
    await dbModule.migrateBreadDb(pool);
    await pool.query(
      "TRUNCATE event_journal, trades, market_candles, token_metrics, holder_snapshots, launch_state, launches, indexer_checkpoints, protocol_stacks CASCADE",
    );
    await seedPersistedGraduatedLaunch(pool);
  });

  it("discovers and atomically applies a later-range Swap from the persisted verified V3 registry", async () => {
    const dbModule = await import("../../packages/db/src/index.ts");
    const applyModule = await import("../../apps/indexer/src/apply-range.ts");
    const db = dbModule.createBreadDb(pool);
    const logRequests: Array<Readonly<Record<string, unknown>>> = [];
    const transactionRequests: string[] = [];
    const blockRequests: bigint[] = [];

    await applyModule.applyRange({
      db,
      client: {
        readContract: async () => {
          throw new Error("persisted verified V3 identity must not be reread every range");
        },
        getLogs: async (request: Readonly<Record<string, unknown>>) => {
          logRequests.push(request);
          return [swapLog];
        },
        getTransaction: async (request: Readonly<{ hash: Hex32 }>) => {
          transactionRequests.push(request.hash);
          return {
            hash: request.hash,
            blockNumber: 111n,
            from: trader,
          };
        },
        getBlock: async (request: Readonly<{ blockNumber: bigint }>) => {
          blockRequests.push(request.blockNumber);
          return { timestamp: swapTimestamp };
        },
      },
      context,
      fromBlock: 111n,
      toBlock: 111n,
      toBlockHash: swapBlockHash,
      toBlockTimestamp: swapTimestamp,
      logs: [],
    } as never);

    const journal = await pool.query(
      `SELECT contract_role, event_name, token_address, curve_address
       FROM event_journal
       WHERE chain_id = $1
       ORDER BY block_number, transaction_index, log_index`,
      [context.chainId],
    );
    const trades = await pool.query(
      `SELECT venue_kind, venue_address, venue_fee_tier, side,
              trader_address, recipient_address, base_amount, quote_amount
       FROM trades
       WHERE chain_id = $1`,
      [context.chainId],
    );
    const metrics = await pool.query(
      `SELECT last_price_source, last_price_numerator, last_price_denominator
       FROM token_metrics
       WHERE chain_id = $1 AND token_address = $2`,
      [context.chainId, token],
    );

    expect(logRequests).toHaveLength(1);
    expect(logRequests[0]).toMatchObject({
      address: [poolAddress],
      fromBlock: 111n,
      toBlock: 111n,
    });
    expect(transactionRequests).toEqual([swapTransactionHash]);
    expect(blockRequests).toEqual([111n]);
    expect(journal.rows).toEqual([
      expect.objectContaining({
        contract_role: "V3_POOL",
        event_name: "Swap",
        token_address: token,
        curve_address: curve,
      }),
    ]);
    expect(trades.rows).toEqual([
      expect.objectContaining({
        venue_kind: "UNISWAP_V3",
        venue_address: poolAddress,
        venue_fee_tier: 3000,
        side: "BUY",
        trader_address: trader,
        recipient_address: recipient,
        base_amount: "50",
        quote_amount: "500",
      }),
    ]);
    expect(metrics.rows).toEqual([
      expect.objectContaining({
        last_price_source: "V3_SWAP_EXECUTION",
        last_price_numerator: "500",
        last_price_denominator: "50",
      }),
    ]);
  });
});
