import { readFile } from 'node:fs/promises';

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

import { eventJournal } from './schema/event-journal.js';
import {
  adminEvents,
  creatorRollups,
  feeClaims,
  feeCredits,
  holderSnapshots,
  indexerCheckpoints,
  launches,
  launchState,
  marketCandles,
  metadata,
  protocolStacks,
  tokenMetrics,
  trades,
} from './schema/projections.js';

export const breadDbSchema = {
  eventJournal,
  protocolStacks,
  launches,
  launchState,
  trades,
  feeCredits,
  feeClaims,
  creatorRollups,
  holderSnapshots,
  marketCandles,
  tokenMetrics,
  indexerCheckpoints,
  adminEvents,
  metadata,
} as const;

export type BreadPgPool = Readonly<{
  query: (text: string, values?: readonly unknown[]) => Promise<unknown>;
}>;

export type BreadDb = NodePgDatabase<typeof breadDbSchema>;

export function createBreadDb(pool: unknown): BreadDb {
  return drizzle(pool as never, { schema: breadDbSchema }) as BreadDb;
}

let migrationSqlPromise: Promise<string> | undefined;

async function readMigrationSql(): Promise<string> {
  migrationSqlPromise ??= readFile(
    new URL('../drizzle/0001_day6_read_stack.sql', import.meta.url),
    'utf8',
  );
  return migrationSqlPromise!;
}

/**
 * Day-6 bootstrap migration is intentionally repeatable. It uses only
 * CREATE TABLE/INDEX IF NOT EXISTS so a fresh or already-initialized read
 * database converges to the same schema without destructive mutation.
 */
export async function migrateBreadDb(pool: BreadPgPool): Promise<void> {
  const sql = await readMigrationSql();
  await pool.query(sql);
}
