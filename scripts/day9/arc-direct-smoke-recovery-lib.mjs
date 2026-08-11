export function classifyArcDirectSmokeStep({
  launchExists,
  allowance,
  quoteIn,
  permanentlyLocked,
  readyToGraduate,
  graduated,
  creatorCredit,
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

  if (!launchExists) {
    return allowance >= quoteIn ? 'LAUNCH' : 'APPROVE';
  }

  if (permanentlyLocked) {
    return creatorCredit > 0n ? 'CLAIM' : 'VERIFY_REPLAY';
  }

  if (readyToGraduate) return 'SWEEP';
  if (graduated) return 'CREATE_POOL';

  throw new Error('inconsistent existing launch state: not locked, not ready to graduate, and not graduated');
}
