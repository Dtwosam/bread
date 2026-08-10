import type { BreadCanonicalEventName, BreadContractRole, EventDisposition, Hex } from '../../types/src/index.js';
import { decodeEventLog } from 'viem';

import { breadAbiRegistry } from './abi/generated.js';

type BreadAbiRegistry = typeof breadAbiRegistry;

export type BreadStackAbiBinding = Readonly<{
  stackVersion: string;
  registry: BreadAbiRegistry;
}>;

/**
 * Explicitly binds the current generated ABI registry to one already-verified
 * protocol stack identity. The SDK intentionally has no default/latest-stack
 * fallback: callers must carry this binding alongside the stack they decode.
 */
export function createBreadStackAbiBinding(stackVersion: string): BreadStackAbiBinding {
  if (stackVersion.trim().length === 0) throw new Error('stackVersion is required');
  return Object.freeze({ stackVersion, registry: breadAbiRegistry });
}

const canonicalEvents: Readonly<Record<BreadContractRole, ReadonlySet<string>>> = {
  FACTORY: new Set([
    'LaunchDeployerSet',
    'GraduationCoordinatorSet',
    'LaunchConfigUpdated',
    'LaunchFeeCredited',
    'LaunchCreated',
    'LaunchAndBuyExecuted',
  ]),
  CURVE: new Set([
    'CreatorFeeRecipientUpdated',
    'CurveBuy',
    'CurveBuyRefunded',
    'OpeningProtectionApplied',
    'CurveSell',
    'FeesSwept',
    'GraduationReady',
    'GraduationAutoAttemptFailed',
    'CurveGraduationReleased',
  ]),
  FEE_ESCROW: new Set(['FeeCredited', 'FeeClaimed', 'CreditorUpdated']),
  FEE_POLICY: new Set(['FeePolicyUpdated', 'FeeSweepOperatorUpdated']),
  EMERGENCY_CONTROLLER: new Set([
    'GuardianUpdated',
    'RestrictionModeUpdated',
    'GraduationPauseUpdated',
  ]),
  GRADUATION_COORDINATOR: new Set([
    'GraduationSwept',
    'GraduationPoolCreated',
    'GraduationRescued',
  ]),
  PERMANENT_LOCKER: new Set(['PositionPermanentlyLocked', 'TokenSupplyPermanentlyLocked']),
  LAUNCH_TOKEN: new Set(['Transfer', 'Approval']),
};

export function isCanonicalBreadEventName(
  role: BreadContractRole,
  eventName: string,
): eventName is BreadCanonicalEventName {
  return canonicalEvents[role].has(eventName);
}

function eventDisposition(
  role: BreadContractRole,
  eventName: string,
): EventDisposition {
  return isCanonicalBreadEventName(role, eventName) ? 'INDEXED_CANONICAL' : 'IGNORED_UNREGISTERED';
}

export type DecodedBreadLog = Readonly<{
  stackVersion: string;
  role: BreadContractRole;
  eventName: string;
  args: Readonly<Record<string, unknown>>;
  disposition: EventDisposition;
}>;

export function decodeBreadLog(input: Readonly<{
  binding: BreadStackAbiBinding;
  stackVersion: string;
  role: BreadContractRole;
  topics: readonly Hex[];
  data: Hex;
}>): DecodedBreadLog {
  if (input.binding.stackVersion !== input.stackVersion) {
    throw new Error(
      `ABI stackVersion mismatch: binding=${input.binding.stackVersion} event=${input.stackVersion}`,
    );
  }

  const abi = input.binding.registry[input.role === 'FACTORY'
    ? 'factory'
    : input.role === 'CURVE'
      ? 'curve'
      : input.role === 'FEE_ESCROW'
        ? 'feeEscrow'
        : input.role === 'FEE_POLICY'
          ? 'feePolicy'
          : input.role === 'EMERGENCY_CONTROLLER'
            ? 'emergencyController'
            : input.role === 'GRADUATION_COORDINATOR'
              ? 'coordinator'
              : input.role === 'PERMANENT_LOCKER'
                ? 'locker'
                : 'launchToken'];

  const decoded = decodeEventLog({
    abi,
    data: input.data,
    topics: input.topics as [Hex, ...Hex[]],
    strict: true,
  });
  const eventName = decoded.eventName;
  const args = decoded.args && typeof decoded.args === 'object'
    ? decoded.args as Readonly<Record<string, unknown>>
    : {};

  return {
    stackVersion: input.stackVersion,
    role: input.role,
    eventName,
    args,
    disposition: eventDisposition(input.role, eventName),
  };
}

export function classifyBreadLog(
  role: BreadContractRole,
  eventName: string,
): EventDisposition {
  return eventDisposition(role, eventName);
}
