import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ProtocolContext } from "../../packages/protocol-sdk/src/context.js";

const RUN_DB = process.env.BREAD_DB_INTEGRATION === "1";
const describeDb = RUN_DB ? describe : describe.skip;
const address = (value: number) =>
  `0x${value.toString(16).padStart(40, "0")}`;
const hash = (value: number) =>
  `0x${value.toString(16).padStart(64, "0")}`;

const factory = address(1);
const quoteAsset = address(2);
const token = address(10);
const curve = address(11);
const poolAddress = address(12);
const conflictingPoolAddress = address(13);

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-reconcile",
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address(3),
    feePolicy: address(4),
    feeEscrow: address(5),
    emergencyController: address(6),
    locker: address(7),
    coordinator: address(8),
    graduationAdapter: address(9),
  },
  graduatedTrading: {
    family: "UNISWAP_V3",
    factory: address(20),
    positionManager: address(21),
    swapRouter: address(22),
    swapRouterKind: "V3_SWAP_ROUTER_02",
    quoter: address(23),
    quoterKind: "V3_QUOTER_V2",
  },
};

const launchTransactionHash = hash(100);
const swapTransactionHash = hash(104);
const checkpointHash = hash(105);

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

const runtimeHashes = {
  factory: hash(1),
  deployer: hash(3),
  feePolicy: hash(4),
  feeEscrow: hash(5),
  emergencyController: hash(6),
  locker: hash(7),
  coordinator: hash(8),
  graduationAdapter: hash(9),
};

function chainReader(input?: Readonly<{ venueAddress?: string; includeSwap?: boolean }>) {
  const venueAddress = input?.venueAddress ?? poolAddress;
  const includeSwap = input?.includeSwap ?? true;
  const runtimeByAddress: Record<string, string> = {
    [context.addresses.factory.toLowerCase()]: runtimeHashes.factory,
    [context.addresses.deployer!.toLowerCase()]: runtimeHashes.deployer,
    [context.addresses.feePolicy!.toLowerCase()]: runtimeHashes.feePolicy,
    [context.addresses.feeEscrow!.toLowerCase()]: runtimeHashes.feeEscrow,
    [context.addresses.emergencyController!.toLowerCase()]:
      runtimeHashes.emergencyController,
    [context.addresses.locker!.toLowerCase()]: runtimeHashes.locker,
    [context.addresses.coordinator!.toLowerCase()]: runtimeHashes.coordinator,
    [context.addresses.graduationAdapter!.toLowerCase()]:
      runtimeHashes.graduationAdapter,
  };

  return {
    countLaunchCreated: async () => 1n,
    scanLaunchCreated: async () => [
      {
        transactionHash: launchTransactionHash,
        logIndex: 1,
        tokenAddress: token,
      },
    ],
    scanCanonicalEventIdentities: async () => [
      { transactionHash: launchTransactionHash, logIndex: 1 },
      ...(includeSwap
        ? [{ transactionHash: swapTransactionHash, logIndex: 3 }]
        : []),
    ],
    readCurveState: async () => ({
      trackedQuote: 500n,
      trackedTokens: 800n,
      quoteFeeBalance: 0n,
      creatorTaxBalance: 0n,
      realQuoteReserve: 500n,
      virtualQuoteReserve: 750n,
      reservedTokens: 100n,
      remainingSellableTokens: 700n,
      readyToGraduate: false,
      graduated: true,
    }),
    readFeeEscrowState: async () => ({ totalOutstanding: 0n, custody: 0n }),
    readGraduationState: async () => ({
      phase: "POOL_CREATED",
      sweptTokenAmount: 100n,
      sweptUsdcAmount: 50n,
      poolId: null,
      positionId: 77n,
      positionLocked: true,
      tokenSupplyLocked: 100n,
      venueKind: "UNISWAP_V3",
      venueAddress,
      venueFeeTier: 3000,
      quoteIsToken0: true,
    }),
    getRuntimeCodeHash: async (target: string) =>
      runtimeByAddress[target.toLowerCase()] ?? null,
    getBlockHash: async (blockNumber: bigint) =>
      blockNumber === 105n ? checkpointHash : hash(Number(blockNumber)),
    readChainConfig: async () => ({
      chainId: context.chainId,
      quoteAsset: context.quoteAsset,
      quoteDecimals: context.quoteDecimals,
    }),
  };
}

async function seedStack(pool: TestPool): Promise<void> {
  await pool.query(
    `INSERT INTO protocol_stacks (
      chain_id, stack_version, factory_address, deployment_start_block,
      quote_asset, quote_decimals, manifest_hash, source_hash, addresses,
      runtime_code_hashes
    ) VALUES ($1,$2,$3,'100',$4,6,$5,$6,$7::jsonb,$8::jsonb)`,
    [
      context.chainId,
      context.stackVersion,
      context.factoryAddress,
      context.quoteAsset,
      hash(200),
      hash(201),
      JSON.stringify(context.addresses),
      JSON.stringify(runtimeHashes),
    ],
  );
  await pool.query(
    `INSERT INTO launches (
      chain_id, token_address, curve_address, stack_version, factory_address,
      quote_asset, graduation_coordinator, graduation_adapter,
      graduation_adapter_family, graduation_config_hash,
      reserved_tokens_baseline, launch_block_number,
      launch_transaction_hash, launch_log_index
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,2,$9,'100','100',$10,1)`,
    [
      context.chainId,
      token,
      curve,
      context.stackVersion,
      factory,
      quoteAsset,
      context.addresses.coordinator,
      context.addresses.graduationAdapter,
      hash(202),
      launchTransactionHash,
    ],
  );
  await pool.query(
    `INSERT INTO launch_state (
      chain_id, token_address, tracked_quote, tracked_tokens,
      quote_fee_balance, creator_tax_balance, real_quote_reserve,
      virtual_quote_reserve, remaining_sellable_tokens, ready_to_graduate,
      graduation_phase, swept_token_amount, swept_usdc_amount, pool_id,
      position_id, position_locked, token_supply_locked,
      graduated_venue_kind, graduated_venue_address,
      graduated_venue_fee_tier, graduated_venue_quote_is_token0,
      graduation_completed_block, graduation_completed_transaction_index,
      graduation_completed_log_index, latest_block_number,
      latest_transaction_hash, latest_log_index
    ) VALUES (
      $1,$2,'500','800','0','0','500','750','700',false,
      'POOL_CREATED','100','50',NULL,'77',true,'100',
      'UNISWAP_V3',$3,3000,true,'103',1,5,'104',$4,3
    )`,
    [context.chainId, token, poolAddress, swapTransactionHash],
  );
  await pool.query(
    `INSERT INTO indexer_checkpoints (
      chain_id, stack_version, factory_address, deployment_start_block,
      indexed_through_block, indexed_through_block_hash,
      indexed_through_block_timestamp, decoder_schema_version, status
    ) VALUES ($1,$2,$3,'100','105',$4,'1786262405','day6-v1','COMMITTED')`,
    [context.chainId, context.stackVersion, factory, checkpointHash],
  );
  await pool.query(
    `INSERT INTO event_journal (
      chain_id, transaction_hash, log_index, block_number, block_hash,
      block_timestamp, transaction_index, contract_address, contract_role,
      stack_version, topic0, topics, data, event_name, payload,
      token_address, curve_address
    ) VALUES (
      $1,$2,1,'100',$3,'1786262400',0,$4,'FACTORY',$5,$6,$7::jsonb,
      '0x','LaunchCreated','{}'::jsonb,$8,$9
    )`,
    [
      context.chainId,
      launchTransactionHash,
      hash(100),
      factory,
      context.stackVersion,
      hash(900),
      JSON.stringify([hash(900)]),
      token,
      curve,
    ],
  );
  await pool.query(
    `INSERT INTO event_journal (
      chain_id, transaction_hash, log_index, block_number, block_hash,
      block_timestamp, transaction_index, contract_address, contract_role,
      stack_version, topic0, topics, data, event_name, payload,
      token_address, curve_address
    ) VALUES (
      $1,$2,3,'104',$3,'1786262404',1,$4,'V3_POOL',$5,$6,$7::jsonb,
      '0x','Swap','{}'::jsonb,$8,$9
    )`,
    [
      context.chainId,
      swapTransactionHash,
      hash(104),
      poolAddress,
      context.stackVersion,
      hash(901),
      JSON.stringify([hash(901)]),
      token,
      curve,
    ],
  );
}

describeDb("Day 9 graduated V3 reconciliation continuity", () => {
  const schemaName = `day9_v3_reconcile_${process.pid}`;
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
      `TRUNCATE event_journal, admin_events, holder_snapshots,
       creator_rollups, fee_claims, fee_credits, market_candles,
       token_metrics, trades, launch_state, metadata, launches,
       indexer_checkpoints, protocol_stacks CASCADE`,
    );
    await seedStack(pool);
  });

  async function reconcile(reader: ReturnType<typeof chainReader>) {
    const dbModule = await import("../../packages/db/src/index.ts");
    const module = await import("../../apps/indexer/src/reconcile.ts");
    return module.reconcileStack({
      db: dbModule.createBreadDb(pool),
      context,
      checkedBlock: 105n,
      chain: reader as never,
    });
  }

  it("REC-04 fails closed when authoritative V3 venue identity disagrees with the projected venue", async () => {
    const report = await reconcile(
      chainReader({ venueAddress: conflictingPoolAddress }),
    );
    expect(report.checks.find((check) => check.id === "REC-04")?.status).toBe(
      "FAIL",
    );
  });

  it("REC-06 includes retained V3 Swap journal identity, including journal-only dust evidence", async () => {
    const passing = await reconcile(chainReader());
    expect(
      passing.checks.find((check) => check.id === "REC-06")?.status,
    ).toBe("PASS");

    const missingSwap = await reconcile(chainReader({ includeSwap: false }));
    expect(
      missingSwap.checks.find((check) => check.id === "REC-06")?.status,
    ).toBe("FAIL");
  });
});
