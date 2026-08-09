import type { Address, CanonicalLogIdentity, Hex, Hex32 } from './identity.js';

export type BreadContractRole =
  | 'FACTORY'
  | 'CURVE'
  | 'FEE_ESCROW'
  | 'FEE_POLICY'
  | 'EMERGENCY_CONTROLLER'
  | 'GRADUATION_COORDINATOR'
  | 'LOCKER'
  | 'LAUNCH_TOKEN';

export type EventDisposition = 'INDEXED_CANONICAL' | 'KNOWN_IGNORED' | 'UNKNOWN';

export type BreadCanonicalEventName =
  | 'LaunchDeployerSet'
  | 'GraduationCoordinatorSet'
  | 'LaunchConfigUpdated'
  | 'LaunchFeeCredited'
  | 'LaunchCreated'
  | 'LaunchAndBuyExecuted'
  | 'CreatorFeeRecipientUpdated'
  | 'CurveBuy'
  | 'CurveBuyRefunded'
  | 'OpeningProtectionApplied'
  | 'CurveSell'
  | 'FeesSwept'
  | 'GraduationReady'
  | 'GraduationAutoAttemptFailed'
  | 'CurveGraduationReleased'
  | 'AuthorizedCreditorUpdated'
  | 'FeeCredited'
  | 'FeeClaimed'
  | 'FeePolicyUpdated'
  | 'FeeSweepOperatorUpdated'
  | 'GuardianUpdated'
  | 'RestrictionModeUpdated'
  | 'GraduationPauseUpdated'
  | 'GraduationSwept'
  | 'GraduationCompleted'
  | 'GraduationRescued'
  | 'GraduationTokenResidueLocked'
  | 'GraduationUsdcDustCredited'
  | 'CoordinatorSet'
  | 'PositionLocked'
  | 'TokenSupplyLocked'
  | 'Transfer'
  | 'OwnershipTransferred';

export type DecodedBreadEvent = Readonly<{
  identity: CanonicalLogIdentity;
  blockNumber: bigint;
  blockHash: Hex32;
  blockTimestamp: bigint;
  transactionIndex: number;
  contractAddress: Address;
  contractRole: BreadContractRole;
  stackVersion: string;
  eventName: BreadCanonicalEventName;
  payload: Readonly<Record<string, unknown>>;
  topic0: Hex32;
  topics: readonly Hex[];
  data: Hex;
}>;
