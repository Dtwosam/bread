import Link from 'next/link';

export default function StatsPage() {
  return (
    <main className="bread-page bread-secondary-page">
      <header className="bread-secondary-page__heading">
        <p className="bread-eyebrow">Stats</p>
        <h1>Platform statistics</h1>
        <p className="bread-muted">
          Reliable aggregate volume, launches, trades and graduations are not available from the
          current indexed API contract.
        </p>
      </header>

      <section className="bread-state" aria-labelledby="bread-stats-unavailable-heading">
        <h2 id="bread-stats-unavailable-heading">Indexed platform totals unavailable</h2>
        <p>
          Bread leaves platform statistics empty rather than deriving authoritative-looking totals
          from incomplete feed pages. Token-level market data remains available where the indexer
          exposes it.
        </p>
        <Link className="bread-secondary-link" href="/explore">Explore indexed tokens</Link>
      </section>
    </main>
  );
}
