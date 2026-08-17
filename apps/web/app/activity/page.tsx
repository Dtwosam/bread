import { ActivityClient } from '../../components/activity/activity-client';

export default function ActivityPage() {
  return (
    <main className="bread-page bread-secondary-page">
      <header className="bread-secondary-page__heading">
        <p className="bread-eyebrow">Activity</p>
        <h1>Platform activity</h1>
        <p className="bread-muted">Newest indexed Bread launches, trades, and completed graduation transitions.</p>
      </header>
      <ActivityClient />
    </main>
  );
}
