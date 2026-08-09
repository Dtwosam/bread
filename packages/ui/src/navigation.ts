import { createElement } from 'react';

import { desktopNavigation, mobileNavigation } from './theme';

function NavigationLink({ label, href }: Readonly<{ label: string; href: string }>) {
  return createElement('a', { className: 'bread-navigation__link', href }, label);
}

export function Navigation() {
  return createElement(
    'nav',
    { className: 'bread-navigation bread-navigation--desktop', 'aria-label': 'Primary navigation' },
    ...desktopNavigation.map((item) => createElement(NavigationLink, { ...item, key: item.href })),
  );
}

export function MobileNavigation() {
  return createElement(
    'nav',
    { className: 'bread-navigation bread-navigation--mobile', 'aria-label': 'Mobile navigation' },
    ...mobileNavigation.map((item) => createElement(NavigationLink, { ...item, key: item.href })),
  );
}
