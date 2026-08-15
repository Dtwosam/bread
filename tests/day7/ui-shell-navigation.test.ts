import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as ui from '../../packages/ui/src/index';

const exports = ui as Record<string, unknown>;

type ElementLike = Readonly<{
  type?: unknown;
  props?: Record<string, unknown>;
}>;

function renderNavigationLink(element: ElementLike): ElementLike {
  expect(typeof element.type).toBe('function');
  return (element.type as (props: Record<string, unknown>) => ElementLike)(element.props ?? {});
}

describe('Bread UI/UX v2.2 Lane 2 primary navigation', () => {
  it('uses the exact source-required desktop and mobile primary destination order', () => {
    const desktop = exports.desktopNavigation as readonly { label: string; href: string }[];
    const mobile = exports.mobileNavigation as readonly { label: string; href: string }[];

    expect(desktop).toEqual([
      { label: 'Explore', href: '/explore' },
      { label: 'Trending', href: '/explore?view=trending' },
      { label: 'Create', href: '/create' },
      { label: 'Portfolio', href: '/portfolio' },
    ]);
    expect(mobile).toEqual(desktop);
    expect(desktop.some(({ label }) => label === 'Graduating')).toBe(false);
  });

  it('marks only the selected destination as the current page', () => {
    const Navigation = exports.Navigation as ((props?: Record<string, unknown>) => ElementLike) | undefined;
    const MobileNavigation = exports.MobileNavigation as ((props?: Record<string, unknown>) => ElementLike) | undefined;
    expect(typeof Navigation).toBe('function');
    expect(typeof MobileNavigation).toBe('function');

    for (const component of [Navigation, MobileNavigation]) {
      const rendered = component?.({ currentHref: '/explore?view=trending' });
      const children = rendered?.props?.children as readonly ElementLike[];
      expect(children).toHaveLength(4);

      const anchors = children.map(renderNavigationLink);
      expect(anchors.map((anchor) => anchor.props?.href)).toEqual([
        '/explore',
        '/explore?view=trending',
        '/create',
        '/portfolio',
      ]);
      expect(anchors.map((anchor) => anchor.props?.['aria-current'])).toEqual([
        undefined,
        'page',
        undefined,
        undefined,
      ]);
    }
  });

  it('uses the v2.2 active-navigation semantic surface rather than a competing visual treatment', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    expect(css).toContain('.bread-navigation__link[aria-current="page"]');
    expect(css).toContain('color: var(--bread-accent);');
    expect(css).toContain('background: var(--bread-accent-soft);');
  });
});
