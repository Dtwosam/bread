import { sql } from "drizzle-orm";

import type { BreadDb } from "../client.js";
import type { CanonicalIndexedEvent } from "./indexer.js";

type Row = Record<string, unknown>;

function rows(result: unknown): Row[] {
  const candidate = result as { rows?: Row[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

function exactAddress(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} is not an address`);
  }
  return value.toLowerCase();
}

async function incrementCreatorTradeCount(
  db: BreadDb,
  input: Readonly<{
    chainId: number;
    tokenAddress: string;
    creatorAddress: string;
    blockNumber: bigint;
  }>,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO creator_rollups (
      chain_id, creator_address, token_address, accrued_fees, claimed_fees,
      trade_count, latest_block_number, updated_at
    ) VALUES (
      ${input.chainId}, ${input.creatorAddress}, ${input.tokenAddress}, '0', '0', '1',
      ${input.blockNumber.toString(10)}, now()
    )
    ON CONFLICT (chain_id, creator_address, token_address) DO UPDATE SET
      trade_count = creator_rollups.trade_count + 1,
      latest_block_number = EXCLUDED.latest_block_number,
      updated_at = EXCLUDED.updated_at
  `);
}

export async function incrementCreatorTradeCountForToken(
  db: BreadDb,
  input: Readonly<{
    chainId: number;
    tokenAddress: string;
    blockNumber: bigint;
  }>,
): Promise<void> {
  const tokenAddress = exactAddress(input.tokenAddress, "launch token");
  const launchRows = rows(
    await db.execute(sql`
    SELECT creator_fee_recipient
    FROM launches
    WHERE chain_id = ${input.chainId}
      AND token_address = ${tokenAddress}
    LIMIT 2
  `),
  );
  if (launchRows.length !== 1) {
    throw new Error(
      `creator trade attribution is not unique for token ${tokenAddress}`,
    );
  }

  const creatorValue = launchRows[0]!.creator_fee_recipient;
  if (creatorValue === null || creatorValue === undefined) return;
  const creatorAddress = exactAddress(creatorValue, "creator fee recipient");
  await incrementCreatorTradeCount(db, {
    chainId: input.chainId,
    tokenAddress,
    creatorAddress,
    blockNumber: input.blockNumber,
  });
}

export async function projectCreatorTradeCount(
  db: BreadDb,
  event: CanonicalIndexedEvent,
): Promise<void> {
  if (event.eventName !== "CurveBuy" && event.eventName !== "CurveSell") return;

  const launchRows = rows(
    await db.execute(sql`
    SELECT token_address, creator_fee_recipient
    FROM launches
    WHERE chain_id = ${event.identity.chainId}
      AND curve_address = ${event.contractAddress.toLowerCase()}
    LIMIT 2
  `),
  );
  if (launchRows.length !== 1) {
    throw new Error(
      `creator trade attribution is not unique for curve ${event.contractAddress}`,
    );
  }

  const launch = launchRows[0]!;
  const tokenAddress = exactAddress(launch.token_address, "launch token");
  if (
    launch.creator_fee_recipient === null ||
    launch.creator_fee_recipient === undefined
  ) {
    return;
  }
  const creatorAddress = exactAddress(
    launch.creator_fee_recipient,
    "creator fee recipient",
  );
  await incrementCreatorTradeCount(db, {
    chainId: event.identity.chainId,
    tokenAddress,
    creatorAddress,
    blockNumber: event.blockNumber,
  });
}
