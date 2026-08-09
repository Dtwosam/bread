import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const network = process.argv[2];
const ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED = "ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED";

function fail(message) {
  console.error(`day5-configure: FAIL: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function isHash(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(value ?? "");
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(value ?? "") && !/^0x0{40}$/i.test(value);
}

if (!network || !["arc-testnet", "arc-mainnet"].includes(network)) {
  fail("usage: node scripts/day5/configure-graduation.mjs <arc-testnet|arc-mainnet>");
}

const networkManifest = readJson(`config/networks/${network}.json`);
const deployment = readJson(`config/deployments/${network}.day5.json`);

if (deployment.adapter.active !== true) {
  fail(`${ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED}: deployment adapter.active is not true`);
}
if (!["UNISWAP_V3", "UNISWAP_V4"].includes(deployment.adapter.family)) {
  fail("adapter family must be an explicitly ratified UNISWAP_V3 or UNISWAP_V4 value");
}
if (networkManifest.dex?.type !== deployment.adapter.family) {
  fail("network DEX family and deployment adapter family do not match");
}
if (!isHash(deployment.dexEvidenceHash)) fail(`${ARC_DEX_DEPLOYMENT_EVIDENCE_REQUIRED}: missing dexEvidenceHash`);
if (!isHash(deployment.economicsConfigHash)) fail("BREAD_PRODUCTION_ECONOMICS_CONFIG_REQUIRED: missing economicsConfigHash");
if (!isHash(deployment.adapter.configHash)) fail("missing graduationConfigHash / adapter.configHash");
if (!isAddress(networkManifest.usdc?.address)) fail("canonical USDC address is unresolved");
if (networkManifest.usdc.decimals !== 6) fail("canonical USDC must use 6 decimals");

for (const [label, value] of Object.entries({
  adapter: deployment.adapter.adapter,
  positionManager: deployment.adapter.positionManager,
  protocolAdmin: deployment.authorities.protocolAdmin,
  guardian: deployment.authorities.guardian,
})) {
  if (!isAddress(value)) fail(`missing verified ${label}`);
}

if (deployment.adapter.family === "UNISWAP_V3") {
  if (!isAddress(deployment.adapter.v3Factory)) fail("verified V3 factory is required");
  if (deployment.adapter.poolManager !== null) fail("V3 configuration must not set a V4 poolManager");
} else {
  if (!isAddress(deployment.adapter.poolManager)) fail("verified V4 poolManager is required");
  if (deployment.adapter.v3Factory !== null) fail("V4 configuration must not set a V3 factory");
}

const graduationConfigHash = deployment.adapter.configHash;
const output = {
  network,
  chainId: deployment.chainId,
  usdc: networkManifest.usdc.address,
  adapterFamily: deployment.adapter.family,
  adapter: deployment.adapter.adapter,
  positionManager: deployment.adapter.positionManager,
  poolManager: deployment.adapter.poolManager,
  v3Factory: deployment.adapter.v3Factory,
  graduationConfigHash,
  economicsConfigHash: deployment.economicsConfigHash,
  dexEvidenceHash: deployment.dexEvidenceHash,
};

console.log(JSON.stringify(output, null, 2));
