import type { Page, Route } from '@playwright/test';
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  parseAbi,
  type Abi,
} from 'viem';

import { breadAbiRegistry } from '../../../../packages/protocol-sdk/src/abi/generated';
import {
  ACTIVE_CURVE,
  ACTIVE_TOKEN,
  APPROVAL_TX_HASH,
  ARC_TESTNET_CHAIN_ID_HEX,
  ARC_TESTNET_RPC,
  ARC_TESTNET_USDC,
  BLOCK_HASH,
  BUY_TX_HASH,
  CLAIM_TX_HASH,
  E2E_FACTORY,
  E2E_FEE_ESCROW,
  E2E_FEE_POLICY,
  E2E_GRADUATION_ADAPTER,
  E2E_WALLET,
  FIXTURE_BLOCK_NUMBER_HEX,
  GRADUATED_CURVE,
  GRADUATED_TOKEN,
  LAUNCH_TX_HASH,
  NEW_LAUNCH_CURVE,
  NEW_LAUNCH_TOKEN,
  PENDING_CURVE,
  PENDING_TOKEN,
  SELL_TX_HASH,
} from './constants';

const ERC20_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);
const ECONOMICS_DIGEST = `0x${'66'.repeat(32)}` as `0x${string}`;
const GRADUATION_CONFIG_HASH = `0x${'77'.repeat(32)}` as `0x${string}`;
const ZERO_BLOOM = `0x${'00'.repeat(256)}`;

export type RpcReceiptMode = 'SUCCESS' | 'PENDING' | 'REVERTED' | 'ERROR';

export type RpcFixtureState = {
  requests: ReadonlyArray<{ method: string; params: readonly unknown[] }>;
  unknownCalls: string[];
  allowance: bigint;
  quoteBalance: bigint;
  tokenBalance: bigint;
  claimable: bigint;
  receiptMode: RpcReceiptMode;
};

export function createRpcFixtureState(): RpcFixtureState {
  return {
    requests: [],
    unknownCalls: [],
    allowance: BigInt('1000000000000000000000000000000'),
    quoteBalance: BigInt('1000000000'),
    tokenBalance: BigInt('2500000000000000000000000'),
    claimable: BigInt('10000000'),
    receiptMode: 'SUCCESS',
  };
}

function functionResult(abi: Abi, functionName: string, result: unknown): `0x${string}` {
  return encodeFunctionResult({ abi, functionName, result } as never);
}

function decode(abi: Abi, data: `0x${string}`) {
  return decodeFunctionData({ abi, data } as never) as Readonly<{
    functionName: string;
    args?: readonly unknown[];
  }>;
}

function curveResult(address: string, data: `0x${string}`): `0x${string}` {
  const decoded = decode(breadAbiRegistry.curve as Abi, data);
  switch (decoded.functionName) {
    case 'getReserves':
      return functionResult(
        breadAbiRegistry.curve as Abi,
        decoded.functionName,
        [BigInt('520000000'), BigInt('680000000000000000000000000')],
      );
    case 'reservedTokens':
      return functionResult(
        breadAbiRegistry.curve as Abi,
        decoded.functionName,
        BigInt('100000000000000000000000000'),
      );
    case 'tradeFeeBps':
      return functionResult(breadAbiRegistry.curve as Abi, decoded.functionName, BigInt(100));
    case 'creatorTaxBps':
      return functionResult(breadAbiRegistry.curve as Abi, decoded.functionName, BigInt(125));
    case 'currentSnipeTaxBps':
      return functionResult(breadAbiRegistry.curve as Abi, decoded.functionName, BigInt(0));
    case 'readyToGraduate':
      return functionResult(
        breadAbiRegistry.curve as Abi,
        decoded.functionName,
        address.toLowerCase() !== ACTIVE_CURVE.toLowerCase(),
      );
    case 'buy':
      return functionResult(
        breadAbiRegistry.curve as Abi,
        decoded.functionName,
        BigInt('1000000000000000000'),
      );
    case 'sell':
      return functionResult(breadAbiRegistry.curve as Abi, decoded.functionName, BigInt('2500000'));
    default:
      throw new Error(`Unhandled curve function ${decoded.functionName}`);
  }
}

function erc20Result(state: RpcFixtureState, address: string, data: `0x${string}`): `0x${string}` {
  const decoded = decode(ERC20_ABI, data);
  switch (decoded.functionName) {
    case 'balanceOf':
      return functionResult(
        ERC20_ABI,
        decoded.functionName,
        address.toLowerCase() === ARC_TESTNET_USDC.toLowerCase() ? state.quoteBalance : state.tokenBalance,
      );
    case 'allowance':
      return functionResult(ERC20_ABI, decoded.functionName, state.allowance);
    case 'approve':
      return functionResult(ERC20_ABI, decoded.functionName, true);
    default:
      throw new Error(`Unhandled ERC20 function ${decoded.functionName}`);
  }
}

function factoryResult(data: `0x${string}`): `0x${string}` {
  const abi = breadAbiRegistry.factory as Abi;
  const decoded = decode(abi, data);
  switch (decoded.functionName) {
    case 'currentLaunchConfig':
      return functionResult(abi, decoded.functionName, [
        {
          supply: BigInt('1000000000000000000000000000'),
          phantomQuote: BigInt('100000000'),
          graduationThreshold: BigInt('1000000000'),
          launchFeeUsdc: BigInt('5000000'),
          graduationAdapter: E2E_GRADUATION_ADAPTER,
          graduationConfigHash: GRADUATION_CONFIG_HASH,
          enabled: true,
        },
        BigInt(1),
      ]);
    case 'previewLaunchEconomics':
      return functionResult(abi, decoded.functionName, ECONOMICS_DIGEST);
    case 'launchToken':
      return functionResult(abi, decoded.functionName, [NEW_LAUNCH_TOKEN, NEW_LAUNCH_CURVE]);
    case 'launchTokenAndBuy':
      return functionResult(abi, decoded.functionName, [
        NEW_LAUNCH_TOKEN,
        NEW_LAUNCH_CURVE,
        BigInt('1000000000000000000'),
      ]);
    default:
      throw new Error(`Unhandled Factory function ${decoded.functionName}`);
  }
}

function feePolicyResult(data: `0x${string}`): `0x${string}` {
  const abi = breadAbiRegistry.feePolicy as Abi;
  const decoded = decode(abi, data);
  if (decoded.functionName !== 'currentFeePolicy') {
    throw new Error(`Unhandled FeePolicy function ${decoded.functionName}`);
  }
  return functionResult(abi, decoded.functionName, {
    protocolFeeRecipient: E2E_FEE_ESCROW,
    tradeFeeBps: BigInt(100),
    protocolFeeShareBps: BigInt(5000),
    maxCreatorTaxBps: BigInt(500),
  });
}

function feeEscrowResult(state: RpcFixtureState, data: `0x${string}`): `0x${string}` {
  const abi = breadAbiRegistry.feeEscrow as Abi;
  const decoded = decode(abi, data);
  switch (decoded.functionName) {
    case 'balanceOf':
      return functionResult(abi, decoded.functionName, state.claimable);
    case 'claim':
      return functionResult(abi, decoded.functionName, state.claimable);
    default:
      throw new Error(`Unhandled FeeEscrow function ${decoded.functionName}`);
  }
}

function callResult(state: RpcFixtureState, call: Record<string, unknown>): `0x${string}` {
  const to = String(call.to ?? '').toLowerCase();
  const data = String(call.data ?? '0x') as `0x${string}`;
  if ([ACTIVE_CURVE, PENDING_CURVE, GRADUATED_CURVE, NEW_LAUNCH_CURVE].some((value) => value.toLowerCase() === to)) {
    return curveResult(to, data);
  }
  if ([ARC_TESTNET_USDC, ACTIVE_TOKEN, PENDING_TOKEN, GRADUATED_TOKEN, NEW_LAUNCH_TOKEN].some((value) => value.toLowerCase() === to)) {
    return erc20Result(state, to, data);
  }
  if (to === E2E_FACTORY.toLowerCase()) return factoryResult(data);
  if (to === E2E_FEE_POLICY.toLowerCase()) return feePolicyResult(data);
  if (to === E2E_FEE_ESCROW.toLowerCase()) return feeEscrowResult(state, data);
  throw new Error(`Unhandled eth_call target ${to}`);
}

function launchCreatedLog() {
  const topics = encodeEventTopics({
    abi: breadAbiRegistry.factory,
    eventName: 'LaunchCreated',
    args: {
      deployer: E2E_WALLET,
      token: NEW_LAUNCH_TOKEN,
      curve: NEW_LAUNCH_CURVE,
    },
  } as never);
  const data = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint16' },
      { type: 'bytes32' },
      { type: 'uint64' },
    ],
    [E2E_WALLET, 125, ECONOMICS_DIGEST, BigInt(1)],
  );
  return {
    address: E2E_FACTORY,
    blockHash: BLOCK_HASH,
    blockNumber: FIXTURE_BLOCK_NUMBER_HEX,
    data,
    logIndex: '0x0',
    removed: false,
    topics,
    transactionHash: LAUNCH_TX_HASH,
    transactionIndex: '0x0',
  };
}

function receipt(hash: string, mode: 'SUCCESS' | 'REVERTED') {
  return {
    blockHash: BLOCK_HASH,
    blockNumber: FIXTURE_BLOCK_NUMBER_HEX,
    contractAddress: null,
    cumulativeGasUsed: '0x5208',
    effectiveGasPrice: '0x1',
    from: E2E_WALLET,
    gasUsed: '0x5208',
    logs: hash.toLowerCase() === LAUNCH_TX_HASH.toLowerCase() ? [launchCreatedLog()] : [],
    logsBloom: ZERO_BLOOM,
    status: mode === 'SUCCESS' ? '0x1' : '0x0',
    to: hash.toLowerCase() === CLAIM_TX_HASH.toLowerCase() ? E2E_FEE_ESCROW : E2E_FACTORY,
    transactionHash: hash,
    transactionIndex: '0x0',
    type: '0x2',
  };
}

function transaction(hash: string) {
  return {
    blockHash: BLOCK_HASH,
    blockNumber: FIXTURE_BLOCK_NUMBER_HEX,
    from: E2E_WALLET,
    gas: '0x5208',
    gasPrice: '0x1',
    hash,
    input: '0x',
    nonce: '0x0',
    to: E2E_FACTORY,
    transactionIndex: '0x0',
    value: '0x0',
    type: '0x2',
    chainId: ARC_TESTNET_CHAIN_ID_HEX,
    maxFeePerGas: '0x1',
    maxPriorityFeePerGas: '0x1',
    accessList: [],
    yParity: '0x0',
    r: `0x${'01'.repeat(32)}`,
    s: `0x${'02'.repeat(32)}`,
    v: '0x0',
  };
}

type RpcRequest = Readonly<{ id?: number | string | null; jsonrpc?: string; method?: string; params?: readonly unknown[] }>;

function handleRpc(state: RpcFixtureState, request: RpcRequest) {
  const method = request.method ?? '';
  const params = request.params ?? [];
  (state.requests as Array<{ method: string; params: readonly unknown[] }>).push({ method, params });

  try {
    let result: unknown;
    switch (method) {
      case 'eth_chainId':
        result = ARC_TESTNET_CHAIN_ID_HEX;
        break;
      case 'eth_blockNumber':
        result = FIXTURE_BLOCK_NUMBER_HEX;
        break;
      case 'eth_call':
        result = callResult(state, (params[0] ?? {}) as Record<string, unknown>);
        break;
      case 'eth_getTransactionReceipt': {
        const hash = String(params[0] ?? '');
        if (state.receiptMode === 'ERROR') {
          throw new Error('Deterministic receipt transport failure.');
        }
        result = state.receiptMode === 'PENDING' ? null : receipt(hash, state.receiptMode);
        break;
      }
      case 'eth_getTransactionByHash':
        result = state.receiptMode === 'PENDING'
          ? null
          : transaction(String(params[0] ?? BUY_TX_HASH));
        break;
      default:
        state.unknownCalls.push(method);
        throw new Error(`Unhandled RPC method ${method}`);
    }
    return { jsonrpc: '2.0', id: request.id ?? null, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unhandled deterministic RPC failure';
    state.unknownCalls.push(`${method}:${message}`);
    return {
      jsonrpc: '2.0',
      id: request.id ?? null,
      error: { code: -32000, message },
    };
  }
}

export async function installRpcRoutes(page: Page, state: RpcFixtureState): Promise<void> {
  await page.route(`${ARC_TESTNET_RPC}**`, async (route: Route) => {
    const payload = route.request().postDataJSON() as RpcRequest | RpcRequest[] | null;
    if (!payload) {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'missing JSON-RPC payload' }) });
      return;
    }
    const response = Array.isArray(payload)
      ? payload.map((request) => handleRpc(state, request))
      : handleRpc(state, payload);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

export const deterministicTransactionHashes = [
  BUY_TX_HASH,
  SELL_TX_HASH,
  LAUNCH_TX_HASH,
  CLAIM_TX_HASH,
  APPROVAL_TX_HASH,
] as const;