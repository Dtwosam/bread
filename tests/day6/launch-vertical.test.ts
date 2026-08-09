import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Address, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const RUN_DB = process.env.BREAD_DB_INTEGRATION === '1';
const ZERO = `0x${'00'.repeat(20)}` as Address;
const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (byte: string) => `0x${byte.repeat(64)}` as Hex32;

const factory = address('1');
const token = address('2');
const curve = address('3');
const deployer = address('4');
const creator = address('5');
const quoteAsset = address('6');
const coordinator = address('7');
const adapter = address('8');
const protocolFeeRecipient = address('9');
const txHash = hash('a');
const blockHash = hash('b');
const economicsDigest = hash('c');
const graduationConfigHash = hash('d');
const topic0 = hash('e');
const initialSupply = 1_000_000_000_000_000_000_000n;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task4-test-stack',
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('a'),
    feePolicy: address('b'),
    feeEscrow: address('c'),
    emergencyController: address('d'),
    locker: address('e'),
    coordinator,
    graduationAdapter: adapter,
  },
};

type FixtureLog = Readonly<{
  address: Address;
  blockNumber: bigint;
  blockHash: Hex32;
  transactionHash: Hex32;
  transactionIndex: number;
  logIndex: number;
  eventName: 'Transfer' | 'LaunchCreated';
  args: Readonly<Record<string, unknown>>;
  topics: readonly Hex32[];
  data: `0x${string}`;
}>;

const constructorMint: FixtureLog = {
  address: token,
  blockNumber: 100n,
  blockHash,
  transactionHash: txHash,
  transactionIndex: 2,
  logIndex: 0,
  eventName: 'Transfer',
  args: { from: ZERO, to: curve, value: initialSupply },
  topics: [topic0],
  data: '0x',
};

const launchCreated: FixtureLog = {
  address: factory,
  blockNumber: 100n,
  blockHash,
  transactionHash: txHash,
  transactionIndex: 2,
  logIndex: 4,
  eventName: 'LaunchCreated',
  args: {
    deployer,
    token,
    curve,
    creatorFeeRecipient: creator,
    creatorTaxBps: 125n,
    economicsDigest,
    configVersion: 3n,
  },
  topics: [topic0],
  data: '0x',
};

async function optionalModule(relativePath: string): Promise<Record<string, unknown>> {
  const href = new URL(relativePath, import.meta.url).href;
  try {
    return (await import(/* @vite-ignore */ href)) as Record<string, unknown>;
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'ERR_MODULE_NOT_FOUND' || /cannot find module|failed to load url/i.test(message)) return {};
    throw error;
  }
}

function requestedAddresses(request: Record<string, unknown>): string[] {
  const value = request.address;
  if (Array.isArray(value)) return value.map(String).map((item) => item.toLowerCase());
  return value ? [String(value).toLowerCase()] : [];
}

describe('Day 6 Task 4 deterministic launch discovery', () => {
  it('discovers Factory launches first, expands token/curve addresses, deduplicates, and restores chain order', async () => {
    const module = await optionalModule('../../apps/indexer/src/discovery.ts');
    const discoverRange = module.discoverRange as
      | ((
          client: { getLogs: (request: Record<string, unknown>) => Promise<readonly FixtureLog[]> },
          protocolContext: ProtocolContext,
          knownLaunchAddresses: readonly Address[],
          fromBlock: bigint,
          toBlock: bigint,
        ) => Promise<readonly FixtureLog[]>)
      | undefined;

    expect(discoverRange).toBeTypeOf('function');

    const calls: Record<string, unknown>[] = [];
    const client = {
      getLogs: async (request: Record<string, unknown>) => {
        calls.push(request);
        if (calls.length === 1) return [launchCreated];
        const addresses = requestedAddresses(request);
        if (addresses.includes(token.toLowerCase()) || addresses.includes(curve.toLowerCase())) {
          return [launchCreated, constructorMint];
        }
        return [];
      },
    };

    const logs = await discoverRange?.(client, context, [], 100n, 100n);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(requestedAddresses(calls[0] ?? {})).toEqual([factory.toLowerCase()]);
    expect(
      calls.slice(1).some((call) => {
        const addresses = requestedAddresses(call);
        return addresses.includes(token.toLowerCase()) && addresses.includes(curve.toLowerCase());
      }),
    ).toBe(true);
    expect(logs?.map((log) => log.logIndex)).toEqual([0, 4]);
    expect(logs).toHaveLength(2);
  });
});

type TestPool = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
};

const requireFromDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as {
  Pool: new (config: Record<string, unknown>) => TestPool;
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
          deployer,
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
          graduationThreshold: 9_000_000_000n,
          protocolFeeRecipient,
          tradeFeeBps: 100,
          protocolFeeShareBps: 7_500,
          maxCreatorTaxBps: 1_000,
          creatorTaxBps: 125,
          launchTimestamp: 1_786_262_400,
          reservedTokens: 27_027_027_027_027_027_027n,
          graduationCoordinator: coordinator,
        };
        if (fn in values) return values[fn];
      }
      if (target === token.toLowerCase()) {
        const values: Record<string, unknown> = {
          name: 'Bread Test',
          symbol: 'BREADT',
          curve,
          launchFactory: factory,
          deployer,
          logo: 'ipfs://logo',
          description: 'Task 4 fixture',
          socials: ['https://x.com/bread', '', '', 'https://bread.test', ''],
        };
        if (fn in values) return values[fn];
      }
      throw new Error(`unexpected read ${target}.${fn}`);
    },
  };
}

describe.skipIf(!RUN_DB)('Day 6 Task 4 launch projection and first read API', () => {
  const schemaName = `day6_task4_${process.pid}`;
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
    await pool.query('TRUNCATE event_journal, launches, launch_state, metadata, indexer_checkpoints, protocol_stacks CASCADE');
  });

  it('persists constructor-mint initial supply and serves token/feed/status with the approved freshness envelope', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const applyModule = await optionalModule('../../apps/indexer/src/apply-range.ts');
    const apiModule = await optionalModule('../../apps/api/src/server.ts');
    const applyRange = applyModule.applyRange as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;
    const createBreadApi = apiModule.createBreadApi as
      | ((input: Record<string, unknown>) => { inject: (input: Record<string, unknown>) => Promise<{ statusCode: number; json: () => unknown }>; close: () => Promise<void> })
      | undefined;

    expect(applyRange).toBeTypeOf('function');
    expect(createBreadApi).toBeTypeOf('function');

    const db = dbModule.createBreadDb(pool);
    await applyRange?.({
      db,
      client: fakeReadClient(),
      context,
      fromBlock: 100n,
      toBlock: 100n,
      toBlockHash: blockHash,
      toBlockTimestamp: 1_786_262_400n,
      logs: [constructorMint, launchCreated],
    });

    const persisted = await pool.query(
      `SELECT token_address, curve_address, initial_supply, quote_asset, phantom_quote, graduation_threshold,
              protocol_fee_recipient, trade_fee_bps, protocol_fee_share_bps, max_creator_tax_bps,
              graduation_coordinator, graduation_adapter, graduation_config_hash, reserved_tokens_baseline
         FROM launches
        WHERE chain_id = $1 AND token_address = $2`,
      [context.chainId, token.toLowerCase()],
    );
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]).toMatchObject({
      token_address: token.toLowerCase(),
      curve_address: curve.toLowerCase(),
      initial_supply: initialSupply.toString(),
      quote_asset: quoteAsset.toLowerCase(),
      phantom_quote: '250000000',
      graduation_threshold: '9000000000',
      protocol_fee_recipient: protocolFeeRecipient.toLowerCase(),
      trade_fee_bps: '100',
      protocol_fee_share_bps: '7500',
      max_creator_tax_bps: '1000',
      graduation_coordinator: coordinator.toLowerCase(),
      graduation_adapter: adapter.toLowerCase(),
      graduation_config_hash: graduationConfigHash.toLowerCase(),
      reserved_tokens_baseline: '27027027027027027027',
    });

    const app = createBreadApi?.({
      db,
      context,
      observedHeadBlock: async () => 100n,
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    });
    expect(app).toBeDefined();

    const tokenResponse = await app!.inject({ method: 'GET', url: `/v1/tokens/${token}` });
    expect(tokenResponse.statusCode).toBe(200);
    const tokenBody = tokenResponse.json() as Record<string, unknown>;
    expect(tokenBody).toHaveProperty('data');
    expect(tokenBody).toHaveProperty('meta');
    expect(tokenBody).not.toHaveProperty('freshness');
    expect(tokenBody.meta).toMatchObject({
      chainId: context.chainId,
      stackVersion: context.stackVersion,
      indexedThroughBlock: '100',
      indexedThroughBlockHash: blockHash.toLowerCase(),
      source: 'bread-indexer',
      status: 'FRESH',
    });
    expect(tokenBody.data).toMatchObject({
      tokenAddress: token.toLowerCase(),
      curveAddress: curve.toLowerCase(),
      initialSupply: initialSupply.toString(),
      name: 'Bread Test',
      symbol: 'BREADT',
    });

    const feedResponse = await app!.inject({ method: 'GET', url: '/v1/feed?view=new&limit=10' });
    expect(feedResponse.statusCode).toBe(200);
    const feedBody = feedResponse.json() as Record<string, unknown>;
    expect(feedBody).toHaveProperty('data');
    expect(feedBody).toHaveProperty('meta');
    expect(feedBody).not.toHaveProperty('freshness');
    expect(feedBody.data).toEqual(expect.arrayContaining([expect.objectContaining({ tokenAddress: token.toLowerCase() })]));

    const statusResponse = await app!.inject({ method: 'GET', url: '/v1/status' });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toMatchObject({
      meta: { source: 'bread-indexer', indexedThroughBlock: '100' },
    });

    const malformed = await app!.inject({ method: 'GET', url: '/v1/tokens/not-an-address' });
    expect(malformed.statusCode).toBe(400);
    const unknown = await app!.inject({ method: 'GET', url: `/v1/tokens/${address('f')}` });
    expect(unknown.statusCode).toBe(404);

    await app!.close();
  });

  it('rejects a missing or contradictory constructor mint before journal/checkpoint commit', async () => {
    const dbModule = await import('../../packages/db/src/index.ts');
    const applyModule = await optionalModule('../../apps/indexer/src/apply-range.ts');
    const applyRange = applyModule.applyRange as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;
    expect(applyRange).toBeTypeOf('function');

    const db = dbModule.createBreadDb(pool);
    await expect(
      applyRange?.({
        db,
        client: fakeReadClient(),
        context,
        fromBlock: 100n,
        toBlock: 100n,
        toBlockHash: blockHash,
        logs: [launchCreated],
      }),
    ).rejects.toThrow(/constructor mint/i);

    const wrongMint: FixtureLog = {
      ...constructorMint,
      args: { from: ZERO, to: address('f'), value: initialSupply },
    };
    await expect(
      applyRange?.({
        db,
        client: fakeReadClient(),
        context,
        fromBlock: 100n,
        toBlock: 100n,
        toBlockHash: blockHash,
        logs: [wrongMint, launchCreated],
      }),
    ).rejects.toThrow(/constructor mint|curve/i);

    const journal = await pool.query('SELECT count(*)::int AS count FROM event_journal');
    const launches = await pool.query('SELECT count(*)::int AS count FROM launches');
    const checkpoints = await pool.query('SELECT count(*)::int AS count FROM indexer_checkpoints');
    expect(journal.rows[0]).toMatchObject({ count: 0 });
    expect(launches.rows[0]).toMatchObject({ count: 0 });
    expect(checkpoints.rows[0]).toMatchObject({ count: 0 });
  });
});
