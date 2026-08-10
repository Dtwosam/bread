import type { IndexedPriceSummary } from '../../../../packages/types/src/index';

export function TokenChart({ price }: Readonly<{ price: IndexedPriceSummary | null }>) {
  return (
    <section className="bread-token-chart" aria-labelledby="bread-token-chart-heading">
      <div className="bread-token-section-heading">
        <div>
          <h2 id="bread-token-chart-heading">Price</h2>
          <p>Indexed price ratio: {price ? `${price.numerator} / ${price.denominator}` : '—'}</p>
        </div>
      </div>
      <div className="bread-token-chart__unavailable" role="status">
        <strong>Historical chart unavailable</strong>
        <span>Bread does not yet expose a canonical public historical-price projection for this surface.</span>
      </div>
    </section>
  );
}
