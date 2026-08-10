import { formatUnits } from 'viem';

import type { IndexedPortfolioHolding } from '../../../../packages/types/src/index';

type IndexedCurrentValue = IndexedPortfolioHolding['currentValue'];

export function indexedCurrentValueBaseUnits(value: IndexedCurrentValue): bigint | null {
  if (value.status !== 'AVAILABLE') return null;
  const denominator = BigInt(value.denominator);
  if (denominator <= BigInt(0)) return null;
  return BigInt(value.numerator) / denominator;
}

export function formatIndexedCurrentValueUsdc(value: IndexedCurrentValue): string | null {
  const baseUnits = indexedCurrentValueBaseUnits(value);
  return baseUnits === null ? null : `${formatUnits(baseUnits, 6)} USDC`;
}

export function indexedWalletValueBaseUnits(
  holdings: readonly IndexedPortfolioHolding[],
): bigint | null {
  let total = BigInt(0);
  for (const holding of holdings) {
    const current = indexedCurrentValueBaseUnits(holding.currentValue);
    if (current === null) return null;
    total += current;
  }
  return total;
}
