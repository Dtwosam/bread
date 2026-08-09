import type { FreshnessMeta, FreshnessStatus } from '../../../packages/types/src/index';

export type FreshnessPresentation = Readonly<{
  tone: 'warning' | 'negative';
  title: string;
  detail: string;
}>;

export function freshnessPresentation(status: FreshnessStatus): FreshnessPresentation | null {
  switch (status) {
    case 'FRESH':
      return null;
    case 'LAGGING':
      return {
        tone: 'warning',
        title: 'Indexed data is delayed',
        detail: 'Bread is showing the latest committed indexed data while the indexer catches up.',
      };
    case 'REBUILDING':
      return {
        tone: 'warning',
        title: 'Indexed data is rebuilding',
        detail: 'Some indexed views may be incomplete until the rebuild reaches the current chain state.',
      };
    case 'DEGRADED':
      return {
        tone: 'negative',
        title: 'Indexed data is degraded',
        detail: 'Some indexed views may be unavailable. Bread will not substitute unverified primary RPC data.',
      };
  }
}

export function FreshnessBanner({ meta }: Readonly<{ meta: FreshnessMeta }>) {
  const presentation = freshnessPresentation(meta.status);
  if (!presentation) return null;

  return (
    <aside
      className={`bread-freshness bread-freshness--${presentation.tone}`}
      role="status"
      aria-live="polite"
    >
      <strong>{presentation.title}</strong>
      <span>{presentation.detail}</span>
    </aside>
  );
}
