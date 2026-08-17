export type ExploreMarketCapBounds = Readonly<{
  minQuote?: string;
  maxQuote?: string;
}>;

function parseNonNegativeInteger(value: string | undefined, label: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a non-negative integer`);
  return BigInt(value).toString(10);
}

export function parseExploreMarketCapBounds(
  minQuote: string | undefined,
  maxQuote: string | undefined,
): ExploreMarketCapBounds | undefined {
  const min = parseNonNegativeInteger(minQuote, 'market-cap minimum');
  const max = parseNonNegativeInteger(maxQuote, 'market-cap maximum');
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined && BigInt(min) > BigInt(max)) {
    throw new Error('market-cap minimum exceeds maximum');
  }
  return {
    ...(min === undefined ? {} : { minQuote: min }),
    ...(max === undefined ? {} : { maxQuote: max }),
  };
}
