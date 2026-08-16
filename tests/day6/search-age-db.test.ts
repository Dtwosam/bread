import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const token = address('a');
const curve = address('b');
const factory = address('c');
const creator = address('d');
const indexedHeadTimestamp = 1_786_262_400n;
const launchTimestamp = indexedHeadTimestamp - 125n;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'search-age-test',
  factoryAddress: factory,
  quoteAsset: address('e'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('1'),
    feePolicy: address('2'),
    feeEscrow: address('3'),
    emergencyController: address('4'),
    locker: address('5'),
    coordinator: address('6'),
    graduationAdapter: address('7'),
  },
};

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };
const requireFromApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const Fastify = requireFromApi('fastify') as (options?: Record<string, unknown>) => {
  get: (...args: unknown[]) => unknown;
  inject: (input: Readonly<{ method: string; url: string }>) => Promise<{
    statusCode: number;
    json: () => Record<string, unknown>;
  }>;
  close: () => Promise<void>;
};

describe.skipIf(!RUN_DB)('Day 6 Search committed-head age projection', () => {
  const schemaName = `day6_search_age_${process.pid}`;
  let adminPool: TestPool;
  let pool: TestPool;

  beforeAll(async () => {
    const connectionString =
      process.env.BREAD_DATABASE_URL ?? 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread';
    adminPool = new Pool({ connectionString });
    await adminPool.query('SELECT 1');
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await adminPool.query(`CREATE SCHEMA ${schemaName}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schemaName}` });
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await adminPool.end();
    }
  });

  beforeEach(async () => {
    const db = await import('../../packages/db/src/index.ts');
    await db.migrateBreadDb(pool);
    await pool.query('TRUNCATE launches CASCADE');
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        deployer_address, creator_fee_recipient, launch_timestamp, name, symbol,
        initial_supply, launch_block_number, launch_transaction_hash, launch_log_index
      ) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,'Bread Search Age','BAGE','1000','120',$8,1)`,
      [
        context.chainId,
        token.toLowerCase(),
        curve.toLowerCase(),
        context.stackVersion,
        factory.toLowerCase(),
        creator.toLowerCase(),
        launchTimestamp.toString(10),
        `0x${'ab'.repeat(32)}`,
      ],
    );
  });

  async function createSearchApp() {
    const dbModule = await import('../../packages/db/src/index.ts');
    const route = await import('../../apps/api/src/routes/search.ts');
    const app = Fastify();
    route.registerSearchRoute(app as never, {
      repository: new dbModule.SearchRepository(dbModule.createBreadDb(pool)),
      context,
      freshness: async () => ({
        chainId: context.chainId,
        schemaVersion: 'day6-v1',
        indexedThroughBlock: '120',
        indexedThroughBlockHash: `0x${'cd'.repeat(32)}`,
        indexedThroughBlockTimestamp: indexedHeadTimestamp.toString(10),
        servedAt: '2026-08-09T18:00:00.000Z',
        source: 'bread-indexer',
        status: 'FRESH',
        observedHeadBlock: '120',
        lagBlocks: '0',
        cache: 'BYPASS',
        stackVersion: context.stackVersion,
      }),
      rateLimit: async () => 'ALLOWED',
    });
    return app;
  }

  it('returns age seconds anchored to committed indexed time and clamps future launch timestamps at zero', async () => {
    const app = await createSearchApp();

    const response = await app.inject({ method: 'GET', url: '/v1/search?q=ba&limit=10' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        expect.objectContaining({
          tokenAddress: token.toLowerCase(),
          ageSeconds: '125',
        }),
      ],
      meta: {
        indexedThroughBlockTimestamp: indexedHeadTimestamp.toString(10),
      },
    });

    await pool.query('UPDATE launches SET launch_timestamp=$1 WHERE token_address=$2', [
      (indexedHeadTimestamp + 10n).toString(10),
      token.toLowerCase(),
    ]);
    const future = await app.inject({ method: 'GET', url: '/v1/search?q=ba&limit=10' });
    expect(future.statusCode).toBe(200);
    expect(future.json()).toMatchObject({
      data: [expect.objectContaining({ ageSeconds: '0' })],
    });

    await app.close();
  });
});
