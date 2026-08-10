import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

import { createBreadApi } from '../../apps/api/src/server.js';
import {
  createBreadDb,
  migrateBreadDb,
  type BreadPgPool,
} from '../../packages/db/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'day8-load-test-only',
  factoryAddress: address(1),
  quoteAsset: address(2),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory: address(1),
    deployer: address(3),
    feePolicy: address(4),
    feeEscrow: address(5),
    emergencyController: address(6),
    locker: address(7),
    coordinator: address(8),
    graduationAdapter: address(9),
  },
};

const HOT_TOKEN = address(10);
const HOT_CURVE = address(20);
const port = Number(process.env.BREAD_DAY8_SERVER_PORT ?? '3108');
const schemaName = process.env.BREAD_DAY8_SCHEMA ?? `day8_load_${process.pid}`;
const databaseUrl = process.env.BREAD_DATABASE_URL ?? 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread';
const redisUrl = process.env.BREAD_REDIS_URL ?? 'redis://127.0.0.1:6379';
const headReadsFile = process.env.BREAD_DAY8_HEAD_READS_FILE ?? '/tmp/bread-day8-head-reads';

const requireDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireDb('pg') as {
  Pool: new (config: Record<string, unknown>) => BreadPgPool & { end(): Promise<void> };
};
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { createClient } = requireApi('redis') as {
  createClient: (input: { url: string }) => {
    connect(): Promise<void>;
    quit(): Promise<void>;
    flushDb(): Promise<unknown>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
    incr(key: string): Promise<number>;
    eval(script: string, input: { keys: readonly string[]; arguments: readonly string[] }): Promise<unknown>;
    pExpire(key: string, ms: number): Promise<unknown>;
  };
};

async function seed(pool: BreadPgPool): Promise<void> {
  await migrateBreadDb(pool);
  await pool.query(`TRUNCATE
    event_journal, admin_events, holder_snapshots, creator_rollups, fee_claims, fee_credits,
    market_candles, token_metrics, trades, launch_state, metadata, launches, indexer_checkpoints,
    protocol_stacks CASCADE`);
  await pool.query(
    `INSERT INTO protocol_stacks
      (chain_id, stack_version, factory_address, deployment_start_block, quote_asset, quote_decimals, addresses)
     VALUES ($1,$2,$3,'100',$4,6,'{}'::jsonb)`,
    [context.chainId, context.stackVersion, context.factoryAddress, context.quoteAsset],
  );
  await pool.query(
    `INSERT INTO indexer_checkpoints
      (chain_id, stack_version, factory_address, deployment_start_block, indexed_through_block,
       indexed_through_block_hash, indexed_through_block_timestamp, decoder_schema_version, status)
     VALUES ($1,$2,$3,'100','120',$4,'1786262400','day6-v1','COMMITTED')`,
    [context.chainId, context.stackVersion, context.factoryAddress, hash(120)],
  );
  await pool.query(
    `INSERT INTO launches
      (chain_id, token_address, curve_address, stack_version, factory_address, deployer_address,
       creator_fee_recipient, launch_timestamp, name, symbol, initial_supply, launch_block_number,
       launch_transaction_hash, launch_log_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'1786262400','Hot Bread','HOT','1000000','120',$8,1)`,
    [
      context.chainId,
      HOT_TOKEN,
      HOT_CURVE,
      context.stackVersion,
      context.factoryAddress,
      address(30),
      address(31),
      hash(120),
    ],
  );
}

const adminPool = new Pool({ connectionString: databaseUrl });
let pool: (BreadPgPool & { end(): Promise<void> }) | undefined;
let redis: ReturnType<typeof createClient> | undefined;
let app: ReturnType<typeof createBreadApi> | undefined;
let closing = false;

async function cleanup(): Promise<void> {
  if (closing) return;
  closing = true;
  await app?.close().catch(() => undefined);
  await redis?.quit().catch(() => undefined);
  await pool?.end().catch(() => undefined);
  await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`).catch(() => undefined);
  await adminPool.end().catch(() => undefined);
}

process.once('SIGTERM', () => {
  void cleanup().finally(() => process.exit(0));
});
process.once('SIGINT', () => {
  void cleanup().finally(() => process.exit(0));
});

try {
  await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await adminPool.query(`CREATE SCHEMA ${schemaName}`);
  pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
  await seed(pool);

  redis = createClient({ url: redisUrl });
  await redis.connect();
  await redis.flushDb();

  let observedHeadReads = 0;
  writeFileSync(headReadsFile, '0\n');
  app = createBreadApi({
    db: createBreadDb(pool),
    context,
    observedHeadBlock: async () => {
      observedHeadReads += 1;
      writeFileSync(headReadsFile, `${observedHeadReads}\n`);
      return 120n;
    },
    redis,
    capacity: {
      dbMaxActive: 16,
      dbMaxQueued: 64,
      dbQueueTimeoutMs: 250,
    },
    rateLimits: {
      feed: { maxRequests: 100_000, windowMs: 10_000 },
      search: { maxRequests: 100_000, windowMs: 10_000 },
    },
  });

  await app.listen({ port, host: '127.0.0.1' });
  console.log(`DAY8_LOAD_SERVER_READY http://127.0.0.1:${port}`);
} catch (error) {
  await cleanup();
  throw error;
}
