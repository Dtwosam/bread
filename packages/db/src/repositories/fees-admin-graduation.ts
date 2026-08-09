import { sql } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import type { CanonicalIndexedEvent, IndexerProtocolContext } from './indexer.js';

type Row = Record<string, unknown>;

const ADMIN_EVENT_NAMES = new Set([
  'GuardianUpdated',
  'RestrictionModeUpdated',
  'TradePauseUpdated',
  'GraduationPauseUpdated',
  'FeePolicyUpdated',
  'FeeSweepOperatorUpdated',
  'AuthorizedCreditorUpdated',
  'LaunchDeployerSet',
  'GraduationCoordinatorSet',
  'LaunchConfigUpdated',
  'CoordinatorSet',
  'GraduationRescued',
  'OwnershipTransferred',
]);

function resultRows(result: unknown): Row[] {
  const candidate = result as { rows?: Row[] };
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

function address(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${label} is not an address`);
  return value.toLowerCase();
}

function optionalAddress(value: unknown): string | null {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null;
}

function uint(value: unknown, label: string): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`${label} is not an exact unsigned integer`);
}

function decimal(value: bigint): string {
  return value.toString(10);
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString(10);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

async function tokenForCurve(db: BreadDb, chainId: number, curve: string): Promise<Row | undefined> {
  return resultRows(await db.execute(sql`
    SELECT token_address, creator_fee_recipient
    FROM launches
    WHERE chain_id = ${chainId} AND curve_address = ${curve.toLowerCase()}
    LIMIT 2
  `))[0];
}

async function contextualToken(
  db: BreadDb,
  event: CanonicalIndexedEvent,
  context: IndexerProtocolContext,
  creditor: string,
  recipient: string,
  amount: bigint,
): Promise<Readonly<{ tokenAddress: string | null; status: string }>> {
  const curveLaunch = await tokenForCurve(db, event.identity.chainId, creditor);
  if (curveLaunch && typeof curveLaunch.token_address === 'string') {
    return { tokenAddress: curveLaunch.token_address.toLowerCase(), status: 'EXACT_CURVE' };
  }

  const candidateNames =
    creditor === context.factoryAddress.toLowerCase()
      ? ['LaunchFeeCredited']
      : creditor === context.addresses.coordinator?.toLowerCase()
        ? ['GraduationUsdcDustCredited']
        : [];
  if (candidateNames.length === 0) return { tokenAddress: null, status: 'UNAVAILABLE' };

  const rows = resultRows(await db.execute(sql`
    SELECT token_address, payload
    FROM event_journal
    WHERE chain_id = ${event.identity.chainId}
      AND transaction_hash = ${event.identity.transactionHash.toLowerCase()}
      AND log_index < ${event.identity.logIndex}
      AND event_name IN (${sql.join(candidateNames.map((name) => sql`${name}`), sql`, `)})
    ORDER BY log_index DESC
  `));
  const matching = rows.filter((row) => {
    const payload = row.payload as Record<string, unknown> | undefined;
    if (!payload) return false;
    const payloadRecipient = optionalAddress(payload.recipient ?? payload.protocolRecipient);
    const payloadAmount = payload.amount;
    try {
      return payloadRecipient === recipient && uint(payloadAmount, 'fee context amount') === amount;
    } catch {
      return false;
    }
  });
  if (matching.length !== 1 || typeof matching[0]?.token_address !== 'string') {
    return { tokenAddress: null, status: matching.length > 1 ? 'AMBIGUOUS' : 'UNAVAILABLE' };
  }
  return {
    tokenAddress: matching[0].token_address.toLowerCase(),
    status: creditor === context.factoryAddress.toLowerCase() ? 'EXACT_FACTORY_CONTEXT' : 'EXACT_GRADUATION_CONTEXT',
  };
}

async function recordAdminEvent(db: BreadDb, event: CanonicalIndexedEvent): Promise<void> {
  if (!ADMIN_EVENT_NAMES.has(event.eventName)) return;
  const actor = optionalAddress(event.payload.actor);
  const payloadJson = JSON.stringify(jsonSafe(event.payload));
  await db.execute(sql`
    INSERT INTO admin_events (
      chain_id, transaction_hash, log_index, contract_address, event_name,
      actor_address, payload, block_number, stack_version
    ) VALUES (
      ${event.identity.chainId}, ${event.identity.transactionHash.toLowerCase()}, ${event.identity.logIndex},
      ${event.contractAddress.toLowerCase()}, ${event.eventName}, ${actor}, ${payloadJson}::jsonb,
      ${decimal(event.blockNumber)}, ${event.stackVersion}
    )
    ON CONFLICT (chain_id, transaction_hash, log_index) DO NOTHING
  `);
}

async function projectFeeEvent(db: BreadDb, event: CanonicalIndexedEvent, context: IndexerProtocolContext): Promise<void> {
  if (event.eventName === 'FeeCredited') {
    if (event.contractRole !== 'FEE_ESCROW' || event.contractAddress.toLowerCase() !== context.addresses.feeEscrow?.toLowerCase()) {
      throw new Error('FeeCredited authority is not the resolved FeeEscrow');
    }
    const creditor = address(event.payload.creditor, 'FeeCredited.creditor');
    const recipient = address(event.payload.recipient, 'FeeCredited.recipient');
    const amount = uint(event.payload.amount, 'FeeCredited.amount');
    const recipientBalance = uint(event.payload.recipientBalance, 'FeeCredited.recipientBalance');
    const totalOutstanding = uint(event.payload.totalOutstanding, 'FeeCredited.totalOutstanding');
    const attribution = await contextualToken(db, event, context, creditor, recipient, amount);

    await db.execute(sql`
      INSERT INTO fee_credits (
        chain_id, transaction_hash, log_index, recipient_address, creditor_address,
        amount, recipient_balance, total_outstanding, block_number, stack_version,
        token_address, attribution_status
      ) VALUES (
        ${event.identity.chainId}, ${event.identity.transactionHash.toLowerCase()}, ${event.identity.logIndex},
        ${recipient}, ${creditor}, ${decimal(amount)}, ${decimal(recipientBalance)}, ${decimal(totalOutstanding)},
        ${decimal(event.blockNumber)}, ${event.stackVersion}, ${attribution.tokenAddress}, ${attribution.status}
      )
      ON CONFLICT (chain_id, transaction_hash, log_index) DO NOTHING
    `);

    if (attribution.tokenAddress) {
      const launch = resultRows(await db.execute(sql`
        SELECT creator_fee_recipient
        FROM launches
        WHERE chain_id = ${event.identity.chainId} AND token_address = ${attribution.tokenAddress}
        LIMIT 1
      `))[0];
      if (optionalAddress(launch?.creator_fee_recipient) === recipient) {
        await db.execute(sql`
          INSERT INTO creator_rollups (
            chain_id, creator_address, token_address, accrued_fees, claimed_fees, trade_count,
            latest_block_number, updated_at
          ) VALUES (
            ${event.identity.chainId}, ${recipient}, ${attribution.tokenAddress}, ${decimal(amount)}, '0', '0',
            ${decimal(event.blockNumber)}, now()
          )
          ON CONFLICT (chain_id, creator_address, token_address) DO UPDATE SET
            accrued_fees = creator_rollups.accrued_fees + EXCLUDED.accrued_fees,
            latest_block_number = EXCLUDED.latest_block_number,
            updated_at = EXCLUDED.updated_at
        `);
      }
    }
    return;
  }

  if (event.eventName === 'FeeClaimed') {
    if (event.contractRole !== 'FEE_ESCROW' || event.contractAddress.toLowerCase() !== context.addresses.feeEscrow?.toLowerCase()) {
      throw new Error('FeeClaimed authority is not the resolved FeeEscrow');
    }
    const recipient = address(event.payload.recipient, 'FeeClaimed.recipient');
    const amount = uint(event.payload.amount, 'FeeClaimed.amount');
    const remainingBalance = uint(event.payload.remainingBalance, 'FeeClaimed.remainingBalance');
    const totalOutstanding = uint(event.payload.totalOutstanding, 'FeeClaimed.totalOutstanding');
    await db.execute(sql`
      INSERT INTO fee_claims (
        chain_id, transaction_hash, log_index, recipient_address, amount,
        remaining_balance, total_outstanding, block_number, stack_version
      ) VALUES (
        ${event.identity.chainId}, ${event.identity.transactionHash.toLowerCase()}, ${event.identity.logIndex},
        ${recipient}, ${decimal(amount)}, ${decimal(remainingBalance)}, ${decimal(totalOutstanding)},
        ${decimal(event.blockNumber)}, ${event.stackVersion}
      )
      ON CONFLICT (chain_id, transaction_hash, log_index) DO NOTHING
    `);
  }
}

async function tokenFromCurveEvent(db: BreadDb, event: CanonicalIndexedEvent): Promise<string> {
  const launch = await tokenForCurve(db, event.identity.chainId, event.contractAddress);
  if (!launch || typeof launch.token_address !== 'string') throw new Error(`curve event has no indexed launch: ${event.contractAddress}`);
  return launch.token_address.toLowerCase();
}

async function updateGraduationMetrics(db: BreadDb, chainId: number, token: string, state: string, ready?: boolean): Promise<void> {
  await db.execute(sql`
    INSERT INTO token_metrics (chain_id, token_address, graduation_progress_bps, graduation_state, updated_at)
    VALUES (${chainId}, ${token}, ${ready === true ? '10000' : null}, ${state}, now())
    ON CONFLICT (chain_id, token_address) DO UPDATE SET
      graduation_progress_bps = COALESCE(EXCLUDED.graduation_progress_bps, token_metrics.graduation_progress_bps),
      graduation_state = EXCLUDED.graduation_state,
      updated_at = EXCLUDED.updated_at
  `);
}

async function projectGraduationEvent(db: BreadDb, event: CanonicalIndexedEvent): Promise<void> {
  if (event.eventName === 'GraduationReady') {
    const token = address(event.payload.token, 'GraduationReady.token');
    await db.execute(sql`
      INSERT INTO launch_state (chain_id, token_address, ready_to_graduate, graduation_phase, updated_at)
      VALUES (${event.identity.chainId}, ${token}, true, 'NOT_GRADUATED', now())
      ON CONFLICT (chain_id, token_address) DO UPDATE SET
        ready_to_graduate = true,
        graduation_phase = COALESCE(launch_state.graduation_phase, 'NOT_GRADUATED'),
        updated_at = EXCLUDED.updated_at
    `);
    await updateGraduationMetrics(db, event.identity.chainId, token, 'READY', true);
    return;
  }

  if (event.eventName === 'GraduationAutoAttemptFailed') {
    const token = address(event.payload.token, 'GraduationAutoAttemptFailed.token');
    const reasonHash = String(event.payload.reasonHash).toLowerCase();
    await db.execute(sql`
      INSERT INTO launch_state (chain_id, token_address, graduation_failure_reason_hash, updated_at)
      VALUES (${event.identity.chainId}, ${token}, ${reasonHash}, now())
      ON CONFLICT (chain_id, token_address) DO UPDATE SET
        graduation_failure_reason_hash = EXCLUDED.graduation_failure_reason_hash,
        updated_at = EXCLUDED.updated_at
    `);
    return;
  }

  if (event.eventName === 'CurveGraduationReleased') {
    const token = await tokenFromCurveEvent(db, event);
    const seedUsdc = uint(event.payload.seedUsdc, 'CurveGraduationReleased.seedUsdc');
    const tokenOut = uint(event.payload.tokenOut, 'CurveGraduationReleased.tokenOut');
    await db.execute(sql`
      INSERT INTO launch_state (
        chain_id, token_address, graduation_release_seed_usdc, graduation_release_token_out, updated_at
      ) VALUES (${event.identity.chainId}, ${token}, ${decimal(seedUsdc)}, ${decimal(tokenOut)}, now())
      ON CONFLICT (chain_id, token_address) DO UPDATE SET
        graduation_release_seed_usdc = EXCLUDED.graduation_release_seed_usdc,
        graduation_release_token_out = EXCLUDED.graduation_release_token_out,
        updated_at = EXCLUDED.updated_at
    `);
    return;
  }

  if (event.eventName === 'GraduationSwept') {
    const token = address(event.payload.token, 'GraduationSwept.token');
    const adapter = address(event.payload.adapter, 'GraduationSwept.adapter');
    await db.execute(sql`
      INSERT INTO launch_state (
        chain_id, token_address, graduation_phase, graduation_adapter,
        swept_usdc_amount, swept_token_amount, swept_at, ready_to_graduate, updated_at
      ) VALUES (
        ${event.identity.chainId}, ${token}, 'SWEPT', ${adapter},
        ${decimal(uint(event.payload.usdcAmount, 'GraduationSwept.usdcAmount'))},
        ${decimal(uint(event.payload.tokenAmount, 'GraduationSwept.tokenAmount'))},
        ${decimal(uint(event.payload.sweptAt, 'GraduationSwept.sweptAt'))}, false, now()
      )
      ON CONFLICT (chain_id, token_address) DO UPDATE SET
        graduation_phase = EXCLUDED.graduation_phase,
        graduation_adapter = EXCLUDED.graduation_adapter,
        swept_usdc_amount = EXCLUDED.swept_usdc_amount,
        swept_token_amount = EXCLUDED.swept_token_amount,
        swept_at = EXCLUDED.swept_at,
        ready_to_graduate = false,
        updated_at = EXCLUDED.updated_at
    `);
    await updateGraduationMetrics(db, event.identity.chainId, token, 'SWEPT');
    return;
  }

  if (event.eventName === 'GraduationCompleted') {
    const token = address(event.payload.token, 'GraduationCompleted.token');
    await db.execute(sql`
      INSERT INTO launch_state (
        chain_id, token_address, graduation_phase, graduation_adapter, pool_id,
        position_manager, position_id, usdc_used, token_used, token_locked, usdc_dust,
        graduation_completed_block, graduation_completed_log_index, updated_at
      ) VALUES (
        ${event.identity.chainId}, ${token}, 'POOL_CREATED', ${address(event.payload.adapter, 'GraduationCompleted.adapter')},
        ${String(event.payload.poolId).toLowerCase()}, ${address(event.payload.positionManager, 'GraduationCompleted.positionManager')},
        ${decimal(uint(event.payload.positionId, 'GraduationCompleted.positionId'))},
        ${decimal(uint(event.payload.usdcUsed, 'GraduationCompleted.usdcUsed'))},
        ${decimal(uint(event.payload.tokenUsed, 'GraduationCompleted.tokenUsed'))},
        ${decimal(uint(event.payload.tokenLocked, 'GraduationCompleted.tokenLocked'))},
        ${decimal(uint(event.payload.usdcDust, 'GraduationCompleted.usdcDust'))},
        ${decimal(event.blockNumber)}, ${event.identity.logIndex}, now()
      )
      ON CONFLICT (chain_id, token_address) DO UPDATE SET
        graduation_phase = EXCLUDED.graduation_phase,
        graduation_adapter = EXCLUDED.graduation_adapter,
        pool_id = EXCLUDED.pool_id,
        position_manager = EXCLUDED.position_manager,
        position_id = EXCLUDED.position_id,
        usdc_used = EXCLUDED.usdc_used,
        token_used = EXCLUDED.token_used,
        token_locked = EXCLUDED.token_locked,
        usdc_dust = EXCLUDED.usdc_dust,
        graduation_completed_block = EXCLUDED.graduation_completed_block,
        graduation_completed_log_index = EXCLUDED.graduation_completed_log_index,
        updated_at = EXCLUDED.updated_at
    `);
    await updateGraduationMetrics(db, event.identity.chainId, token, 'POOL_CREATED');
    return;
  }

  if (event.eventName === 'GraduationRescued') {
    const token = address(event.payload.token, 'GraduationRescued.token');
    await db.execute(sql`
      INSERT INTO launch_state (
        chain_id, token_address, graduation_phase, rescue_recipient, rescue_usdc_amount, rescue_token_amount, updated_at
      ) VALUES (
        ${event.identity.chainId}, ${token}, 'RESCUED', ${address(event.payload.recipient, 'GraduationRescued.recipient')},
        ${decimal(uint(event.payload.usdcAmount, 'GraduationRescued.usdcAmount'))},
        ${decimal(uint(event.payload.tokenAmount, 'GraduationRescued.tokenAmount'))}, now()
      )
      ON CONFLICT (chain_id, token_address) DO UPDATE SET
        graduation_phase = EXCLUDED.graduation_phase,
        rescue_recipient = EXCLUDED.rescue_recipient,
        rescue_usdc_amount = EXCLUDED.rescue_usdc_amount,
        rescue_token_amount = EXCLUDED.rescue_token_amount,
        updated_at = EXCLUDED.updated_at
    `);
    await updateGraduationMetrics(db, event.identity.chainId, token, 'RESCUED');
    return;
  }

  if (event.eventName === 'PositionLocked') {
    const token = address(event.payload.token, 'PositionLocked.token');
    await db.execute(sql`
      INSERT INTO launch_state (chain_id, token_address, position_locked, position_manager, position_id, updated_at)
      VALUES (
        ${event.identity.chainId}, ${token}, true,
        ${address(event.payload.positionManager, 'PositionLocked.positionManager')},
        ${decimal(uint(event.payload.positionId, 'PositionLocked.positionId'))}, now()
      )
      ON CONFLICT (chain_id, token_address) DO UPDATE SET
        position_locked = true,
        position_manager = EXCLUDED.position_manager,
        position_id = EXCLUDED.position_id,
        updated_at = EXCLUDED.updated_at
    `);
    return;
  }

  if (event.eventName === 'TokenSupplyLocked') {
    const token = address(event.payload.token, 'TokenSupplyLocked.token');
    await db.execute(sql`
      INSERT INTO launch_state (chain_id, token_address, token_supply_locked, updated_at)
      VALUES (${event.identity.chainId}, ${token}, ${decimal(uint(event.payload.totalLocked, 'TokenSupplyLocked.totalLocked'))}, now())
      ON CONFLICT (chain_id, token_address) DO UPDATE SET
        token_supply_locked = EXCLUDED.token_supply_locked,
        updated_at = EXCLUDED.updated_at
    `);
  }
}

export async function applyFeeAdminGraduationProjection(
  db: BreadDb,
  event: CanonicalIndexedEvent,
  context: IndexerProtocolContext,
): Promise<void> {
  await projectFeeEvent(db, event, context);
  await projectGraduationEvent(db, event);
  await recordAdminEvent(db, event);
}
