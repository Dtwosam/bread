import { describe, expect, it, vi } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import { executeTradeLifecycle, prepareTradeReview } from '../../apps/web/lib/transactions/controller.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;
const hash = (byte: string) => `0x${byte.repeat(64)}` as `0x${string}`;
const bytes32Address = (value: Address) => `0x${'0'.repeat(24)}${value.slice(2)}` as const;
const Q96 = BigInt(1) << BigInt(96);

const token = address('1');
const curve = address('2');
const coordinator = address('3');
const adapter = address('4');
const quoteAsset = address('5');
const v3Factory = address('6');
const positionManager = address('7');
const router = address('8');
const quoter = address('9');
const pool = address('a');
const protocolFactory = address('b');
const account = address('c');
const configHash = `0x${'1'.repeat(64)}` as const;

const protocolContext = {
  network: 'arc-testnet', chainId: 5_042_002, stackVersion: 'test-stack', factoryAddress: protocolFactory,
  quoteAsset, quoteDecimals: 6, deploymentStartBlock: BigInt(1),
  addresses: { factory: protocolFactory, deployer: address('d'), feePolicy: address('e'), feeEscrow: address('f'), emergencyController: address('d'), locker: address('e'), coordinator: address('f'), graduationAdapter: address('d') },
  graduatedTrading: { family: 'UNISWAP_V3', factory: v3Factory, positionManager, swapRouter: router, swapRouterKind: 'V3_SWAP_ROUTER_02', quoter, quoterKind: 'V3_QUOTER_V2' },
} satisfies ProtocolContext;
const executionContext = { chainId: protocolContext.chainId, quoteAsset, quoteDecimals: 6 } as const;

function launch() { return { token, curve, deployer: address('d'), creatorFeeRecipient: address('e'), creatorTaxBps: 0, economicsDigest: `0x${'2'.repeat(64)}`, launchTimestamp: 1, configVersion: 1, graduationCoordinator: coordinator, graduationAdapter: adapter, graduationAdapterFamily: 2, graduationConfigHash: configHash }; }
function graduation(phase: number) { return { phase, sweptUsdc: BigInt(0), sweptTokens: BigInt(0), usdcUsed: BigInt(0), tokenUsed: BigInt(0), usdcDust: BigInt(0), tokenDust: BigInt(0), poolId: phase === 2 ? bytes32Address(pool) : `0x${'0'.repeat(64)}`, positionManager: phase === 2 ? positionManager : address('0'), positionId: phase === 2 ? BigInt(1) : BigInt(0) }; }
function memoryStorage(): Storage { const values = new Map<string, string>(); return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }; }

function canonicalClient(input: { phase?: number; ready?: boolean; quotes?: bigint[] } = {}) {
  const quotes = [...(input.quotes ?? [BigInt(900)])];
  const simulateContract = vi.fn(async (request: { address: Address }) => ({ request, result: BigInt(0) }));
  const readContract = vi.fn(async (request: { address: Address; functionName: string }) => {
    if (request.address === protocolFactory && request.functionName === 'getLaunch') return launch();
    if (request.address === coordinator && request.functionName === 'getGraduation') return graduation(input.phase ?? 2);
    if (request.address === curve && request.functionName === 'readyToGraduate') return input.ready ?? false;
    if (request.address === curve && request.functionName === 'getReserves') return [BigInt(1_000_000), BigInt(2_000_000)];
    if (request.address === curve && request.functionName === 'reservedTokens') return BigInt(0);
    if (request.address === curve && request.functionName === 'tradeFeeBps') return BigInt(100);
    if (request.address === curve && request.functionName === 'creatorTaxBps') return BigInt(50);
    if (request.address === curve && request.functionName === 'currentSnipeTaxBps') return BigInt(0);
    if (request.address === adapter && request.functionName === 'family') return 2;
    if (request.address === adapter && request.functionName === 'coordinator') return coordinator;
    if (request.address === adapter && request.functionName === 'configHash') return configHash;
    if (request.address === adapter && request.functionName === 'usdc') return quoteAsset;
    if (request.address === adapter && request.functionName === 'positionManager') return positionManager;
    if (request.address === adapter && request.functionName === 'v3Factory') return v3Factory;
    if (request.address === adapter && request.functionName === 'fee') return 3000;
    if (request.address === router && request.functionName === 'factory') return v3Factory;
    if (request.address === quoter && request.functionName === 'factory') return v3Factory;
    if (request.address === v3Factory && request.functionName === 'getPool') return pool;
    if (request.address === pool && request.functionName === 'token0') return quoteAsset;
    if (request.address === pool && request.functionName === 'token1') return token;
    if (request.address === pool && request.functionName === 'fee') return 3000;
    if (request.address === pool && request.functionName === 'liquidity') return BigInt(1);
    if (request.address === pool && request.functionName === 'slot0') return [Q96, 0, 0, 1, 1, 0, true];
    if (request.address === quoter && request.functionName === 'quoteExactInputSingle') { const amountOut = quotes.length > 1 ? quotes.shift()! : quotes[0]!; return [amountOut, Q96, 0, BigInt(123_456)]; }
    throw new Error(`unexpected read ${request.address}.${request.functionName}`);
  });
  return { readContract, simulateContract, waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' as const })) };
}

const preparation = { context: executionContext, protocolContext, walletChainId: protocolContext.chainId, account, action: 'BUY' as const, tokenAddress: token, curveAddress: curve, inputAmount: BigInt(1_000), slippageBps: 100 };

describe('Day 9 canonical graduated V3 controller execution', () => {
  it('keeps an active canonical launch on the existing curve preparation path', async () => {
    const client = canonicalClient({ phase: 0, ready: false });
    const prepared = await prepareTradeReview({ ...preparation, client: client as never });
    expect(prepared.transaction).toMatchObject({ to: curve, functionName: 'buy', allowance: { token: quoteAsset, spender: curve, amount: BigInt(1_000) } });
    expect(prepared.review).not.toHaveProperty('route', 'V3_POOL');
  });

  it('prepares a canonically POOL_CREATED launch through the verified Router02 route', async () => {
    const prepared = await prepareTradeReview({ ...preparation, client: canonicalClient() as never });
    expect(prepared.review).toMatchObject({ action: 'BUY', route: 'V3_POOL', expectedOutput: BigInt(900), minimumOutput: BigInt(891), venueFee: 3000 });
    expect(prepared.transaction).toMatchObject({ to: router, functionName: 'exactInputSingle', value: BigInt(0), allowance: { token: quoteAsset, spender: router, amount: BigInt(1_000) } });
  });

  it('re-resolves and re-quotes after allowance, then refuses to open the wallet when the review changed', async () => {
    const client = canonicalClient({ quotes: [BigInt(900), BigInt(900), BigInt(800)] });
    const approved = await prepareTradeReview({ ...preparation, client: client as never });
    const ensurePreparedTransactionAllowance = vi.fn(async () => undefined);
    const sendPreparedTransaction = vi.fn(async () => hash('c'));
    const wallet = { getAccount: async () => account, getChainId: async () => protocolContext.chainId, ensurePreparedTransactionAllowance, sendPreparedTransaction };
    const result = await executeTradeLifecycle({ client: client as never, wallet, storage: memoryStorage(), context: executionContext, protocolContext, action: 'BUY', tokenAddress: token, curveAddress: curve, inputAmount: BigInt(1_000), slippageBps: 100, approvedReview: approved.review });
    expect(ensurePreparedTransactionAllowance).toHaveBeenCalledWith(expect.objectContaining({ to: router, allowance: { token: quoteAsset, spender: router, amount: BigInt(1_000) } }));
    expect(client.simulateContract).toHaveBeenCalledTimes(1);
    expect(client.simulateContract).toHaveBeenCalledWith(expect.objectContaining({ address: router }));
    expect(result.reviewChanged).toBe(true);
    expect(result.prepared?.review).toMatchObject({ route: 'V3_POOL', expectedOutput: BigInt(800) });
    expect(sendPreparedTransaction).not.toHaveBeenCalled();
  });

  it('sends exactly one Router02 transaction after a matching fresh review', async () => {
    const client = canonicalClient({ quotes: [BigInt(900), BigInt(900), BigInt(900)] });
    const approved = await prepareTradeReview({ ...preparation, client: client as never });
    const ensurePreparedTransactionAllowance = vi.fn(async () => undefined);
    const sendPreparedTransaction = vi.fn(async () => hash('c'));
    const wallet = { getAccount: async () => account, getChainId: async () => protocolContext.chainId, ensurePreparedTransactionAllowance, sendPreparedTransaction };
    const result = await executeTradeLifecycle({ client: client as never, wallet, storage: memoryStorage(), context: executionContext, protocolContext, action: 'BUY', tokenAddress: token, curveAddress: curve, inputAmount: BigInt(1_000), slippageBps: 100, approvedReview: approved.review });
    expect(ensurePreparedTransactionAllowance).toHaveBeenCalledTimes(1);
    expect(client.simulateContract).toHaveBeenCalledTimes(1);
    expect(sendPreparedTransaction).toHaveBeenCalledTimes(1);
    expect(sendPreparedTransaction).toHaveBeenCalledWith(expect.objectContaining({ to: router }));
    expect(result.reviewChanged).toBe(false);
    expect(result.state.status).toBe('CONFIRMED');
  });

  it('fails before allowance or broadcast while graduation is pending', async () => {
    const client = canonicalClient({ phase: 0, ready: true });
    const ensurePreparedTransactionAllowance = vi.fn(async () => undefined);
    const sendPreparedTransaction = vi.fn(async () => hash('c'));
    const wallet = { getAccount: async () => account, getChainId: async () => protocolContext.chainId, ensurePreparedTransactionAllowance, sendPreparedTransaction };
    const result = await executeTradeLifecycle({ client: client as never, wallet, storage: memoryStorage(), context: executionContext, protocolContext, action: 'BUY', tokenAddress: token, curveAddress: curve, inputAmount: BigInt(1_000), slippageBps: 100, approvedReview: undefined });
    expect(result.state.status).toBe('REVERTED');
    expect(result.state.error).toMatch(/graduation is pending/i);
    expect(ensurePreparedTransactionAllowance).not.toHaveBeenCalled();
    expect(sendPreparedTransaction).not.toHaveBeenCalled();
  });
});
