import Link from 'next/link';

export default function ActivityPage() {
  return (
    <main className="bread-page bread-secondary-page">
      <header className="bread-secondary-page__heading">
        <p className="bread-eyebrow">Activity</p>
        <h1>Platform activity</h1>
        <p className="bread-muted">
          Platform-wide activity is not available from Bread&apos;s current indexed read API.
        </p>
      </header>

      <section className="bread-state" aria-labelledby="bread-activity-unavailable-heading">
        <h2 id="bread-activity-unavailable-heading">Activity projection unavailable</h2>
        <p>
          Bread will not assemble a global activity feed from partial token data or invent fields that
          are not indexed. Token pages continue to show their own indexed trades where that data is
          available.
        </p>
        <Link className="bread-secondary-link" href="/explore">Explore tokens</Link>
      </section>
    </main>
  );
}
