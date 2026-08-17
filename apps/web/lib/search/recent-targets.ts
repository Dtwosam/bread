export const MAX_RECENT_SEARCH_TARGETS = 8;
const RECENT_SEARCH_STORAGE_KEY = 'bread.recent-search-targets.v1';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type RecentSearchTarget = Readonly<{
  tokenAddress: string;
  name: string | null;
  symbol: string | null;
  deployerAddress: string | null;
}>;

function canonicalAddress(value: string): string | null {
  return ADDRESS.test(value) ? value.toLowerCase() : null;
}

function sanitizeTarget(value: unknown): RecentSearchTarget | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const tokenAddress = typeof candidate.tokenAddress === 'string' ? canonicalAddress(candidate.tokenAddress) : null;
  if (tokenAddress === null) return null;
  const deployerAddress = typeof candidate.deployerAddress === 'string'
    ? canonicalAddress(candidate.deployerAddress)
    : null;
  return {
    tokenAddress,
    name: typeof candidate.name === 'string' ? candidate.name : null,
    symbol: typeof candidate.symbol === 'string' ? candidate.symbol : null,
    deployerAddress,
  };
}

export function addRecentSearchTarget(
  targets: readonly RecentSearchTarget[],
  target: RecentSearchTarget,
): RecentSearchTarget[] {
  const canonical = sanitizeTarget(target);
  if (canonical === null) return [...targets].slice(0, MAX_RECENT_SEARCH_TARGETS);
  return [
    canonical,
    ...targets.filter((item) => item.tokenAddress.toLowerCase() !== canonical.tokenAddress),
  ].slice(0, MAX_RECENT_SEARCH_TARGETS);
}

export function removeRecentSearchTarget(
  targets: readonly RecentSearchTarget[],
  tokenAddress: string,
): RecentSearchTarget[] {
  const canonical = canonicalAddress(tokenAddress);
  if (canonical === null) return [...targets];
  return targets.filter((target) => target.tokenAddress.toLowerCase() !== canonical);
}

export function clearRecentSearchTargets(): RecentSearchTarget[] {
  return [];
}

export function readRecentSearchTargets(): RecentSearchTarget[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const result: RecentSearchTarget[] = [];
    for (const item of parsed) {
      const target = sanitizeTarget(item);
      if (target === null || result.some((existing) => existing.tokenAddress === target.tokenAddress)) continue;
      result.push(target);
      if (result.length === MAX_RECENT_SEARCH_TARGETS) break;
    }
    return result;
  } catch {
    return [];
  }
}

export function writeRecentSearchTargets(targets: readonly RecentSearchTarget[]): void {
  if (typeof window === 'undefined') return;
  const sanitized: RecentSearchTarget[] = [];
  for (const item of targets) {
    const target = sanitizeTarget(item);
    if (target === null || sanitized.some((existing) => existing.tokenAddress === target.tokenAddress)) continue;
    sanitized.push(target);
    if (sanitized.length === MAX_RECENT_SEARCH_TARGETS) break;
  }
  try {
    window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Recent Search is optional browser-local convenience. Storage failure must not affect Search.
  }
}
