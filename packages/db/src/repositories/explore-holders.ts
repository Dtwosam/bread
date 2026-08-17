export type ExploreHolderBounds = Readonly<{
  min?: string;
  max?: string;
}>;

function exactNonNegativeInteger(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{1,78}$/.test(value)) throw new Error(`${label} is invalid`);
  return BigInt(value).toString(10);
}

export function parseExploreHolderBounds(
  minValue: string | undefined,
  maxValue: string | undefined,
): ExploreHolderBounds | undefined {
  const min = exactNonNegativeInteger(minValue, 'holdersMin');
  const max = exactNonNegativeInteger(maxValue, 'holdersMax');
  if (min === undefined && max === undefined) return undefined;
  if (min !== undefined && max !== undefined && BigInt(min) > BigInt(max)) {
    throw new Error('holder range is inverted');
  }
  return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
}
