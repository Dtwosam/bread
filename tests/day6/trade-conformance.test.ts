import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}`;
const factory = address('1');
const token = address('2');
const curve = address('3');
const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task5-test-stack',
  factoryAddress: factory,
  quoteAsset: address('8'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('9'),
    feePolicy: address('a'),
    feeEscrow: address('b'),
    emergencyController: address('c'),
    locker: address('d'),
    coordinator: address('e'),
    graduationAdapter: address('f'),
  },
};
const blockTimestamp = 1_786_262_461n;

describe('Day 6 Task 5 typed read-model conformance', () => {
  it('exports the exact trade/state/candle/metric columns added by the Task-5 migration', async () => {
    const db = await import('../../packages/db/src/index.ts');
    expect(Object.keys(db.trades)).toEqual(expect.arrayContaining([
      'blockTimestamp',
      'offeredQuote',
      'openingTaxBps',
      'openingTaxAmount',
      'launchBuyExempt',
      'refundAmount',
      'netCurveInput',
      'netQuoteOut',
      'grossCurveQuoteOut',
      'executionPriceNumerator',
      'executionPriceDenominator',
    ]));
    expect(Object.keys(db.launchState)).toEqual(expect.arrayContaining([
      'trackedQuote',
      'trackedTokens',
      'quoteFeeBalance',
      'creatorTaxBalance',
      'realQuoteReserve',
      'virtualQuoteReserve',
    ]));
    expect(Object.keys(db.marketCandles)).toEqual(expect.arrayContaining([
      'openPriceNumerator',
      'openPriceDenominator',
      'highPriceNumerator',
      'highPriceDenominator',
      'lowPriceNumerator',
      'lowPriceDenominator',
      'closePriceNumerator',
      'closePriceDenominator',
    ]));
    expect(Object.keys(db.tokenMetrics)).toEqual(expect.arrayContaining([
      'lastPriceNumerator',
      'lastPriceDenominator',
      'lastPriceSource',
      'quoteVolume5m',
      'quoteVolume1h',
      'quoteVolume24h',
      'tradeCount1h',
      'tradeCount24h',
      'uniqueTraders1h',
      'uniqueTraders24h',
    ]));
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 6 Task 5 exact state and public metric surfaces', () => {
  const schemaName = `day6_task5_conformance_${process.pid}`;
  let adminPool: TestPool;
  let pool: TestPool;

  beforeAll(async () => {
    const connectionString = process.env.BREAD_DATABASE_URL ?? 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread';
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
    await pool.query('TRUNCATE event_journal, trades, market_candles, token_metrics, launch_state, launches, indexer_checkpoints CASCADE');
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        creator_tax_bps, launch_timestamp, quote_asset, initial_supply, phantom_quote,
        graduation_threshold, reserved_tokens_baseline, launch_block_number,
        launch_transaction_hash, launch_log_index, name, symbol
      ) VALUES ($1,$2,$3,$4,$5,'200','1786262400',$6,'1000','100','900','200','100',$7,4,'Trade Test','TRD')`,
      [context.chainId, token, curve, context.stackVersion, factory, context.quoteAsset, hash('1')],
    );
    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'100','101',$4,$5,'day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory, hash('c'), blockTimestamp.toString()],
    );
  });

  async function projectFixture() {
    const dbModule = await import('../../packages/db/src/index.ts');
    const db = dbModule.createBreadDb(pool);
    await db.transaction(async (tx) => {
      await dbModule.applyCanonicalTradeProjection(tx as never, {
        id: { chainId: context.chainId, transactionHash: hash('a'), logIndex: 3 },
        stackVersion: context.stackVersion,
        side: 'BUY', token, curve, actor: address('4'), recipient: address('5'),
        offeredQuote: 1_010n, quoteAmount: 1_000n, tokenAmount: 100n,
        baseFee: 10n, creatorTax: 20n, openingTaxBps: 500n, openingTax: 45n,
        launchBuyExempt: false, refund: 10n, netCurveInput: 925n,
        netQuoteOut: 0n, grossCurveQuoteOut: 0n,
        executionPriceNumerator: 925n, executionPriceDenominator: 100n,
        blockNumber: 101n, blockTimestamp, transactionIndex: 1,
      });
      await dbModule.applyCanonicalTradeProjection(tx as never, {
        id: { chainId: context.chainId, transactionHash: hash('b'), logIndex: 0 },
        stackVersion: context.stackVersion,
        side: 'SELL', token, curve, actor: address('6'), recipient: address('7'),
        offeredQuote: 0n, quoteAmount: 415n, tokenAmount: 50n,
        baseFee: 10n, creatorTax: 5n, openingTaxBps: 0n, openingTax: 0n,
        launchBuyExempt: false, refund: 0n, netCurveInput: 0n,
        netQuoteOut: 400n, grossCurveQuoteOut: 415n,
        executionPriceNumerator: 415n, executionPriceDenominator: 50n,
        blockNumber: 101n, blockTimestamp, transactionIndex: 2,
      });
    });
    return db;
  }

  it('reconstructs exact tracked state, rational candles and rolling metrics', async () => {
    await projectFixture();
    const state = (await pool.query(`SELECT
      tracked_quote::text, tracked_tokens::text, quote_fee_balance::text, creator_tax_balance::text,
      real_quote_reserve::text, virtual_quote_reserve::text, remaining_sellable_tokens::text
      FROM launch_state WHERE chain_id=$1 AND token_address=$2`, [context.chainId, token])).rows[0];
    expect(state).toMatchObject({
      tracked_quote: '600', tracked_tokens: '950', quote_fee_balance: '65', creator_tax_balance: '25',
      real_quote_reserve: '510', virtual_quote_reserve: '610', remaining_sellable_tokens: '750',
    });

    const candle = (await pool.query(`SELECT
      open_price_numerator::text, open_price_denominator::text,
      high_price_numerator::text, high_price_denominator::text,
      low_price_numerator::text, low_price_denominator::text,
      close_price_numerator::text, close_price_denominator::text,
      quote_volume::text, trade_count::text
      FROM market_candles WHERE chain_id=$1 AND token_address=$2 AND interval_seconds=60`, [context.chainId, token])).rows[0];
    expect(candle).toMatchObject({
      open_price_numerator: '925', open_price_denominator: '100',
      high_price_numerator: '925', high_price_denominator: '100',
      low_price_numerator: '415', low_price_denominator: '50',
      close_price_numerator: '415', close_price_denominator: '50',
      quote_volume: '1415', trade_count: '2',
    });

    const metric = (await pool.query(`SELECT
      last_price_numerator::text, last_price_denominator::text, last_price_source,
      quote_volume_5m::text, quote_volume_1h::text, quote_volume_24h::text,
      trade_count_1h::text, trade_count_24h::text,
      unique_traders_1h::text, unique_traders_24h::text
      FROM token_metrics WHERE chain_id=$1 AND token_address=$2`, [context.chainId, token])).rows[0];
    expect(metric).toMatchObject({
      last_price_numerator: '415', last_price_denominator: '50', last_price_source: 'CURVE_EXECUTION',
      quote_volume_5m: '1415', quote_volume_1h: '1415', quote_volume_24h: '1415',
      trade_count_1h: '2', trade_count_24h: '2', unique_traders_1h: '2', unique_traders_24h: '2',
    });
  });

  it('enriches token and New-feed reads only with supported indexed trade metrics', async () => {
    const db = await projectFixture();
    const api = await import('../../apps/api/src/server.ts');
    const app = api.createBreadApi({
      db,
      context,
      observedHeadBlock: async () => 101n,
      now: () => new Date('2026-08-09T14:00:00.000Z'),
    });

    const tokenResponse = await app.inject({ method: 'GET', url: `/v1/tokens/${token}` });
    expect(tokenResponse.statusCode).toBe(200);
    const tokenBody = tokenResponse.json() as { data: Record<string, unknown> };
    expect(tokenBody.data).toMatchObject({
      metrics: {
        lastPrice: { numerator: '415', denominator: '50', source: 'CURVE_EXECUTION' },
        quoteVolume: { m5: '1415', h1: '1415', h24: '1415' },
        tradeCount: { h1: '2', h24: '2' },
        uniqueTraders: { h1: '2', h24: '2' },
      },
      curveState: {
        trackedQuote: '600', trackedTokens: '950', quoteFeeBalance: '65', creatorTaxBalance: '25',
        realQuoteReserve: '510', virtualQuoteReserve: '610', remainingSellableTokens: '750',
      },
    });

    const feedResponse = await app.inject({ method: 'GET', url: '/v1/feed?view=new&limit=1' });
    expect(feedResponse.statusCode).toBe(200);
    const feedBody = feedResponse.json() as { data: Array<Record<string, unknown>> };
    expect(feedBody.data[0]).toMatchObject({
      tokenAddress: token,
      metrics: {
        lastPrice: { numerator: '415', denominator: '50', source: 'CURVE_EXECUTION' },
        quoteVolume: { h1: '1415' },
        tradeCount: { h1: '2' },
        uniqueTraders: { h1: '2' },
      },
    });

    await app.close();
  });
});
