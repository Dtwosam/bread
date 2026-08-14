import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';

const address = (nibble: string) => `0x${nibble.repeat(40)}`;
const hash = (nibble: string) => `0x${nibble.repeat(64)}`;

const chainId = 5_042_002;
const stackVersion = 'day9-v3-indexing-db-red';
const factory = address('1');
const token = address('2');
const curve = address('3');
const buyer = address('4');
const recipient = address('5');
const transactionHash = hash('a');

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 9 V3 indexing curve venue PostgreSQL persistence', () => {
  const schemaName = `day9_v3_venue_${process.pid}`;
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

    const dbModule = await import('../../packages/db/src/index.ts');
    await dbModule.migrateBreadDb(pool);
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        initial_supply, phantom_quote, reserved_tokens_baseline,
        launch_block_number, launch_transaction_hash, launch_log_index
      ) VALUES ($1,$2,$3,$4,$5,'1000','100','0','100',$6,0)`,
      [chainId, token, curve, stackVersion, factory, hash('b')],
    );
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await adminPool.end();
    }
  });

  it('persists canonical Bread curve venue identity on the single trades row', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const db = dbModule.createBreadDb(pool);

    await dbModule.applyCanonicalTradeProjection(
      db,
      {
        id: { chainId, transactionHash, logIndex: 7 },
        stackVersion,
        side: 'BUY',
        token,
        curve,
        actor: buyer,
        recipient,
        offeredQuote: 100n,
        quoteAmount: 100n,
        tokenAmount: 10n,
        baseFee: 1n,
        creatorTax: 0n,
        openingTaxBps: 0n,
        openingTax: 0n,
        launchBuyExempt: false,
        refund: 0n,
        netCurveInput: 99n,
        netQuoteOut: 0n,
        grossCurveQuoteOut: 0n,
        executionPriceNumerator: 99n,
        executionPriceDenominator: 10n,
        blockNumber: 101n,
        blockTimestamp: 1_786_262_461n,
        transactionIndex: 1,
        venueKind: 'BREAD_CURVE',
        venueAddress: curve,
        venueFeeTier: null,
      } as never,
    );

    const result = await pool.query(
      `SELECT
        to_jsonb(t)->>'venue_kind' AS venue_kind,
        to_jsonb(t)->>'venue_address' AS venue_address,
        to_jsonb(t)->>'venue_fee_tier' AS venue_fee_tier
      FROM trades t
      WHERE chain_id = $1 AND transaction_hash = $2 AND log_index = 7`,
      [chainId, transactionHash],
    );

    expect(result.rows).toEqual([
      {
        venue_kind: 'BREAD_CURVE',
        venue_address: curve,
        venue_fee_tier: null,
      },
    ]);
  });
});
