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
const trader = address("5");
const recipient = address("6");
const dexFactory = address("7");
const quoteAsset = address("8");
const positionManager = address("9");
const graduationAdapter = address("a");
const coordinator = address("b");
const transactionHash = hash("c");
const blockHash = hash("d");
const topic0 = hash("e");
const timestamp = 1_786_263_700n;

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-cache-invalidation",
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address("c"),
    feePolicy: address("d"),
    feeEscrow: address("e"),
    emergencyController: address("f"),
    locker: address("1"),
    coordinator,
    graduationAdapter,
  },
  graduatedTrading: {
    family: "UNISWAP_V3",
    factory: dexFactory,
    positionManager,
    swapRouter: address("2"),
    swapRouterKind: "V3_SWAP_ROUTER_02",
    quoter: address("3"),
    quoterKind: "V3_QUOTER_V2",
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
      hash("1"),
      hash("2"),
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
      hash("3"),
      (timestamp - 1n).toString(10),
    ],
  );
}

function swapLog(amount0: bigint, amount1: bigint) {
  return {
    address: poolAddress,
    blockNumber: 111n,
    blockHash,
    transactionHash,
    transactionIndex: 2,
    logIndex: 3,
    eventName: "Swap",
    args: {
      sender: address("4"),
      recipient,
      amount0,
      amount1,
      sqrtPriceX96: 1n,
      liquidity: 10_000n,
      tick: 0,
    },
    topics: [topic0],
    data: "0x" as const,
  };
}

describeDb("Day 9 applyRange projection-cache invalidation derivation", () => {
  const schemaName = `day9_v3_cache_invalidation_${process.pid}`;
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
    await seedPersistedGraduatedLaunch(pool);
  });

  async function apply(log: ReturnType<typeof swapLog>) {
    const dbModule = await import("../../packages/db/src/index.ts");
    const applyModule = await import("../../apps/indexer/src/apply-range.ts");
    const db = dbModule.createBreadDb(pool);
    return (await applyModule.applyRange({
      db,
      client: {
        readContract: async () => {
          throw new Error("persisted verified V3 identity must not be reread");
        },
        getLogs: async () => [log],
        getTransaction: async () => ({
          hash: transactionHash,
          blockNumber: 111n,
          from: trader,
        }),
        getBlock: async () => ({ timestamp }),
      },
      context,
      fromBlock: 111n,
      toBlock: 111n,
      toBlockHash: blockHash,
      toBlockTimestamp: timestamp,
      logs: [],
    } as never)) as Readonly<{
      insertedEventIds: readonly string[];
      projectionCacheChannels?: readonly string[];
    }>;
  }

  it("returns deterministic token plus factory-feed invalidations for a newly inserted priced V3 Swap and none on replay", async () => {
    const first = await apply(swapLog(500n, -50n));
    expect(first.insertedEventIds).toHaveLength(1);
    expect(first.projectionCacheChannels).toEqual([
      `stack:${context.chainId}:${context.stackVersion}:${factory}:feed`,
      `token:${context.chainId}:${token}`,
    ]);

    const replay = await apply(swapLog(500n, -50n));
    expect(replay.insertedEventIds).toEqual([]);
    expect(replay.projectionCacheChannels).toEqual([]);
  });

  it("returns no invalidation channels for a newly journaled dust-only V3 Swap", async () => {
    const result = await apply(swapLog(1n, 0n));
    expect(result.insertedEventIds).toHaveLength(1);
    expect(result.projectionCacheChannels).toEqual([]);

    const journal = await pool.query(
      `SELECT count(*)::int AS count FROM event_journal WHERE chain_id=$1`,
      [context.chainId],
    );
    const trades = await pool.query(
      `SELECT count(*)::int AS count FROM trades WHERE chain_id=$1`,
      [context.chainId],
    );
    expect(journal.rows[0]?.count).toBe(1);
    expect(trades.rows[0]?.count).toBe(0);
  });
});
