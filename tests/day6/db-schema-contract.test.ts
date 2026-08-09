import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as {
  Pool: new (config: Record<string, unknown>) => {
    query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
};

type TestPool = InstanceType<typeof Pool>;

function stringRows(rows: unknown[], key: string): string[] {
  return rows.map((row) => String((row as Record<string, unknown>)[key]));
}

describe.skipIf(!RUN_DB)('Day 6 Task 3 exact read-stack schema contract', () => {
  const schemaName = `day6_task3_contract_${process.pid}`;
  let adminPool: TestPool;
  let pool: TestPool;

  beforeAll(async () => {
    const connectionString =
      process.env.BREAD_DATABASE_URL ?? 'postgresql://bread:bread_local_only@127.0.0.1:5432/bread';
    adminPool = new Pool({ connectionString });
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await adminPool.query(`CREATE SCHEMA ${schemaName}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schemaName}` });

    const dbModule = await import('../../packages/db/src/index.ts');
    const migrateBreadDb = (dbModule as Record<string, unknown>).migrateBreadDb as
      | ((pool: TestPool) => Promise<void>)
      | undefined;
    expect(migrateBreadDb).toBeTypeOf('function');
    await migrateBreadDb?.(pool);
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await adminPool.end();
    }
  });

  it('stores event context and decoder/schema version in the canonical journal', async () => {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'event_journal'
       ORDER BY ordinal_position`,
      [schemaName],
    );
    expect(stringRows(result.rows, 'column_name')).toEqual(
      expect.arrayContaining(['token_address', 'curve_address', 'decoder_schema_version']),
    );
  });

  it('keys protocol stacks by chain + stack version + factory address', async () => {
    const result = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid = 'protocol_stacks'::regclass AND contype = 'p'`,
    );
    expect(String((result.rows[0] as { definition?: string } | undefined)?.definition)).toMatch(
      /PRIMARY KEY \(chain_id, stack_version, factory_address\)/,
    );
  });

  it('enforces one canonical launch token per curve on a chain', async () => {
    const result = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid = 'launches'::regclass AND contype = 'u'`,
    );
    const definitions = stringRows(result.rows, 'definition');
    expect(definitions.some((definition) => /UNIQUE \(chain_id, curve_address\)/.test(definition))).toBe(true);
  });

  it('keys checkpoints by chain + stack + factory and stores committed-boundary metadata', async () => {
    const columns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'indexer_checkpoints'
       ORDER BY ordinal_position`,
      [schemaName],
    );
    expect(stringRows(columns.rows, 'column_name')).toEqual(
      expect.arrayContaining([
        'factory_address',
        'deployment_start_block',
        'indexed_through_block_timestamp',
        'last_transaction_hash',
        'last_log_index',
        'decoder_schema_version',
        'status',
        'applied_at',
      ]),
    );

    const primaryKey = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid = 'indexer_checkpoints'::regclass AND contype = 'p'`,
    );
    expect(String((primaryKey.rows[0] as { definition?: string } | undefined)?.definition)).toMatch(
      /PRIMARY KEY \(chain_id, stack_version, factory_address\)/,
    );
  });
});
