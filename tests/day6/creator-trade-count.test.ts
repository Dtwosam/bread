import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address, DecodedBreadEvent, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;
const factory = address('1');
const token = address('2');
const curve = address('3');
const creator = address('4');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task6-creator-trade-stack',
  factoryAddress: factory,
  quoteAsset: address('b'),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('c'),
    feePolicy: address('d'),
    feeEscrow: address('e'),
    emergencyController: address('f'),
    locker: address('8'),
    coordinator: address('7'),
    graduationAdapter: address('6'),
  },
};

function tradeEvent(
  side: 'CurveBuy' | 'CurveSell',
  transactionHash: Hex32,
  logIndex: number,
): DecodedBreadEvent {
  const common = {
    identity: { chainId: context.chainId, transactionHash, logIndex },
    blockNumber: 101n,
    blockHash: hash('c'),
    blockTimestamp: 1_786_262_461n,
    transactionIndex: logIndex,
    contractAddress: curve,
    contractRole: 'CURVE' as const,
    stackVersion: context.stackVersion,
    topic0: hash('d'),
    topics: [hash('d')],
    data: '0x' as const,
  };
  return side === 'CurveBuy'
    ? ({ ...common, eventName: 'CurveBuy', payload: {
        buyer: address('9'), recipient: address('9'), quoteIn: 100n, tokensOut: 10n, fee: 1n, tax: 0n,
      } } as DecodedBreadEvent)
    : ({ ...common, eventName: 'CurveSell', payload: {
        seller: address('9'), recipient: address('9'), tokensIn: 5n, quoteOut: 50n, fee: 1n, tax: 0n,
      } } as DecodedBreadEvent);
}

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};
const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 6 Task 6 creator trade-count projection', () => {
  const schemaName = `day6_task6_creator_trades_${process.pid}`;
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
    await pool.query('TRUNCATE creator_rollups, launch_state, token_metrics, launches CASCADE');
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        creator_fee_recipient, initial_supply, reserved_tokens_baseline, graduation_threshold,
        launch_block_number, launch_transaction_hash, launch_log_index
      ) VALUES ($1,$2,$3,$4,$5,$6,'1000','200','900','100',$7,4)`,
      [context.chainId, token, curve, context.stackVersion, factory, creator, hash('1')],
    );
    await pool.query(
      `INSERT INTO launch_state (
        chain_id, token_address, remaining_sellable_tokens, tracked_sold_inventory,
        real_quote_reserve, updated_at
      ) VALUES ($1,$2,'400','400','450',now())`,
      [context.chainId, token],
    );
  });

  it('counts canonical curve trades for the exact launch fee recipient without inventing revenue', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const reducers = await import('../../apps/indexer/src/reducers.ts');
    const db = dbModule.createBreadDb(pool);
    const reducer = reducers.createFeeAdminGraduationReducer({ context });

    await db.transaction(async (tx) => {
      await reducer(tx, tradeEvent('CurveBuy', hash('a'), 0));
      await reducer(tx, tradeEvent('CurveSell', hash('b'), 0));
    });

    const row = (await pool.query(`SELECT creator_address, token_address, accrued_fees::text, claimed_fees::text, trade_count::text
      FROM creator_rollups WHERE chain_id=$1 AND creator_address=$2 AND token_address=$3`, [context.chainId, creator, token])).rows[0];
    expect(row).toEqual({
      creator_address: creator,
      token_address: token,
      accrued_fees: '0',
      claimed_fees: '0',
      trade_count: '2',
    });
  });
});
