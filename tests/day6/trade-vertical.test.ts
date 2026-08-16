import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address('1');
const token = address('2');
const curve = address('3');
const buyer = address('4');
const buyRecipient = address('5');
const seller = address('6');
const sellRecipient = address('7');
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

const buyTx = hash('a');
const sellTx = hash('b');
const blockHash = hash('c');
const topic0 = hash('d');
const blockTimestamp = 1_786_262_461n; // bucket starts: 1786262460 / 1786262400 / 1786262400

type FixtureLog = Readonly<{
  address: Address;
  blockNumber: bigint;
  blockHash: Hex32;
  transactionHash: Hex32;
  transactionIndex: number;
  logIndex: number;
  eventName: string;
  args: Readonly<Record<string, unknown>>;
  topics: readonly Hex32[];
  data: `0x${string}`;
}>;

const buyLogs: FixtureLog[] = [
  {
    address: curve,
    blockNumber: 101n,
    blockHash,
    transactionHash: buyTx,
    transactionIndex: 1,
    logIndex: 1,
    eventName: 'CurveBuyRefunded',
    args: { buyer, refund: 10n },
    topics: [topic0],
    data: '0x',
  },
  {
    address: curve,
    blockNumber: 101n,
    blockHash,
    transactionHash: buyTx,
    transactionIndex: 1,
    logIndex: 2,
    eventName: 'OpeningProtectionApplied',
    args: { buyer, recipient: buyRecipient, taxBps: 500n, taxAmount: 45n, launchBuyExempt: false },
    topics: [topic0],
    data: '0x',
  },
  {
    address: curve,
    blockNumber: 101n,
    blockHash,
    transactionHash: buyTx,
    transactionIndex: 1,
    logIndex: 3,
    eventName: 'CurveBuy',
    args: { buyer, recipient: buyRecipient, quoteIn: 1_000n, tokensOut: 100n, fee: 10n, tax: 20n },
    topics: [topic0],
    data: '0x',
  },
];

const sellLog: FixtureLog = {
  address: curve,
  blockNumber: 101n,
  blockHash,
  transactionHash: sellTx,
  transactionIndex: 2,
  logIndex: 0,
  eventName: 'CurveSell',
  args: { seller, recipient: sellRecipient, tokensIn: 50n, quoteOut: 400n, fee: 10n, tax: 5n },
  topics: [topic0],
  data: '0x',
};

const tradeLogs = [...buyLogs, sellLog];

async function normalize(logs: readonly FixtureLog[]) {
  const module = await import('../../apps/indexer/src/normalize.ts');
  return module.normalizeTransactionLogs({
    client: { readContract: async () => { throw new Error('no immutable launch read expected'); } },
    context,
    knownLaunches: [{ tokenAddress: token, curveAddress: curve }],
    logs,
    toBlock: 101n,
    toBlockTimestamp: blockTimestamp,
  } as never) as Promise<Record<string, unknown>>;
}

describe('Day 6 Task 5 transaction-local trade normalization', () => {
  it('correlates refund/opening protection into one canonical BUY and keeps SELL identity exact', async () => {
    const normalized = await normalize(tradeLogs);
    const trades = normalized.trades as Array<Record<string, unknown>> | undefined;
    expect(trades).toHaveLength(2);

    expect(trades?.[0]).toMatchObject({
      id: { chainId: context.chainId, transactionHash: buyTx, logIndex: 3 },
      side: 'BUY',
      token,
      curve,
      actor: buyer,
      recipient: buyRecipient,
      offeredQuote: 1_010n,
      quoteAmount: 1_000n,
      tokenAmount: 100n,
      baseFee: 10n,
      creatorTax: 20n,
      openingTaxBps: 500n,
      openingTax: 45n,
      launchBuyExempt: false,
      refund: 10n,
      netCurveInput: 925n,
      grossCurveQuoteOut: 0n,
      executionPriceNumerator: 925n,
      executionPriceDenominator: 100n,
    });
    expect(trades?.[1]).toMatchObject({
      id: { chainId: context.chainId, transactionHash: sellTx, logIndex: 0 },
      side: 'SELL',
      token,
      curve,
      actor: seller,
      recipient: sellRecipient,
      offeredQuote: 0n,
      quoteAmount: 415n,
      tokenAmount: 50n,
      baseFee: 10n,
      creatorTax: 5n,
      openingTaxBps: 0n,
      openingTax: 0n,
      launchBuyExempt: false,
      refund: 0n,
      netCurveInput: 0n,
      grossCurveQuoteOut: 415n,
      executionPriceNumerator: 415n,
      executionPriceDenominator: 50n,
    });
  });

  it('rejects a BUY when mandatory opening-protection context is missing', async () => {
    await expect(normalize([buyLogs[0]!, buyLogs[2]!])).rejects.toThrow(/OpeningProtectionApplied|opening protection/i);
  });

  it('rejects ambiguous matching BUY context instead of guessing', async () => {
    await expect(normalize([buyLogs[0]!, { ...buyLogs[0]!, logIndex: 2 }, { ...buyLogs[1]!, logIndex: 3 }, { ...buyLogs[2]!, logIndex: 4 }])).rejects.toThrow(/ambiguous|refund/i);
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
};
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

async function seedLaunch(pool: TestPool): Promise<void> {
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
    ) VALUES ($1,$2,$3,'100','100',$4,'1786262400','day6-v1','COMMITTED')`,
    [context.chainId, context.stackVersion, factory, hash('2')],
  );
}

describe.skipIf(!RUN_DB)('Day 6 Task 5 trade projections and read API', () => {
  const schemaName = `day6_task5_${process.pid}`;
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
    const dbModule = await import('../../packages/db/src/index.ts');
    await dbModule.migrateBreadDb(pool);
    await pool.query('TRUNCATE event_journal, trades, market_candles, token_metrics, launch_state, launches, indexer_checkpoints, protocol_stacks CASCADE');
    await seedLaunch(pool);
  });

  async function applyFixture() {
    const dbModule = await import('../../packages/db/src/index.ts');
    const applyModule = await import('../../apps/indexer/src/apply-range.ts');
    const db = dbModule.createBreadDb(pool);
    await applyModule.applyRange({
      db,
      client: { readContract: async () => { throw new Error('no immutable launch read expected'); } },
      context,
      fromBlock: 101n,
      toBlock: 101n,
      toBlockHash: blockHash,
      toBlockTimestamp: blockTimestamp,
      logs: tradeLogs,
    } as never);
    return db;
  }

  it('projects only CurveBuy/CurveSell as trades and builds 1m/5m/1h candles plus token metrics', async () => {
    await applyFixture();

    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM event_journal) AS journal_count,
        (SELECT count(*)::int FROM trades) AS trade_count,
        (SELECT count(*)::int FROM market_candles) AS candle_count,
        (SELECT count(*)::int FROM token_metrics) AS metric_count
    `);
    expect(counts.rows[0]).toMatchObject({ journal_count: 4, trade_count: 2, candle_count: 3, metric_count: 1 });

    const trades = await pool.query(`
      SELECT transaction_hash, log_index, side, quote_amount, base_amount, fee_amount, tax_amount
      FROM trades
      ORDER BY transaction_index, log_index
    `);
    expect(trades.rows).toEqual([
      expect.objectContaining({ transaction_hash: buyTx, log_index: 3, side: 'BUY', quote_amount: '1000', base_amount: '100', fee_amount: '10', tax_amount: '20' }),
      expect.objectContaining({ transaction_hash: sellTx, log_index: 0, side: 'SELL', quote_amount: '415', base_amount: '50', fee_amount: '10', tax_amount: '5' }),
    ]);

    const candles = await pool.query(`
      SELECT interval_seconds, quote_volume, trade_count
      FROM market_candles
      ORDER BY interval_seconds
    `);
    expect(candles.rows).toEqual([
      expect.objectContaining({ interval_seconds: 60, quote_volume: '1415', trade_count: '2' }),
      expect.objectContaining({ interval_seconds: 300, quote_volume: '1415', trade_count: '2' }),
      expect.objectContaining({ interval_seconds: 3600, quote_volume: '1415', trade_count: '2' }),
    ]);
  });

  it('projects baked progress from tracked quote over the snapshotted graduation threshold', async () => {
    await applyFixture();

    const progress = await pool.query(`
      SELECT
        state.tracked_quote,
        launch.graduation_threshold,
        metrics.graduation_progress_bps,
        metrics.graduation_state
      FROM launch_state state
      INNER JOIN launches launch
        ON launch.chain_id = state.chain_id
       AND launch.token_address = state.token_address
      INNER JOIN token_metrics metrics
        ON metrics.chain_id = state.chain_id
       AND metrics.token_address = state.token_address
      WHERE state.chain_id = $1 AND state.token_address = $2
    `, [context.chainId, token.toLowerCase()]);

    expect(progress.rows).toEqual([
      expect.objectContaining({
        tracked_quote: '600',
        graduation_threshold: '900',
        graduation_progress_bps: '6666',
        graduation_state: 'CURVE_ACTIVE',
      }),
    ]);
  });

  it('serves reverse-chain-order trades with bounded cursor pagination and no RPC fallback', async () => {
    const db = await applyFixture();
    const apiModule = await import('../../apps/api/src/server.ts');
    const app = apiModule.createBreadApi({
      db,
      context,
      observedHeadBlock: async () => 101n,
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    });

    const firstResponse = await app.inject({ method: 'GET', url: `/v1/tokens/${token}/trades?limit=1` });
    expect(firstResponse.statusCode).toBe(200);
    const first = firstResponse.json() as { data: Array<Record<string, unknown>>; meta: Record<string, unknown>; page: { hasMore: boolean; nextCursor?: string } };
    expect(first.data).toHaveLength(1);
    expect(first.data[0]).toMatchObject({ side: 'SELL', transactionHash: sellTx, logIndex: 0, quoteAmount: '415' });
    expect(first.meta).toMatchObject({ source: 'bread-indexer', indexedThroughBlock: '101' });
    expect(first.page.hasMore).toBe(true);
    expect(first.page.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);

    const secondResponse = await app.inject({ method: 'GET', url: `/v1/tokens/${token}/trades?limit=1&cursor=${first.page.nextCursor}` });
    expect(secondResponse.statusCode).toBe(200);
    const second = secondResponse.json() as { data: Array<Record<string, unknown>>; page: { hasMore: boolean; nextCursor?: string } };
    expect(second.data[0]).toMatchObject({ side: 'BUY', transactionHash: buyTx, logIndex: 3, quoteAmount: '1000' });
    expect(second.page.hasMore).toBe(false);

    const malformed = await app.inject({ method: 'GET', url: `/v1/tokens/${token}/trades?cursor=not-a-valid-cursor` });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ error: { code: 'INVALID_CURSOR' } });

    await app.close();
  });
});
