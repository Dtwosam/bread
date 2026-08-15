import { createElement } from 'react';

import { desktopNavigation, mobileNavigation } from './theme';

export type NavigationProps = Readonly<{
  currentHref?: string;
}>;

function NavigationLink({
  label,
  href,
  currentHref,
}: Readonly<{ label: string; href: string; currentHref?: string }>) {
  const active = currentHref === href;
  return createElement(
    'a',
    {
      className: 'bread-navigation__link',
      href,
      'aria-current': active ? 'page' : undefined,
    },
    label,
  );
}

export function Navigation({ currentHref }: NavigationProps = {}) {
  return createElement(
    'nav',
    { className: 'bread-navigation bread-navigation--desktop', 'aria-label': 'Primary navigation' },
    ...desktopNavigation.map((item) =>
      createElement(NavigationLink, { ...item, currentHref, key: item.href }),
    ),
  );
}

export function MobileNavigation({ currentHref }: NavigationProps = {}) {
  return createElement(
    'nav',
    { className: 'bread-navigation bread-navigation--mobile', 'aria-label': 'Mobile navigation' },
    ...mobileNavigation.map((item) =>
      createElement(NavigationLink, { ...item, currentHref, key: item.href }),
    ),
  );
}
