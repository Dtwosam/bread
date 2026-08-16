import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const addr = (byte: string) => `0x${byte.repeat(20)}` as Address;
const factory = addr('11');
const recentActive = addr('aa');
const oldActive = addr('bb');
const recentGraduated = addr('cc');
const oldGraduated = addr('dd');
const recentCurve = addr('1a');
const oldCurve = addr('1b');
const recentGraduatedCurve = addr('1c');
const oldGraduatedCurve = addr('1d');
const trader = addr('21');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'explore-age-filter-test',
  factoryAddress: factory,
  quoteAsset: addr('31'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: addr('32'),
    feePolicy: addr('33'),
    feeEscrow: addr('34'),
    emergencyController: addr('35'),
    locker: addr('36'),
    coordinator: addr('37'),
    graduationAdapter: addr('38'),
  },
};

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
};
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

function tokenAddresses(body: unknown): string[] {
  const parsed = body as { data?: Array<{ tokenAddress?: string }> };
  return (parsed.data ?? []).map((item) => String(item.tokenAddress));
}

describe.skipIf(!RUN_DB)('Day 6 Explore indexed-head age filters', () => {
  const schemaName = `day6_explore_age_${process.pid}`;
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
    await pool.query('TRUNCATE launch_state, token_metrics, trades, launches, indexer_checkpoints, protocol_stacks CASCADE');

    // Indexed head = 10:00:00. Recent launches are 09:57/09:58; old launches are 08:00.
    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'100','500',$4,'1786269600','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory.toLowerCase(), `0x${'ab'.repeat(32)}`],
    );

    const launches = [
      [recentActive, recentCurve, '1786269420', '490', 1, 'Recent Active'],
      [oldActive, oldCurve, '1786262400', '300', 2, 'Old Active'],
      [recentGraduated, recentGraduatedCurve, '1786269480', '491', 3, 'Recent Graduated'],
      [oldGraduated, oldGraduatedCurve, '1786262400', '301', 4, 'Old Graduated'],
    ] as const;

    for (const [token, curve, launchTimestamp, block, logIndex, name] of launches) {
      await pool.query(
        `INSERT INTO launches (
          chain_id, token_address, curve_address, stack_version, factory_address,
          deployer_address, launch_timestamp, initial_supply, phantom_quote,
          graduation_threshold, reserved_tokens_baseline, launch_block_number,
          launch_transaction_hash, launch_log_index, name, symbol
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'1000','100','900','200',$8,$9,$10,$11,$12)`,
        [
          context.chainId,
          token.toLowerCase(),
          curve.toLowerCase(),
          context.stackVersion,
          factory.toLowerCase(),
          addr('41').toLowerCase(),
          launchTimestamp,
          block,
          `0x${String(logIndex).padStart(64, '0')}`,
          logIndex,
          name,
          `AGE${logIndex}`,
        ],
      );
    }

    await pool.query(
      `INSERT INTO launch_state (
        chain_id, token_address, mode, graduation_phase, ready_to_graduate,
        graduation_completed_block, graduation_completed_log_index
      ) VALUES
        ($1,$2,'ACTIVE','NOT_GRADUATED',false,null,null),
        ($1,$3,'ACTIVE','NOT_GRADUATED',false,null,null),
        ($1,$4,'GRADUATED','POOL_CREATED',false,'499',1),
        ($1,$5,'GRADUATED','POOL_CREATED',false,'400',1)`,
      [context.chainId, recentActive.toLowerCase(), oldActive.toLowerCase(), recentGraduated.toLowerCase(), oldGraduated.toLowerCase()],
    );

    await pool.query(
      `INSERT INTO token_metrics (
        chain_id, token_address, graduation_progress_bps, graduation_state
      ) VALUES
        ($1,$2,'9000','CURVE_ACTIVE'),
        ($1,$3,'8000','CURVE_ACTIVE'),
        ($1,$4,'10000','POOL_CREATED'),
        ($1,$5,'10000','POOL_CREATED')`,
      [context.chainId, recentActive.toLowerCase(), oldActive.toLowerCase(), recentGraduated.toLowerCase(), oldGraduated.toLowerCase()],
    );

    // Both active launches have current trailing-hour activity. Age, not activity freshness, must exclude oldActive.
    for (const [sequence, token, curve, quote] of [
      [701, recentActive, recentCurve, '200'],
      [702, oldActive, oldCurve, '500'],
    ] as const) {
      await pool.query(
        `INSERT INTO trades (
          chain_id, transaction_hash, log_index, token_address, curve_address,
          side, trader_address, recipient_address, base_amount, quote_amount,
          fee_amount, tax_amount, block_number, transaction_index, stack_version,
          block_timestamp
        ) VALUES ($1,$2,1,$3,$4,'BUY',$5,$5,'1',$6,'0','0','495',0,$7,'1786269300')`,
        [
          context.chainId,
          `0x${String(sequence).padStart(64, '0')}`,
          token.toLowerCase(),
          curve.toLowerCase(),
          trader.toLowerCase(),
          quote,
          context.stackVersion,
        ],
      );
    }
  });

  it('applies the <5m age preset against the committed indexed head on every Explore view', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apiModule = await import('../../apps/api/src/server.ts');
    const db = dbModule.createBreadDb(pool);
    const app = apiModule.createBreadApi({
      db,
      context,
      observedHeadBlock: async () => 500n,
      // Deliberately far from indexed time: browser/server wall clock must not own age classification.
      now: () => new Date('2030-01-01T00:00:00.000Z'),
    });

    const cases = [
      { view: 'new', expected: [recentGraduated, recentActive] },
      { view: 'trending', expected: [recentActive] },
      { view: 'graduating', expected: [recentActive] },
      { view: 'graduated', expected: [recentGraduated] },
    ] as const;

    for (const testCase of cases) {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/feed?view=${testCase.view}&age=lt5m&limit=10`,
      });
      expect(response.statusCode).toBe(200);
      expect(tokenAddresses(response.json())).toEqual(testCase.expected);
    }

    await app.close();
  });
});
