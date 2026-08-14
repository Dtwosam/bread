import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ProtocolContext } from "../../packages/protocol-sdk/src/context.js";
import type {
  Address,
  Hex32,
  ReconciliationReport,
} from "../../packages/types/src/index.js";

const RUN_DB = process.env.BREAD_DB_INTEGRATION === "1";
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address("1");
const token = address("2");
const curve = address("3");
const quoteAsset = address("4");
const feeEscrow = address("5");
const coordinator = address("6");
const locker = address("7");
const poolAddress = address("8");
const wrongPoolAddress = address("9");
const launchTx = hash("a");
const launchBlockHash = hash("b");
const checkedBlockHash = hash("c");
const topic0 = hash("d");
const poolId = `0x${"0".repeat(24)}${poolAddress.slice(2)}` as Hex32;

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-reconciliation",
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    feeEscrow,
    coordinator,
    locker,
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

function authoritativeChain() {
  const runtimeHashes: Record<string, Hex32> = {
    [factory.toLowerCase()]: hash("1"),
    [feeEscrow.toLowerCase()]: hash("2"),
    [coordinator.toLowerCase()]: hash("3"),
    [locker.toLowerCase()]: hash("4"),
  };

  return {
    countLaunchCreated: async () => 1n,
    scanLaunchCreated: async () => [
      { transactionHash: launchTx, logIndex: 4, tokenAddress: token },
    ],
    scanCanonicalEventIdentities: async () => [
      { transactionHash: launchTx, logIndex: 4 },
    ],
    readCurveState: async () => ({
      trackedQuote: 500n,
      trackedTokens: 800n,
      quoteFeeBalance: 0n,
      creatorTaxBalance: 0n,
      realQuoteReserve: 500n,
      virtualQuoteReserve: 250n,
      reservedTokens: 200n,
      remainingSellableTokens: 600n,
      readyToGraduate: false,
      graduated: true,
    }),
    readFeeEscrowState: async () => ({ totalOutstanding: 0n, custody: 0n }),
    readGraduationState: async () => ({
      phase: "POOL_CREATED",
      sweptTokenAmount: 200n,
      sweptUsdcAmount: 50n,
      poolId,
      positionId: 77n,
      positionLocked: true,
      tokenSupplyLocked: 180n,
      graduatedVenueKind: "UNISWAP_V3",
      graduatedVenueAddress: poolAddress,
      graduatedVenueFeeTier: 3000,
      graduatedVenueQuoteIsToken0: true,
      graduationCompletedBlock: 103n,
      graduationCompletedTransactionIndex: 2,
      graduationCompletedLogIndex: 7,
    }),
    readChainConfig: async () => ({
      chainId: context.chainId,
      quoteAsset: context.quoteAsset,
      quoteDecimals: context.quoteDecimals,
    }),
    getRuntimeCodeHash: async (target: string) =>
      runtimeHashes[target.toLowerCase()] ?? null,
    getBlockHash: async (blockNumber: bigint) =>
      blockNumber === 105n ? checkedBlockHash : launchBlockHash,
  };
}

async function reconcile(pool: TestPool): Promise<ReconciliationReport> {
  const dbModule = await import("../../packages/db/src/index.ts");
  const reconcileModule = await import("../../apps/indexer/src/reconcile.ts");
  return reconcileModule.reconcileStack({
    db: dbModule.createBreadDb(pool),
    context,
    checkedBlock: 105n,
    chain: authoritativeChain() as never,
  });
}

async function seedReconciledV3Launch(pool: TestPool): Promise<void> {
  await pool.query(
    `INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block,
       quote_asset, quote_decimals, addresses, runtime_code_hashes)
     VALUES ($1,$2,$3,'100',$4,6,$5::jsonb,$6::jsonb)`,
    [
      context.chainId,
      context.stackVersion,
      factory,
      quoteAsset,
      JSON.stringify({ factory, feeEscrow, coordinator, locker }),
      JSON.stringify({
        factory: hash("1"),
        feeEscrow: hash("2"),
        coordinator: hash("3"),
        locker: hash("4"),
      }),
    ],
  );
  await pool.query(
    `INSERT INTO launches
      (chain_id, token_address, curve_address, stack_version, factory_address,
       graduation_coordinator, reserved_tokens_baseline, launch_block_number,
       launch_transaction_hash, launch_log_index)
     VALUES ($1,$2,$3,$4,$5,$6,'200','100',$7,4)`,
    [
      context.chainId,
      token,
      curve,
      context.stackVersion,
      factory,
      coordinator,
      launchTx,
    ],
  );
  await pool.query(
    `INSERT INTO launch_state
      (chain_id, token_address, tracked_quote, tracked_tokens, quote_fee_balance,
       creator_tax_balance, real_quote_reserve, virtual_quote_reserve,
       remaining_sellable_tokens, ready_to_graduate, graduation_phase,
       swept_token_amount, swept_usdc_amount, pool_id, position_id,
       position_locked, token_supply_locked, graduated_venue_kind,
       graduated_venue_address, graduated_venue_fee_tier,
       graduated_venue_quote_is_token0, graduation_completed_block,
       graduation_completed_transaction_index, graduation_completed_log_index,
       latest_block_number, latest_transaction_hash, latest_log_index)
     VALUES ($1,$2,'500','800','0','0','500','250','600',false,
       'POOL_CREATED','200','50',$3,'77',true,'180','UNISWAP_V3',$4,3000,true,
       '103',2,7,'105',$5,2)`,
    [context.chainId, token, poolId, poolAddress, hash("e")],
  );
  await pool.query(
    `INSERT INTO event_journal
      (chain_id, transaction_hash, log_index, block_number, block_hash,
       block_timestamp, transaction_index, contract_address, contract_role,
       stack_version, token_address, curve_address, event_name, topic0,
       topics, data, payload)
     VALUES ($1,$2,4,'100',$3,'1786262400',1,$4,'FACTORY',$5,$6,$7,
       'LaunchCreated',$8,$9::jsonb,'0x','{}'::jsonb)`,
    [
      context.chainId,
      launchTx,
      launchBlockHash,
      factory,
      context.stackVersion,
      token,
      curve,
      topic0,
      JSON.stringify([topic0]),
    ],
  );
  await pool.query(
    `INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block,
       indexed_through_block, indexed_through_block_hash,
       indexed_through_block_timestamp, decoder_schema_version, status)
     VALUES ($1,$2,$3,'100','105',$4,'1786262405','day6-v1','COMMITTED')`,
    [context.chainId, context.stackVersion, factory, checkedBlockHash],
  );
}

describe.skipIf(!RUN_DB)("Day 9 REC-04 graduated V3 venue identity", () => {
  const schemaName = `day9_v3_rec04_${process.pid}`;
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
      `TRUNCATE event_journal, admin_events, holder_snapshots, creator_rollups,
       fee_claims, fee_credits, market_candles, token_metrics, trades,
       launch_state, metadata, launches, indexer_checkpoints, protocol_stacks CASCADE`,
    );
    await seedReconciledV3Launch(pool);
  });

  it("fails REC-04 for any projected V3 venue or completion identity mismatch", async () => {
    const baseline = await reconcile(pool);
    expect(baseline.status).toBe("PASS");
    expect(baseline.checks.find((item) => item.id === "REC-04")?.status).toBe(
      "PASS",
    );

    const mismatches: ReadonlyArray<readonly [string, unknown]> = [
      ["graduated_venue_kind", "BREAD_CURVE"],
      ["graduated_venue_address", wrongPoolAddress],
      ["graduated_venue_fee_tier", 500],
      ["graduated_venue_quote_is_token0", false],
      ["graduation_completed_block", "104"],
      ["graduation_completed_transaction_index", 9],
      ["graduation_completed_log_index", 9],
    ];

    for (const [column, value] of mismatches) {
      await seedReconciledV3Launch;
      await pool.query(
        `UPDATE launch_state SET ${column}=$1 WHERE chain_id=$2 AND token_address=$3`,
        [value, context.chainId, token],
      );
      const report = await reconcile(pool);
      expect(
        report.checks.find((item) => item.id === "REC-04")?.status,
        column,
      ).toBe("FAIL");
      await pool.query(
        `UPDATE launch_state SET
          graduated_venue_kind='UNISWAP_V3',
          graduated_venue_address=$1,
          graduated_venue_fee_tier=3000,
          graduated_venue_quote_is_token0=true,
          graduation_completed_block='103',
          graduation_completed_transaction_index=2,
          graduation_completed_log_index=7
         WHERE chain_id=$2 AND token_address=$3`,
        [poolAddress, context.chainId, token],
      );
    }
  });
});
