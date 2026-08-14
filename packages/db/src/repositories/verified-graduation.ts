import { sql } from "drizzle-orm";

import type { BreadDb } from "../client.js";
import { applyFeeAdminGraduationProjection as applyLegacyFeeAdminGraduationProjection } from "./fees-admin-graduation.js";
import type {
  CanonicalIndexedEvent,
  IndexerProtocolContext,
} from "./indexer.js";

export type VerifiedGraduatedVenueProjection = Readonly<{
  venueKind: "UNISWAP_V3";
  chainId: number;
  tokenAddress: string;
  poolAddress: string;
  feeTier: number;
  quoteIsToken0: boolean;
  completion: Readonly<{
    blockNumber: bigint;
    transactionIndex: number;
    logIndex: number;
  }>;
}>;

function canonicalAddress(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(value) ||
    /^0x0{40}$/i.test(value)
  ) {
    return undefined;
  }
  return value.toLowerCase();
}

function verifiedVenueForEvent(
  event: CanonicalIndexedEvent,
  verifiedVenue: VerifiedGraduatedVenueProjection | undefined,
): VerifiedGraduatedVenueProjection | undefined {
  if (verifiedVenue === undefined) return undefined;
  const eventToken = canonicalAddress(event.payload.token);
  const venueToken = canonicalAddress(verifiedVenue.tokenAddress);
  const poolAddress = canonicalAddress(verifiedVenue.poolAddress);

  if (
    event.eventName !== "GraduationCompleted" ||
    verifiedVenue.venueKind !== "UNISWAP_V3" ||
    verifiedVenue.chainId !== event.identity.chainId ||
    eventToken === undefined ||
    venueToken !== eventToken ||
    poolAddress === undefined ||
    !Number.isSafeInteger(verifiedVenue.feeTier) ||
    verifiedVenue.feeTier <= 0 ||
    verifiedVenue.feeTier > 0xffffff ||
    typeof verifiedVenue.quoteIsToken0 !== "boolean" ||
    verifiedVenue.completion.blockNumber !== event.blockNumber ||
    verifiedVenue.completion.transactionIndex !== event.transactionIndex ||
    verifiedVenue.completion.logIndex !== event.identity.logIndex
  ) {
    throw new Error("verified graduated venue identity mismatch");
  }

  return {
    ...verifiedVenue,
    tokenAddress: venueToken,
    poolAddress,
  };
}

export async function applyFeeAdminGraduationProjection(
  db: BreadDb,
  event: CanonicalIndexedEvent,
  context: IndexerProtocolContext,
  verifiedVenue?: VerifiedGraduatedVenueProjection,
): Promise<void> {
  const canonicalVenue = verifiedVenueForEvent(event, verifiedVenue);

  await applyLegacyFeeAdminGraduationProjection(db, event, context);
  if (canonicalVenue === undefined) return;

  await db.execute(sql`
    UPDATE launch_state
    SET
      graduated_venue_kind = ${canonicalVenue.venueKind},
      graduated_venue_address = ${canonicalVenue.poolAddress},
      graduated_venue_fee_tier = ${canonicalVenue.feeTier},
      graduated_venue_quote_is_token0 = ${canonicalVenue.quoteIsToken0},
      graduation_completed_transaction_index = ${canonicalVenue.completion.transactionIndex},
      updated_at = now()
    WHERE chain_id = ${event.identity.chainId}
      AND token_address = ${canonicalVenue.tokenAddress}
  `);
}
