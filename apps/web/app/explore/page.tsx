import { Suspense } from 'react';

import { Skeleton } from '@bread/ui';
import { ExploreClient } from '../../components/explore/explore-client';

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <main className="bread-page">
          <h1 className="bread-page__heading">Explore</h1>
          <Skeleton label="Loading Explore" />
        </main>
      }
    >
      <ExploreClient />
    </Suspense>
  );
}
