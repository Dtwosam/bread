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

export type GraduatedV3VerificationLaunchRead = Readonly<{
  chainId: number;
  tokenAddress: string;
  curveAddress: string;
  graduationCoordinator: string;
  graduationAdapter: string;
  graduationAdapterFamily: number;
  graduationConfigHash: string;
}>;

function resultRows<T>(result: unknown): T[] {
  const candidate = result as { rows?: T[] };
  return Array.isArray(candidate.rows) ? candidate.rows : [];
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`incomplete canonical V3 launch snapshot: ${label}`);
  }
  return value;
}

function requiredInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`incomplete canonical V3 launch snapshot: ${label}`);
  }
  return value;
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

export async function getGraduatedV3VerificationLaunch(
  db: BreadDb,
  input: Readonly<{
    chainId: number;
    stackVersion: string;
    factoryAddress: string;
    tokenAddress: string;
  }>,
): Promise<GraduatedV3VerificationLaunchRead | undefined> {
  const result = await db.execute(sql`
    SELECT
      chain_id AS "chainId",
      token_address AS "tokenAddress",
      curve_address AS "curveAddress",
      graduation_coordinator AS "graduationCoordinator",
      graduation_adapter AS "graduationAdapter",
      graduation_adapter_family AS "graduationAdapterFamily",
      graduation_config_hash AS "graduationConfigHash"
    FROM launches
    WHERE chain_id = ${input.chainId}
      AND stack_version = ${input.stackVersion}
      AND factory_address = ${input.factoryAddress.toLowerCase()}
      AND token_address = ${input.tokenAddress.toLowerCase()}
    LIMIT 1
  `);
  const row = resultRows<Record<string, unknown>>(result)[0];
  if (!row) return undefined;
  return {
    chainId: requiredInteger(row.chainId, "chainId"),
    tokenAddress: requiredString(row.tokenAddress, "tokenAddress"),
    curveAddress: requiredString(row.curveAddress, "curveAddress"),
    graduationCoordinator: requiredString(
      row.graduationCoordinator,
      "graduationCoordinator",
    ),
    graduationAdapter: requiredString(
      row.graduationAdapter,
      "graduationAdapter",
    ),
    graduationAdapterFamily: requiredInteger(
      row.graduationAdapterFamily,
      "graduationAdapterFamily",
    ),
    graduationConfigHash: requiredString(
      row.graduationConfigHash,
      "graduationConfigHash",
    ),
  };
}
