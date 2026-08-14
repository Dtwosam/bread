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
const poolAddress = address("4");
const positionManager = address("5");
const dexFactory = address("6");
const quoteAsset = address("7");
const graduationAdapter = address("8");
const coordinator = address("9");
const trader = address("a");
const swapRecipient = address("b");
const swapSender = address("c");
const deployer = address("d");
const creator = address("e");
const protocolRecipient = address("f");
const configHash = hash("1");
const completionTx = hash("2");
const blockHash = hash("3");
const poolId = `0x${"0".repeat(24)}${poolAddress.slice(2)}` as Hex32;
const blockTimestamp = 1_786_262_600n;

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-same-range",
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address("1"),
    feePolicy: address("2"),
    feeEscrow: address("3"),
    emergencyController: address("4"),
    locker: address("5"),
    coordinator,
    graduationAdapter,
  },
  graduatedTrading: {
    family: "UNISWAP_V3",
    factory: dexFactory,
    positionManager,
    swapRouter: address("6"),
    swapRouterKind: "V3_SWAP_ROUTER_02",
    quoter: address("7"),
    quoterKind: "V3_QUOTER_V2",
  },
};

const transferLog = {
  address: token,
  blockNumber: 120n,
  blockHash,
  transactionHash: completionTx,
  transactionIndex: 3,
  logIndex: 4,
  topics: [hash("4")],
  data: "0x" as const,
  eventName: "Transfer",
  args: { from: curve, to: poolAddress, value: 10n },
};

const completionLog = {
  address: coordinator,
  blockNumber: 120n,
  blockHash,
  transactionHash: completionTx,
  transactionIndex: 3,
  logIndex: 5,
  topics: [hash("5")],
  data: "0x" as const,
  eventName: "GraduationCompleted",
  args: {
    token,
    adapter: graduationAdapter,
    poolId,
    positionManager,
    positionId: 77n,
    usdcUsed: 500n,
    tokenUsed: 200n,
    tokenLocked: 190n,
    usdcDust: 0n,
  },
};

const swapLog = {
  address: poolAddress,
  blockNumber: 120n,
  blockHash,
  transactionHash: completionTx,
  transactionIndex: 3,
  logIndex: 6,
  topics: [hash("6")],
  data: "0x" as const,
  eventName: "Swap",
  args: {
    sender: swapSender,
    recipient: swapRecipient,
    amount0: 500n,
    amount1: -50n,
    sqrtPriceX96: 1n,
    liquidity: 10_000n,
    tick: 0,
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

async function seedLaunch(pool: TestPool): Promise<void> {
  await pool.query(
    `INSERT INTO launches (
      chain_id, token_address, curve_address, stack_version, factory_address,
      deployer_address, creator_fee_recipient, creator_tax_bps, economics_digest,
      config_version, launch_timestamp, name, symbol, metadata, quote_asset,
      initial_supply, phantom_quote, graduation_threshold, protocol_fee_recipient,
      trade_fee_bps, protocol_fee_share_bps, max_creator_tax_bps,
      graduation_coordinator, graduation_adapter, graduation_adapter_family,
      graduation_config_hash, reserved_tokens_baseline,
      launch_block_number, launch_transaction_hash, launch_log_index
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,'200',$8,'1','1786262400','Same Range','SR','{}'::jsonb,$9,
      '1000','100','900',$10,'100','5000','1000',$11,$12,2,$13,'200','100',$14,4
    )`,
    [
      context.chainId,
      token,
      curve,
      context.stackVersion,
      factory,
      deployer,
      creator,
      hash("7"),
      quoteAsset,
      protocolRecipient,
      coordinator,
      graduationAdapter,
      configHash,
      hash("8"),
    ],
  );
  await pool.query(
    `INSERT INTO launch_state (
      chain_id, token_address, graduation_phase, graduation_adapter,
      swept_usdc_amount, swept_token_amount
    ) VALUES ($1,$2,'SWEPT',$3,'500','200')`,
    [context.chainId, token, graduationAdapter],
  );
  await pool.query(
    `INSERT INTO holder_snapshots (
      chain_id, token_address, holder_address, balance, is_protocol_address,
      as_of_block_number, last_transaction_hash, last_log_index
    ) VALUES ($1,$2,$3,'100',true,'119',$4,1)`,
    [context.chainId, token, curve, hash("9")],
  );
  await pool.query(
    `INSERT INTO indexer_checkpoints (
      chain_id, stack_version, factory_address, deployment_start_block,
      indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
      decoder_schema_version, status
    ) VALUES ($1,$2,$3,'100','119',$4,$5,'day6-v1','COMMITTED')`,
    [
      context.chainId,
      context.stackVersion,
      factory,
      hash("a"),
      (blockTimestamp - 1n).toString(10),
    ],
  );
}

describeDb("Day 9 same-range graduated V3 applyRange orchestration", () => {
  const schemaName = `day9_v3_same_range_${process.pid}`;
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
      "TRUNCATE event_journal, trades, market_candles, token_metrics, holder_snapshots, launch_state, launches, indexer_checkpoints, protocol_stacks CASCADE",
    );
    await seedLaunch(pool);
  });

  it("verifies same-range graduation before reducers, persists the venue, classifies pool custody, and applies the post-completion Swap", async () => {
    const dbModule = await import("../../packages/db/src/index.ts");
    const applyModule = await import("../../apps/indexer/src/apply-range.ts");
    const db = dbModule.createBreadDb(pool);
    const readRequests: string[] = [];
    const logRequests: Array<Readonly<Record<string, unknown>>> = [];

    await applyModule.applyRange({
      db,
      client: {
        readContract: async (request: Readonly<Record<string, unknown>>) => {
          const addressValue = String(request.address).toLowerCase();
          const functionName = String(request.functionName);
          readRequests.push(`${addressValue}:${functionName}`);
          const values: Record<string, unknown> = {
            [`${graduationAdapter}:family`]: 2n,
            [`${graduationAdapter}:coordinator`]: coordinator,
            [`${graduationAdapter}:configHash`]: configHash,
            [`${graduationAdapter}:usdc`]: quoteAsset,
            [`${graduationAdapter}:positionManager`]: positionManager,
            [`${graduationAdapter}:v3Factory`]: dexFactory,
            [`${graduationAdapter}:fee`]: 3000n,
            [`${dexFactory}:getPool`]: poolAddress,
            [`${poolAddress}:token0`]: quoteAsset,
            [`${poolAddress}:token1`]: token,
            [`${poolAddress}:fee`]: 3000n,
          };
          const key = `${addressValue}:${functionName}`;
          if (!(key in values)) throw new Error(`unexpected read ${key}`);
          return values[key];
        },
        getLogs: async (request: Readonly<Record<string, unknown>>) => {
          logRequests.push(request);
          return [swapLog];
        },
        getTransaction: async () => ({
          hash: completionTx,
          blockNumber: 120n,
          from: trader,
        }),
        getBlock: async () => ({ timestamp: blockTimestamp }),
      },
      context,
      fromBlock: 120n,
      toBlock: 120n,
      toBlockHash: blockHash,
      toBlockTimestamp: blockTimestamp,
      logs: [transferLog, completionLog],
    } as never);

    const state = (
      await pool.query(
        `SELECT graduation_phase, graduated_venue_kind, graduated_venue_address,
                graduated_venue_fee_tier, graduated_venue_quote_is_token0,
                graduation_completed_block::text AS completion_block,
                graduation_completed_transaction_index AS completion_transaction_index,
                graduation_completed_log_index AS completion_log_index
         FROM launch_state
         WHERE chain_id=$1 AND token_address=$2`,
        [context.chainId, token],
      )
    ).rows[0];
    const poolHolder = (
      await pool.query(
        `SELECT balance::text AS balance, is_protocol_address
         FROM holder_snapshots
         WHERE chain_id=$1 AND token_address=$2 AND holder_address=$3`,
        [context.chainId, token, poolAddress],
      )
    ).rows[0];
    const journal = (
      await pool.query(
        `SELECT event_name, contract_role, log_index
         FROM event_journal
         WHERE chain_id=$1
         ORDER BY block_number, transaction_index, log_index`,
        [context.chainId],
      )
    ).rows;
    const v3Trades = (
      await pool.query(
        `SELECT venue_kind, venue_address, side, base_amount::text AS base_amount,
                quote_amount::text AS quote_amount
         FROM trades
         WHERE chain_id=$1 AND venue_kind='UNISWAP_V3'`,
        [context.chainId],
      )
    ).rows;

    expect(readRequests.length).toBeGreaterThan(0);
    expect(logRequests).toHaveLength(1);
    expect(state).toMatchObject({
      graduation_phase: "POOL_CREATED",
      graduated_venue_kind: "UNISWAP_V3",
      graduated_venue_address: poolAddress,
      graduated_venue_fee_tier: 3000,
      graduated_venue_quote_is_token0: true,
      completion_block: "120",
      completion_transaction_index: 3,
      completion_log_index: 5,
    });
    expect(poolHolder).toMatchObject({
      balance: "10",
      is_protocol_address: true,
    });
    expect(journal).toEqual([
      expect.objectContaining({ event_name: "Transfer", log_index: 4 }),
      expect.objectContaining({
        event_name: "GraduationCompleted",
        log_index: 5,
      }),
      expect.objectContaining({
        event_name: "Swap",
        contract_role: "V3_POOL",
        log_index: 6,
      }),
    ]);
    expect(v3Trades).toEqual([
      expect.objectContaining({
        venue_kind: "UNISWAP_V3",
        venue_address: poolAddress,
        side: "BUY",
        base_amount: "50",
        quote_amount: "500",
      }),
    ]);
  });
});
