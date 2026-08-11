import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createPublicClient,
  decodeFunctionData,
  defineChain,
  http,
  recoverMessageAddress,
} from 'viem';

import {
  predecessorForOwner,
  safeEthSignToStandardSignature,
  splitPackedSafeSignatures,
} from '../../../scripts/day9/arc-safe-threshold-recovery-lib.mjs';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

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
  console.error(`verify-day9-arc-safe-threshold-recovery: FAIL: ${message}`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required`);
  return value;
}

function sameOwnerSet(left, right) {
  if (left.length !== right.length) return false;
  const expected = new Set(right.map((value) => value.toLowerCase()));
  return left.every((value) => expected.has(value.toLowerCase()));
}

function sorted(values) {
  return [...values].map((value) => value.toLowerCase()).sort();
}

const receiptFile = resolve(required('BREAD_SAFE_RECOVERY_RECEIPT_FILE'));
let evidence;
try {
  evidence = JSON.parse(readFileSync(receiptFile, 'utf8'));
} catch (error) {
  fail(`cannot read recovery receipt ${receiptFile}: ${error.message}`);
}

if (evidence.phase !== 'PASS') fail(`recovery receipt phase is ${String(evidence.phase)}, expected PASS`);
if (evidence.chainId !== 5_042_002) fail(`recovery receipt chain ID is ${String(evidence.chainId)}`);
if (!ADDRESS_RE.test(evidence.safe ?? '')) fail('recovery receipt Safe address is invalid');
if (!Array.isArray(evidence.originalOwners) || evidence.originalOwners.length !== 3) fail('recovery receipt must contain 3 original owners');
if (!Array.isArray(evidence.originalOwnerOrder) || evidence.originalOwnerOrder.length !== 3) fail('recovery receipt must preserve original owner order');
if (!ADDRESS_RE.test(evidence.recoveryOwner ?? '')) fail('recovery receipt recovery owner is invalid');
if (!ADDRESS_RE.test(evidence.removedOwner ?? '')) fail('recovery receipt removed owner is invalid');
if (!Array.isArray(evidence.transactions) || evidence.transactions.length !== 2) fail('recovery receipt must contain exactly 2 transactions');

const safe = evidence.safe.toLowerCase();
const originalOwners = evidence.originalOwners.map((owner) => owner.toLowerCase());
const originalOwnerOrder = evidence.originalOwnerOrder.map((owner) => owner.toLowerCase());
const recoveryOwner = evidence.recoveryOwner.toLowerCase();
const removedOwner = evidence.removedOwner.toLowerCase();
const startNonce = BigInt(evidence.startNonce);

const rpcUrl = required('ARC_RPC_URL');
const chain = defineChain({
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc Testnet Native', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

if (await publicClient.getChainId() !== chain.id) fail('Arc Testnet chain ID mismatch');
const [version, owners, threshold, nonce] = await Promise.all([
  publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'VERSION' }),
  publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getOwners' }),
  publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'getThreshold' }),
  publicClient.readContract({ address: safe, abi: safeAbi, functionName: 'nonce' }),
]);
const finalOwners = owners.map((owner) => String(owner).toLowerCase());
if (version !== '1.4.1') fail(`Safe version mismatch: ${version}`);
if (threshold !== 2n) fail(`Safe threshold mismatch: ${threshold}`);
if (nonce !== startNonce + 2n) fail(`Safe nonce ${nonce} does not equal startNonce+2`);
if (!sameOwnerSet(finalOwners, originalOwners)) fail('Safe final owners do not match the original owner set');
if (finalOwners.includes(recoveryOwner)) fail('temporary recovery owner remains in final Safe owner set');

const rotatedOwnerOrder = originalOwnerOrder.map((owner) => (owner === removedOwner ? recoveryOwner : owner));
const expectedTransactions = [
  {
    oldOwner: removedOwner,
    newOwner: recoveryOwner,
    prevOwner: predecessorForOwner(originalOwnerOrder, removedOwner),
    signerSet: originalOwners.filter((owner) => owner !== removedOwner),
  },
  {
    oldOwner: recoveryOwner,
    newOwner: removedOwner,
    prevOwner: predecessorForOwner(rotatedOwnerOrder, recoveryOwner),
    signerSet: [recoveryOwner, originalOwners[1]],
  },
];

const verifiedTransactions = [];
for (let index = 0; index < evidence.transactions.length; index += 1) {
  const recorded = evidence.transactions[index];
  const expected = expectedTransactions[index];
  const chainHash = recorded.chainTransactionHash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(chainHash ?? '')) fail(`transaction ${index} chain hash is invalid`);

  const [transaction, transactionReceipt] = await Promise.all([
    publicClient.getTransaction({ hash: chainHash }),
    publicClient.getTransactionReceipt({ hash: chainHash }),
  ]);
  if (transactionReceipt.status !== 'success') fail(`Safe recovery transaction ${chainHash} did not succeed`);
  if (String(transaction.to).toLowerCase() !== safe) fail(`Safe recovery transaction ${chainHash} was not sent to the Safe`);

  let outer;
  try {
    outer = decodeFunctionData({ abi: safeAbi, data: transaction.input });
  } catch (error) {
    fail(`cannot decode Safe recovery transaction ${chainHash}: ${error.message}`);
  }
  if (outer.functionName !== 'execTransaction') fail(`transaction ${chainHash} is not Safe execTransaction`);
  const [to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures] = outer.args;
  if (String(to).toLowerCase() !== safe || value !== 0n || Number(operation) !== 0) fail(`transaction ${chainHash} has unexpected Safe target/value/operation`);
  if (safeTxGas !== 0n || baseGas !== 0n || gasPrice !== 0n) fail(`transaction ${chainHash} has unexpected Safe gas reimbursement fields`);
  if (String(gasToken).toLowerCase() !== ZERO_ADDRESS || String(refundReceiver).toLowerCase() !== ZERO_ADDRESS) {
    fail(`transaction ${chainHash} has unexpected Safe gas token/refund receiver`);
  }

  const safeNonce = startNonce + BigInt(index);
  const safeTxHash = await publicClient.readContract({
    address: safe,
    abi: safeAbi,
    functionName: 'getTransactionHash',
    args: [safe, 0n, data, 0, 0n, 0n, 0n, ZERO_ADDRESS, ZERO_ADDRESS, safeNonce],
  });
  if (safeTxHash.toLowerCase() !== String(recorded.safeTxHash).toLowerCase()) {
    fail(`transaction ${chainHash} Safe tx hash does not match the recovery receipt`);
  }

  let inner;
  try {
    inner = decodeFunctionData({ abi: safeAbi, data });
  } catch (error) {
    fail(`cannot decode nested Safe owner change ${chainHash}: ${error.message}`);
  }
  if (inner.functionName !== 'swapOwner') fail(`transaction ${chainHash} nested call is not swapOwner`);
  const [prevOwner, oldOwner, newOwner] = inner.args.map((value) => String(value).toLowerCase());
  if (prevOwner !== expected.prevOwner || oldOwner !== expected.oldOwner || newOwner !== expected.newOwner) {
    fail(`transaction ${chainHash} swapOwner arguments do not match the reversible recovery sequence`);
  }

  const packed = splitPackedSafeSignatures(signatures);
  if (packed.length !== 2) fail(`transaction ${chainHash} does not contain exactly two threshold signatures`);
  const recoveredSigners = [];
  for (const safeSignature of packed) {
    const standardSignature = safeEthSignToStandardSignature(safeSignature);
    const signer = await recoverMessageAddress({ message: { raw: safeTxHash }, signature: standardSignature });
    recoveredSigners.push(signer.toLowerCase());
  }
  if (recoveredSigners[0] >= recoveredSigners[1]) fail(`transaction ${chainHash} signatures are not ordered by owner address`);
  if (!sameOwnerSet(recoveredSigners, expected.signerSet)) {
    fail(`transaction ${chainHash} recovered signers ${recoveredSigners.join(',')} do not match expected threshold signer set`);
  }

  const executionLogs = await publicClient.getLogs({
    address: safe,
    event: safeAbi.find((item) => item.type === 'event' && item.name === 'ExecutionSuccess'),
    args: { txHash: safeTxHash },
    fromBlock: BigInt(evidence.startBlock),
    toBlock: 'latest',
    strict: true,
  });
  if (executionLogs.length !== 1 || executionLogs[0].transactionHash.toLowerCase() !== chainHash.toLowerCase()) {
    fail(`transaction ${chainHash} does not have exactly one matching Safe ExecutionSuccess event`);
  }

  verifiedTransactions.push({
    chainTransactionHash: chainHash,
    safeTxHash,
    safeNonce: safeNonce.toString(),
    swapOwner: { prevOwner, oldOwner, newOwner },
    recoveredSigners,
    executionSuccess: true,
  });
}

const recoveryParticipatedInRestore = verifiedTransactions[1].recoveredSigners.includes(recoveryOwner);
if (!recoveryParticipatedInRestore) fail('recovery owner did not participate in the restoration threshold transaction');

console.log(JSON.stringify({
  status: 'DAY9_ARC_SAFE_THRESHOLD_RECOVERY_FINAL_EVIDENCE_PASS',
  chainId: chain.id,
  safe,
  safeVersion: version,
  threshold: Number(threshold),
  startNonce: startNonce.toString(),
  endNonce: nonce.toString(),
  originalOwners,
  finalOwners,
  recoveryOwner,
  simulatedLostOwner: removedOwner,
  verifiedTransactions,
  finalOwnerSetRestored: true,
  recoveryOwnerRemovedAfterDrill: true,
  recoveredSignerParticipatedInRestore: true,
  privateKeysUsedByVerifier: false,
  privateKeysPrinted: false,
  productionAuthorityClaim: false,
  nextAction: 'RECORD_DAY9_SAFE_RECOVERY_EVIDENCE_AND_RECONCILE_REMAINING_GATES',
}, null, 2));
