import type { IndexedTokenDetail } from '../../../../packages/types/src/index';
import { formatUsdcBaseUnits } from '../explore/model';

function priceRatio(token: IndexedTokenDetail): string {
  const price = token.metrics?.lastPrice;
  return price ? `${price.numerator} / ${price.denominator}` : '—';
}

export function TokenStats({ token }: Readonly<{ token: IndexedTokenDetail }>) {
  const metrics = [
    ['Market cap', formatUsdcBaseUnits(token.marketCap)],
    ['Price', priceRatio(token)],
    ['24h volume', formatUsdcBaseUnits(token.metrics?.quoteVolume.h24 ?? null)],
    ['Holders', token.holderCount ?? '—'],
    ['Trades', token.metrics?.tradeCount.h24 ?? '—'],
  ] as const;

  return (
    <section className="bread-token-stats" aria-label="Token market stats">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}
