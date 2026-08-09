import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';

type Row = Record<string, unknown>;

function rows(result: unknown): Row[] {
  const candidate = result as { rows?: Row[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

function text(value: unknown, fallback = '0'): string {
  return typeof value === 'string' && /^\d+$/.test(value) ? value : fallback;
}

export class CreatorRepository {
  constructor(private readonly db: BreadDb) {}

  async getCreatorOverview(chainId: number, creatorAddress: string) {
    const address = creatorAddress.toLowerCase();
    const [created, feeRecipient, feeTotals, earned] = await Promise.all([
      this.db.execute(sql`
        SELECT token_address, curve_address
        FROM launches
        WHERE chain_id = ${chainId} AND deployer_address = ${address}
        ORDER BY launch_block_number DESC, launch_log_index DESC, token_address ASC
      `),
      this.db.execute(sql`
        SELECT token_address, curve_address
        FROM launches
        WHERE chain_id = ${chainId} AND creator_fee_recipient = ${address}
        ORDER BY launch_block_number DESC, launch_log_index DESC, token_address ASC
      `),
      this.db.execute(sql`
        SELECT
          COALESCE((SELECT sum(amount) FROM fee_credits WHERE chain_id = ${chainId} AND recipient_address = ${address}), 0)::text AS credited,
          COALESCE((SELECT sum(amount) FROM fee_claims WHERE chain_id = ${chainId} AND recipient_address = ${address}), 0)::text AS claimed
      `),
      this.db.execute(sql`
        SELECT token_address, accrued_fees::text AS credited, trade_count::text AS trade_count
        FROM creator_rollups
        WHERE chain_id = ${chainId} AND creator_address = ${address}
        ORDER BY token_address ASC
      `),
    ]);

    const totals = rows(feeTotals)[0] ?? {};
    const credited = BigInt(text(totals.credited));
    const claimed = BigInt(text(totals.claimed));
    if (claimed > credited) throw new Error(`indexed creator claims exceed credits for ${address}`);

    return {
      address,
      createdLaunches: rows(created).map((row) => ({
        tokenAddress: String(row.token_address).toLowerCase(),
        curveAddress: String(row.curve_address).toLowerCase(),
      })),
      feeRecipientLaunches: rows(feeRecipient).map((row) => ({
        tokenAddress: String(row.token_address).toLowerCase(),
        curveAddress: String(row.curve_address).toLowerCase(),
      })),
      fees: {
        credited: credited.toString(10),
        claimed: claimed.toString(10),
        indexedClaimable: (credited - claimed).toString(10),
        onchainAuthoritative: false,
      },
      perLaunchEarnedRevenue: rows(earned).map((row) => ({
        tokenAddress: String(row.token_address).toLowerCase(),
        credited: text(row.credited),
        tradeCount: text(row.trade_count),
      })),
      unavailable: {
        buyback: true,
        vesting: true,
      },
    } as const;
  }
}
