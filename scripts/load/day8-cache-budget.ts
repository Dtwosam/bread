export function sharedCacheTtlMs(cacheControl: string): number {
  const directives = cacheControl
    .split(',')
    .map((value) => value.trim().toLowerCase());

  for (const directive of directives) {
    const match = /^s-maxage=(\d+)$/.exec(directive);
    if (!match) continue;
    const seconds = Number(match[1]);
    if (Number.isSafeInteger(seconds) && seconds > 0) return seconds * 1_000;
  }

  throw new Error('shared cache policy must contain a positive s-maxage');
}

export function maxOriginFetchesForBurst(input: Readonly<{
  frontends: number;
  arrivalWindowMs: number;
  cacheTtlMs: number;
}>): number {
  const { frontends, arrivalWindowMs, cacheTtlMs } = input;
  if (!Number.isInteger(frontends) || frontends < 1) {
    throw new Error('frontends must be a positive integer');
  }
  if (!Number.isInteger(arrivalWindowMs) || arrivalWindowMs < 0) {
    throw new Error('arrivalWindowMs must be a non-negative integer');
  }
  if (!Number.isInteger(cacheTtlMs) || cacheTtlMs < 1) {
    throw new Error('cacheTtlMs must be a positive integer');
  }

  // A burst can touch the initial cold epoch plus every TTL boundary crossed
  // during its configured arrival window. The extra epoch keeps an exact
  // boundary from becoming timing-dependent while the budget remains O(edges),
  // never O(viewers).
  const epochsPerFrontend = Math.ceil(arrivalWindowMs / cacheTtlMs) + 1;
  return frontends * epochsPerFrontend;
}
