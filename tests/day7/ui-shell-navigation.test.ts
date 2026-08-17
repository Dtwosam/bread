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

  it('uses decorative canonical 20px navigation icons without changing link names', () => {
    const Navigation = exports.Navigation as ((props?: Record<string, unknown>) => ElementLike) | undefined;
    const rendered = Navigation?.({ currentHref: '/explore' });
    const children = rendered?.props?.children as readonly ElementLike[];
    const anchors = children.map(renderNavigationLink);

    for (const [index, anchor] of anchors.entries()) {
      const content = anchor.props?.children as readonly [ElementLike, string];
      expect(content).toHaveLength(2);
      expect(content[0]?.props?.size).toBe('navigation');
      expect(content[0]?.props?.label).toBeUndefined();
      expect(content[1]).toBe(['Explore', 'Trending', 'Create', 'Portfolio'][index]);
    }
  });

  it('uses the v2.2 active-navigation semantic surface rather than a competing visual treatment', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    expect(css).toContain('.bread-navigation__link[aria-current="page"]');
    expect(css).toContain('color: var(--bread-accent);');
    expect(css).toContain('background: var(--bread-accent-soft);');
  });

  it('composes the desktop header in the source-required Bread -> nav -> flexible search -> watchlist -> wallet order', () => {
    const layout = readFileSync(new URL('../../apps/web/app/layout.tsx', import.meta.url), 'utf8');
    const brand = layout.indexOf('<BreadBrand />', layout.indexOf('<header className="bread-header">'));
    const nav = layout.indexOf('<PrimaryNavigation />', brand);
    const search = layout.indexOf('className="bread-header__search"', nav);
    const watchlist = layout.indexOf('<WatchlistShellControl />', search);
    const wallet = layout.indexOf('<WalletButton />', watchlist);

    expect(brand).toBeGreaterThanOrEqual(0);
    expect(nav).toBeGreaterThan(brand);
    expect(search).toBeGreaterThan(nav);
    expect(watchlist).toBeGreaterThan(search);
    expect(wallet).toBeGreaterThan(watchlist);
  });

  it('uses one shared Bread brand primitive with the approved decorative 36px butter mark', () => {
    const layout = readFileSync(new URL('../../apps/web/app/layout.tsx', import.meta.url), 'utf8');
    const shellCss = readFileSync(new URL('../../apps/web/app/shell-v2.css', import.meta.url), 'utf8');

    expect(layout).toContain("import { BreadBrand } from '../components/bread-brand';");
    expect(layout.match(/<BreadBrand \/>/g)).toHaveLength(2);
    expect(layout).not.toContain('<a className="bread-brand" href="/explore" aria-label="Bread home">');
    expect(shellCss).toContain('.bread-brand__mark {');
    expect(shellCss).toContain('width: 36px;');
    expect(shellCss).toContain('height: 36px;');
    expect(shellCss).toContain('background: var(--bread-brand-butter);');
  });

  it('uses the approved compact desktop shell proportions without widening navigation or wallet controls', () => {
    const css = [
      readFileSync(new URL('../../apps/web/app/globals.css', import.meta.url), 'utf8'),
      readFileSync(new URL('../../apps/web/app/shell-v2.css', import.meta.url), 'utf8'),
    ].join('\n');

    expect(css).toContain('height: var(--bread-header-desktop);');
    expect(css).toContain('max-width: var(--bread-max-width);');
    expect(css).toContain('grid-template-columns: auto auto minmax(280px, 1fr) auto auto;');
    expect(css).toContain('.bread-header__search {');
    expect(css).toContain('width: min(100%, 520px);');
    expect(css).toContain('justify-self: center;');
    expect(css).toContain('.bread-header__watchlist {');
    expect(css).toContain('width: var(--bread-touch-target);');
    expect(css).toContain('height: var(--bread-touch-target);');
  });

  it('renders one truthful 40px live strip and never labels degraded indexed state as LIVE', () => {
    expect(exports).toHaveProperty('LiveActivityStrip');
    const LiveActivityStrip = exports.LiveActivityStrip as ((props: Record<string, unknown>) => ElementLike) | undefined;
    expect(typeof LiveActivityStrip).toBe('function');

    const fresh = LiveActivityStrip?.({ status: 'FRESH', indexedThroughBlock: '57159858' }) as ElementLike | undefined;
    const freshChildren = fresh?.props?.children as readonly ElementLike[] | undefined;
    expect(fresh?.props?.className).toBe('bread-live-strip');
    expect(freshChildren?.[0]?.props?.children).toContain('LIVE');

    for (const [status, expected] of [
      ['LAGGING', 'Live updates delayed'],
      ['REBUILDING', 'Live updates rebuilding'],
      ['DEGRADED', 'Live updates paused'],
      ['UNAVAILABLE', 'Live updates paused'],
    ] as const) {
      const rendered = LiveActivityStrip?.({ status, indexedThroughBlock: '57159858' }) as ElementLike | undefined;
      const children = rendered?.props?.children as readonly ElementLike[] | undefined;
      expect(String(children?.[0]?.props?.children)).toContain(expected);
      expect(String(children?.[0]?.props?.children)).not.toBe('LIVE');
    }

    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    expect(css).toContain('.bread-live-strip {');
    expect(css).toContain('height: var(--bread-live-strip-desktop);');
    expect(css).toContain('border: 1px solid var(--bread-border-subtle);');
  });
});
