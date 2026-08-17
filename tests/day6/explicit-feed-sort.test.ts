import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const factory = address('1');
const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'v1.6.1-explicit-sort',
  factoryAddress: factory,
  quoteAsset: address('2'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('3'),
    feePolicy: address('4'),
    feeEscrow: address('5'),
    emergencyController: address('6'),
    locker: address('7'),
    coordinator: address('8'),
    graduationAdapter: address('9'),
  },
};

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as {
  Pool: new (config: Record<string, unknown>) => TestPool;
};

const tokens = {
  a: address('a'),
  b: address('b'),
  c: address('c'),
  d: address('d'),
  e: address('e'),
} as const;

describe.skipIf(!RUN_DB)('v1.6.1 deterministic explicit Explore sorts', () => {
  const schemaName = `v161_explicit_sort_${process.pid}`;
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
    const dbModule = await import('../../packages/db/src/index.ts');
    await dbModule.migrateBreadDb(pool);
    await pool.query(
      'TRUNCATE launch_state, token_metrics, trades, launches, indexer_checkpoints, protocol_stacks CASCADE',
    );
    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'100','200',$4,'6000','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory.toLowerCase(), `0x${'aa'.repeat(32)}`],
    );

    const fixtures = [
      { token: tokens.a, curve: address('5'), block: '100', time: '1000', log: 1, marketCap: '500', volume: '900', holders: '9', progress: '1000' },
      { token: tokens.b, curve: address('6'), block: '104', time: '4000', log: 2, marketCap: '1000', volume: null, holders: '7', progress: '8000' },
      { token: tokens.c, curve: address('7'), block: '103', time: '4000', log: 3, marketCap: '1000', volume: '100', holders: null, progress: '8000' },
      { token: tokens.d, curve: address('8'), block: '105', time: '5000', log: 4, marketCap: null, volume: '2000', holders: '20', progress: null },
      { token: tokens.e, curve: address('9'), block: '102', time: '3000', log: 5, marketCap: '750', volume: '2000', holders: '20', progress: '9000' },
    ] as const;

    for (const fixture of fixtures) {
      await pool.query(
        `INSERT INTO launches (
          chain_id, token_address, curve_address, stack_version, factory_address,
          launch_timestamp, initial_supply, launch_block_number,
          launch_transaction_hash, launch_log_index, name, symbol
        ) VALUES ($1,$2,$3,$4,$5,$6,'1000000',$7,$8,$9,$10,$11)`,
        [
          context.chainId,
          fixture.token.toLowerCase(),
          fixture.curve.toLowerCase(),
          context.stackVersion,
          factory.toLowerCase(),
          fixture.time,
          fixture.block,
          `0x${String(fixture.log).padStart(64, '0')}`,
          fixture.log,
          `Token ${fixture.log}`,
          `T${fixture.log}`,
        ],
      );
      await pool.query(
        `INSERT INTO token_metrics (
          chain_id, token_address, market_cap, quote_volume_24h,
          holder_count, graduation_progress_bps, latest_block_number
        ) VALUES ($1,$2,$3,$4,$5,$6,'200')`,
        [
          context.chainId,
          fixture.token.toLowerCase(),
          fixture.marketCap,
          fixture.volume,
          fixture.holders,
          fixture.progress,
        ],
      );
    }
  });

  async function createApp() {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apiModule = await import('../../apps/api/src/server.ts');
    return apiModule.createBreadApi({
      db: dbModule.createBreadDb(pool),
      context,
      observedHeadBlock: async () => 200n,
      now: () => new Date('2026-08-17T09:00:00.000Z'),
    });
  }

  it('orders every explicit sort descending with launch-time/address tie-breaks and nulls last', async () => {
    const app = await createApp();
    const cases = [
      ['newest', [tokens.d, tokens.b, tokens.c, tokens.e, tokens.a]],
      ['market-cap', [tokens.b, tokens.c, tokens.e, tokens.a, tokens.d]],
      ['volume-24h', [tokens.d, tokens.e, tokens.a, tokens.c, tokens.b]],
      ['holders', [tokens.d, tokens.e, tokens.a, tokens.b, tokens.c]],
      ['baked-progress', [tokens.e, tokens.b, tokens.c, tokens.a, tokens.d]],
    ] as const;

    for (const [sort, expected] of cases) {
      const response = await app.inject({ method: 'GET', url: `/v1/feed?view=new&sort=${sort}&limit=10` });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { data: Array<{ tokenAddress: string }> };
      expect(body.data.map((row) => row.tokenAddress)).toEqual(expected);
    }

    await app.close();
  });

  it('keeps explicit-sort cursor pagination stable across repeated reads, including null values', async () => {
    const app = await createApp();
    const collected: string[] = [];
    let cursor: string | undefined;

    do {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/feed?view=new&sort=market-cap&limit=2${cursor ? `&cursor=${cursor}` : ''}`,
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        data: Array<{ tokenAddress: string }>;
        page: { hasMore: boolean; nextCursor?: string };
      };
      collected.push(...body.data.map((row) => row.tokenAddress));
      cursor = body.page.nextCursor;
      if (!body.page.hasMore) expect(cursor).toBeUndefined();
    } while (cursor);

    expect(collected).toEqual([tokens.b, tokens.c, tokens.e, tokens.a, tokens.d]);
    expect(new Set(collected).size).toBe(5);

    const repeat = await app.inject({ method: 'GET', url: '/v1/feed?view=new&sort=market-cap&limit=5' });
    expect((repeat.json() as { data: Array<{ tokenAddress: string }> }).data.map((row) => row.tokenAddress)).toEqual(collected);
    await app.close();
  });

  it('filters on the same indexed market-cap authority and never coerces null to zero', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/feed?view=new&sort=market-cap&marketCapMinQuote=700&marketCapMaxQuote=1000&limit=10',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ tokenAddress: string }> };
    expect(body.data.map((row) => row.tokenAddress)).toEqual([tokens.b, tokens.c, tokens.e]);
    await app.close();
  });

  it('filters market cap without changing the selected feed canonical default order', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/feed?view=new&marketCapMinQuote=700&marketCapMaxQuote=1000&limit=10',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ tokenAddress: string }> };
    expect(body.data.map((row) => row.tokenAddress)).toEqual([tokens.b, tokens.c, tokens.e]);
    await app.close();
  });
});
