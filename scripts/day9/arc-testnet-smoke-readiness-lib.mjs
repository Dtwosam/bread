import { DAY9_ARC_TESTNET_SMOKE } from './arc-testnet-deployment-preflight-lib.mjs';

const MINIMUM = BigInt(DAY9_ARC_TESTNET_SMOKE.minimumFunding);

export function assessArcTestnetSmokeFunding(currentUsdc) {
  const balance = BigInt(currentUsdc);
  if (balance < 0n) throw new Error('USDC balance cannot be negative');
  const missing = balance >= MINIMUM ? 0n : MINIMUM - balance;
  return {
    ready: missing === 0n,
    currentUsdc: balance.toString(),
    minimumUsdc: MINIMUM.toString(),
    missingUsdc: missing.toString(),
  };
}
