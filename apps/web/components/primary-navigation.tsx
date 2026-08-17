'use client';

import { MobileNavigation, Navigation } from '@bread/ui';
import { usePathname, useSearchParams } from 'next/navigation';

function useCurrentNavigationHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname === '/explore') {
    return searchParams.get('view') === 'trending' ? '/explore?view=trending' : '/explore';
  }

  if (pathname === '/create' || pathname === '/portfolio') {
    return pathname;
  }

  return undefined;
}

export function PrimaryNavigation() {
  return <Navigation currentHref={useCurrentNavigationHref()} />;
}

export function PrimaryMobileNavigation() {
  return <MobileNavigation currentHref={useCurrentNavigationHref()} />;
}
