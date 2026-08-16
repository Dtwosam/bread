'use client';

import { Button } from '@bread/ui';

export default function RouteError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <main className="bread-page">
      <section className="bread-state bread-state--error" role="alert" aria-labelledby="bread-route-error-title">
        <h1 id="bread-route-error-title">Page unavailable</h1>
        <p>
          Bread could not load this website or indexed read-service view. Retry the route when the
          frontend is available; this failure does not change onchain contracts or submitted
          transactions.
        </p>
        {error.digest ? <code className="bread-technical">Reference: {error.digest}</code> : null}
        <div>
          <Button type="button" onClick={() => reset()}>
            Retry
          </Button>
        </div>
      </section>
    </main>
  );
}
