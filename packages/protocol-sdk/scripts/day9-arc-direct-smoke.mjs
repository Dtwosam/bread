import {
  chmodSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { classifyArcDirectSmokeStep } from '../../../scripts/day9/arc-direct-smoke-recovery-lib.mjs';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

const usdcAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'allowance', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'ok', type: 'bool' }],
  },
];

const factoryAbi = [
  {
    type: 'function',
    name: 'previewLaunchEconomics',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'digest', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'launchTokenAndBuy',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'logo', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'twitter', type: 'string' },
          { name: 'telegram', type: 'string' },
          { name: 'discord', type: 'string' },
          { name: 'website', type: 'string' },
          { name: 'farcaster', type: 'string' },
          { name: 'creatorFeeRecipient', type: 'address' },
          { name: 'creatorTaxBps', type: 'uint16' },
          { name: 'expectedEconomics', type: 'bytes32' },
        ],
      },
      { name: 'quoteIn', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
      { name: 'tokensOut', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LaunchCreated',
    anonymous: false,
    inputs: [
      { name: 'deployer', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'curve', type: 'address', indexed: true },
      { name: 'creatorFeeRecipient', type: 'address', indexed: false },
      { name: 'creatorTaxBps', type: 'uint16', indexed: false },
      { name: 'economicsDigest', type: 'bytes32', indexed: false },
      { name: 'configVersion', type: 'uint64', indexed: false },
    ],
  },
];

const coordinatorAbi = [
  {
    type: 'function',
    name: 'feeEscrow',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'feeEscrow', type: 'address' }],
  },
  {
    type: 'function',
    name: 'sweep',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'createPool',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'positionId', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getGraduation',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      {
        name: 'record',
        type: 'tuple',
        components: [
          { name: 'phase', type: 'uint8' },
          { name: 'sweptAt', type: 'uint64' },
          { name: 'sweptUsdc', type: 'uint256' },
          { name: 'sweptTokens', type: 'uint256' },
          { name: 'poolTokenAmount', type: 'uint256' },
          { name: 'poolId', type: 'bytes32' },
          { name: 'positionManager', type: 'address' },
          { name: 'positionId', type: 'uint256' },
        ],
      },
    ],
  },
];

const curveAbi = [
  {
    type: 'function',
    name: 'readyToGraduate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'ready', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'graduated',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'graduated', type: 'bool' }],
  },
];

const lockerAbi = [
  {
    type: 'function',
    name: 'isPositionLocked',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: 'locked', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'lockedPosition',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'positionManager', type: 'address' },
      { name: 'positionId', type: 'uint256' },
    ],
  },
];

const feeEscrowAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
];

const erc721Abi = [
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'owner', type: 'address' }],
  },
];

function fail(message) {
  console.error(`day9-arc-direct-smoke: FAIL: ${message}`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required`);
  return value;
}

function address(name) {
  const value = required(name);
  if (!ADDRESS_RE.test(value) || /^0x0{40}$/i.test(value)) fail(`${name} must be a non-zero address`);
  return value.toLowerCase();
}

function uint(name) {
  const value = required(name);
  if (!/^\d+$/.test(value)) fail(`${name} must be an unsigned integer`);
  return BigInt(value);
}

function writeReceipt(path, receipt) {
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

function jsonSafe(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

function appendTransaction(receipt, step, hash) {
  const existing = Array.isArray(receipt.smoke?.transactions) ? receipt.smoke.transactions : [];
  const next = existing.some((item) => item?.hash?.toLowerCase?.() === hash.toLowerCase())
    ? existing
    : [...existing, { step, hash }];
  return {
    ...receipt,
    smoke: {
      ...receipt.smoke,
      phase: step,
      transactions: next,
    },
  };
}

const receiptFile = resolve(required('BREAD_SMOKE_RECEIPT_FILE'));
let receipt;
try {
  receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
} catch (error) {
  fail(`cannot read smoke receipt ${receiptFile}: ${error.message}`);
}

if (receipt?.phase !== 'VERIFIED' || receipt?.verified !== true) fail('Bread deployment receipt is not VERIFIED');
if (!receipt.smoke || !Number.isSafeInteger(receipt.smoke.startBlock) || receipt.smoke.startBlock <= 0) {
  fail('smoke PREPARED receipt with a valid startBlock is required');
}

const initialSmokePhase = receipt.smoke.phase;
const rpcUrl = required('ARC_RPC_URL');
const usdc = address('BREAD_USDC');
const factory = address('BREAD_FACTORY');
const coordinator = address('BREAD_GRADUATION_COORDINATOR');
const locker = address('BREAD_PERMANENT_LIQUIDITY_LOCKER');
const positionManager = address('BREAD_POSITION_MANAGER');
const operator = address('BREAD_SMOKE_OPERATOR');
const quoteIn = uint('BREAD_SMOKE_QUOTE_IN');
const minTokensOut = uint('BREAD_SMOKE_MIN_TOKENS_OUT');
const creatorTaxBpsBig = uint('BREAD_SMOKE_CREATOR_TAX_BPS');
if (creatorTaxBpsBig > 65_535n) fail('BREAD_SMOKE_CREATOR_TAX_BPS exceeds uint16');
const creatorTaxBps = Number(creatorTaxBpsBig);
const privateKey = required('BREAD_SMOKE_PRIVATE_KEY');
if (!HASH_RE.test(privateKey)) fail('BREAD_SMOKE_PRIVATE_KEY must be a 32-byte private key');

const chain = defineChain({
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc Testnet USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});
const account = privateKeyToAccount(privateKey);
if (account.address.toLowerCase() !== operator) fail('smoke private key does not match BREAD_SMOKE_OPERATOR');

const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

const actualChainId = await publicClient.getChainId();
if (actualChainId !== chain.id) fail(`Arc chain ID mismatch: expected ${chain.id}, got ${actualChainId}`);

const feeEscrow = String(await publicClient.readContract({
  address: coordinator,
  abi: coordinatorAbi,
  functionName: 'feeEscrow',
})).toLowerCase();
if (!ADDRESS_RE.test(feeEscrow) || /^0x0{40}$/i.test(feeEscrow)) fail('coordinator feeEscrow is invalid');
if (receipt.created?.feeEscrow && feeEscrow !== String(receipt.created.feeEscrow).toLowerCase()) {
  fail(`coordinator feeEscrow mismatch: ${feeEscrow}`);
}

async function findLaunch() {
  const event = factoryAbi.find((item) => item.type === 'event' && item.name === 'LaunchCreated');
  const logs = await publicClient.getLogs({
    address: factory,
    event,
    args: { deployer: operator },
    fromBlock: BigInt(receipt.smoke.startBlock),
    toBlock: 'latest',
    strict: true,
  });
  if (logs.length === 0) return null;
  if (logs.length > 1) fail(`multiple smoke LaunchCreated events found after block ${receipt.smoke.startBlock}`);
  const log = logs[0];
  return {
    token: String(log.args.token).toLowerCase(),
    curve: String(log.args.curve).toLowerCase(),
    launchTransactionHash: log.transactionHash,
    launchBlock: Number(log.blockNumber),
  };
}

async function sendContract({ address: target, abi, functionName, args, step }) {
  let simulation;
  try {
    simulation = await publicClient.simulateContract({
      account,
      address: target,
      abi,
      functionName,
      args,
    });
  } catch (error) {
    fail(`${step} Arc RPC simulation failed: ${error.shortMessage ?? error.message}`);
  }

  let hash;
  try {
    hash = await walletClient.writeContract(simulation.request);
  } catch (error) {
    fail(`${step} transaction submission failed: ${error.shortMessage ?? error.message}`);
  }

  let txReceipt;
  try {
    txReceipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
  } catch (error) {
    fail(`${step} transaction receipt wait failed for ${hash}: ${error.shortMessage ?? error.message}`);
  }
  if (txReceipt.status !== 'success') fail(`${step} transaction reverted: ${hash}`);

  receipt = appendTransaction(receipt, step, hash);
  receipt.smoke.lastConfirmedBlock = Number(txReceipt.blockNumber);
  writeReceipt(receiptFile, receipt);
  return { hash, receipt: txReceipt };
}

async function lockedPosition(token) {
  const locked = await publicClient.readContract({
    address: locker,
    abi: lockerAbi,
    functionName: 'isPositionLocked',
    args: [token],
  });
  if (!locked) return null;

  const [manager, positionId] = await publicClient.readContract({
    address: locker,
    abi: lockerAbi,
    functionName: 'lockedPosition',
    args: [token],
  });
  const normalizedManager = String(manager).toLowerCase();
  if (normalizedManager !== positionManager) {
    fail(`locked Position Manager mismatch: expected ${positionManager}, got ${normalizedManager}`);
  }
  if (positionId === 0n) fail('locked Position Manager token ID is zero');

  const nftOwner = String(await publicClient.readContract({
    address: positionManager,
    abi: erc721Abi,
    functionName: 'ownerOf',
    args: [positionId],
  })).toLowerCase();
  if (nftOwner !== locker) fail(`Position Manager NFT ${positionId} is not owned by the Bread locker`);

  return {
    positionManager: normalizedManager,
    positionId: positionId.toString(),
    nftOwner,
  };
}

async function assertGraduationReconciled(token, lock) {
  const record = await publicClient.readContract({
    address: coordinator,
    abi: coordinatorAbi,
    functionName: 'getGraduation',
    args: [token],
  });
  if (Number(record.phase) !== 2) fail(`graduation phase is ${record.phase}, expected POOL_CREATED (2)`);
  if (record.sweptUsdc !== 0n || record.sweptTokens !== 0n || record.poolTokenAmount !== 0n) {
    fail(
      `graduation residue remains: sweptUsdc=${record.sweptUsdc} sweptTokens=${record.sweptTokens} `
      + `poolTokenAmount=${record.poolTokenAmount}`,
    );
  }
  if (String(record.positionManager).toLowerCase() !== lock.positionManager) {
    fail('graduation record Position Manager does not match permanent locker');
  }
  if (record.positionId.toString() !== lock.positionId) {
    fail('graduation record position ID does not match permanent locker');
  }
  return jsonSafe(record);
}

async function assertReplayRejected(token) {
  let rejected = false;
  try {
    await publicClient.simulateContract({
      account,
      address: coordinator,
      abi: coordinatorAbi,
      functionName: 'createPool',
      args: [token],
    });
  } catch {
    rejected = true;
  }
  if (!rejected) fail('graduation replay simulation unexpectedly succeeded');
}

let launch = await findLaunch();
const operatorUsdcAtResume = await publicClient.readContract({
  address: usdc,
  abi: usdcAbi,
  functionName: 'balanceOf',
  args: [operator],
});

for (let guard = 0; guard < 8; guard += 1) {
  const allowance = await publicClient.readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args: [operator, factory],
  });

  let permanentlyLocked = false;
  let readyToGraduate = false;
  let graduated = false;
  let creatorCredit = 0n;

  if (launch) {
    permanentlyLocked = Boolean(await publicClient.readContract({
      address: locker,
      abi: lockerAbi,
      functionName: 'isPositionLocked',
      args: [launch.token],
    }));
    creatorCredit = await publicClient.readContract({
      address: feeEscrow,
      abi: feeEscrowAbi,
      functionName: 'balanceOf',
      args: [operator],
    });
    if (!permanentlyLocked) {
      readyToGraduate = Boolean(await publicClient.readContract({
        address: launch.curve,
        abi: curveAbi,
        functionName: 'readyToGraduate',
      }));
      graduated = Boolean(await publicClient.readContract({
        address: launch.curve,
        abi: curveAbi,
        functionName: 'graduated',
      }));
    } else {
      graduated = true;
    }
  }

  const step = classifyArcDirectSmokeStep({
    launchExists: Boolean(launch),
    allowance,
    quoteIn,
    permanentlyLocked,
    readyToGraduate,
    graduated,
    creatorCredit,
  });

  if (step === 'APPROVE') {
    const balance = await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: 'balanceOf',
      args: [operator],
    });
    if (balance < quoteIn) fail(`smoke operator has ${balance} USDC units but launch requires ${quoteIn}`);
    await sendContract({
      address: usdc,
      abi: usdcAbi,
      functionName: 'approve',
      args: [factory, quoteIn],
      step: 'APPROVED',
    });
    continue;
  }

  if (step === 'LAUNCH') {
    const expectedEconomics = await publicClient.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: 'previewLaunchEconomics',
    });
    const params = {
      name: 'Bread Day5 Smoke',
      symbol: 'BD5S',
      logo: '',
      description: 'Day-5 operational smoke',
      twitter: '',
      telegram: '',
      discord: '',
      website: '',
      farcaster: '',
      creatorFeeRecipient: operator,
      creatorTaxBps,
      expectedEconomics,
    };
    const result = await sendContract({
      address: factory,
      abi: factoryAbi,
      functionName: 'launchTokenAndBuy',
      args: [params, quoteIn, minTokensOut, operator],
      step: 'LAUNCHED',
    });

    const created = result.receipt.logs
      .filter((log) => String(log.address).toLowerCase() === factory)
      .map((log) => {
        try {
          return decodeEventLog({ abi: factoryAbi, eventName: 'LaunchCreated', data: log.data, topics: log.topics, strict: true });
        } catch {
          return null;
        }
      })
      .find((decoded) => decoded?.args?.deployer?.toLowerCase?.() === operator);
    if (!created) fail(`launch transaction ${result.hash} succeeded but LaunchCreated was not found`);

    launch = {
      token: String(created.args.token).toLowerCase(),
      curve: String(created.args.curve).toLowerCase(),
      launchTransactionHash: result.hash,
      launchBlock: Number(result.receipt.blockNumber),
    };
    receipt.smoke = { ...receipt.smoke, ...launch };
    writeReceipt(receiptFile, receipt);
    continue;
  }

  if (!launch) fail(`internal recovery error: step ${step} requires an existing launch`);

  if (step === 'SWEEP') {
    await sendContract({
      address: coordinator,
      abi: coordinatorAbi,
      functionName: 'sweep',
      args: [launch.token],
      step: 'SWEPT',
    });
    continue;
  }

  if (step === 'CREATE_POOL') {
    await sendContract({
      address: coordinator,
      abi: coordinatorAbi,
      functionName: 'createPool',
      args: [launch.token],
      step: 'POOL_CREATED',
    });
    continue;
  }

  if (step === 'CLAIM') {
    await sendContract({
      address: feeEscrow,
      abi: feeEscrowAbi,
      functionName: 'claim',
      args: [],
      step: 'CREATOR_CLAIMED',
    });
    continue;
  }

  if (step === 'VERIFY_REPLAY') {
    const lock = await lockedPosition(launch.token);
    if (!lock) fail('smoke reached replay verification without a permanent LP lock');
    const graduation = await assertGraduationReconciled(launch.token, lock);
    const remainingCreatorCredit = await publicClient.readContract({
      address: feeEscrow,
      abi: feeEscrowAbi,
      functionName: 'balanceOf',
      args: [operator],
    });
    if (remainingCreatorCredit !== 0n) fail(`creator credit remains after claim: ${remainingCreatorCredit}`);
    await assertReplayRejected(launch.token);

    const operatorUsdcAfter = await publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: 'balanceOf',
      args: [operator],
    });
    const endBlock = await publicClient.getBlockNumber();
    receipt = {
      ...receipt,
      smoke: {
        ...receipt.smoke,
        phase: 'PASS',
        endBlock: Number(endBlock),
        token: launch.token,
        curve: launch.curve,
        launchTransactionHash: launch.launchTransactionHash,
        launchBlock: launch.launchBlock,
        lockedPosition: lock,
        graduation,
        transactionHashes: (receipt.smoke.transactions ?? []).map((item) => item.hash),
        operatorUsdcAtResume: operatorUsdcAtResume.toString(),
        operatorUsdcAfter: operatorUsdcAfter.toString(),
        creatorClaimRemaining: '0',
        executionMode: 'DIRECT_ARC_RPC_WITH_REAL_NODE_SIMULATION_PER_TRANSACTION',
        foundryLocalEvmUsedForMoneyPath: false,
      },
    };
    writeReceipt(receiptFile, receipt);

    console.log(JSON.stringify({
      status: 'BREAD_ARC_TESTNET_SMOKE_PASS',
      chainId: chain.id,
      deploymentSourceCommit: receipt.sourceCommit,
      smokeSourceCommit: receipt.smoke.sourceCommit,
      executionMode: receipt.smoke.executionMode,
      recoveredFromPreparedIntent: initialSmokePhase === 'PREPARED',
      token: launch.token,
      curve: launch.curve,
      launchTransactionHash: launch.launchTransactionHash,
      lockedPosition: lock,
      smokeTransactionHashes: receipt.smoke.transactionHashes,
      operatorUsdcAtResume: receipt.smoke.operatorUsdcAtResume,
      operatorUsdcAfter: receipt.smoke.operatorUsdcAfter,
      creatorClaimRemaining: '0',
      graduationResidueZero: true,
      replayRejected: true,
      transactionBroadcast: true,
      productionMoneyClaim: false,
      privateKeysPrinted: false,
      receiptFile,
      nextAction: 'RECORD_DAY9_PUBLIC_ARC_EVIDENCE_AND_RUN_REMAINING_GATES',
    }, null, 2));
    process.exit(0);
  }

  fail(`unsupported direct smoke step ${step}`);
}

fail('direct Arc smoke exceeded bounded recovery step count');
