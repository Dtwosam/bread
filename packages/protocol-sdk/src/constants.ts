// BreadLaunchToken inherits OpenZeppelin ERC20 without overriding decimals().
// The drift test in tests/day7/token-decimals.test.ts keeps this consumer value tied to that contract source.
export const BREAD_LAUNCH_TOKEN_DECIMALS = 18 as const;
