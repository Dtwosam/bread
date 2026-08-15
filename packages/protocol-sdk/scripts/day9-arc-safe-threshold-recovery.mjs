import {
  chmodSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  classifySafeRecoveryState,
  packSafeSignatures,
  predecessorForOwner,
} from '../../../scripts/day9/arc-safe-threshold-recovery-lib.mjs';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const safeAbi = [
  {
    type: 'function',
    name: 'VERSION',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'version', type: 'string' }],
  },
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'owners', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'threshold', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nonce',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getTransactionHash',
    stateMutability: 'view',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: '_nonce', type: 'uint256' },
    ],
    outputs: [{ name: 'txHash', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'execTransaction',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'swapOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'prevOwner', type: 'address' },
      { name: 'oldOwner', type: 'address' },
      { name: 'newOwner', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'ExecutionSuccess',
    anonymous: false,
    inputs: [
      { name: 'txHash', type: 'bytes32', indexed: true },
      { name: 'payment', type: 'uint256', indexed: false },
    ],
  },
];

function fail(message) {
  console.error(`day9-arc-safe-threshold-recovery: FAIL: ${message}`);
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

function privateKey(name) {
  const value = required(name);
  if (!PRIVATE_KEY_RE.test(value)) fail(`${name} must be a 32-byte private key`);
  return value;
}

function ownerSetEquals(left, right) {
  if (left.length !== right.length) return false;
  const expected = new Set(right.map((value) => value.toLowerCase()));
  return left.every((value) => expected.has(value.toLowerCase()));
}

function writeReceipt(path, receipt) {
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

function ethSignSignatureForSafe(signature) {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) fail('owner signMessage returned a non-65-byte signature');
  const rawV = Number.parseInt(signature.slice(-2), 16);
  const normalizedV = rawV <= 1 ? rawV + 27 : rawV;
  if (normalizedV !== 27 && normalizedV !== 28) fail(`unsupported ECDSA v=${rawV}`);
  const safeV = normalizedV + 4;
  return `${signature.slice(0, -2)}${safeV.toString(16).padStart(2, '0')}`;
}

const receiptFile = resolve(required('BREAD_SAFE_RECOVERY_RECEIPT_FILE'));
const rpcUrl = required('ARC_RPC_URL');
const safe = address('BREAD_DAY9_SAFE_ADDRESS');
const deploymentAuthority = address('BREAD_DEPLOYMENT_AUTHORITY');
const deployerAccount = privateKeyToAccount(privateKey('BREAD_DEPLOYER_PRIVATE_KEY'));
if (deployerAccount.address.toLowerCase() !== deploymentAuthority) {
  fail('BREAD_DEPLOYER_PRIVATE_KEY does not match BREAD_DEPLOYMENT_AUTHORITY');
}

const originalAccounts = [1, 2, 3].map((index) => {
  const expected = address(`BREAD_SAFE_OWNER_${index}`);
  const account = privateKeyToAccount(privateKey(`BREAD_SAFE_OWNER_${index}_PRIVATE_KEY`));
  if (account.address.toLowerCase() !== expected) {
    fail(`BREAD_SAFE_OWNER_${index}_PRIVATE_KEY does not match BREAD_SAFE_OWNER_${index}`);
  }
  return account;
});
const originalOwners = originalAccounts.map((account) => account.address.toLowerCase());
const removedOwner = originalOwners[0];
const retainedOwnerA = originalAccounts[1];
const retainedOwnerB = originalAccounts[2];

const recoveryOwner = address('BREAD_SAFE_RECOVERY_OWNER');
const recoveryAccount = privateKeyToAccount(privateKey('BREAD_SAFE_RECOVERY_OWNER_PRIVATE_KEY'));
if (recoveryAccount.address.toLowerCase() !== recoveryOwner) {
  fail('BREAD_SAFE_RECOVERY_OWNER_PRIVATE_KEY does not match BREAD_SAFE_RECOVERY_OWNER');
}
if ([...originalOwners, deploymentAuthority, address('BREAD_GUARDIAN')].includes(recoveryOwner)) {
  fail('recovery owner must be distinct from Safe owners, deployment authority and Guardian');
}

const chain = defineChain({
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc Testnet Native', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account: deployerAccount, chain, transport: http(rpcUrl) });

if (await publicClient.getChainId() !== chain.id) fail('Arc Testnet chain ID mismatch');
const safeCode = await publicClient.getBytecode({ address: safe });
if (!safeCode || safeCode === '0x') fail('Safe has no runtime bytecode');
const version = await publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'VERSION' });
if (version !== '1.4.1') fail(`Safe version mismatch: ${version}`);

async function readSafeState() {
  const [owners, threshold, nonce] = await Promise.all([
    publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getOwners' }),
    publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getThreshold' }),
    publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'nonce' }),
  ]);
  return {
    owners: owners.map((owner) => String(owner).toLowerCase()),
    threshold,
    nonce,
  };
}

let state = await readSafeState();
let receipt;
if (existsSync(receiptFile)) {
  try {
    receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
  } catch (error) {
    fail(`invalid recovery receipt ${receiptFile}: ${error.message}`);
  }
  if (String(receipt.safe).toLowerCase() !== safe) fail('recovery receipt Safe mismatch');
  if (!ownerSetEquals(receipt.originalOwners ?? [], originalOwners)) fail('recovery receipt original owner set mismatch');
  if (String(receipt.recoveryOwner).toLowerCase() !== recoveryOwner) fail('recovery receipt recovery owner mismatch');
  if (String(receipt.removedOwner).toLowerCase() !== removedOwner) fail('recovery receipt removed owner mismatch');
} else {
  if (!ownerSetEquals(state.owners, originalOwners) || state.threshold !== 2n) {
    fail('Safe is not in the exact original 3-owner / threshold-2 state required to begin recovery drill');
  }
  receipt = {
    schema: 'bread://day9/arc-safe-threshold-recovery-v1',
    phase: 'PREPARED',
    chainId: chain.id,
    safe,
    safeVersion: version,
    threshold: '2',
    originalOwners,
    originalOwnerOrder: state.owners,
    removedOwner,
    recoveryOwner,
    startNonce: state.nonce.toString(),
    startBlock: Number(await publicClient.getBlockNumber()),
    transactions: [],
    productionAuthorityClaim: false,
    privateKeysPrinted: false,
  };
  writeReceipt(receiptFile, receipt);
}

const startNonce = BigInt(receipt.startNonce);

async function recoverPendingExecution() {
  if (!receipt.pending?.safeTxHash) return;
  const logs = await publicClient.getLogs({
    address: safe,
    event: safeAbi.find((item) => item.type === 'event' && item.name === 'ExecutionSuccess'),
    args: { txHash: receipt.pending.safeTxHash },
    fromBlock: BigInt(receipt.startBlock),
    toBlock: 'latest',
    strict: true,
  });
  if (logs.length > 1) fail(`multiple ExecutionSuccess logs found for pending Safe tx ${receipt.pending.safeTxHash}`);
  if (logs.length === 0) return;

  const log = logs[0];
  const existing = Array.isArray(receipt.transactions) ? receipt.transactions : [];
  if (!existing.some((entry) => entry.safeTxHash?.toLowerCase() === receipt.pending.safeTxHash.toLowerCase())) {
    existing.push({
      step: receipt.pending.step,
      nonce: receipt.pending.nonce,
      safeTxHash: receipt.pending.safeTxHash,
      chainTransactionHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
      signers: receipt.pending.signers,
      recoveredFromExecutionLog: true,
    });
  }
  receipt = { ...receipt, pending: null, transactions: existing };
  writeReceipt(receiptFile, receipt);
}

await recoverPendingExecution();
state = await readSafeState();

async function safeTransactionHash(data, nonce) {
  return publicClient.readContract({
    address: safe,
    abi: safeAbi,
    functionName: 'getTransactionHash',
    args: [safe, 0n, data, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, nonce],
  });
}

async function signSafeHash(txHash, signerAccounts) {
  const entries = [];
  for (const account of signerAccounts) {
    const signature = await account.signMessage({ message: { raw: txHash } });
    entries.push({ owner: account.address, signature: ethSignSignatureForSafe(signature) });
  }
  return packSafeSignatures(entries);
}

async function executeSwap({ step, currentOwners, oldOwner, newOwner, signerAccounts, nonce }) {
  const prevOwner = predecessorForOwner(currentOwners, oldOwner);
  const data = encodeFunctionData({
    abi: safeAbi,
    functionName: 'swapOwner',
    args: [prevOwner, oldOwner, newOwner],
  });
  const txHash = await safeTransactionHash(data, nonce);
  const signatures = await signSafeHash(txHash, signerAccounts);
  const signers = signerAccounts.map((account) => account.address.toLowerCase()).sort();

  receipt = {
    ...receipt,
    phase: step,
    pending: {
      step,
      nonce: nonce.toString(),
      safeTxHash: txHash,
      signers,
      oldOwner,
      newOwner,
      prevOwner,
    },
  };
  writeReceipt(receiptFile, receipt);

  let simulation;
  try {
    simulation = await publicClient.simulateContract({
      account: deployerAccount,
      address: safe,
      abi: safeAbi,
      functionName: 'execTransaction',
      args: [safe, 0n, data, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, signatures],
    });
  } catch (error) {
    fail(`${step} Arc RPC Safe simulation failed: ${error.shortMessage ?? error.message}`);
  }

  let chainTransactionHash;
  try {
    chainTransactionHash = await walletClient.writeContract(simulation.request);
  } catch (error) {
    fail(`${step} Safe transaction submission failed: ${error.shortMessage ?? error.message}`);
  }
  receipt.pending.chainTransactionHash = chainTransactionHash;
  writeReceipt(receiptFile, receipt);

  let chainReceipt;
  try {
    chainReceipt = await publicClient.waitForTransactionReceipt({
      hash: chainTransactionHash,
      confirmations: 1,
      timeout: 120_000,
    });
  } catch (error) {
    fail(`${step} receipt wait failed for ${chainTransactionHash}: ${error.shortMessage ?? error.message}`);
  }
  if (chainReceipt.status !== 'success') fail(`${step} Safe transaction reverted: ${chainTransactionHash}`);

  const transactions = Array.isArray(receipt.transactions) ? receipt.transactions : [];
  transactions.push({
    step,
    nonce: nonce.toString(),
    safeTxHash: txHash,
    chainTransactionHash,
    blockNumber: Number(chainReceipt.blockNumber),
    signers,
    recoveredFromExecutionLog: false,
  });
  receipt = { ...receipt, pending: null, transactions };
  writeReceipt(receiptFile, receipt);
}

for (let guard = 0; guard < 4; guard += 1) {
  await recoverPendingExecution();
  state = await readSafeState();
  let step;
  try {
    step = classifySafeRecoveryState({
      currentOwners: state.owners,
      originalOwners,
      recoveryOwner,
      removedOwner,
      threshold: state.threshold,
      startNonce,
      currentNonce: state.nonce,
    });
  } catch (error) {
    fail(error.message);
  }

  if (step === 'ROTATE_TO_RECOVERY_OWNER') {
    await executeSwap({
      step: 'ROTATED_TO_RECOVERY_OWNER',
      currentOwners: state.owners,
      oldOwner: removedOwner,
      newOwner: recoveryOwner,
      signerAccounts: [retainedOwnerA, retainedOwnerB],
      nonce: state.nonce,
    });
    continue;
  }

  if (step === 'RESTORE_ORIGINAL_OWNER') {
    await executeSwap({
      step: 'RESTORED_ORIGINAL_OWNER',
      currentOwners: state.owners,
      oldOwner: recoveryOwner,
      newOwner: removedOwner,
      signerAccounts: [recoveryAccount, retainedOwnerA],
      nonce: state.nonce,
    });
    continue;
  }

  if (step === 'VERIFY_COMPLETE') {
    const finalState = await readSafeState();
    if (!ownerSetEquals(finalState.owners, originalOwners)) fail('final Safe owner set was not restored exactly');
    if (finalState.threshold !== 2n) fail(`final Safe threshold changed to ${finalState.threshold}`);
    if (finalState.nonce !== startNonce + 2n) fail('final Safe nonce does not prove exactly two recovery transactions');
    if (finalState.owners.includes(recoveryOwner)) fail('temporary recovery owner remains in final Safe owner set');
    if (!Array.isArray(receipt.transactions) || receipt.transactions.length !== 2) {
      fail(`expected exactly two confirmed Safe recovery transactions, found ${receipt.transactions?.length ?? 0}`);
    }

    receipt = {
      ...receipt,
      phase: 'PASS',
      pending: null,
      endNonce: finalState.nonce.toString(),
      finalOwners: finalState.owners,
      finalThreshold: finalState.threshold.toString(),
      finalOwnerSetRestored: true,
      recoveredSignerParticipatedInRestore: receipt.transactions[1].signers.includes(recoveryOwner),
      completedBlock: Number(await publicClient.getBlockNumber()),
    };
    if (!receipt.recoveredSignerParticipatedInRestore) fail('recovery signer did not participate in the restoration threshold');
    writeReceipt(receiptFile, receipt);

    console.log(JSON.stringify({
      status: 'DAY9_ARC_SAFE_THRESHOLD_RECOVERY_EXECUTION_PASS',
      chainId: chain.id,
      safe,
      safeVersion: version,
      threshold: 2,
      originalOwners,
      simulatedLostOwner: removedOwner,
      recoveryOwner,
      startNonce: startNonce.toString(),
      endNonce: finalState.nonce.toString(),
      transactions: receipt.transactions,
      finalOwners: finalState.owners,
      finalOwnerSetRestored: true,
      recoveredSignerParticipatedInRestore: true,
      transactionBroadcast: true,
      productionAuthorityClaim: false,
      privateKeysPrinted: false,
      receiptFile,
      nextAction: 'RUN_INDEPENDENT_SAFE_RECOVERY_VERIFIER',
    }, null, 2));
    process.exit(0);
  }
}

fail('Safe recovery state machine exceeded bounded step count');
