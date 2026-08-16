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
    SELECT token_address, graduation_threshold::text
    FROM launches
    WHERE chain_id = ${event.identity.chainId}
      AND curve_address = ${event.contractAddress.toLowerCase()}
    LIMIT 2
  `));
  if (launchRows.length !== 1) throw new Error(`curve progress attribution is not unique: ${event.contractAddress}`);
  const launch = launchRows[0]!;
  const token = String(launch.token_address).toLowerCase();
  const graduationThreshold = exact(launch.graduation_threshold, 'launch graduation threshold');
  if (graduationThreshold === 0n) throw new Error('launch graduation threshold is zero');

  const stateRows = rows(await db.execute(sql`
    SELECT real_quote_reserve::text
    FROM launch_state
    WHERE chain_id = ${event.identity.chainId}
      AND token_address = ${token}
    LIMIT 1
  `));
  if (stateRows.length !== 1) throw new Error(`launch state missing for graduation progress: ${token}`);
  const realQuoteReserve = exact(stateRows[0]!.real_quote_reserve, 'real quote reserve');

  const rawBps = (realQuoteReserve * 10_000n) / graduationThreshold;
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
