import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const RUN_DB = process.env.BREAD_DB_INTEGRATION === "1";
const address = (nibble: string) => `0x${nibble.repeat(40)}`;
const hash = (nibble: string) => `0x${nibble.repeat(64)}`;

const chainId = 5_042_002;
const stackVersion = "day9-v3-graduation-persistence-red";
const factory = address("1");
const token = address("2");
const curve = address("3");
const coordinator = address("4");
const adapter = address("5");
const positionManager = address("6");
const poolAddress = address("7");
const transactionHash = hash("a");
const poolId = `0x${"0".repeat(24)}${poolAddress.slice(2)}`;

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
  quoteAsset: address("8"),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    coordinator,
    graduationAdapter: adapter,
  },
} as const;

function graduationCompletedEvent() {
  return {
    identity: { chainId, transactionHash, logIndex: 7 },
    blockNumber: 105n,
    blockHash: hash("b"),
    blockTimestamp: 1_786_262_465n,
    transactionIndex: 4,
    contractAddress: coordinator,
    contractRole: "GRADUATION_COORDINATOR",
    stackVersion,
    topic0: hash("c"),
    topics: [hash("c")],
    data: "0x",
    eventName: "GraduationCompleted",
    payload: {
      token,
      adapter,
      poolId,
      positionManager,
      positionId: 77n,
      usdcUsed: 490n,
      tokenUsed: 190n,
      tokenLocked: 180n,
      usdcDust: 10n,
    },
  } as const;
}

function verifiedVenue(transactionIndex = 4) {
  return {
    venueKind: "UNISWAP_V3",
    chainId,
    tokenAddress: token,
    poolAddress,
    feeTier: 3000,
    completion: {
      blockNumber: 105n,
      transactionIndex,
      logIndex: 7,
    },
  } as const;
}

describe.skipIf(!RUN_DB)(
  "Day 9 verified graduated V3 venue PostgreSQL persistence",
  () => {
    const schemaName = `day9_v3_graduation_${process.pid}`;
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
      await pool.query("TRUNCATE launch_state, launches CASCADE");
      await pool.query(
        `INSERT INTO launches (
          chain_id, token_address, curve_address, stack_version, factory_address,
          graduation_coordinator, graduation_adapter,
          initial_supply, phantom_quote, reserved_tokens_baseline,
          launch_block_number, launch_transaction_hash, launch_log_index
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'1000','100','0','100',$8,0)`,
        [
          chainId,
          token,
          curve,
          stackVersion,
          factory,
          coordinator,
          adapter,
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

    it("atomically stores the already-verified V3 venue tuple and exact completion position", async () => {
      const dbModule = await import("../../packages/db/src/index.ts");
      const db = dbModule.createBreadDb(pool);
      const projection = dbModule.applyFeeAdminGraduationProjection as unknown as (
        db: unknown,
        event: unknown,
        context: unknown,
        verifiedVenue?: unknown,
      ) => Promise<void>;

      await projection(
        db,
        graduationCompletedEvent(),
        context,
        verifiedVenue(),
      );

      const result = await pool.query(
        `SELECT
          graduation_phase,
          pool_id,
          graduated_venue_kind,
          graduated_venue_address,
          graduated_venue_fee_tier,
          graduation_completed_block::text,
          graduation_completed_transaction_index,
          graduation_completed_log_index
        FROM launch_state
        WHERE chain_id = $1 AND token_address = $2`,
        [chainId, token],
      );

      expect(result.rows).toEqual([
        {
          graduation_phase: "POOL_CREATED",
          pool_id: poolId,
          graduated_venue_kind: "UNISWAP_V3",
          graduated_venue_address: poolAddress,
          graduated_venue_fee_tier: 3000,
          graduation_completed_block: "105",
          graduation_completed_transaction_index: 4,
          graduation_completed_log_index: 7,
        },
      ]);
    });

    it("fails closed before persistence when the verified completion position does not match the event", async () => {
      const dbModule = await import("../../packages/db/src/index.ts");
      const db = dbModule.createBreadDb(pool);
      const projection = dbModule.applyFeeAdminGraduationProjection as unknown as (
        db: unknown,
        event: unknown,
        context: unknown,
        verifiedVenue?: unknown,
      ) => Promise<void>;

      await expect(
        projection(
          db,
          graduationCompletedEvent(),
          context,
          verifiedVenue(9),
        ),
      ).rejects.toThrow("verified graduated venue identity mismatch");

      const result = await pool.query(
        `SELECT count(*)::int AS count FROM launch_state
         WHERE chain_id = $1 AND token_address = $2`,
        [chainId, token],
      );
      expect(result.rows).toEqual([{ count: 0 }]);
    });
  },
);
