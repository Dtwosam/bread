import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const CLOSEOUT_EVIDENCE = 'docs/evidence/day6-sdk-indexer-api-closeout.md';

async function readRequired(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN';
    throw new Error(`Day-6 closeout validation requires ${file} (${code})`);
  }
}

function requireText(text, token, label) {
  if (!text.includes(token)) throw new Error(`${label} missing required token: ${token}`);
}

function requirePattern(text, pattern, label) {
  if (!pattern.test(text)) throw new Error(`${label} missing required pattern: ${pattern}`);
}

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(target);
    return entry.isFile() && target.endsWith('.ts') ? [target] : [];
  }));
  return nested.flat();
}

const routeContract = new Map([
  ['apps/api/src/routes/feed.ts', '/v1/feed'],
  ['apps/api/src/routes/search.ts', '/v1/search'],
  ['apps/api/src/routes/token.ts', '/v1/tokens/:address'],
  ['apps/api/src/routes/trades.ts', '/v1/tokens/:address/trades'],
  ['apps/api/src/routes/holders.ts', '/v1/tokens/:address/holders'],
  ['apps/api/src/routes/portfolio.ts', '/v1/portfolio/:address'],
  ['apps/api/src/routes/creators.ts', '/v1/creators/:address'],
  ['apps/api/src/routes/status.ts', '/v1/status'],
]);

const server = await readRequired('apps/api/src/server.ts');
for (const [file, route] of routeContract) {
  const routeSource = await readRequired(file);
  requireText(routeSource, `app.get('${route}'`, file);
}

const requiredRegistrations = [
  'registerFeedRoute(app',
  'registerSearchRoute(app',
  'registerTokenRoute(app',
  'registerTradesRoute(app',
  'registerHoldersRoute(app',
  'registerPortfolioRoute(app',
  'registerCreatorRoute(app',
  'registerStatusRoute(app',
];
for (const registration of requiredRegistrations) requireText(server, registration, 'apps/api/src/server.ts');

const apiFiles = await collectTypeScriptFiles('apps/api/src');
for (const file of apiFiles) {
  const source = await readRequired(file);
  if (/\bapp\.(?:post|put|patch|delete)\s*\(\s*['"]\/v1\//.test(source)) {
    throw new Error(`production API financial/action surface must remain read-only: ${file}`);
  }
}

const apiTypes = await readRequired('packages/types/src/api.ts');
requirePattern(apiTypes, /export type IndexedResponse<[^>]+>[\s\S]*?meta:\s*FreshnessMeta;/, 'IndexedResponse');
for (const token of [
  'indexedThroughBlock:',
  'indexedThroughBlockHash:',
  'indexedThroughBlockTimestamp:',
  'servedAt:',
  "source: 'bread-indexer';",
  'status: FreshnessStatus;',
]) requireText(apiTypes, token, 'FreshnessMeta');

const migration = await readRequired('packages/db/drizzle/0001_day6_read_stack.sql');
const requiredTables = [
  'event_journal',
  'protocol_stacks',
  'launches',
  'launch_state',
  'trades',
  'fee_credits',
  'fee_claims',
  'creator_rollups',
  'holder_snapshots',
  'market_candles',
  'token_metrics',
  'indexer_checkpoints',
  'admin_events',
  'metadata',
];
for (const table of requiredTables) {
  requirePattern(migration, new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\s*\\(`), `Day-6 table ${table}`);
}
requirePattern(
  migration,
  /CREATE TABLE IF NOT EXISTS event_journal[\s\S]*?PRIMARY KEY\s*\(chain_id, transaction_hash, log_index\)/,
  'event journal canonical identity',
);
requirePattern(
  migration,
  /CREATE TABLE IF NOT EXISTS indexer_checkpoints[\s\S]*?indexed_through_block_hash\s+text\s+NOT NULL[\s\S]*?decoder_schema_version\s+text\s+NOT NULL[\s\S]*?PRIMARY KEY\s*\(chain_id, stack_version, factory_address\)/,
  'indexer checkpoint continuity contract',
);

await access('scripts/abi/check-bread-abi.mjs');
const packageJson = JSON.parse(await readRequired('package.json'));
if (packageJson.scripts?.['abi:check'] !== 'node scripts/abi/check-bread-abi.mjs') {
  throw new Error('package.json must retain canonical abi:check wiring');
}
const ci = await readRequired('.github/workflows/ci.yml');
requireText(ci, 'Check generated Bread SDK ABIs', 'root CI ABI drift gate');

const state = await readRequired('docs/current-build-state.yaml');
let closeoutEvidence;
try {
  closeoutEvidence = await readFile(CLOSEOUT_EVIDENCE, 'utf8');
} catch (error) {
  const day6AlreadyClaimed = /DAY6[^\n]*(?:PASS_DURABLE|DURABLY_CLOSED|CLOSEOUT[^\n]*PASS)/i.test(state);
  if (day6AlreadyClaimed) {
    throw new Error('current-build-state claims Day 6 PASS before closeout evidence exists');
  }
  const code = error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN';
  throw new Error(`Day-6 closeout evidence is required before PASS: ${CLOSEOUT_EVIDENCE} (${code})`);
}

const mandatoryGateTokens = [
  'DELETE_DB_REBUILD_PASS = PASS',
  'OVERLAP_REPLAY_IDEMPOTENT = PASS',
  'API_FRESHNESS_METADATA_PRESENT = PASS',
  'RECONCILE_PASS = PASS',
  'FIRST_MEANINGFUL_CONCURRENT_READ_REPLAY_CACHE_FANOUT_TESTS_PASS = PASS',
];
for (const token of mandatoryGateTokens) requireText(closeoutEvidence, token, CLOSEOUT_EVIDENCE);

for (const token of [
  'DAY6_API_ROUTE_COVERAGE = PASS',
  'DAY6_ABI_DRIFT = PASS',
  'DAY6_MIGRATION_REBUILD_IDENTITY = PASS',
  'DAY6_RECONCILIATION_REPORT_IDENTITY = PASS',
  'DAY6_NO_OPEN_CRITICAL_HIGH = PASS',
]) requireText(closeoutEvidence, token, CLOSEOUT_EVIDENCE);

requirePattern(
  closeoutEvidence,
  /(?:candidate|exact)[_ -]head\s*:\s*`?[0-9a-f]{40}`?/i,
  'Day-6 closeout exact candidate identity',
);

console.log('day6-read-stack-validation: PASS');
