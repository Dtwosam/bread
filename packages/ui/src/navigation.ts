import { createElement } from 'react';

import { Icon } from './icon';
import { desktopNavigation, mobileNavigation } from './theme';

export type NavigationProps = Readonly<{
  currentHref?: string;
}>;

function NavigationGlyph({ label }: Readonly<{ label: string }>) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    focusable: false,
  };

  if (label === 'Explore') {
    return createElement(
      'svg',
      common,
      createElement('circle', { cx: 12, cy: 12, r: 8 }),
      createElement('path', { d: 'm15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z' }),
    );
  }

  if (label === 'Trending') {
    return createElement(
      'svg',
      common,
      createElement('path', { d: 'M13.4 3.5c.4 3-1.1 4.5-2.5 6-1.2 1.3-2.4 2.6-2.4 4.7a3.5 3.5 0 0 0 7 0c0-1.1-.4-2.2-1.2-3.3-.2 1.5-.8 2.4-1.8 3 .2-2.2-.8-3.7-2-5.1C9.2 7.3 8 5.8 8.5 3.5c-2.8 2-4.5 5.2-4.5 8.5a8 8 0 0 0 16 0c0-3.1-1.7-6.3-6.6-8.5Z' }),
    );
  }

  if (label === 'Create') {
    return createElement(
      'svg',
      common,
      createElement('rect', { x: 4, y: 4, width: 16, height: 16, rx: 4 }),
      createElement('path', { d: 'M12 8v8M8 12h8' }),
    );
  }

  return createElement(
    'svg',
    common,
    createElement('rect', { x: 4, y: 7, width: 16, height: 12, rx: 3 }),
    createElement('path', { d: 'M9 7V5.5h6V7M4 11h16' }),
  );
}

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
    createElement(Icon, { size: 'navigation' }, createElement(NavigationGlyph, { label })),
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
