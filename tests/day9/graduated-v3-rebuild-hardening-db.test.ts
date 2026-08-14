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
const conflictingPool = address("0");
const trader = address("a");
const swapRecipient = address("b");
const protocolFeeRecipient = address("c");
const initialSupply = 1_000_000n;
const launchTx = hash("1");
const completionTx = hash("2");
const launchBlockHash = hash("3");
const completionBlockHash = hash("4");
const economicsDigest = hash("5");
const graduationConfigHash = hash("6");
const topic0 = hash("7");
const poolId = `0x${"0".repeat(24)}${poolAddress.slice(2)}` as Hex32;
const blockTimestamp = 1_786_262_420n;

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-rebuild-hardening",
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

function swapLog(amount0: bigint, amount1: bigint): FixtureLog {
  return {
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
      amount0,
      amount1,
      sqrtPriceX96: 1n,
      liquidity: 10_000n,
      tick: 0,
    },
    topics: [topic0],
    data: "0x",
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

function readClient(input: Readonly<{ malformedSwap?: boolean; conflictingPool?: boolean }> = {}) {
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
      if (target === factory && fn === "stackVersion") return context.stackVersion;
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
          name: "V3 Rebuild Hardening",
          symbol: "V3RH",
          curve,
          launchFactory: factory,
          deployer,
          logo: "ipfs://v3-rebuild-hardening",
          description: "Day 9 V3 rebuild hardening fixture",
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
        [`${dexFactory}:getPool`]: input.conflictingPool ? conflictingPool : poolAddress,
        [`${poolAddress}:token0`]: quoteAsset,
        [`${poolAddress}:token1`]: token,
        [`${poolAddress}:fee`]: 3000n,
      };
      const key = `${target}:${fn}`;
      if (key in v3Values) return v3Values[key];
      throw new Error(`unexpected read ${target}.${fn}`);
    },
    getLogs: async () => [input.malformedSwap ? swapLog(1n, 1n) : swapLog(500n, -50n)],
    getTransaction: async () => ({
      hash: completionTx,
      blockNumber: 120n,
      from: trader,
    }),
    getBlock: async () => ({
      timestamp: blockTimestamp,
      hash: completionBlockHash,
    }),
  };
}

function chainReader() {
  const codeHashes = new Map<string, Hex32>([
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
      codeHashes.get(target.toLowerCase()) ?? null,
    getBlockHash: async () => completionBlockHash,
  };
}

async function marketDigest(pool: TestPool): Promise<string> {
  const result = await pool.query(
    `SELECT md5(jsonb_build_object(
      'candles', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY interval, bucket_start)
        FROM market_candles c WHERE chain_id=$1 AND token_address=$2), '[]'::jsonb),
      'metrics', COALESCE((SELECT jsonb_agg(to_jsonb(m) - 'updated_at' ORDER BY token_address)
        FROM token_metrics m WHERE chain_id=$1 AND token_address=$2), '[]'::jsonb)
    )::text) AS digest`,
    [context.chainId, token],
  );
  return String(result.rows[0]?.digest);
}

async function selectedReadModelCounts(pool: TestPool) {
  return (
    await pool.query(
      `SELECT
        (SELECT count(*)::int FROM launches WHERE chain_id=$1 AND stack_version=$2 AND factory_address=$3) AS launches,
        (SELECT count(*)::int FROM launch_state WHERE chain_id=$1 AND token_address=$4) AS state,
        (SELECT count(*)::int FROM event_journal WHERE chain_id=$1 AND stack_version=$2) AS journal,
        (SELECT count(*)::int FROM trades WHERE chain_id=$1 AND token_address=$4) AS trades,
        (SELECT count(*)::int FROM market_candles WHERE chain_id=$1 AND token_address=$4) AS candles,
        (SELECT count(*)::int FROM token_metrics WHERE chain_id=$1 AND token_address=$4) AS metrics,
        (SELECT count(*)::int FROM indexer_checkpoints WHERE chain_id=$1 AND stack_version=$2 AND factory_address=$3) AS checkpoints`,
      [context.chainId, context.stackVersion, factory, token],
    )
  ).rows[0];
}

describeDb("Day 9 graduated V3 rebuild hardening", () => {
  const schemaName = `day9_v3_rebuild_hardening_${process.pid}`;
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

  async function rebuild(client: ReturnType<typeof readClient>) {
    const dbModule = await import("../../packages/db/src/index.ts");
    const reconcileModule = await import("../../apps/indexer/src/reconcile.ts");
    return reconcileModule.rebuildStack({
      db: dbModule.createBreadDb(pool),
      client: client as never,
      context,
      targetBlock: 120n,
      batchSize: 21n,
      loadRange: async (fromBlock: bigint, toBlock: bigint) => ({
        fromBlock,
        toBlock,
        toBlockHash: completionBlockHash,
        toBlockTimestamp: blockTimestamp,
        logs: [...launchLogs, completionLog],
      }),
      verifyRebuildTarget: async () => ({
        targetMode: "LOCAL_TEST" as const,
        targetIdentity: `${schemaName}:v3-rebuild-hardening`,
      }),
      chain: chainReader(),
    });
  }

  it("rebuilds V3 candles and token metrics deterministically through production applyRange", async () => {
    const first = await rebuild(readClient());
    expect(first.reconciliation.status).toBe("PASS");

    const counts = await selectedReadModelCounts(pool);
    expect(counts.candles).toBeGreaterThan(0);
    expect(counts.metrics).toBe(1);
    const firstDigest = await marketDigest(pool);

    const second = await rebuild(readClient());
    expect(second.reconciliation.status).toBe("PASS");
    expect(await marketDigest(pool)).toBe(firstDigest);
  });

  it.each([
    ["malformed same-sign Swap", { malformedSwap: true }],
    ["conflicting factory pool identity", { conflictingPool: true }],
  ])("aborts %s before any selected range state is committed", async (_label, options) => {
    await expect(rebuild(readClient(options))).rejects.toThrow();
    expect(await selectedReadModelCounts(pool)).toMatchObject({
      launches: 0,
      state: 0,
      journal: 0,
      trades: 0,
      candles: 0,
      metrics: 0,
      checkpoints: 0,
    });
  });
});
