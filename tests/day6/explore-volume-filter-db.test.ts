import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const addr = (byte: string) => `0x${byte.repeat(20)}` as Address;
const factory = addr('11');
const activeLow = addr('aa');
const activeHigh = addr('bb');
const graduatedMid = addr('cc');
const graduatedHigh = addr('dd');
const activeLowCurve = addr('1a');
const activeHighCurve = addr('1b');
const graduatedMidCurve = addr('1c');
const graduatedHighCurve = addr('1d');
const trader = addr('21');
const indexedHeadTimestamp = 1_786_269_600n;
const trailing24hCutoff = indexedHeadTimestamp - 86_400n;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'explore-volume-filter-test',
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

describe.skipIf(!RUN_DB)('Day 6 Explore trailing-24h volume filters', () => {
  const schemaName = `day6_explore_volume_${process.pid}`;
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
      ) VALUES ($1,$2,$3,'100','500',$4,$5,'day6-v1','COMMITTED')`,
      [
        context.chainId,
        context.stackVersion,
        factory.toLowerCase(),
        `0x${'ab'.repeat(32)}`,
        indexedHeadTimestamp.toString(10),
      ],
    );

    const launches = [
      [activeHigh, activeHighCurve, '1786269400', '490', 1, 'Active High'],
      [graduatedMid, graduatedMidCurve, '1786269300', '480', 2, 'Graduated Mid'],
      [activeLow, activeLowCurve, '1786269200', '470', 3, 'Active Low'],
      [graduatedHigh, graduatedHighCurve, '1786269100', '460', 4, 'Graduated High'],
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
          `VOL${logIndex}`,
        ],
      );
    }

    await pool.query(
      `INSERT INTO launch_state (
        chain_id, token_address, mode, graduation_phase, ready_to_graduate,
        graduation_completed_block, graduation_completed_log_index
      ) VALUES
        ($1,$2,'ACTIVE','NOT_GRADUATED',false,null,null),
        ($1,$3,'GRADUATED','POOL_CREATED',false,'498',1),
        ($1,$4,'ACTIVE','NOT_GRADUATED',false,null,null),
        ($1,$5,'GRADUATED','POOL_CREATED',false,'499',1)`,
      [
        context.chainId,
        activeHigh.toLowerCase(),
        graduatedMid.toLowerCase(),
        activeLow.toLowerCase(),
        graduatedHigh.toLowerCase(),
      ],
    );

    // These persisted values are intentionally wrong for the committed-head
    // trailing 24h window. A correct Explore implementation must use timestamped
    // trade evidence rather than this trade-triggered cumulative/snapshot field.
    await pool.query(
      `INSERT INTO token_metrics (
        chain_id, token_address, holder_count, graduation_progress_bps,
        graduation_state, quote_volume_24h
      ) VALUES
        ($1,$2,'20','9000','CURVE_ACTIVE','1'),
        ($1,$3,'10','10000','POOL_CREATED','1'),
        ($1,$4,'5','8000','CURVE_ACTIVE','105000000'),
        ($1,$5,'30','10000','POOL_CREATED','1')`,
      [
        context.chainId,
        activeHigh.toLowerCase(),
        graduatedMid.toLowerCase(),
        activeLow.toLowerCase(),
        graduatedHigh.toLowerCase(),
      ],
    );

    const inWindowTrades = [
      [701, activeHigh, activeHighCurve, '20000000', '1786269300'],
      [702, activeLow, activeLowCurve, '5000000', '1786269300'],
      [703, graduatedMid, graduatedMidCurve, '15000000', '1786269200'],
      [704, graduatedHigh, graduatedHighCurve, '25000000', '1786269100'],
    ] as const;
    for (const [sequence, token, curve, quote, timestamp] of inWindowTrades) {
      await pool.query(
        `INSERT INTO trades (
          chain_id, transaction_hash, log_index, token_address, curve_address,
          side, trader_address, recipient_address, base_amount, quote_amount,
          fee_amount, tax_amount, block_number, transaction_index, stack_version,
          block_timestamp
        ) VALUES ($1,$2,1,$3,$4,'BUY',$5,$5,'1',$6,'0','0','495',0,$7,$8)`,
        [
          context.chainId,
          `0x${String(sequence).padStart(64, '0')}`,
          token.toLowerCase(),
          curve.toLowerCase(),
          trader.toLowerCase(),
          quote,
          context.stackVersion,
          timestamp,
        ],
      );
    }

    // This large trade is one second outside the committed trailing-24h window.
    // It must not make Active Low satisfy a 10–20 USDC filter.
    await pool.query(
      `INSERT INTO trades (
        chain_id, transaction_hash, log_index, token_address, curve_address,
        side, trader_address, recipient_address, base_amount, quote_amount,
        fee_amount, tax_amount, block_number, transaction_index, stack_version,
        block_timestamp
      ) VALUES ($1,$2,2,$3,$4,'BUY',$5,$5,'1','100000000','0','0','400',0,$6,$7)`,
      [
        context.chainId,
        `0x${String(799).padStart(64, '0')}`,
        activeLow.toLowerCase(),
        activeLowCurve.toLowerCase(),
        trader.toLowerCase(),
        context.stackVersion,
        (trailing24hCutoff - 1n).toString(10),
      ],
    );
  });

  it('filters every Explore view by inclusive trailing-24h quote volume at the committed indexed head', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apiModule = await import('../../apps/api/src/server.ts');
    const app = apiModule.createBreadApi({
      db: dbModule.createBreadDb(pool),
      context,
      observedHeadBlock: async () => 500n,
      now: () => new Date('2030-01-01T00:00:00.000Z'),
    });

    const expectedByQuery = {
      'volumeMinQuote=10000000&volumeMaxQuote=20000000': {
        new: [activeHigh, graduatedMid],
        trending: [activeHigh, graduatedMid],
        graduating: [activeHigh],
        graduated: [graduatedMid],
      },
      'volumeMaxQuote=5000000': {
        new: [activeLow],
        trending: [activeLow],
        graduating: [activeLow],
        graduated: [],
      },
      'volumeMinQuote=25000000': {
        new: [graduatedHigh],
        trending: [graduatedHigh],
        graduating: [],
        graduated: [graduatedHigh],
      },
    } as const;

    for (const [volumeQuery, byView] of Object.entries(expectedByQuery)) {
      for (const [view, expected] of Object.entries(byView)) {
        const response = await app.inject({
          method: 'GET',
          url: `/v1/feed?view=${view}&${volumeQuery}&limit=10`,
        });
        expect(response.statusCode).toBe(200);
        expect(tokenAddresses(response.json())).toEqual(expected);
      }
    }

    for (const url of [
      '/v1/feed?view=new&volumeMinQuote=abc',
      '/v1/feed?view=new&volumeMaxQuote=-1',
      '/v1/feed?view=new&volumeMinQuote=20000000&volumeMaxQuote=10000000',
      '/v1/feed?view=new&volumeMinQuote=1.5',
    ]) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'INVALID_VOLUME_FILTER' } });
    }

    await app.close();
  });
});