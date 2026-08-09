import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import type { CanonicalIndexedEvent } from './indexer.js';

type Row = Record<string, unknown>;

function rows(result: unknown): Row[] {
  const candidate = result as { rows?: Row[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

function exact(value: unknown, label: string): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`${label} is not an exact unsigned integer`);
}

export async function projectCurveGraduationProgress(db: BreadDb, event: CanonicalIndexedEvent): Promise<void> {
  if (event.eventName !== 'CurveBuy' && event.eventName !== 'CurveSell') return;

  const launchRows = rows(await db.execute(sql`
    SELECT token_address, initial_supply::text, reserved_tokens_baseline::text
    FROM launches
    WHERE chain_id = ${event.identity.chainId}
      AND curve_address = ${event.contractAddress.toLowerCase()}
    LIMIT 2
  `));
  if (launchRows.length !== 1) throw new Error(`curve progress attribution is not unique: ${event.contractAddress}`);
  const launch = launchRows[0]!;
  const token = String(launch.token_address).toLowerCase();
  const initialSupply = exact(launch.initial_supply, 'launch initial supply');
  const reservedTokens = exact(launch.reserved_tokens_baseline, 'launch reserved tokens');
  if (reservedTokens > initialSupply) throw new Error('reserved tokens exceed initial supply');
  const initialSellable = initialSupply - reservedTokens;
  if (initialSellable === 0n) throw new Error('initial sellable token inventory is zero');

  const stateRows = rows(await db.execute(sql`
    SELECT remaining_sellable_tokens::text
    FROM launch_state
    WHERE chain_id = ${event.identity.chainId}
      AND token_address = ${token}
    LIMIT 1
  `));
  if (stateRows.length !== 1) throw new Error(`launch state missing for graduation progress: ${token}`);
  const remaining = exact(stateRows[0]!.remaining_sellable_tokens, 'remaining sellable tokens');
  if (remaining > initialSellable) throw new Error('remaining sellable tokens exceed initial sellable inventory');

  const sold = initialSellable - remaining;
  const rawBps = (sold * 10_000n) / initialSellable;
  const progressBps = rawBps > 10_000n ? 10_000n : rawBps;
  const graduationState = progressBps >= 10_000n ? 'READY' : 'CURVE_ACTIVE';

  await db.execute(sql`
    INSERT INTO token_metrics (
      chain_id, token_address, graduation_progress_bps, graduation_state, updated_at
    ) VALUES (
      ${event.identity.chainId}, ${token}, ${progressBps.toString(10)}, ${graduationState}, now()
    )
    ON CONFLICT (chain_id, token_address) DO UPDATE SET
      graduation_progress_bps = EXCLUDED.graduation_progress_bps,
      graduation_state = EXCLUDED.graduation_state,
      updated_at = EXCLUDED.updated_at
  `);
}
