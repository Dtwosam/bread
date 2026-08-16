export type ExploreProgressBounds = Readonly<{
  minBps?: string;
  maxBps?: string;
}>;

function exactProgressBps(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{1,5}$/.test(value)) throw new Error(`${label} is invalid`);
  const parsed = BigInt(value);
  if (parsed > 10_000n) throw new Error(`${label} exceeds 10000 bps`);
  return parsed.toString(10);
}

export function parseExploreProgressBounds(
  minValue: string | undefined,
  maxValue: string | undefined,
): ExploreProgressBounds | undefined {
  const minBps = exactProgressBps(minValue, 'progressMinBps');
  const maxBps = exactProgressBps(maxValue, 'progressMaxBps');
  if (minBps === undefined && maxBps === undefined) return undefined;
  if (minBps !== undefined && maxBps !== undefined && BigInt(minBps) > BigInt(maxBps)) {
    throw new Error('progress range is inverted');
  }
  return {
    ...(minBps === undefined ? {} : { minBps }),
    ...(maxBps === undefined ? {} : { maxBps }),
  };
}
