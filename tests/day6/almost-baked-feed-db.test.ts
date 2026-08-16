import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const patternedAddress = (byte: string) => `0x${byte.repeat(20)}` as Address;
const factory = patternedAddress('11');
const tokenA = patternedAddress('aa');
const tokenB = patternedAddress('bb');
const tokenC = patternedAddress('cc');
const tokenD = patternedAddress('dd');
const curveA = patternedAddress('1a');
const curveB = patternedAddress('1b');
const curveC = patternedAddress('1c');
const curveD = patternedAddress('1d');
const traderA = patternedAddress('21');
const traderB = patternedAddress('22');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'almost-baked-feed-test',
  factoryAddress: factory,
  quoteAsset: patternedAddress('31'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: patternedAddress('32'),
    feePolicy: patternedAddress('33'),
    feeEscrow: patternedAddress('34'),
    emergencyController: patternedAddress('35'),
    locker: patternedAddress('36'),
    coordinator: patternedAddress('37'),
    graduationAdapter: patternedAddress('38'),
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

describe.skipIf(!RUN_DB)('Day 6 Almost Baked deterministic feed', () => {
  const schemaName = `day6_almost_baked_${process.pid}`;
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

    // The committed indexed head is 10:00:00. The trailing feed window therefore
    // begins at 09:00:00 regardless of wall-clock/API request time.
    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'100','500',$4,'1786269600','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory.toLowerCase(), `0x${'ab'.repeat(32)}`],
    );

    const launches = [
      { token: tokenA, curve: curveA, time: '1786268500', block: '450', log: 1, name: 'Completed' },
      { token: tokenB, curve: curveB, time: '1786268400', block: '440', log: 2, name: 'Nine B' },
      { token: tokenC, curve: curveC, time: '1786268300', block: '430', log: 3, name: 'Nine C' },
      { token: tokenD, curve: curveD, time: '1786268200', block: '420', log: 4, name: 'Processing' },
    ];

    for (const launch of launches) {
      await pool.query(
        `INSERT INTO launches (
          chain_id, token_address, curve_address, stack_version, factory_address,
          launch_timestamp, initial_supply, phantom_quote, graduation_threshold,
          reserved_tokens_baseline, launch_block_number, launch_transaction_hash,
          launch_log_index, name, symbol
        ) VALUES ($1,$2,$3,$4,$5,$6,'1000','100','900','200',$7,$8,$9,$10,$11)`,
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
          launch.name,
          `AB${launch.log}`,
        ],
      );
    }

    await pool.query(
      `INSERT INTO launch_state (
        chain_id, token_address, mode, graduation_phase, ready_to_graduate,
        graduation_completed_block, graduation_completed_log_index
      ) VALUES
        ($1,$2,'GRADUATED','POOL_CREATED',false,'490',7),
        ($1,$3,'ACTIVE','NOT_GRADUATED',false,null,null),
        ($1,$4,'ACTIVE','NOT_GRADUATED',false,null,null),
        ($1,$5,'ACTIVE','SWEPT',false,null,null)`,
      [context.chainId, tokenA.toLowerCase(), tokenB.toLowerCase(), tokenC.toLowerCase(), tokenD.toLowerCase()],
    );

    await pool.query(
      `INSERT INTO token_metrics (
        chain_id, token_address, graduation_progress_bps, graduation_state
      ) VALUES
        ($1,$2,'10000','POOL_CREATED'),
        ($1,$3,'9000','CURVE_ACTIVE'),
        ($1,$4,'9000','CURVE_ACTIVE'),
        ($1,$5,'10000','SWEPT')`,
      [context.chainId, tokenA.toLowerCase(), tokenB.toLowerCase(), tokenC.toLowerCase(), tokenD.toLowerCase()],
    );

    let sequence = 700;
    const insertTrade = async (input: {
      token: Address;
      curve: Address;
      trader: Address;
      quote: string;
      timestamp: string;
      block: string;
      log: number;
    }) => {
      sequence += 1;
      await pool.query(
        `INSERT INTO trades (
          chain_id, transaction_hash, log_index, token_address, curve_address,
          side, trader_address, recipient_address, base_amount, quote_amount,
          fee_amount, tax_amount, block_number, transaction_index, stack_version,
          block_timestamp
        ) VALUES ($1,$2,$3,$4,$5,'BUY',$6,$6,'1',$7,'0','0',$8,0,$9,$10)`,
        [
          context.chainId,
          `0x${String(sequence).padStart(64, '0')}`,
          input.log,
          input.token.toLowerCase(),
          input.curve.toLowerCase(),
          input.trader.toLowerCase(),
          input.quote,
          input.block,
          context.stackVersion,
          input.timestamp,
        ],
      );
    };

    // C outranks B only on current trailing-1h volume because progress is tied.
    await insertTrade({ token: tokenB, curve: curveB, trader: traderA, quote: '100', timestamp: '1786269300', block: '470', log: 1 });
    await insertTrade({ token: tokenC, curve: curveC, trader: traderA, quote: '125', timestamp: '1786269200', block: '468', log: 1 });
    await insertTrade({ token: tokenC, curve: curveC, trader: traderB, quote: '75', timestamp: '1786269250', block: '469', log: 2 });

    // This large B trade is outside the committed trailing hour and must not affect ordering.
    await insertTrade({ token: tokenB, curve: curveB, trader: traderB, quote: '9999', timestamp: '1786265900', block: '300', log: 1 });
  });

  it('orders non-graduated launches by progress, indexed-head 1h volume, launch time and token with stable pagination', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apiModule = await import('../../apps/api/src/server.ts');
    const db = dbModule.createBreadDb(pool);
    const app = apiModule.createBreadApi({
      db,
      context,
      observedHeadBlock: async () => 500n,
      // Deliberately unrelated wall-clock time: the feed window belongs to the committed indexed head.
      now: () => new Date('2030-01-01T00:00:00.000Z'),
    });

    const firstResponse = await app.inject({ method: 'GET', url: '/v1/feed?view=graduating&limit=2' });
    expect(firstResponse.statusCode).toBe(200);
    const first = firstResponse.json() as {
      data: Array<{ tokenAddress: string; progress: { progressBps: string | null; state: string | null } | null }>;
      page: { hasMore: boolean; nextCursor?: string };
    };

    // D is processing but not POOL_CREATED, so the canonical phase remains visible while
    // progress owns ranking. C then outranks B on current trailing-1h volume.
    expect(first.data.map((item) => item.tokenAddress)).toEqual([tokenD, tokenC]);
    expect(first.data.map((item) => item.progress?.progressBps)).toEqual(['10000', '9000']);
    expect(first.data.map((item) => item.progress?.state)).toEqual(['SWEPT', 'CURVE_ACTIVE']);
    expect(first.page.hasMore).toBe(true);
    expect(first.page.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);

    const secondResponse = await app.inject({
      method: 'GET',
      url: `/v1/feed?view=graduating&limit=2&cursor=${first.page.nextCursor}`,
    });
    expect(secondResponse.statusCode).toBe(200);
    const second = secondResponse.json() as {
      data: Array<{ tokenAddress: string }>;
      page: { hasMore: boolean; nextCursor?: string };
    };
    expect(second.data.map((item) => item.tokenAddress)).toEqual([tokenB]);
    expect(second.page.hasMore).toBe(false);
    expect(second.page.nextCursor).toBeUndefined();

    const all = [...first.data, ...second.data].map((item) => item.tokenAddress);
    expect(all).not.toContain(tokenA);
    expect(new Set(all).size).toBe(3);

    await app.close();
  });
});
