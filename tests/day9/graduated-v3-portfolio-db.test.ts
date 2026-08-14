import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ProtocolContext } from "../../packages/protocol-sdk/src/context.js";
import type { Address, Hex32 } from "../../packages/types/src/index.js";

const RUN_DB = process.env.BREAD_DB_INTEGRATION === "1";
const describeDb = RUN_DB ? describe : describe.skip;
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address("1");
const token = address("2");
const curve = address("3");
const wallet = address("4");
const coordinator = address("5");
const adapter = address("6");
const quoteAsset = address("7");

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-portfolio",
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address("8"),
    feePolicy: address("9"),
    feeEscrow: address("a"),
    emergencyController: address("b"),
    locker: address("c"),
    coordinator,
    graduationAdapter: adapter,
  },
};

type TestPool = {
  query: (
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(
  new URL("../../packages/db/package.json", import.meta.url),
);
const { Pool } = requireFromDb("pg") as {
  Pool: new (config: Record<string, unknown>) => TestPool;
};

async function seedGraduatedHolding(pool: TestPool): Promise<void> {
  await pool.query(
    `INSERT INTO launches (
      chain_id, token_address, curve_address, stack_version, factory_address,
      deployer_address, creator_fee_recipient, launch_timestamp, quote_asset,
      initial_supply, graduation_threshold, graduation_coordinator, graduation_adapter,
      graduation_adapter_family, graduation_config_hash, reserved_tokens_baseline,
      launch_block_number, launch_transaction_hash, launch_log_index, name, symbol
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$6,'1786262400',$7,'1000','900',$8,$9,2,$10,'200','100',$11,1,
      'Graduated','GRD'
    )`,
    [
      context.chainId,
      token,
      curve,
      context.stackVersion,
      factory,
      wallet,
      quoteAsset,
      coordinator,
      adapter,
      hash("1"),
      hash("2"),
    ],
  );
  await pool.query(
    `INSERT INTO launch_state (
      chain_id, token_address, graduation_phase, latest_block_number
    ) VALUES ($1,$2,'POOL_CREATED','120')`,
    [context.chainId, token],
  );
  await pool.query(
    `INSERT INTO holder_snapshots (
      chain_id, token_address, holder_address, balance, is_protocol_address,
      as_of_block_number, last_transaction_hash, last_log_index
    ) VALUES ($1,$2,$3,'40',false,'120',$4,7)`,
    [context.chainId, token, wallet, hash("3")],
  );
  await pool.query(
    `INSERT INTO token_metrics (
      chain_id, token_address, last_price_numerator, last_price_denominator,
      last_price_source, graduation_state, latest_block_number
    ) VALUES ($1,$2,'5','2','V3_SWAP_EXECUTION','POOL_CREATED','120')`,
    [context.chainId, token],
  );
  await pool.query(
    `INSERT INTO indexer_checkpoints (
      chain_id, stack_version, factory_address, deployment_start_block,
      indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
      decoder_schema_version, status
    ) VALUES ($1,$2,$3,'100','120',$4,'1786262600','day6-v1','COMMITTED')`,
    [context.chainId, context.stackVersion, factory, hash("4")],
  );
}

describeDb("Day 9 graduated V3 portfolio valuation", () => {
  const schemaName = `day9_v3_portfolio_${process.pid}`;
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
      "TRUNCATE holder_snapshots, token_metrics, launch_state, launches, indexer_checkpoints, protocol_stacks CASCADE",
    );
    await seedGraduatedHolding(pool);
  });

  it("values a graduated holding only from canonical V3_SWAP_EXECUTION without inventing cost basis or PnL", async () => {
    const dbModule = await import("../../packages/db/src/index.ts");
    const { createBreadApi } = await import("../../apps/api/src/server.ts");
    const app = createBreadApi({
      db: dbModule.createBreadDb(pool),
      context,
      observedHeadBlock: async () => 120n,
      now: () => new Date("2026-08-14T19:40:00.000Z"),
    });

    const response = await app.inject({
      method: "GET",
      url: `/v1/portfolio/${wallet}`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const holding = body.data.holdings.find(
      (row: { tokenAddress: string }) => row.tokenAddress === token,
    );

    expect(holding).toBeDefined();
    expect(holding.price).toEqual({
      status: "AVAILABLE",
      source: "V3_SWAP_EXECUTION",
      numerator: "5",
      denominator: "2",
    });
    expect(holding.currentValue).toEqual({
      status: "AVAILABLE",
      source: "V3_SWAP_EXECUTION",
      numerator: "200",
      denominator: "2",
    });
    expect(JSON.stringify(holding)).not.toMatch(/averageEntry|costBasis|pnl/i);
    expect(body.meta.source).toBe("bread-indexer");

    await app.close();
  });
});
