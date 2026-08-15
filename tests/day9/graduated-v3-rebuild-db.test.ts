import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ProtocolContext } from "../../packages/protocol-sdk/src/context.js";
import type { Address, Hex32 } from "../../packages/types/src/index.js";

const RUN_DB = process.env.BREAD_DB_INTEGRATION === "1";
const describeDb = RUN_DB ? describe : describe.skip;
const ZERO = `0x${"00".repeat(20)}` as Address;
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address("1");
const token = address("2");
const curve = address("3");
const deployer = address("4");
const creator = address("5");
const quoteAsset = address("6");
const coordinator = address("7");
const adapter = address("8");
const locker = address("9");
const feeEscrow = address("a");
const feePolicy = address("b");
const emergencyController = address("c");
const positionManager = address("d");
const dexFactory = address("e");
const poolAddress = address("f");
const trader = address("a");
const swapRecipient = address("b");
const protocolFeeRecipient = address("c");
const initialSupply = 1_000_000n;
const launchTx = hash("1");
const completionTx = hash("2");
const dustTx = hash("3");
const launchBlockHash = hash("4");
const completionBlockHash = hash("5");
const dustBlockHash = hash("6");
const economicsDigest = hash("7");
const graduationConfigHash = hash("8");
const topic0 = hash("9");
const poolId = `0x${"0".repeat(24)}${poolAddress.slice(2)}` as Hex32;

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-rebuild",
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer,
    feePolicy,
    feeEscrow,
    emergencyController,
    locker,
    coordinator,
    graduationAdapter: adapter,
  },
  graduatedTrading: {
    family: "UNISWAP_V3",
    factory: dexFactory,
    positionManager,
    swapRouter: address("1"),
    swapRouterKind: "V3_SWAP_ROUTER_02",
    quoter: address("2"),
    quoterKind: "V3_QUOTER_V2",
  },
};

type FixtureLog = Readonly<{
  address: Address;
  blockNumber: bigint;
  blockHash: Hex32;
  transactionHash: Hex32;
  transactionIndex: number;
  logIndex: number;
  eventName: string;
  args: Readonly<Record<string, unknown>>;
  topics: readonly Hex32[];
  data: `0x${string}`;
}>;

const launchLogs: readonly FixtureLog[] = [
  {
    address: token,
    blockNumber: 100n,
    blockHash: launchBlockHash,
    transactionHash: launchTx,
    transactionIndex: 1,
    logIndex: 0,
    eventName: "Transfer",
    args: { from: ZERO, to: curve, value: initialSupply },
    topics: [topic0],
    data: "0x",
  },
  {
    address: factory,
    blockNumber: 100n,
    blockHash: launchBlockHash,
    transactionHash: launchTx,
    transactionIndex: 1,
    logIndex: 4,
    eventName: "LaunchCreated",
    args: {
      deployer,
      token,
      curve,
      creatorFeeRecipient: creator,
      creatorTaxBps: 125n,
      economicsDigest,
      configVersion: 3n,
    },
    topics: [topic0],
    data: "0x",
  },
];

const completionLog: FixtureLog = {
  address: coordinator,
  blockNumber: 120n,
  blockHash: completionBlockHash,
  transactionHash: completionTx,
  transactionIndex: 3,
  logIndex: 5,
  eventName: "GraduationCompleted",
  args: {
    token,
    adapter,
    poolId,
    positionManager,
    positionId: 77n,
    usdcUsed: 500n,
    tokenUsed: 200n,
    tokenLocked: 190n,
    usdcDust: 0n,
  },
  topics: [topic0],
  data: "0x",
};

const pricedSwap: FixtureLog = {
  address: poolAddress,
  blockNumber: 120n,
  blockHash: completionBlockHash,
  transactionHash: completionTx,
  transactionIndex: 3,
  logIndex: 6,
  eventName: "Swap",
  args: {
    sender: address("3"),
    recipient: swapRecipient,
    amount0: 500n,
    amount1: -50n,
    sqrtPriceX96: 1n,
    liquidity: 10_000n,
    tick: 0,
  },
  topics: [topic0],
  data: "0x",
};

const dustSwap: FixtureLog = {
  address: poolAddress,
  blockNumber: 121n,
  blockHash: dustBlockHash,
  transactionHash: dustTx,
  transactionIndex: 0,
  logIndex: 1,
  eventName: "Swap",
  args: {
    sender: address("4"),
    recipient: swapRecipient,
    amount0: 1n,
    amount1: 0n,
    sqrtPriceX96: 1n,
    liquidity: 10_000n,
    tick: 0,
  },
  topics: [topic0],
  data: "0x",
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

function readClient() {
  return {
    readContract: async (request: Readonly<Record<string, unknown>>) => {
      const fn = String(request.functionName);
      const target = String(request.address).toLowerCase();
      if (target === factory && fn === "getLaunch") {
        return {
          token,
          curve,
          deployer,
          creatorFeeRecipient: creator,
          creatorTaxBps: 125,
          economicsDigest,
          launchTimestamp: 1_786_262_400,
          configVersion: 3,
          graduationCoordinator: coordinator,
          graduationAdapter: adapter,
          graduationAdapterFamily: 2,
          graduationConfigHash,
        };
      }
      if (target === factory && fn === "stackVersion")
        return context.stackVersion;
      if (target === curve) {
        const values: Record<string, unknown> = {
          token,
          pairToken: quoteAsset,
          phantomQuote: 250n,
          graduationThreshold: 9_000n,
          protocolFeeRecipient,
          tradeFeeBps: 100,
          protocolFeeShareBps: 7_500,
          maxCreatorTaxBps: 1_000,
          creatorTaxBps: 125,
          launchTimestamp: 1_786_262_400,
          reservedTokens: 200n,
          graduationCoordinator: coordinator,
        };
        if (fn in values) return values[fn];
      }
      if (target === token) {
        const values: Record<string, unknown> = {
          name: "V3 Rebuild Bread",
          symbol: "V3RB",
          curve,
          launchFactory: factory,
          deployer,
          logo: "ipfs://v3-rebuild",
          description: "Day 9 graduated V3 rebuild fixture",
          socials: ["", "", "", "", ""],
        };
        if (fn in values) return values[fn];
      }
      const v3Values: Record<string, unknown> = {
        [`${adapter}:family`]: 2n,
        [`${adapter}:coordinator`]: coordinator,
        [`${adapter}:configHash`]: graduationConfigHash,
        [`${adapter}:usdc`]: quoteAsset,
        [`${adapter}:positionManager`]: positionManager,
        [`${adapter}:v3Factory`]: dexFactory,
        [`${adapter}:fee`]: 3000n,
        [`${dexFactory}:getPool`]: poolAddress,
        [`${poolAddress}:token0`]: quoteAsset,
        [`${poolAddress}:token1`]: token,
        [`${poolAddress}:fee`]: 3000n,
      };
      const key = `${target}:${fn}`;
      if (key in v3Values) return v3Values[key];
      throw new Error(`unexpected read ${target}.${fn}`);
    },
    getLogs: async (request: Readonly<Record<string, unknown>>) => {
      const fromBlock = BigInt(String(request.fromBlock));
      const toBlock = BigInt(String(request.toBlock));
      const logs: FixtureLog[] = [];
      if (fromBlock <= 120n && toBlock >= 120n) logs.push(pricedSwap);
      if (fromBlock <= 121n && toBlock >= 121n) logs.push(dustSwap);
      return logs;
    },
    getTransaction: async (request: Readonly<{ hash: Hex32 }>) => {
      if (request.hash.toLowerCase() === dustTx.toLowerCase()) {
        throw new Error(
          "journal-only dust must not perform transaction lookup",
        );
      }
      if (request.hash.toLowerCase() !== completionTx.toLowerCase()) {
        throw new Error(`unexpected transaction lookup ${request.hash}`);
      }
      return { hash: completionTx, blockNumber: 120n, from: trader };
    },
    getBlock: async (request: Readonly<Record<string, unknown>>) => {
      const blockNumber = BigInt(String(request.blockNumber));
      return {
        timestamp: 1_786_262_400n + (blockNumber - 100n),
        hash:
          blockNumber === 100n
            ? launchBlockHash
            : blockNumber === 120n
              ? completionBlockHash
              : dustBlockHash,
      };
    },
  };
}

function runtimeHashes(): Record<string, Hex32> {
  return {
    factory: hash("a"),
    deployer: hash("b"),
    feePolicy: hash("c"),
    feeEscrow: hash("d"),
    emergencyController: hash("e"),
    locker: hash("f"),
    coordinator: hash("1"),
    graduationAdapter: hash("2"),
  };
}

function chainReader() {
  const byAddress = new Map<string, Hex32>([
    [factory, hash("a")],
    [deployer, hash("b")],
    [feePolicy, hash("c")],
    [feeEscrow, hash("d")],
    [emergencyController, hash("e")],
    [locker, hash("f")],
    [coordinator, hash("1")],
    [adapter, hash("2")],
  ]);
  return {
    countLaunchCreated: async () => 1n,
    scanLaunchCreated: async () => [
      { transactionHash: launchTx, logIndex: 4, tokenAddress: token },
    ],
    scanCanonicalEventIdentities: async () => [
      { transactionHash: launchTx, logIndex: 0 },
      { transactionHash: launchTx, logIndex: 4 },
      { transactionHash: completionTx, logIndex: 5 },
      { transactionHash: completionTx, logIndex: 6 },
      { transactionHash: dustTx, logIndex: 1 },
    ],
    readCurveState: async () => ({
      trackedQuote: 0n,
      trackedTokens: initialSupply,
      quoteFeeBalance: 0n,
      creatorTaxBalance: 0n,
      realQuoteReserve: 0n,
      virtualQuoteReserve: 250n,
      reservedTokens: 200n,
      remainingSellableTokens: initialSupply - 200n,
      readyToGraduate: false,
      graduated: true,
    }),
    readFeeEscrowState: async () => ({ totalOutstanding: 0n, custody: 0n }),
    readGraduationState: async () => ({
      phase: "POOL_CREATED",
      sweptTokenAmount: 0n,
      sweptUsdcAmount: 0n,
      poolId,
      positionId: 77n,
      positionLocked: false,
      tokenSupplyLocked: 0n,
      graduatedVenueKind: "UNISWAP_V3",
      graduatedVenueAddress: poolAddress,
      graduatedVenueFeeTier: 3000,
      graduatedVenueQuoteIsToken0: true,
      graduationCompletedBlock: 120n,
      graduationCompletedTransactionIndex: 3,
      graduationCompletedLogIndex: 5,
    }),
    readChainConfig: async () => ({
      chainId: context.chainId,
      quoteAsset,
      quoteDecimals: context.quoteDecimals,
    }),
    getRuntimeCodeHash: async (target: string) =>
      byAddress.get(target.toLowerCase()) ?? null,
    getBlockHash: async (blockNumber: bigint) =>
      blockNumber === 121n ? dustBlockHash : launchBlockHash,
  };
}

async function seedStackRegistry(pool: TestPool): Promise<void> {
  await pool.query(
    `INSERT INTO protocol_stacks (
      chain_id, stack_version, factory_address, deployment_start_block,
      quote_asset, quote_decimals, addresses, runtime_code_hashes
    ) VALUES ($1,$2,$3,'100',$4,6,$5::jsonb,$6::jsonb)`,
    [
      context.chainId,
      context.stackVersion,
      factory,
      quoteAsset,
      JSON.stringify(context.addresses),
      JSON.stringify(runtimeHashes()),
    ],
  );
}

async function digestV3Projection(pool: TestPool): Promise<string> {
  const result = await pool.query(
    `SELECT md5(jsonb_build_object(
      'state', COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'updated_at' ORDER BY token_address)
        FROM launch_state s WHERE chain_id=$1), '[]'::jsonb),
      'trades', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY block_number, transaction_index, log_index)
        FROM trades t WHERE chain_id=$1), '[]'::jsonb),
      'journal', COALESCE((SELECT jsonb_agg(to_jsonb(j) - 'inserted_at' ORDER BY block_number, transaction_index, log_index)
        FROM event_journal j WHERE chain_id=$1 AND stack_version=$2), '[]'::jsonb),
      'checkpoint', COALESCE((SELECT to_jsonb(c) - 'created_at' - 'updated_at' - 'applied_at'
        FROM indexer_checkpoints c WHERE chain_id=$1 AND stack_version=$2 AND factory_address=$3), '{}'::jsonb)
    )::text) AS digest`,
    [context.chainId, context.stackVersion, factory],
  );
  return String(result.rows[0]?.digest);
}

describeDb("Day 9 graduated V3 deterministic rebuild", () => {
  const schemaName = `day9_v3_rebuild_${process.pid}`;
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
    await seedStackRegistry(pool);
  });

  it("rebuilds verified V3 venue, priced trade and dust journal deterministically and reconciles them", async () => {
    const dbModule = await import("../../packages/db/src/index.ts");
    const reconcileModule = await import("../../apps/indexer/src/reconcile.ts");
    const db = dbModule.createBreadDb(pool);
    const client = readClient();

    const rebuild = () =>
      reconcileModule.rebuildStack({
        db,
        client: client as never,
        context,
        targetBlock: 121n,
        batchSize: 21n,
        loadRange: async (fromBlock: bigint, toBlock: bigint) => ({
          fromBlock,
          toBlock,
          toBlockHash: toBlock === 120n ? completionBlockHash : dustBlockHash,
          toBlockTimestamp: 1_786_262_400n + (toBlock - 100n),
          logs: fromBlock === 100n ? [...launchLogs, completionLog] : [],
        }),
        verifyRebuildTarget: async () => ({
          targetMode: "LOCAL_TEST" as const,
          targetIdentity: `${schemaName}:graduated-v3`,
        }),
        chain: chainReader(),
      });

    const first = await rebuild();
    expect(first.reconciliation.status).toBe("PASS");
    expect(
      first.reconciliation.checks.find((check) => check.id === "REC-04")
        ?.status,
    ).toBe("PASS");
    expect(
      first.reconciliation.checks.find((check) => check.id === "REC-06")
        ?.status,
    ).toBe("PASS");

    const state = (
      await pool.query(
        `SELECT graduated_venue_kind, graduated_venue_address,
                graduated_venue_fee_tier, graduated_venue_quote_is_token0,
                graduation_completed_block::text AS completion_block,
                graduation_completed_transaction_index AS completion_transaction_index,
                graduation_completed_log_index AS completion_log_index
         FROM launch_state WHERE chain_id=$1 AND token_address=$2`,
        [context.chainId, token],
      )
    ).rows[0];
    expect(state).toMatchObject({
      graduated_venue_kind: "UNISWAP_V3",
      graduated_venue_address: poolAddress,
      graduated_venue_fee_tier: 3000,
      graduated_venue_quote_is_token0: true,
      completion_block: "120",
      completion_transaction_index: 3,
      completion_log_index: 5,
    });

    const v3Journal = (
      await pool.query(
        `SELECT transaction_hash, log_index
         FROM event_journal
         WHERE chain_id=$1 AND contract_role='V3_POOL' AND event_name='Swap'
         ORDER BY block_number, transaction_index, log_index`,
        [context.chainId],
      )
    ).rows;
    expect(v3Journal).toEqual([
      { transaction_hash: completionTx, log_index: 6 },
      { transaction_hash: dustTx, log_index: 1 },
    ]);

    const v3Trades = (
      await pool.query(
        `SELECT transaction_hash, log_index, venue_kind, venue_address,
                side, base_amount::text AS base_amount,
                quote_amount::text AS quote_amount
         FROM trades WHERE chain_id=$1 AND venue_kind='UNISWAP_V3'`,
        [context.chainId],
      )
    ).rows;
    expect(v3Trades).toEqual([
      expect.objectContaining({
        transaction_hash: completionTx,
        log_index: 6,
        venue_kind: "UNISWAP_V3",
        venue_address: poolAddress,
        side: "BUY",
        base_amount: "50",
        quote_amount: "500",
      }),
    ]);

    const firstDigest = await digestV3Projection(pool);
    const second = await rebuild();
    expect(second.reconciliation.status).toBe("PASS");
    expect(await digestV3Projection(pool)).toBe(firstDigest);
  });
});
