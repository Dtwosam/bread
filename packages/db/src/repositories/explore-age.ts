export const EXPLORE_AGE_FILTERS = ['lt5m', 'lt1h', '1h-24h', '1d-7d'] as const;

export type ExploreAgeFilter = (typeof EXPLORE_AGE_FILTERS)[number];

export type ExploreAgeBounds = Readonly<{
  minLaunchTimestamp?: string;
  minInclusive: boolean;
  maxLaunchTimestamp: string;
  maxInclusive: boolean;
}>;

function exactUnsigned(value: string | number | bigint, label: string): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`${label} is not an exact unsigned integer`);
}

function subtractFloor(value: bigint, amount: bigint): bigint {
  return value > amount ? value - amount : 0n;
}

export function isExploreAgeFilter(value: unknown): value is ExploreAgeFilter {
  return typeof value === 'string' && (EXPLORE_AGE_FILTERS as readonly string[]).includes(value);
}

/**
 * Resolve Explore age presets against the committed indexed-head timestamp.
 * Ranges are non-overlapping at their named boundaries:
 * - <5m and <1h exclude exactly 5m/1h-old launches.
 * - 1–24h includes exactly 1h and excludes exactly 24h.
 * - 1–7d includes exactly 1d and 7d.
 */
export function resolveExploreAgeBounds(
  indexedHeadTimestamp: string | number | bigint,
  filter: ExploreAgeFilter,
): ExploreAgeBounds {
  const head = exactUnsigned(indexedHeadTimestamp, 'indexed head timestamp');
  if (filter === 'lt5m') {
    return {
      minLaunchTimestamp: subtractFloor(head, 300n).toString(10),
      minInclusive: false,
      maxLaunchTimestamp: head.toString(10),
      maxInclusive: true,
    };
  }
  if (filter === 'lt1h') {
    return {
      minLaunchTimestamp: subtractFloor(head, 3_600n).toString(10),
      minInclusive: false,
      maxLaunchTimestamp: head.toString(10),
      maxInclusive: true,
    };
  }
  if (filter === '1h-24h') {
    return {
      minLaunchTimestamp: subtractFloor(head, 86_400n).toString(10),
      minInclusive: false,
      maxLaunchTimestamp: subtractFloor(head, 3_600n).toString(10),
      maxInclusive: true,
    };
  }
  return {
    minLaunchTimestamp: subtractFloor(head, 604_800n).toString(10),
    minInclusive: true,
    maxLaunchTimestamp: subtractFloor(head, 86_400n).toString(10),
    maxInclusive: true,
  };
}
