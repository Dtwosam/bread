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
  stackVersion: 'task4-cursor-stack',
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

describe.skipIf(!RUN_DB)('Day 6 Task 4 New-feed keyset pagination', () => {
  const schemaName = `day6_task4_cursor_${process.pid}`;
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
    await pool.query('TRUNCATE launches, indexer_checkpoints, protocol_stacks CASCADE');
    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'100','102',$4,'1786262402','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory.toLowerCase(), `0x${'aa'.repeat(32)}`],
    );

    const launches = [
      { token: address('a'), curve: address('d'), block: '102', time: '1786262402', log: 5 },
      { token: address('b'), curve: address('e'), block: '101', time: '1786262401', log: 4 },
      { token: address('c'), curve: address('f'), block: '100', time: '1786262400', log: 3 },
    ];
    for (const launch of launches) {
      await pool.query(
        `INSERT INTO launches (
          chain_id, token_address, curve_address, stack_version, factory_address,
          launch_timestamp, initial_supply, launch_block_number,
          launch_transaction_hash, launch_log_index, name, symbol
        ) VALUES ($1,$2,$3,$4,$5,$6,'1000',$7,$8,$9,$10,$11)`,
        [
          context.chainId,
          launch.token.toLowerCase(),
          launch.curve.toLowerCase(),
          context.stackVersion,
          factory.toLowerCase(),
          launch.time,
          launch.block,
          `0x${String(launch.log).padStart(64, '0')}`,
          launch.log,
          `Token ${launch.log}`,
          `T${launch.log}`,
        ],
      );
    }
  });

  it('uses nextCursor keyset pagination with no overlap and stable New ordering', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apiModule = await import('../../apps/api/src/server.ts');
    const db = dbModule.createBreadDb(pool);
    const app = apiModule.createBreadApi({
      db,
      context,
      observedHeadBlock: async () => 102n,
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    });

    const firstResponse = await app.inject({ method: 'GET', url: '/v1/feed?view=new&limit=2' });
    expect(firstResponse.statusCode).toBe(200);
    const first = firstResponse.json() as {
      data: Array<{ tokenAddress: string }>;
      page: { hasMore: boolean; nextCursor?: string };
    };
    expect(first.data.map((item) => item.tokenAddress)).toEqual([address('a'), address('b')]);
    expect(first.page.hasMore).toBe(true);
    expect(first.page.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);

    const secondResponse = await app.inject({
      method: 'GET',
      url: `/v1/feed?view=new&limit=2&cursor=${first.page.nextCursor}`,
    });
    expect(secondResponse.statusCode).toBe(200);
    const second = secondResponse.json() as {
      data: Array<{ tokenAddress: string }>;
      page: { hasMore: boolean; nextCursor?: string };
    };
    expect(second.data.map((item) => item.tokenAddress)).toEqual([address('c')]);
    expect(second.page.hasMore).toBe(false);
    expect(second.page.nextCursor).toBeUndefined();
    expect(new Set([...first.data, ...second.data].map((item) => item.tokenAddress)).size).toBe(3);

    await app.close();
  });
});
