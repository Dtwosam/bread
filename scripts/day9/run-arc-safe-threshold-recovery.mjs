import { createECDH, randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DEFAULT_SECRET_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-safe.env');
const DEFAULT_RECEIPT_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-safe-recovery.json');
const PROTOCOL_SDK = join(ROOT, 'packages', 'protocol-sdk');
const EXECUTOR = join(PROTOCOL_SDK, 'scripts', 'day9-arc-safe-threshold-recovery.mjs');
const VERIFIER = join(PROTOCOL_SDK, 'scripts', 'verify-day9-arc-safe-threshold-recovery.mjs');
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function fail(message) {
  console.error(`day9-arc-safe-threshold-recovery-wrapper: FAIL: ${message}`);
  process.exit(1);
}

function argPath(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return resolve(fallback);
  if (!process.argv[index + 1]) fail(`${flag} requires a path`);
  return resolve(process.argv[index + 1]);
}

function parseEnv(path) {
  const values = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at <= 0) fail(`invalid env line in ${path}`);
    values[line.slice(0, at)] = line.slice(at + 1);
  }
  return values;
}

function renderEnv(values) {
  return `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function required(values, key) {
  const value = values[key];
  if (!value) fail(`missing ${key} in local authority file`);
  return value;
}

function redact(value, secrets) {
  let output = String(value ?? '');
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join('[REDACTED]');
  }
  return output;
}

function run(command, args, options = {}) {
  const secrets = options.secrets ?? [];
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout ?? 300_000,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    fail([
      `${command} ${args.join(' ')} exited ${result.status}`,
      redact(result.stdout, secrets),
      redact(result.stderr, secrets),
    ].join('\n'));
  }
  return String(result.stdout ?? '').trim();
}

function dependencyReady() {
  const result = spawnSync(process.execPath, ['-e', "import('viem').then(()=>process.stdout.write('ok'))"], {
    cwd: PROTOCOL_SDK,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });
  return result.status === 0 && result.stdout === 'ok';
}

function cast(args) {
  const result = spawnSync('cast', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });
  if (result.error) fail(`cast: ${result.error.message}`);
  if (result.status !== 0) fail(`cast ${args.join(' ')} failed: ${(result.stderr ?? '').trim()}`);
  return String(result.stdout ?? '').trim();
}

function addressFromPrivateKey(privateKeyBytes) {
  const ecdh = createECDH('secp256k1');
  ecdh.setPrivateKey(privateKeyBytes);
  const publicKey = ecdh.getPublicKey(undefined, 'uncompressed').subarray(1);
  const digest = cast(['keccak', `0x${publicKey.toString('hex')}`]);
  if (!/^0x[0-9a-fA-F]{64}$/.test(digest)) fail('cast keccak returned an unexpected digest');
  return `0x${digest.slice(-40)}`.toLowerCase();
}

function generateRecoveryAuthority(existingAddresses) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const bytes = randomBytes(32);
    try {
      const owner = addressFromPrivateKey(bytes);
      if (existingAddresses.has(owner)) continue;
      return { owner, privateKey: `0x${bytes.toString('hex')}` };
    } catch {
      // Invalid secp256k1 scalar; retry with fresh entropy.
    }
  }
  fail('could not generate a distinct recovery owner');
}

const secretFile = argPath('--env-file', DEFAULT_SECRET_FILE);
const receiptFile = argPath('--receipt-file', DEFAULT_RECEIPT_FILE);
if (!existsSync(secretFile)) fail(`authority file not found: ${secretFile}`);
if ((statSync(secretFile).mode & 0o077) !== 0) fail('authority secret file permissions are broader than 0600-like');

if (!dependencyReady()) {
  console.log(JSON.stringify({
    status: 'DAY9_SAFE_RECOVERY_DEPENDENCY_BOOTSTRAP_REQUIRED',
    package: '@bread/protocol-sdk',
    dependency: 'viem@2.55.8 (repository lockfile)',
    transactionBroadcast: false,
    privateKeysPrinted: false,
    nextAction: 'RUN_FROZEN_PNPM_PROTOCOL_SDK_INSTALL_THEN_RERUN',
  }, null, 2));
  process.exitCode = 2;
} else {
  const values = parseEnv(secretFile);
  const originalOwners = [1, 2, 3].map((index) => required(values, `BREAD_SAFE_OWNER_${index}`).toLowerCase());
  const existingAddresses = new Set([
    ...originalOwners,
    required(values, 'BREAD_DEPLOYMENT_AUTHORITY').toLowerCase(),
    required(values, 'BREAD_GUARDIAN').toLowerCase(),
    required(values, 'BREAD_DAY9_SAFE_ADDRESS').toLowerCase(),
  ]);

  const existingRecoveryOwner = values.BREAD_SAFE_RECOVERY_OWNER?.toLowerCase();
  const existingRecoveryKey = values.BREAD_SAFE_RECOVERY_OWNER_PRIVATE_KEY;
  if (Boolean(existingRecoveryOwner) !== Boolean(existingRecoveryKey)) {
    fail('recovery owner address/private-key fields must either both exist or both be absent');
  }

  let recoveryOwnerPrepared = false;
  if (!existingRecoveryOwner) {
    const generated = generateRecoveryAuthority(existingAddresses);
    values.BREAD_SAFE_RECOVERY_OWNER = generated.owner;
    values.BREAD_SAFE_RECOVERY_OWNER_PRIVATE_KEY = generated.privateKey;
    writeFileSync(secretFile, renderEnv(values), { encoding: 'utf8', mode: 0o600 });
    chmodSync(secretFile, 0o600);
    recoveryOwnerPrepared = true;
  } else {
    if (!ADDRESS_RE.test(existingRecoveryOwner)) fail('existing recovery owner address is invalid');
    if (existingAddresses.has(existingRecoveryOwner)) fail('existing recovery owner collides with another authority role');
  }

  const secrets = [
    values.BREAD_DEPLOYER_PRIVATE_KEY,
    values.BREAD_SAFE_OWNER_1_PRIVATE_KEY,
    values.BREAD_SAFE_OWNER_2_PRIVATE_KEY,
    values.BREAD_SAFE_OWNER_3_PRIVATE_KEY,
    values.BREAD_GUARDIAN_PRIVATE_KEY,
    values.BREAD_SAFE_RECOVERY_OWNER_PRIVATE_KEY,
  ].filter(Boolean);

  const executionEnv = {
    ...process.env,
    ...values,
    BREAD_SAFE_RECOVERY_RECEIPT_FILE: receiptFile,
  };
  const executionOutput = run(process.execPath, [EXECUTOR], {
    cwd: PROTOCOL_SDK,
    env: executionEnv,
    timeout: 360_000,
    secrets,
  });

  const verificationOutput = run(process.execPath, [VERIFIER], {
    cwd: PROTOCOL_SDK,
    env: {
      ...process.env,
      ARC_RPC_URL: required(values, 'ARC_RPC_URL'),
      BREAD_SAFE_RECOVERY_RECEIPT_FILE: receiptFile,
    },
    timeout: 240_000,
  });

  let execution;
  let independentFinalVerification;
  try {
    execution = JSON.parse(executionOutput);
    independentFinalVerification = JSON.parse(verificationOutput);
  } catch (error) {
    fail(`recovery child output was not valid JSON: ${error.message}`);
  }

  console.log(JSON.stringify({
    status: 'DAY9_ARC_SAFE_THRESHOLD_RECOVERY_AND_FINAL_VERIFY_PASS',
    recoveryOwnerPrepared,
    recoveryOwner: values.BREAD_SAFE_RECOVERY_OWNER,
    execution,
    independentFinalVerification,
    receiptFile,
    productionAuthorityClaim: false,
    privateKeysPrinted: false,
    nextAction: 'RECORD_DAY9_SAFE_RECOVERY_EVIDENCE_AND_RECONCILE_REMAINING_GATES',
  }, null, 2));
}
