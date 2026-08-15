import { sql } from "drizzle-orm";

import type { BreadDb } from "../client.js";
import type { IndexerProtocolContext } from "./indexer.js";

export type ReconciliationGraduatedVenueRow = Readonly<{
  tokenAddress: string;
  graduatedVenueKind: string | null;
  graduatedVenueAddress: string | null;
  graduatedVenueFeeTier: number | null;
  graduatedVenueQuoteIsToken0: boolean | null;
  graduationCompletedBlock: bigint | null;
  graduationCompletedTransactionIndex: number | null;
  graduationCompletedLogIndex: number | null;
}>;

function rows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

export async function readReconciliationGraduatedVenues(
  db: BreadDb,
  context: IndexerProtocolContext,
): Promise<readonly ReconciliationGraduatedVenueRow[]> {
  const factory = context.factoryAddress.toLowerCase();
  const result = await db.execute(sql`
    SELECT
      s.token_address AS "tokenAddress",
      s.graduated_venue_kind AS "graduatedVenueKind",
      s.graduated_venue_address AS "graduatedVenueAddress",
      s.graduated_venue_fee_tier AS "graduatedVenueFeeTier",
      s.graduated_venue_quote_is_token0 AS "graduatedVenueQuoteIsToken0",
      s.graduation_completed_block::text AS "graduationCompletedBlock",
      s.graduation_completed_transaction_index AS "graduationCompletedTransactionIndex",
      s.graduation_completed_log_index AS "graduationCompletedLogIndex"
    FROM launch_state s
    JOIN launches l
      ON l.chain_id=s.chain_id AND l.token_address=s.token_address
    WHERE l.chain_id=${context.chainId}
      AND l.stack_version=${context.stackVersion}
      AND l.factory_address=${factory}
    ORDER BY s.token_address
  `);

  return rows<{
    tokenAddress: string;
    graduatedVenueKind: string | null;
    graduatedVenueAddress: string | null;
    graduatedVenueFeeTier: number | null;
    graduatedVenueQuoteIsToken0: boolean | null;
    graduationCompletedBlock: string | null;
    graduationCompletedTransactionIndex: number | null;
    graduationCompletedLogIndex: number | null;
  }>(result).map((row) => ({
    tokenAddress: row.tokenAddress,
    graduatedVenueKind: row.graduatedVenueKind,
    graduatedVenueAddress: row.graduatedVenueAddress,
    graduatedVenueFeeTier: row.graduatedVenueFeeTier,
    graduatedVenueQuoteIsToken0: row.graduatedVenueQuoteIsToken0,
    graduationCompletedBlock:
      row.graduationCompletedBlock === null
        ? null
        : BigInt(row.graduationCompletedBlock),
    graduationCompletedTransactionIndex:
      row.graduationCompletedTransactionIndex,
    graduationCompletedLogIndex: row.graduationCompletedLogIndex,
  }));
}
