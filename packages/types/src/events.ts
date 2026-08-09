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

export type BreadFeePolicyEventSnapshot = Readonly<{
  protocolFeeRecipient: Address;
  tradeFeeBps: bigint;
  protocolFeeShareBps: bigint;
  maxCreatorTaxBps: bigint;
}>;

/**
 * Normalized canonical Bread event payloads. All Solidity integer widths are
 * represented as bigint internally so downstream accounting never mixes JS
 * number semantics with onchain integer values.
 */
export type BreadEventPayloadMap = Readonly<{
  LaunchDeployerSet: Readonly<{ launchDeployer: Address }>;
  GraduationCoordinatorSet: Readonly<{ graduationCoordinator: Address }>;
  LaunchConfigUpdated: Readonly<{ previousVersion: bigint; nextVersion: bigint }>;
  LaunchFeeCredited: Readonly<{ token: Address; protocolRecipient: Address; amount: bigint }>;
  LaunchCreated: Readonly<{
    deployer: Address;
    token: Address;
    curve: Address;
    creatorFeeRecipient: Address;
    creatorTaxBps: bigint;
    economicsDigest: Hex32;
    configVersion: bigint;
  }>;
  LaunchAndBuyExecuted: Readonly<{
    buyer: Address;
    token: Address;
    curve: Address;
    recipient: Address;
    quoteIn: bigint;
    spent: bigint;
    refund: bigint;
    tokensOut: bigint;
  }>;
  CreatorFeeRecipientUpdated: Readonly<{ previousRecipient: Address; nextRecipient: Address }>;
  CurveBuy: Readonly<{
    buyer: Address;
    recipient: Address;
    quoteIn: bigint;
    tokensOut: bigint;
    fee: bigint;
    tax: bigint;
  }>;
  CurveBuyRefunded: Readonly<{ buyer: Address; refund: bigint }>;
  OpeningProtectionApplied: Readonly<{
    buyer: Address;
    recipient: Address;
    taxBps: bigint;
    taxAmount: bigint;
    launchBuyExempt: boolean;
  }>;
  CurveSell: Readonly<{
    seller: Address;
    recipient: Address;
    tokensIn: bigint;
    quoteOut: bigint;
    fee: bigint;
    tax: bigint;
  }>;
  FeesSwept: Readonly<{ protocolAmount: bigint; creatorAmount: bigint; creatorTaxAmount: bigint }>;
  GraduationReady: Readonly<{ token: Address; curve: Address; coordinator: Address }>;
  GraduationAutoAttemptFailed: Readonly<{ token: Address; reasonHash: Hex32 }>;
  CurveGraduationReleased: Readonly<{
    coordinator: Address;
    seedUsdc: bigint;
    tokenOut: bigint;
    protocolFeeAmount: bigint;
    creatorFeeAmount: bigint;
  }>;
  AuthorizedCreditorUpdated: Readonly<{ creditor: Address; allowed: boolean }>;
  FeeCredited: Readonly<{
    creditor: Address;
    recipient: Address;
    amount: bigint;
    recipientBalance: bigint;
    totalOutstanding: bigint;
  }>;
  FeeClaimed: Readonly<{
    recipient: Address;
    amount: bigint;
    remainingBalance: bigint;
    totalOutstanding: bigint;
  }>;
  FeePolicyUpdated: Readonly<{
    previousPolicy: BreadFeePolicyEventSnapshot;
    nextPolicy: BreadFeePolicyEventSnapshot;
  }>;
  FeeSweepOperatorUpdated: Readonly<{ previousOperator: Address; nextOperator: Address }>;
  GuardianUpdated: Readonly<{ previousGuardian: Address; nextGuardian: Address }>;
  RestrictionModeUpdated: Readonly<{ actor: Address; previousMode: bigint; nextMode: bigint }>;
  GraduationPauseUpdated: Readonly<{ actor: Address; previousPaused: boolean; nextPaused: boolean }>;
  GraduationSwept: Readonly<{
    token: Address;
    adapter: Address;
    usdcAmount: bigint;
    tokenAmount: bigint;
    sweptAt: bigint;
  }>;
  GraduationCompleted: Readonly<{
    token: Address;
    adapter: Address;
    poolId: Hex32;
    positionManager: Address;
    positionId: bigint;
    usdcUsed: bigint;
    tokenUsed: bigint;
    tokenLocked: bigint;
    usdcDust: bigint;
  }>;
  GraduationRescued: Readonly<{
    token: Address;
    recipient: Address;
    usdcAmount: bigint;
    tokenAmount: bigint;
  }>;
  GraduationTokenResidueLocked: Readonly<{ token: Address; amount: bigint }>;
  GraduationUsdcDustCredited: Readonly<{ token: Address; recipient: Address; amount: bigint }>;
  CoordinatorSet: Readonly<{ coordinator: Address }>;
  PositionLocked: Readonly<{ token: Address; positionManager: Address; positionId: bigint }>;
  TokenSupplyLocked: Readonly<{ token: Address; amount: bigint; totalLocked: bigint }>;
  Transfer: Readonly<{ from: Address; to: Address; value: bigint }>;
  OwnershipTransferred: Readonly<{ previousOwner: Address; newOwner: Address }>;
}>;

export type BreadCanonicalEventName = keyof BreadEventPayloadMap;

type DecodedBreadEventBase = Readonly<{
  identity: CanonicalLogIdentity;
  blockNumber: bigint;
  blockHash: Hex32;
  blockTimestamp: bigint;
  transactionIndex: number;
  contractAddress: Address;
  contractRole: BreadContractRole;
  stackVersion: string;
  topic0: Hex32;
  topics: readonly Hex[];
  data: Hex;
}>;

export type DecodedBreadEvent = {
  [EventName in BreadCanonicalEventName]: Readonly<
    DecodedBreadEventBase & {
      eventName: EventName;
      payload: BreadEventPayloadMap[EventName];
    }
  >;
}[BreadCanonicalEventName];
