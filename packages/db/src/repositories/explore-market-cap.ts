export type ExploreMarketCapBounds = Readonly<{
  minQuote?: string;
  maxQuote?: string;
}>;

function exactNonNegativeInteger(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{1,78}$/.test(value)) throw new Error(`${label} is invalid`);
  return BigInt(value).toString(10);
}

export function parseExploreMarketCapBounds(
  minValue: string | undefined,
  maxValue: string | undefined,
): ExploreMarketCapBounds | undefined {
  const minQuote = exactNonNegativeInteger(minValue, 'marketCapMinQuote');
  const maxQuote = exactNonNegativeInteger(maxValue, 'marketCapMaxQuote');
  if (minQuote === undefined && maxQuote === undefined) return undefined;
  if (minQuote !== undefined && maxQuote !== undefined && BigInt(minQuote) > BigInt(maxQuote)) {
    throw new Error('market-cap range is inverted');
  }
  return {
    ...(minQuote === undefined ? {} : { minQuote }),
    ...(maxQuote === undefined ? {} : { maxQuote }),
  };
}
