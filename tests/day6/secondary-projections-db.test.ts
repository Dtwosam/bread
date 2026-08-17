import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const addr = (byte: string) => `0x${byte.repeat(20)}` as Address;
const factory = addr('11');
const firstToken = addr('aa');
const firstCurve = addr('1a');
const secondToken = addr('bb');
const secondCurve = addr('1b');
const deployer = addr('41');
const trader = addr('42');
const graduationContract = addr('43');
const launchOneTx = `0x${'10'.repeat(32)}`;
const launchTwoTx = `0x${'20'.repeat(32)}`;
const tradeOneTx = `0x${'30'.repeat(32)}`;
const tradeTwoTx = `0x${'40'.repeat(32)}`;
const graduationTx = `0x${'50'.repeat(32)}`;
const blockHash = `0x${'ab'.repeat(32)}`;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'secondary-projections-test',
  factoryAddress: factory,
  quoteAsset: addr('31'),
  quoteDecimals: 6,
  deploymentStartBlock: 90n,
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

describe.skipIf(!RUN_DB)('Day 6 indexed Activity and Stats projections', () => {
  const schemaName = `day6_secondary_${process.pid}`;
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
    await pool.query('TRUNCATE event_journal, launch_state, token_metrics, trades, launches, indexer_checkpoints, protocol_stacks CASCADE');

    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'90','130',$4,'1730000130','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory.toLowerCase(), blockHash],
    );

    const launches = [
      [firstToken, firstCurve, '1730000100', '100', 1, launchOneTx, 'First Bread', 'ONE'],
      [secondToken, secondCurve, '1730000105', '105', 2, launchTwoTx, 'Second Bread', 'TWO'],
    ] as const;
    for (const [token, curve, timestamp, block, logIndex, txHash, name, symbol] of launches) {
      await pool.query(
        `INSERT INTO launches (
          chain_id, token_address, curve_address, stack_version, factory_address,
          deployer_address, creator_fee_recipient, launch_timestamp, initial_supply,
          phantom_quote, graduation_threshold, reserved_tokens_baseline,
          launch_block_number, launch_transaction_hash, launch_log_index, name, symbol
        ) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,'1000000','100','900','200',$8,$9,$10,$11,$12)`,
        [
          context.chainId,
          token.toLowerCase(),
          curve.toLowerCase(),
          context.stackVersion,
          factory.toLowerCase(),
          deployer.toLowerCase(),
          timestamp,
          block,
          txHash,
          logIndex,
          name,
          symbol,
        ],
      );
    }

    await pool.query(
      `INSERT INTO trades (
        chain_id, transaction_hash, log_index, token_address, curve_address,
        side, trader_address, recipient_address, base_amount, quote_amount,
        fee_amount, tax_amount, block_number, block_timestamp, transaction_index,
        stack_version
      ) VALUES
        ($1,$2,3,$3,$4,'BUY',$5,$5,'10','20000000','0','0','110','1730000110',0,$6),
        ($1,$7,4,$8,$9,'SELL',$5,$5,'20','30000000','0','0','115','1730000115',0,$6)`,
      [
        context.chainId,
        tradeOneTx,
        firstToken.toLowerCase(),
        firstCurve.toLowerCase(),
        trader.toLowerCase(),
        context.stackVersion,
        tradeTwoTx,
        secondToken.toLowerCase(),
        secondCurve.toLowerCase(),
      ],
    );

    await pool.query(
      `INSERT INTO launch_state (
        chain_id, token_address, mode, graduation_phase, ready_to_graduate,
        graduation_completed_block, graduation_completed_log_index
      ) VALUES
        ($1,$2,'ACTIVE','NOT_GRADUATED',false,null,null),
        ($1,$3,'GRADUATED','POOL_CREATED',false,'120',7)`,
      [context.chainId, firstToken.toLowerCase(), secondToken.toLowerCase()],
    );

    await pool.query(
      `INSERT INTO event_journal (
        chain_id, transaction_hash, log_index, block_number, block_hash,
        block_timestamp, transaction_index, contract_address, contract_role,
        stack_version, token_address, curve_address, decoder_schema_version,
        event_name, topic0, topics, data, payload
      ) VALUES ($1,$2,7,'120',$3,'1730000120',0,$4,'GRADUATION_ADAPTER',$5,$6,$7,'day6-v1','Graduated',$8,'[]'::jsonb,'0x','{}'::jsonb)`,
      [
        context.chainId,
        graduationTx,
        blockHash,
        graduationContract.toLowerCase(),
        context.stackVersion,
        secondToken.toLowerCase(),
        secondCurve.toLowerCase(),
        `0x${'99'.repeat(32)}`,
      ],
    );
  });

  it('serves canonical activity order and exact lifetime totals without fabricating metrics', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const apiModule = await import('../../apps/api/src/server.ts');
    const app = apiModule.createBreadApi({
      db: dbModule.createBreadDb(pool),
      context,
      observedHeadBlock: async () => 130n,
      now: () => new Date('2030-01-01T00:00:00.000Z'),
    });

    const activity = await app.inject({ method: 'GET', url: '/v1/activity?limit=10' });
    expect(activity.statusCode).toBe(200);
    expect(activity.json()).toMatchObject({
      data: [
        { kind: 'GRADUATION', tokenAddress: secondToken.toLowerCase(), transactionHash: graduationTx, creatorAddress: deployer.toLowerCase(), blockNumber: '120', logIndex: 7 },
        { kind: 'TRADE', tokenAddress: secondToken.toLowerCase(), transactionHash: tradeTwoTx, side: 'SELL', quoteAmount: '30000000', blockNumber: '115', logIndex: 4 },
        { kind: 'TRADE', tokenAddress: firstToken.toLowerCase(), transactionHash: tradeOneTx, side: 'BUY', quoteAmount: '20000000', blockNumber: '110', logIndex: 3 },
        { kind: 'LAUNCH', tokenAddress: secondToken.toLowerCase(), transactionHash: launchTwoTx, creatorAddress: deployer.toLowerCase(), blockNumber: '105', logIndex: 2 },
        { kind: 'LAUNCH', tokenAddress: firstToken.toLowerCase(), transactionHash: launchOneTx, creatorAddress: deployer.toLowerCase(), blockNumber: '100', logIndex: 1 },
      ],
    });

    const stats = await app.inject({ method: 'GET', url: '/v1/stats' });
    expect(stats.statusCode).toBe(200);
    expect(stats.json()).toMatchObject({
      data: {
        scope: 'LIFETIME',
        quoteVolume: '50000000',
        launches: '2',
        trades: '2',
        graduations: '1',
      },
    });

    const invalidLimit = await app.inject({ method: 'GET', url: '/v1/activity?limit=101' });
    expect(invalidLimit.statusCode).toBe(400);
    expect(invalidLimit.json()).toMatchObject({ error: { code: 'INVALID_LIMIT' } });

    await app.close();
  });
});
