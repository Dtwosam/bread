import { createECDH, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

import { publicAuthoritySummary, renderSecretEnv, validateAuthoritySet } from './arc-safe-bootstrap-lib.mjs';

const ROOT = process.cwd();
const DEFAULT_SECRET_FILE = join(homedir(), '.config', 'bread', 'day9-arc-testnet-safe.env');
const SAFE_L2 = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762';
const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';

function fail(message) {
  console.error(`day9-arc-safe-authorities: FAIL: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(' ')} failed: ${(result.stderr ?? '').trim()}`);
  return (result.stdout ?? '').trim();
}

function outputPath() {
  const index = process.argv.indexOf('--output');
  const candidate = index === -1 ? DEFAULT_SECRET_FILE : process.argv[index + 1];
  if (!candidate) fail('--output requires a path');
  return resolve(candidate);
}

function assertOutsideRepository(path) {
  const rel = relative(ROOT, path);
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) {
    fail('secret authority file must live outside the Git repository');
  }
}

function addressFromPrivateKey(privateKey) {
  const ecdh = createECDH('secp256k1');
  ecdh.setPrivateKey(privateKey);
  const publicKey = ecdh.getPublicKey(undefined, 'uncompressed').subarray(1);
  const digest = run('cast', ['keccak', `0x${publicKey.toString('hex')}`]);
  if (!/^0x[0-9a-fA-F]{64}$/.test(digest)) fail('cast keccak returned an unexpected digest');
  return `0x${digest.slice(-40)}`.toLowerCase();
}

function generateAuthority() {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const privateKey = randomBytes(32);
    try {
      const address = addressFromPrivateKey(privateKey);
      return { privateKey: `0x${privateKey.toString('hex')}`, address };
    } catch {
      // secp256k1 rejects only invalid scalar values; retry with fresh entropy.
    }
  }
  fail('could not generate valid secp256k1 key material');
}

function randomSaltNonce() {
  return BigInt(`0x${randomBytes(16).toString('hex')}`).toString(10);
}

const secretFile = outputPath();
assertOutsideRepository(secretFile);
if (existsSync(secretFile)) {
  fail(`secret file already exists; refusing to replace authority material: ${secretFile}`);
}

const network = JSON.parse(readFileSync(join(ROOT, 'config', 'networks', 'arc-testnet.json'), 'utf8'));
if (network.chainId !== 5_042_002) fail('Arc Testnet manifest chain ID mismatch');
if (network.dex?.type !== 'UNISWAP_V3') fail('Arc Testnet DEX family must be UNISWAP_V3 before Safe preparation');

const deployer = generateAuthority();
const guardian = generateAuthority();
const owner1 = generateAuthority();
const owner2 = generateAuthority();
const owner3 = generateAuthority();
const owners = [owner1.address, owner2.address, owner3.address];
validateAuthoritySet({ deployer: deployer.address, guardian: guardian.address, owners });

const values = {
  ARC_RPC_URL: network.rpc[0],
  BREAD_CHAIN_ID: String(network.chainId),
  BREAD_USDC: network.usdc.address,
  BREAD_V3_POSITION_MANAGER: network.dex.positionManager,
  BREAD_V3_FACTORY: network.dex.factory,
  BREAD_V3_FEE: '3000',
  BREAD_DAY9_SAFE_L2: SAFE_L2,
  BREAD_DAY9_SAFE_PROXY_FACTORY: SAFE_PROXY_FACTORY,
  BREAD_DAY9_SAFE_SALT_NONCE: randomSaltNonce(),
  BREAD_DEPLOYMENT_AUTHORITY: deployer.address,
  BREAD_DEPLOYER_PRIVATE_KEY: deployer.privateKey,
  BREAD_GUARDIAN: guardian.address,
  BREAD_GUARDIAN_PRIVATE_KEY: guardian.privateKey,
  BREAD_SAFE_OWNER_1: owner1.address,
  BREAD_SAFE_OWNER_1_PRIVATE_KEY: owner1.privateKey,
  BREAD_SAFE_OWNER_2: owner2.address,
  BREAD_SAFE_OWNER_2_PRIVATE_KEY: owner2.privateKey,
  BREAD_SAFE_OWNER_3: owner3.address,
  BREAD_SAFE_OWNER_3_PRIVATE_KEY: owner3.privateKey,
};

mkdirSync(dirname(secretFile), { recursive: true, mode: 0o700 });
writeFileSync(secretFile, renderSecretEnv(values), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
chmodSync(secretFile, 0o600);

console.log(JSON.stringify(publicAuthoritySummary({
  deployer: deployer.address,
  guardian: guardian.address,
  owners,
  secretFile,
}), null, 2));
