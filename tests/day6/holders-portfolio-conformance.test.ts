import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}` as Address;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}` as Hex32;

const ZERO = address(0);
const factory = address(1);
const token = address(2);
const curve = address(3);
const launchDeployer = address(4);
const creator = address(5);
const quoteAsset = address(6);
const coordinator = address(7);
const adapter = address(8);
const wallet = address(9);
const tokenB = address(10);
const curveB = address(11);
const protocolFeeRecipient = address(12);
const factoryDeployer = address(13);
const feePolicy = address(14);
const feeEscrow = address(15);
const emergencyController = address(16);
const locker = address(17);

const blockHash = hash(101);
const txHash = hash(102);
const economicsDigest = hash(103);
const graduationConfigHash = hash(104);
const topic0 = hash(105);
const initialSupply = 1_000n;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task7-conformance-stack',
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: factoryDeployer,
    feePolicy,
    feeEscrow,
    emergencyController,
    locker,
    coordinator,
    graduationAdapter: adapter,
  },
};

function fakeReadClient() {
  return {
    readContract: async (request: Record<string, unknown>) => {
      const fn = String(request.functionName);
      const target = String(request.address).toLowerCase();
      if (target === factory.toLowerCase() && fn === 'getLaunch') {
        return {
          token,
          curve,
          deployer: launchDeployer,
          creatorFeeRecipient: creator,
          creatorTaxBps: 125,
          economicsDigest,
          launchTimestamp: 1_786_262_400,
          configVersion: 3,
          graduationCoordinator: coordinator,
          graduationAdapter: adapter,
          graduationAdapterFamily: 1,
          graduationConfigHash,
        };
      }
      if (target === factory.toLowerCase() && fn === 'stackVersion') return context.stackVersion;
      if (target === curve.toLowerCase()) {
        const values: Record<string, unknown> = {
          token,
          pairToken: quoteAsset,
          phantomQuote: 250_000_000n,
          graduationThreshold: 900n,
          protocolFeeRecipient,
          tradeFeeBps: 100,
          protocolFeeShareBps: 7_500,
          maxCreatorTaxBps: 1_000,
          creatorTaxBps: 125,
          launchTimestamp: 1_786_262_400,
          reservedTokens: 200n,
          graduationCoordinator: coordinator,
        };
        if (fn in values) return values[fn];
      }
      if (target === token.toLowerCase()) {
        const values: Record<string, unknown> = {
          name: 'Holder Conformance',
          symbol: 'HOLD',
          curve,
          launchFactory: factory,
          deployer: launchDeployer,
          logo: '',
          description: '',
          socials: ['', '', '', '', ''],
        };
        if (fn in values) return values[fn];
      }
      throw new Error(`unexpected read ${target}.${fn}`);
    },
  };
}

const constructorMint = {
  address: token,
  blockNumber: 100n,
  blockHash,
  transactionHash: txHash,
  transactionIndex: 0,
  logIndex: 0,
  eventName: 'Transfer',
  args: { from: ZERO, to: curve, value: initialSupply },
  topics: [topic0],
  data: '0x',
} as const;

const launchCreated = {
  address: factory,
  blockNumber: 100n,
  blockHash,
  transactionHash: txHash,
  transactionIndex: 0,
  logIndex: 4,
  eventName: 'LaunchCreated',
  args: {
    deployer: launchDeployer,
    token,
    curve,
    creatorFeeRecipient: creator,
    creatorTaxBps: 125n,
    economicsDigest,
    configVersion: 3n,
  },
  topics: [topic0],
  data: '0x',
} as const;

describe('Day 6 Task 7 holder conformance', () => {
  it('Approval is an explicit holdings no-op', async () => {
    const { createHolderReducer } = await import('../../apps/indexer/src/reducers.ts');
    const reducer = createHolderReducer({ context });
    await expect(
      reducer(null, {
        identity: { chainId: context.chainId, transactionHash: hash(106), logIndex: 0 },
        blockNumber: 100n,
        blockHash,
        blockTimestamp: 1_786_262_400n,
        transactionIndex: 0,
        contractAddress: token,
        contractRole: 'LAUNCH_TOKEN',
        stackVersion: context.stackVersion,
        topic0,
        topics: [topic0],
        data: '0x',
        eventName: 'Approval',
        payload: { owner: wallet, spender: curve, value: 100n },
      }),
    ).resolves.toBeUndefined();
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as { Pool: new (config: Record<string, unknown>) => TestPool };

describe.skipIf(!RUN_DB)('Day 6 Task 7 integrated conformance against PostgreSQL', () => {
  const schemaName = `day6_task7_conformance_${process.pid}`;
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
    await pool.query('TRUNCATE event_journal, holder_snapshots, token_metrics, launch_state, launches, indexer_checkpoints, protocol_stacks CASCADE');
  });

  it('projects constructor mint through real applyRange before LaunchCreated persistence', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const { applyRange } = await import('../../apps/indexer/src/apply-range.ts');
    await applyRange({
      db: dbModule.createBreadDb(pool),
      client: fakeReadClient(),
      context,
      fromBlock: 100n,
      toBlock: 100n,
      toBlockHash: blockHash,
      toBlockTimestamp: 1_786_262_400n,
      logs: [constructorMint, launchCreated],
    });

    const result = await pool.query(
      `SELECT holder_address, balance::text, is_protocol_address
       FROM holder_snapshots
       WHERE chain_id = $1 AND token_address = $2`,
      [context.chainId, token],
    );
    expect(result.rows).toEqual([
      expect.objectContaining({
        holder_address: curve,
        balance: initialSupply.toString(10),
        is_protocol_address: true,
      }),
    ]);
  });

  it('paginates a two-token wallet portfolio without overlap', async () => {
    await pool.query(
      `INSERT INTO launches (
        chain_id, token_address, curve_address, stack_version, factory_address,
        launch_block_number, launch_transaction_hash, launch_log_index, name, symbol
      ) VALUES
        ($1,$2,$3,$4,$5,'100',$6,1,'Alpha','ALP'),
        ($1,$7,$8,$4,$5,'101',$9,1,'Beta','BET')`,
      [context.chainId, token, curve, context.stackVersion, factory, hash(1), tokenB, curveB, hash(2)],
    );
    await pool.query(
      `INSERT INTO holder_snapshots (
        chain_id, token_address, holder_address, balance, is_protocol_address,
        as_of_block_number, last_transaction_hash, last_log_index
      ) VALUES
        ($1,$2,$3,'10',false,'100',$4,1),
        ($1,$5,$3,'20',false,'101',$6,1)`,
      [context.chainId, token, wallet, hash(3), tokenB, hash(4)],
    );
    await pool.query(
      `INSERT INTO indexer_checkpoints (
        chain_id, stack_version, factory_address, deployment_start_block,
        indexed_through_block, indexed_through_block_hash, indexed_through_block_timestamp,
        decoder_schema_version, status
      ) VALUES ($1,$2,$3,'100','101',$4,'1786262401','day6-v1','COMMITTED')`,
      [context.chainId, context.stackVersion, factory, hash(5)],
    );

    const { createBreadApi } = await import('../../apps/api/src/server.ts');
    const app = createBreadApi({
      db: (await import('../../packages/db/src/index.ts')).createBreadDb(pool),
      context,
      observedHeadBlock: async () => 101n,
    });

    const first = await app.inject({ method: 'GET', url: `/v1/portfolio/${wallet}?limit=1` });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.data.holdings).toHaveLength(1);
    expect(firstBody.page.hasMore).toBe(true);
    expect(typeof firstBody.page.nextCursor).toBe('string');

    const second = await app.inject({
      method: 'GET',
      url: `/v1/portfolio/${wallet}?limit=1&cursor=${encodeURIComponent(firstBody.page.nextCursor)}`,
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.data.holdings).toHaveLength(1);
    expect(secondBody.page.hasMore).toBe(false);
    expect(new Set([
      firstBody.data.holdings[0].tokenAddress,
      secondBody.data.holdings[0].tokenAddress,
    ]).size).toBe(2);

    await app.close();
  });
});
