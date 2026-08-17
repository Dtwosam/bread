import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="bread-page">
      <section className="bread-state" aria-labelledby="bread-not-found-title">
        <p className="bread-eyebrow">404</p>
        <h1 id="bread-not-found-title">Page not found</h1>
        <p>
          This Bread route does not exist. A valid-looking token address that is not a Bread launch
          is handled separately on the token route.
        </p>
        <Link className="bread-secondary-link" href="/explore">Back to Explore</Link>
      </section>
    </main>
  );
}
