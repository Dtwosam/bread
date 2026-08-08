import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inventoryPath = path.join(root, "config/protocol/day5-dex-source-inventory.json");
const exactSha = /^[0-9a-f]{40}$/i;

function fail(message) {
  console.error(`day5-graduation-source-integrity: FAIL: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(inventoryPath)) {
  fail("missing config/protocol/day5-dex-source-inventory.json");
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

if (inventory.projectSourcePack !== "v1.5-day5-preflight-consolidated") {
  fail("unexpected Project Source pack");
}
if (inventory.checkedAt !== "2026-08-09") fail("checkedAt must be the current Day-5 source check date");

const official = inventory.uniswapV4?.officialSource;
if (!official) fail("missing official Uniswap V4 source block");
if (official.periphery?.repository !== "https://github.com/Uniswap/v4-periphery") fail("wrong V4 periphery repository");
if (official.periphery?.commit !== "545a5d2a87228167edde48f3b9eda122d1e3c4d6") fail("wrong V4 periphery commit");
if (official.core?.repository !== "https://github.com/Uniswap/v4-core") fail("wrong V4 core repository");
if (official.core?.commit !== "59d3ecf53afa9264a16bba0e38f4c5d2231f80bc") fail("wrong V4 core commit");
if (official.permit2?.repository !== "https://github.com/Uniswap/permit2") fail("wrong Permit2 repository");
if (official.permit2?.commit !== "cc56ad0f3439c502c246fc5cfcc3db92bb8b7219") fail("wrong Permit2 commit");

for (const [name, source] of Object.entries({
  periphery: official.periphery,
  core: official.core,
  permit2: official.permit2,
})) {
  if (!exactSha.test(source.commit ?? "")) fail(`${name} commit must be an exact 40-hex SHA`);
  if (!Array.isArray(source.files) || source.files.length === 0) fail(`${name} must list exact source files`);
  for (const file of source.files) {
    if (!file.path || !file.spdx) fail(`${name} source file is missing path/SPDX identity`);
  }
}

if (official.lockedByPeriphery !== true) fail("V4 core/Permit2 pins must be derived from the exact periphery lock");
if (inventory.uniswapV4?.arcDeployment?.status !== "NOT_LISTED_IN_OFFICIAL_V4_DEPLOYMENTS") {
  fail("Arc V4 deployment must remain unresolved while the official V4 registry has no Arc entry");
}
if (inventory.uniswapV4?.arcDeployment?.checkedAt !== "2026-08-09") {
  fail("Arc V4 deployment evidence must use the current Day-5 check date");
}

const v3 = inventory.uniswapV3?.officialSource;
if (!v3) fail("missing official Uniswap V3 source block");
if (v3.periphery?.repository !== "https://github.com/Uniswap/v3-periphery") fail("wrong V3 periphery repository");
if (v3.periphery?.commit !== "0682387198a24c7cd63566a2c58398533860a5d1") fail("wrong V3 periphery commit");
if (v3.core?.repository !== "https://github.com/Uniswap/v3-core") fail("wrong V3 core repository");
if (v3.core?.commit !== "d0831dc6b8a318df3872b6d68f6de135c9f3ec29") fail("wrong V3 core commit");
for (const [name, source] of Object.entries({
  v3Periphery: v3.periphery,
  v3Core: v3.core,
})) {
  if (!exactSha.test(source.commit ?? "")) fail(`${name} commit must be an exact 40-hex SHA`);
  if (!Array.isArray(source.files) || source.files.length === 0) fail(`${name} must list exact source files`);
  for (const file of source.files) {
    if (!file.path || !file.spdx) fail(`${name} source file is missing path/SPDX identity`);
  }
}
if (inventory.uniswapV3?.activationAllowed !== false) {
  fail("Arc V3 fallback must remain inactive without verified deployment need and compatibility evidence");
}

if (inventory.arc?.mainnet?.status !== "WAITING_FOR_OFFICIAL_PUBLICATION") {
  fail("Arc mainnet values must remain an official-publication gate");
}
if (inventory.arc?.testnet?.canonicalUsdc !== "0x3600000000000000000000000000000000000000") {
  fail("Arc testnet canonical USDC mismatch");
}
if (inventory.arc?.testnet?.usdcDecimals !== 6) fail("Arc testnet USDC must be 6 decimals");
if (inventory.ponsReference?.role !== "REFERENCE_ONLY") fail("Pons must remain reference-only");
if (!exactSha.test(inventory.ponsReference?.commit ?? "")) fail("Pons reference must use exact commit");

for (const network of ["config/networks/arc-testnet.json", "config/networks/arc-mainnet.json"]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, network), "utf8"));
  const dex = manifest.dex ?? manifest.graduationDex ?? null;
  if (dex?.active === true || dex?.status === "ACTIVE" || dex?.type === "UNISWAP_V4" || dex?.type === "UNISWAP_V3") {
    fail(`${network} must not activate a graduation DEX without authoritative Arc deployment evidence`);
  }
}

console.log("day5-graduation-source-integrity: PASS");
