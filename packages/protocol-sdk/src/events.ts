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
    'OwnershipTransferred',
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
  FEE_ESCROW: new Set(['AuthorizedCreditorUpdated', 'FeeCredited', 'FeeClaimed', 'OwnershipTransferred']),
  FEE_POLICY: new Set(['FeePolicyUpdated', 'FeeSweepOperatorUpdated', 'OwnershipTransferred']),
  EMERGENCY_CONTROLLER: new Set([
    'GuardianUpdated',
    'RestrictionModeUpdated',
    'GraduationPauseUpdated',
    'OwnershipTransferred',
  ]),
  GRADUATION_COORDINATOR: new Set([
    'GraduationSwept',
    'GraduationCompleted',
    'GraduationRescued',
    'GraduationTokenResidueLocked',
    'GraduationUsdcDustCredited',
    'OwnershipTransferred',
  ]),
  LOCKER: new Set(['CoordinatorSet', 'PositionLocked', 'TokenSupplyLocked']),
  LAUNCH_TOKEN: new Set(['Transfer']),
};

const knownIgnoredEvents: Readonly<Record<BreadContractRole, ReadonlySet<string>>> = {
  FACTORY: new Set(),
  CURVE: new Set(),
  FEE_ESCROW: new Set(),
  FEE_POLICY: new Set(),
  EMERGENCY_CONTROLLER: new Set(),
  GRADUATION_COORDINATOR: new Set(),
  LOCKER: new Set(),
  LAUNCH_TOKEN: new Set(['Approval']),
};

const registryKeyByRole = {
  FACTORY: 'factory',
  CURVE: 'curve',
  FEE_ESCROW: 'feeEscrow',
  FEE_POLICY: 'feePolicy',
  EMERGENCY_CONTROLLER: 'emergencyController',
  GRADUATION_COORDINATOR: 'coordinator',
  LOCKER: 'locker',
  LAUNCH_TOKEN: 'launchToken',
} as const satisfies Record<BreadContractRole, keyof BreadAbiRegistry>;

export function classifyBreadLog(role: BreadContractRole, eventName: string): EventDisposition {
  if (canonicalEvents[role].has(eventName)) return 'INDEXED_CANONICAL';
  if (knownIgnoredEvents[role].has(eventName)) return 'KNOWN_IGNORED';
  return 'UNKNOWN';
}

export type DecodedBreadLog = Readonly<{
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
  if (input.stackVersion !== input.binding.stackVersion) {
    throw new Error(`unsupported stack version: ${input.stackVersion}`);
  }

  const abi = input.binding.registry[registryKeyByRole[input.role]];
  const decoded = decodeEventLog({
    abi,
    data: input.data,
    topics: input.topics as [Hex, ...Hex[]],
    strict: true,
  });
  const eventName = decoded.eventName;
  const args = (decoded.args ?? {}) as unknown as Readonly<Record<string, unknown>>;
  return {
    eventName,
    args,
    disposition: classifyBreadLog(input.role, eventName),
  };
}

export function isCanonicalBreadEventName(eventName: string): eventName is BreadCanonicalEventName {
  return Object.values(canonicalEvents).some((events) => events.has(eventName));
}
