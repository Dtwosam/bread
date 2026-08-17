import { StatsClient } from '../../components/stats/stats-client';

export default function StatsPage() {
  return (
    <main className="bread-page bread-secondary-page">
      <header className="bread-secondary-page__heading">
        <p className="bread-eyebrow">Stats</p>
        <h1>Platform statistics</h1>
        <p className="bread-muted">Reliable lifetime totals from Bread&apos;s canonical indexed stack.</p>
      </header>
      <StatsClient />
    </main>
  );
}
