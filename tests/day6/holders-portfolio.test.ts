import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address, DecodedBreadEvent, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;
const ZERO = address('0');

const factory = address('1');
const tokenA = address('2');
const curveA = address('3');
const tokenB = address('4');
const curveB = address('5');
const walletA = address('6');
const walletB = address('7');
const coordinator = address('8');
const locker = address('9');
const adapter = address('a');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task7-test-stack',
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
    locker,
    coordinator,
    graduationAdapter: adapter,
  },
};

function transfer(
  token: Address,
  transactionHash: Hex32,
  logIndex: number,
  from: Address,
  to: Address,
  value: bigint,
  blockNumber: bigint,
): DecodedBreadEvent {
  return {
    identity: { chainId: context.chainId, transactionHash, logIndex },
    blockNumber,
    blockHash: hash('c'),
    blockTimestamp: 1_786_262_500n + blockNumber - 101n,
    transactionIndex: 1,
    contractAddress: token,
    contractRole: 'LAUNCH_TOKEN',
    stackVersion: context.stackVersion,
    topic0: hash('d'),
    topics: [hash('d')],
    data: '0x',
    eventName: 'Transfer',
    payload: { from, to, value },
  } as DecodedBreadEvent;
}

describe('Day 6 Task 7 holder/portfolio surface', () => {
  it('exposes one canonical holder reducer factory and last-event schema fields', async () => {
    const reducers = await import('../../apps/indexer/src/reducers.ts');
    const db = await import('../../packages/db/src/index.ts');
    expect((reducers as Record<string, unknown>).createHolderReducer).toBeTypeOf('function');
    const holder = db.holderSnapshots as unknown as Record<string, unknown>;
    expect(holder.lastTransactionHash).toBeDefined();
    expect(holder.lastLogIndex).toBeDefined();
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 6 Task 7 holders and portfolio against PostgreSQL', () => {
  const schemaName = `day6_task7_${process.pid}`;
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
    await pool.query('TRUNCATE event_journal, holder_snapshots, token_metrics, launch_state, launches, indexer_checkpoints CASCADE');
    for (const [token, curve, name, symbol, logIndex] of [
      [tokenA, curveA, 'Alpha', 'ALP', 1],
      [tokenB, curveB, 'Beta', 'BET', 2],
    ] as const) {
      await pool.query(
        `INSERT INTO launches (
          chain_id, token_address, curve_address, stack_version, factory_address,
          deployer_address, creator_fee_recipient, launch_timestamp, quote_asset,
          initial_supply, graduation_threshold, graduation_coordinator, graduation_adapter,
          reserved_tokens_baseline, launch_block_number, launch_transaction_hash, launch_log_index,
          name, symbol
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'1786262400',$8,'1000','900',$9,$10,'200','100',$11,$12,$13,$14)`,
        [context.chainId, token, curve, context.stackVersion, factory, walletA, walletA, context.quoteAsset, coordinator, adapter, hash(String(logIndex)), logIndex, name, symbol],
      );
    }
    await pool.query(
      `INSERT INTO launch_state (chain_id, token_address, graduation_phase, latest_block_number)
       VALUES ($1,$2,'NOT_GRADUATED','100'), ($1,$3,'POOL_CREATED','100')`,
      [context.chainId, tokenA, tokenB],
    );
    await pool.query(
      `INSERT INTO token_metrics (
        chain_id, token_address, last_price_numerator, last_price_denominator,
        last_price_source, graduation_state, latest_block_number
       ) VALUES
       ($1,$2,'3','2','CURVE_EXECUTION','ACTIVE','100'),
       ($1,$3,'5','2','CURVE_EXECUTION','POOL_CREATED','100')`,
      [context.chainId, tokenA, tokenB],
    );
    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'100','100',$4,'1786262400','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory, hash('0')],
    );
  });

  async function holderReducer() {
    const reducers = await import('../../apps/indexer/src/reducers.ts');
    const factoryFn = (reducers as Record<string, unknown>).createHolderReducer;
    if (typeof factoryFn !== 'function') throw new Error('createHolderReducer is not implemented');
    return (factoryFn as (input: { context: ProtocolContext }) => (tx: unknown, ev: DecodedBreadEvent) => Promise<void>)({ context });
  }

  async function apply(events: readonly DecodedBreadEvent[], fromBlock: bigint, toBlock: bigint) {
    const dbModule = await import('../../packages/db/src/index.ts');
    const db = dbModule.createBreadDb(pool);
    const reducer = await holderReducer();
    const repository = new dbModule.IndexerRepository(db, [reducer]);
    return repository.applyCanonicalRange({
      context,
      fromBlock,
      toBlock,
      toBlockHash: hash('f'),
      toBlockTimestamp: 1_786_262_500n + toBlock - 101n,
      events,
    });
  }

  const events = [
    transfer(tokenA, hash('1'), 0, ZERO, curveA, 1_000n, 101n),
    transfer(tokenA, hash('2'), 0, curveA, walletA, 400n, 102n),
    transfer(tokenA, hash('3'), 0, walletA, walletB, 100n, 103n),
    transfer(tokenA, hash('4'), 0, walletB, ZERO, 25n, 104n),
    transfer(tokenB, hash('5'), 0, ZERO, curveB, 1_000n, 105n),
    transfer(tokenB, hash('6'), 0, curveB, walletA, 50n, 106n),
  ] as const;

  it('reconstructs mint/transfer/burn balances, tags protocol holders, and replay does not double-apply', async () => {
    await apply(events, 101n, 106n);
    await apply(events, 101n, 106n);

    const result = await pool.query(
      `SELECT token_address, holder_address, balance::text, is_protocol_address,
              as_of_block_number::text, last_transaction_hash, last_log_index
       FROM holder_snapshots
       ORDER BY token_address, holder_address`,
    );
    expect(result.rows).toEqual([
      expect.objectContaining({ token_address: tokenA, holder_address: curveA, balance: '600', is_protocol_address: true }),
      expect.objectContaining({ token_address: tokenA, holder_address: walletA, balance: '300', is_protocol_address: false }),
      expect.objectContaining({ token_address: tokenA, holder_address: walletB, balance: '75', is_protocol_address: false }),
      expect.objectContaining({ token_address: tokenB, holder_address: curveB, balance: '950', is_protocol_address: true }),
      expect.objectContaining({ token_address: tokenB, holder_address: walletA, balance: '50', is_protocol_address: false }),
    ]);
    expect(result.rows.some((row) => row.holder_address === ZERO)).toBe(false);
  });

  it('rejects a transfer that would make a projected holder balance negative', async () => {
    await expect(
      apply([transfer(tokenA, hash('7'), 0, walletA, walletB, 1n, 101n)], 101n, 101n),
    ).rejects.toThrow(/negative|holder balance|integrity/i);

    const journal = await pool.query('SELECT count(*)::int AS count FROM event_journal');
    expect(journal.rows[0]?.count).toBe(0);
  });

  it('serves bounded holders and two-token portfolio from DB only without fabricated cost basis', async () => {
    await apply(events, 101n, 106n);
    const { createBreadApi } = await import('../../apps/api/src/server.ts');
    let observedHeadCalls = 0;
    const app = createBreadApi({
      db: (await import('../../packages/db/src/index.ts')).createBreadDb(pool),
      context,
      observedHeadBlock: async () => {
        observedHeadCalls += 1;
        return 106n;
      },
      now: () => new Date('2026-08-09T16:30:00.000Z'),
    });

    const holders = await app.inject({ method: 'GET', url: `/v1/tokens/${tokenA}/holders?limit=2` });
    expect(holders.statusCode).toBe(200);
    const holderBody = holders.json();
    expect(holderBody.data.tokenAddress).toBe(tokenA);
    expect(holderBody.data.holders).toHaveLength(2);
    expect(holderBody.data.holders.some((row: { isProtocolAddress: boolean }) => row.isProtocolAddress)).toBe(true);
    expect(holderBody.data.concentration.top10ExcludesProtocolAddresses).toBe(true);
    expect(holderBody.meta.source).toBe('bread-indexer');
    expect(holderBody.page.hasMore).toBe(true);
    expect(typeof holderBody.page.nextCursor).toBe('string');

    const second = await app.inject({
      method: 'GET',
      url: `/v1/tokens/${tokenA}/holders?limit=2&cursor=${encodeURIComponent(holderBody.page.nextCursor)}`,
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.data.holders).toHaveLength(1);
    expect(new Set([...holderBody.data.holders, ...secondBody.data.holders].map((row: { walletAddress: string }) => row.walletAddress)).size).toBe(3);

    const portfolio = await app.inject({ method: 'GET', url: `/v1/portfolio/${walletA}` });
    expect(portfolio.statusCode).toBe(200);
    const portfolioBody = portfolio.json();
    expect(portfolioBody.data.walletAddress).toBe(walletA);
    expect(portfolioBody.data.holdings.map((row: { tokenAddress: string }) => row.tokenAddress).sort()).toEqual([tokenA, tokenB].sort());
    expect(JSON.stringify(portfolioBody.data)).not.toMatch(/averageEntry|pnl/i);
    const graduated = portfolioBody.data.holdings.find((row: { tokenAddress: string }) => row.tokenAddress === tokenB);
    expect(graduated.price.status).toBe('UNAVAILABLE');
    expect(graduated.currentValue.status).toBe('UNAVAILABLE');
    expect(portfolioBody.meta.source).toBe('bread-indexer');
    expect(observedHeadCalls).toBeGreaterThan(0);

    await app.close();
  });

  it('rejects malformed holder cursors and invalid portfolio addresses with bounded 400 errors', async () => {
    const { createBreadApi } = await import('../../apps/api/src/server.ts');
    const app = createBreadApi({
      db: (await import('../../packages/db/src/index.ts')).createBreadDb(pool),
      context,
      observedHeadBlock: async () => 100n,
    });
    const badCursor = await app.inject({ method: 'GET', url: `/v1/tokens/${tokenA}/holders?cursor=%%%` });
    expect(badCursor.statusCode).toBe(400);
    expect(badCursor.json().error.code).toBe('INVALID_CURSOR');
    const badWallet = await app.inject({ method: 'GET', url: '/v1/portfolio/not-an-address' });
    expect(badWallet.statusCode).toBe(400);
    expect(badWallet.json().error.code).toBe('INVALID_ADDRESS');
    await app.close();
  });
});
