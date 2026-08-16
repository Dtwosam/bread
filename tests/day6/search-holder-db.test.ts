import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const tokenWithHolders = address('a');
const tokenWithoutMetric = address('b');
const curveA = address('c');
const curveB = address('d');
const factory = address('e');
const creator = address('f');
const indexedHeadTimestamp = 1_786_262_400n;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'search-holder-test',
  factoryAddress: factory,
  quoteAsset: address('1'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('2'),
    feePolicy: address('3'),
    feeEscrow: address('4'),
    emergencyController: address('5'),
    locker: address('6'),
    coordinator: address('7'),
    graduationAdapter: address('8'),
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

describe.skipIf(!RUN_DB)('Day 6 Search indexed holder-count projection', () => {
  const schemaName = `day6_search_holder_${process.pid}`;
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
    await pool.query('TRUNCATE token_metrics, launches CASCADE');

    const launches = [
      [tokenWithHolders, curveA, '120', 2, 'Bread Holders', 'BHLD'],
      [tokenWithoutMetric, curveB, '119', 1, 'Bread Unknown', 'BUNK'],
    ] as const;
    for (const [token, curve, block, logIndex, name, symbol] of launches) {
      await pool.query(
        `INSERT INTO launches (
          chain_id, token_address, curve_address, stack_version, factory_address,
          deployer_address, creator_fee_recipient, launch_timestamp, name, symbol,
          initial_supply, launch_block_number, launch_transaction_hash, launch_log_index
        ) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,'1000',$10,$11,$12)`,
        [
          context.chainId,
          token.toLowerCase(),
          curve.toLowerCase(),
          context.stackVersion,
          factory.toLowerCase(),
          creator.toLowerCase(),
          (indexedHeadTimestamp - 120n).toString(10),
          name,
          symbol,
          block,
          `0x${String(logIndex).padStart(64, '0')}`,
          logIndex,
        ],
      );
    }
    await pool.query(
      `INSERT INTO token_metrics (chain_id, token_address, holder_count)
       VALUES ($1,$2,'42')`,
      [context.chainId, tokenWithHolders.toLowerCase()],
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

  it('returns canonical indexed holder count while preserving tokens with unknown metrics', async () => {
    const app = await createSearchApp();

    const known = await app.inject({
      method: 'GET',
      url: `/v1/search?q=${tokenWithHolders.toLowerCase()}&limit=10`,
    });
    expect(known.statusCode).toBe(200);
    expect(known.json()).toMatchObject({
      data: [
        expect.objectContaining({
          tokenAddress: tokenWithHolders.toLowerCase(),
          holderCount: '42',
        }),
      ],
    });

    const unknown = await app.inject({
      method: 'GET',
      url: `/v1/search?q=${tokenWithoutMetric.toLowerCase()}&limit=10`,
    });
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json()).toMatchObject({
      data: [
        expect.objectContaining({
          tokenAddress: tokenWithoutMetric.toLowerCase(),
          holderCount: null,
        }),
      ],
    });

    await app.close();
  });
});
