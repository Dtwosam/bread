import { sql } from 'drizzle-orm';

import type { DecodedBreadEvent } from '../../../types/src/index.js';
import type { BreadDb } from '../client.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

type SqlRows<T> = Readonly<{ rows?: T[] }>;

export type HolderProjectionContext = Readonly<{
  chainId: number;
  baseProtocolAddresses: readonly string[];
  launchProtocolAddresses?: ReadonlyMap<string, readonly string[]>;
}>;

function rows<T>(result: unknown): T[] {
  const candidate = result as SqlRows<T>;
  return Array.isArray(candidate.rows) ? candidate.rows : [];
}

async function resolveProtocolAddresses(
  db: BreadDb,
  tokenAddress: string,
  context: HolderProjectionContext,
): Promise<ReadonlySet<string>> {
  const canonicalToken = tokenAddress.toLowerCase();
  const result = await db.execute(sql`
    SELECT curve_address AS "curveAddress",
           graduation_coordinator AS "graduationCoordinator",
           graduation_adapter AS "graduationAdapter"
    FROM launches
    WHERE chain_id = ${context.chainId}
      AND token_address = ${canonicalToken}
    LIMIT 1
  `);
  const launch = rows<{
    curveAddress: string;
    graduationCoordinator: string | null;
    graduationAdapter: string | null;
  }>(result)[0];
  const inRange = context.launchProtocolAddresses?.get(canonicalToken);
  if (!launch && !inRange) {
    throw new Error(`holder integrity: transfer emitted by unknown Bread launch token ${canonicalToken}`);
  }

  const protocol = new Set(context.baseProtocolAddresses.map((value) => value.toLowerCase()));
  for (const value of inRange ?? []) protocol.add(value.toLowerCase());
  if (launch) {
    protocol.add(launch.curveAddress.toLowerCase());
    if (launch.graduationCoordinator) protocol.add(launch.graduationCoordinator.toLowerCase());
    if (launch.graduationAdapter) protocol.add(launch.graduationAdapter.toLowerCase());
  }
  return protocol;
}

async function adjustBalance(
  db: BreadDb,
  input: Readonly<{
    chainId: number;
    tokenAddress: string;
    holderAddress: string;
    delta: bigint;
    isProtocolAddress: boolean;
    blockNumber: bigint;
    transactionHash: string;
    logIndex: number;
  }>,
): Promise<void> {
  const holderAddress = input.holderAddress.toLowerCase();
  if (holderAddress === ZERO_ADDRESS || input.delta === 0n) return;

  const currentResult = await db.execute(sql`
    SELECT balance::text AS balance
    FROM holder_snapshots
    WHERE chain_id = ${input.chainId}
      AND token_address = ${input.tokenAddress}
      AND holder_address = ${holderAddress}
    FOR UPDATE
  `);
  const current = rows<{ balance: string }>(currentResult)[0];
  const nextBalance = BigInt(current?.balance ?? '0') + input.delta;
  if (nextBalance < 0n) {
    throw new Error(
      `holder balance integrity violation for ${input.tokenAddress}:${holderAddress}; projected balance would be negative`,
    );
  }

  await db.execute(sql`
    INSERT INTO holder_snapshots (
      chain_id, token_address, holder_address, balance, is_protocol_address,
      as_of_block_number, last_transaction_hash, last_log_index, updated_at
    ) VALUES (
      ${input.chainId}, ${input.tokenAddress}, ${holderAddress}, ${nextBalance.toString(10)},
      ${input.isProtocolAddress}, ${input.blockNumber.toString(10)},
      ${input.transactionHash.toLowerCase()}, ${input.logIndex}, now()
    )
    ON CONFLICT (chain_id, token_address, holder_address)
    DO UPDATE SET
      balance = EXCLUDED.balance,
      is_protocol_address = holder_snapshots.is_protocol_address OR EXCLUDED.is_protocol_address,
      as_of_block_number = EXCLUDED.as_of_block_number,
      last_transaction_hash = EXCLUDED.last_transaction_hash,
      last_log_index = EXCLUDED.last_log_index,
      updated_at = now()
  `);
}

async function refreshHolderCount(db: BreadDb, chainId: number, tokenAddress: string): Promise<void> {
  const countResult = await db.execute(sql`
    SELECT count(*)::text AS count
    FROM holder_snapshots
    WHERE chain_id = ${chainId}
      AND token_address = ${tokenAddress}
      AND balance > 0
  `);
  const holderCount = rows<{ count: string }>(countResult)[0]?.count ?? '0';
  await db.execute(sql`
    INSERT INTO token_metrics (chain_id, token_address, holder_count)
    VALUES (${chainId}, ${tokenAddress}, ${holderCount})
    ON CONFLICT (chain_id, token_address)
    DO UPDATE SET holder_count = EXCLUDED.holder_count, updated_at = now()
  `);
}

export async function applyHolderTransferProjection(
  db: BreadDb,
  event: DecodedBreadEvent,
  context: HolderProjectionContext,
): Promise<void> {
  if (event.eventName !== 'Transfer') return;
  if (event.contractRole !== 'LAUNCH_TOKEN') {
    throw new Error(`holder integrity: Transfer from unexpected contract role ${event.contractRole}`);
  }
  if (event.identity.chainId !== context.chainId) {
    throw new Error('holder integrity: event chain does not match projection context');
  }

  const tokenAddress = event.contractAddress.toLowerCase();
  const protocolAddresses = await resolveProtocolAddresses(db, tokenAddress, context);
  const from = event.payload.from.toLowerCase();
  const to = event.payload.to.toLowerCase();

  await adjustBalance(db, {
    chainId: context.chainId,
    tokenAddress,
    holderAddress: from,
    delta: -event.payload.value,
    isProtocolAddress: protocolAddresses.has(from),
    blockNumber: event.blockNumber,
    transactionHash: event.identity.transactionHash,
    logIndex: event.identity.logIndex,
  });
  await adjustBalance(db, {
    chainId: context.chainId,
    tokenAddress,
    holderAddress: to,
    delta: event.payload.value,
    isProtocolAddress: protocolAddresses.has(to),
    blockNumber: event.blockNumber,
    transactionHash: event.identity.transactionHash,
    logIndex: event.identity.logIndex,
  });
  await refreshHolderCount(db, context.chainId, tokenAddress);
}
