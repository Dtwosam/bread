import { sql } from "drizzle-orm";

import type { BreadDb } from "../client.js";

export type GraduatedV3RegistryReadRow = Readonly<{
  chainId: number;
  tokenAddress: string;
  curveAddress: string;
  graduatedVenueKind: string | null;
  graduatedVenueAddress: string | null;
  graduatedVenueFeeTier: number | null;
  graduatedVenueQuoteIsToken0: boolean | null;
  graduationCompletedBlock: string | null;
  graduationCompletedTransactionIndex: number | null;
  graduationCompletedLogIndex: number | null;
}>;

function resultRows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate.rows) ? candidate.rows : [];
}

export async function listGraduatedV3RegistryRows(
  db: BreadDb,
  input: Readonly<{
    chainId: number;
    stackVersion: string;
    factoryAddress: string;
  }>,
): Promise<readonly GraduatedV3RegistryReadRow[]> {
  const result = await db.execute(sql`
    SELECT
      l.chain_id AS "chainId",
      l.token_address AS "tokenAddress",
      l.curve_address AS "curveAddress",
      s.graduated_venue_kind AS "graduatedVenueKind",
      s.graduated_venue_address AS "graduatedVenueAddress",
      s.graduated_venue_fee_tier AS "graduatedVenueFeeTier",
      s.graduated_venue_quote_is_token0 AS "graduatedVenueQuoteIsToken0",
      s.graduation_completed_block::text AS "graduationCompletedBlock",
      s.graduation_completed_transaction_index AS "graduationCompletedTransactionIndex",
      s.graduation_completed_log_index AS "graduationCompletedLogIndex"
    FROM launches l
    INNER JOIN launch_state s
      ON s.chain_id = l.chain_id
     AND s.token_address = l.token_address
    WHERE l.chain_id = ${input.chainId}
      AND l.stack_version = ${input.stackVersion}
      AND l.factory_address = ${input.factoryAddress.toLowerCase()}
      AND l.graduation_adapter_family = 2
      AND s.graduation_phase = 'POOL_CREATED'
    ORDER BY l.token_address ASC
  `);
  return resultRows<GraduatedV3RegistryReadRow>(result);
}
