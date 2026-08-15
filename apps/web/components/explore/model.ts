import type {
  IndexedFeedItem,
  IndexedGraduationProgressSummary,
  IndexedPriceSummary,
} from '../../../../packages/types/src/index';
import { BreadApiRequestError } from '../../lib/api/client';

export type ExploreView = 'new' | 'trending' | 'graduating' | 'graduated';

export type IndexedFeedCardFields = Pick<
  IndexedFeedItem,
  'tokenAddress' | 'deployerAddress' | 'holderCount' | 'graduatedVenueKind' | 'name' | 'symbol' | 'metrics' | 'progress'
>;

export type SearchIntent =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'invalid-address' }>
  | Readonly<{ kind: 'search'; query: string }>;

export type TokenCardModel = Readonly<{
  tokenAddress: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  price: IndexedPriceSummary | null;
  volume24h: string | null;
  holderCount: string | null;
  graduatedVenueKind: string | null;
  priceChange24h: null;
  progress: Readonly<{
    bps: number;
    percent: number;
    state: string | null;
  }> | null;
}>;

const EXPLORE_VIEWS = new Set<ExploreView>(['new', 'trending', 'graduating', 'graduated']);
const EXACT_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function resolveExploreView(value: string | null | undefined): ExploreView {
  return EXPLORE_VIEWS.has(value as ExploreView) ? (value as ExploreView) : 'new';
}

export function searchIntent(rawValue: string): SearchIntent {
  const value = rawValue.trim();
  if (value.length === 0) return { kind: 'idle' };
  if (value.toLowerCase().startsWith('0x')) {
    if (!EXACT_ADDRESS.test(value)) return { kind: 'invalid-address' };
    return { kind: 'search', query: value.toLowerCase() };
  }
  if (value.length < 2) return { kind: 'idle' };
  return { kind: 'search', query: value };
}

export function feedErrorPresentation(error: unknown) {
  if (error instanceof BreadApiRequestError && error.code === 'FEED_VIEW_NOT_READY') {
    return {
      kind: 'not-ready' as const,
      title: 'This feed view is not ready yet',
      detail: 'Bread will not fabricate rankings while this indexed projection is unavailable.',
    };
  }
  return {
    kind: 'error' as const,
    title: 'Explore data is unavailable',
    detail: 'Try again when the indexed read service is available.',
  };
}

function progressModel(progress: IndexedGraduationProgressSummary | null) {
  if (!progress || progress.progressBps === null) return null;
  if (!/^\d+$/.test(progress.progressBps)) return null;
  const value = BigInt(progress.progressBps);
  if (value < BigInt(0) || value > BigInt(10_000)) return null;
  const bps = Number(value);
  return {
    bps,
    percent: bps / 100,
    state: progress.state,
  } as const;
}

export function toTokenCardModel(source: IndexedFeedCardFields): TokenCardModel {
  return {
    tokenAddress: source.tokenAddress,
    creatorAddress: source.deployerAddress,
    name: source.name?.trim() || 'Unnamed token',
    symbol: source.symbol?.trim() || '—',
    price: source.metrics?.lastPrice ?? null,
    volume24h: source.metrics?.quoteVolume.h24 ?? null,
    holderCount: source.holderCount,
    graduatedVenueKind: source.graduatedVenueKind,
    priceChange24h: null,
    progress: progressModel(source.progress),
  };
}

export function formatUsdcBaseUnits(value: string | null): string {
  if (value === null || !/^\d+$/.test(value)) return '—';
  const units = BigInt(value);
  const scale = BigInt(1_000_000);
  const whole = units / scale;
  const fraction = units % scale;
  if (fraction === BigInt(0)) return `${whole.toString(10)} USDC`;
  const fractionText = fraction.toString(10).padStart(6, '0').replace(/0+$/, '');
  return `${whole.toString(10)}.${fractionText} USDC`;
}

export function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}
