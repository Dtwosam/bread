export function classifyArcDirectSmokeStep({
  launchExists,
  allowance,
  quoteIn,
  permanentlyLocked,
  readyToGraduate,
  graduated,
  creatorCredit,
  creatorClaimObserved,
}) {
  if (typeof allowance !== 'bigint' || allowance < 0n) {
    throw new Error('allowance must be a non-negative bigint');
  }
  if (typeof quoteIn !== 'bigint' || quoteIn <= 0n) {
    throw new Error('quoteIn must be a positive bigint');
  }
  if (typeof creatorCredit !== 'bigint' || creatorCredit < 0n) {
    throw new Error('creatorCredit must be a non-negative bigint');
  }
  if (creatorClaimObserved !== undefined && typeof creatorClaimObserved !== 'boolean') {
    throw new Error('creatorClaimObserved must be boolean when supplied');
  }

  if (!launchExists) {
    return allowance >= quoteIn ? 'LAUNCH' : 'APPROVE';
  }

  if (permanentlyLocked) {
    if (creatorCredit > 0n) return 'CLAIM';
    if (creatorClaimObserved === false) {
      throw new Error('creator claim evidence is required before replay verification');
    }
    // Compatibility for the first direct-RPC recovery runner, which predates the
    // explicit creatorClaimObserved argument. Its terminal result is accepted only
    // through the separate read-only final verifier, which requires FeeClaimed.
    return 'VERIFY_REPLAY';
  }

  if (readyToGraduate) return 'SWEEP';
  if (graduated) return 'CREATE_POOL';

  throw new Error('inconsistent existing launch state: not locked, not ready to graduate, and not graduated');
}
