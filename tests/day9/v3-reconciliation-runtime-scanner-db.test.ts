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
const quoteAsset = address("4");
const coordinator = address("5");
const poolAddress = address("6");
const user = address("7");
const launchTx = hash("1");
const completionTx = hash("2");
const dustTx = hash("3");
const transferTx = hash("4");
const block110Hash = hash("a");
const block111Hash = hash("b");
const block112Hash = hash("c");
const topic0 = hash("d");

const context: ProtocolContext = {
  network: "arc-testnet",
  chainId: 5_042_002,
  stackVersion: "day9-v3-reconciliation-scanner",
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
    coordinator,
    locker: address("c"),
    graduationAdapter: address("d"),
  },
  graduatedTrading: {
    family: "UNISWAP_V3",
    factory: address("e"),
    positionManager: address("f"),
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

const completionLog: FixtureLog = {
  address: coordinator,
  blockNumber: 110n,
  blockHash: block110Hash,
  transactionHash: completionTx,
  transactionIndex: 1,
  logIndex: 5,
  eventName: "GraduationCompleted",
  args: {
    token,
    adapter: context.addresses.graduationAdapter,
    poolId: `0x${"0".repeat(24)}${poolAddress.slice(2)}`,
    positionManager: context.graduatedTrading?.positionManager,
    positionId: 77n,
    usdcUsed: 500n,
    tokenUsed: 200n,
    tokenLocked: 190n,
    usdcDust: 0n,
  },
  topics: [topic0],
  data: "0x",
};

const transferLog: FixtureLog = {
  address: token,
  blockNumber: 112n,
  blockHash: block112Hash,
  transactionHash: transferTx,
  transactionIndex: 0,
  logIndex: 0,
  eventName: "Transfer",
  args: { from: curve, to: user, value: 1n },
  topics: [topic0],
  data: "0x",
};

const preCompletionSwap: FixtureLog = {
  address: poolAddress,
  blockNumber: 110n,
  blockHash: block110Hash,
  transactionHash: completionTx,
  transactionIndex: 1,
  logIndex: 4,
  eventName: "Swap",
  args: {},
  topics: [topic0],
  data: "0x",
};

const pricedSwap: FixtureLog = {
  address: poolAddress,
  blockNumber: 110n,
  blockHash: block110Hash,
  transactionHash: completionTx,
  transactionIndex: 1,
  logIndex: 6,
  eventName: "Swap",
  args: {},
  topics: [topic0],
  data: "0x",
};

const dustSwap: FixtureLog = {
  address: poolAddress,
  blockNumber: 111n,
  blockHash: block111Hash,
  transactionHash: dustTx,
  transactionIndex: 0,
  logIndex: 1,
  eventName: "Swap",
  args: {},
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

async function seedGraduatedLaunch(pool: TestPool): Promise<void> {
  await pool.query(
    `INSERT INTO launches (
      chain_id, token_address, curve_address, stack_version, factory_address,
      graduation_coordinator, launch_block_number, launch_transaction_hash,
      launch_log_index
    ) VALUES ($1,$2,$3,$4,$5,$6,'100',$7,4)`,
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
    `INSERT INTO launch_state (
      chain_id, token_address, graduation_phase, pool_id,
      graduated_venue_kind, graduated_venue_address,
      graduated_venue_fee_tier, graduated_venue_quote_is_token0,
      graduation_completed_block, graduation_completed_transaction_index,
      graduation_completed_log_index, latest_block_number,
      latest_transaction_hash, latest_log_index
    ) VALUES ($1,$2,'POOL_CREATED',$3,'UNISWAP_V3',$4,3000,true,
      '110',1,5,'112',$5,0)`,
    [
      context.chainId,
      token,
      `0x${"0".repeat(24)}${poolAddress.slice(2)}`,
      poolAddress,
      transferTx,
    ],
  );
}

describeDb("Day 9 REC-06 runtime canonical event scanner", () => {
  const schemaName = `day9_v3_rec06_runtime_${process.pid}`;
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
    await seedGraduatedLaunch(pool);
  });

  it("scans canonical Bread events plus exact post-completion V3 Swap identities including dust", async () => {
    const dbModule = await import("../../packages/db/src/index.ts");
    const indexerModule = (await import(
      "../../apps/indexer/src/index.ts"
    )) as Readonly<Record<string, unknown>>;
    const createScanner = indexerModule.createReconciliationCanonicalEventScanner;
    expect(createScanner).toBeTypeOf("function");
    if (typeof createScanner !== "function") return;

    const requests: Array<Readonly<Record<string, unknown>>> = [];
    const client = {
      readContract: async () => {
        throw new Error("scanner must not re-verify persisted V3 identity");
      },
      getBlock: async (request: Readonly<Record<string, unknown>>) => ({
        timestamp: 1_786_262_400n + BigInt(String(request.blockNumber)),
      }),
      getLogs: async (request: Readonly<Record<string, unknown>>) => {
        requests.push(request);
        const values = Array.isArray(request.address)
          ? request.address.map((value) => String(value).toLowerCase())
          : [String(request.address).toLowerCase()];
        if (values.includes(poolAddress)) {
          return [preCompletionSwap, pricedSwap, dustSwap];
        }
        const logs: FixtureLog[] = [];
        if (values.includes(coordinator)) logs.push(completionLog);
        if (values.includes(token)) logs.push(transferLog);
        return logs;
      },
    };

    const scanner = (
      createScanner as (input: Readonly<Record<string, unknown>>) => (
        fromBlock: bigint,
        toBlock: bigint,
      ) => Promise<readonly Readonly<{ transactionHash: string; logIndex: number }>[]>
    )({
      db: dbModule.createBreadDb(pool),
      client,
      context,
    });

    const identities = await scanner(110n, 120n);
    expect(identities).toEqual([
      { transactionHash: completionTx, logIndex: 5 },
      { transactionHash: completionTx, logIndex: 6 },
      { transactionHash: dustTx, logIndex: 1 },
      { transactionHash: transferTx, logIndex: 0 },
    ]);
    expect(
      requests.some(
        (request) =>
          Array.isArray(request.address) &&
          request.address.length === 1 &&
          String(request.address[0]).toLowerCase() === poolAddress,
      ),
    ).toBe(true);
    expect(
      identities.some(
        (identity) =>
          identity.transactionHash === completionTx && identity.logIndex === 4,
      ),
    ).toBe(false);
  });
});
