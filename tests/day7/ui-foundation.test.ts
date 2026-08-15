import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as ui from '../../packages/ui/src/index';

const exports = ui as Record<string, unknown>;

type ElementLike = Readonly<{
  props?: Record<string, unknown>;
}>;

describe('Bread UI/UX v2.2 public web design foundation', () => {
  it('matches the ratified v2.2 foundation-token contract exactly', () => {
    expect(exports).toHaveProperty('breadTheme');

    const theme = exports.breadTheme as
      | {
          colors: Record<string, string>;
          fonts: Record<string, string>;
          typography: Record<string, { size: number; weight: number; lineHeight: number }>;
          controls: Record<string, number>;
          spacing: readonly number[];
          radii: Record<string, number>;
          layout: Record<string, number>;
          breakpoints: Record<string, number>;
          motion: Record<string, string | number>;
        }
      | undefined;

    expect(theme).toBeDefined();
    expect(theme?.colors).toEqual({
      bgPrimary: '#0A0B0D',
      bgSecondary: '#0F1115',
      surface1: '#13161B',
      surface2: '#181C22',
      surface3: '#20252D',
      borderSubtle: '#242A33',
      borderStrong: '#343C48',
      textPrimary: '#F5F7FA',
      textSecondary: '#A7B0BD',
      textTertiary: '#727D8D',
      textDisabled: '#505966',
      accent: '#4C8DFF',
      accentHover: '#68A0FF',
      accentSoft: '#14233E',
      brandButter: '#F4C35D',
      brandButterHover: '#FFD477',
      brandButterSoft: '#2B2210',
      brandLavender: '#A98BFA',
      brandLavenderSoft: '#211A35',
      brandMint: '#47D7B0',
      brandMintSoft: '#102B26',
      positive: '#32D583',
      positiveSoft: '#102A20',
      negative: '#F97066',
      negativeSoft: '#351817',
      warning: '#F79009',
      warningSoft: '#35240D',
    });
    expect(theme?.fonts).toEqual({ primary: 'Inter', technical: 'Geist Mono' });
    expect(theme?.typography).toEqual({
      display: { size: 32, weight: 700, lineHeight: 38 },
      pageH1: { size: 24, weight: 700, lineHeight: 30 },
      mobileH1: { size: 22, weight: 700, lineHeight: 28 },
      tokenTitle: { size: 28, weight: 700, lineHeight: 34 },
      sectionH2: { size: 20, weight: 600, lineHeight: 26 },
      sectionH3: { size: 17, weight: 600, lineHeight: 23 },
      cardName: { size: 15, weight: 600, lineHeight: 20 },
      bodyLg: { size: 16, weight: 400, lineHeight: 24 },
      body: { size: 14, weight: 400, lineHeight: 21 },
      bodyMedium: { size: 14, weight: 500, lineHeight: 21 },
      label: { size: 13, weight: 500, lineHeight: 18 },
      creator: { size: 12, weight: 500, lineHeight: 17 },
      small: { size: 12, weight: 400, lineHeight: 17 },
      micro: { size: 11, weight: 600, lineHeight: 15 },
    });
    expect(theme?.controls).toEqual({ standardButtonHeight: 40, largeButtonHeight: 48, smallButtonHeight: 32, minimumTouchTarget: 44 });
    expect(theme?.spacing).toEqual([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
    expect(theme?.radii).toEqual({ control: 8, card: 12, modal: 16, full: 9999 });
    expect(theme?.layout).toEqual({
      mobilePageGutter: 16, tabletPageGutter: 24, desktopPageGutter: 32, maxWidth: 1440,
      exploreMaxWidth: 1600, desktopTradePanel: 360, filterRail: 232, desktopHeader: 64,
      desktopLiveStrip: 40, mobileLiveStrip: 36, mobileTopBar: 56, mobileBottomNav: 64, minimumTouchTarget: 44,
    });
    expect(theme?.breakpoints).toMatchObject({
      xsMax: 479, smMin: 480, smMax: 767, mdMin: 768, mdMax: 1023, lgMin: 1024,
      lgMax: 1279, xlMin: 1280, xlMax: 1535, xxlMin: 1536, mobileMax: 767, desktopTradeCollapseBelow: 1024,
    });
    expect(theme?.motion).toEqual({ instant: 80, fast: 120, standard: 180, enter: 220, sheet: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  });

  it('exposes the exact ratified v2.2 runtime CSS variable surface', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    for (const token of [
      '--bread-warning: #f79009;', '--bread-warning-soft: #35240d;', '--bread-brand-butter: #f4c35d;',
      '--bread-brand-butter-hover: #ffd477;', '--bread-brand-butter-soft: #2b2210;', '--bread-brand-lavender: #a98bfa;',
      '--bread-brand-lavender-soft: #211a35;', '--bread-brand-mint: #47d7b0;', '--bread-brand-mint-soft: #102b26;',
      '--bread-space-0: 0px;', '--bread-space-4: 4px;', '--bread-space-8: 8px;', '--bread-space-12: 12px;',
      '--bread-space-16: 16px;', '--bread-space-20: 20px;', '--bread-space-24: 24px;', '--bread-space-32: 32px;',
      '--bread-space-40: 40px;', '--bread-space-48: 48px;', '--bread-space-64: 64px;', '--bread-gutter-mobile: 16px;',
      '--bread-gutter-tablet: 24px;', '--bread-gutter-desktop: 32px;', '--bread-max-width: 1440px;', '--bread-explore-max-width: 1600px;',
      '--bread-trade-rail: 360px;', '--bread-filter-rail: 232px;', '--bread-header-desktop: 64px;', '--bread-live-strip-desktop: 40px;',
      '--bread-live-strip-mobile: 36px;', '--bread-topbar-mobile: 56px;', '--bread-bottomnav-mobile: 64px;', '--bread-motion-instant: 80ms;',
      '--bread-motion-fast: 120ms;', '--bread-motion-standard: 180ms;', '--bread-motion-enter: 220ms;', '--bread-motion-sheet: 260ms;',
      '--bread-easing: cubic-bezier(0.2, 0, 0, 1);',
    ]) expect(css).toContain(token);
  });

  it('keeps literal color values inside the root token definition rather than component rules', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    const rootEnd = css.indexOf('\n}\n');
    expect(rootEnd).toBeGreaterThan(0);
    const componentCss = css.slice(rootEnd + 3);
    expect(componentCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(componentCss).toContain('color: var(--bread-bg-primary)');
  });

  it('implements the ratified visible focus ring without relying on shadow-only focus', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    expect(css).toContain('outline: 2px solid var(--bread-accent);');
    expect(css).toContain('outline-offset: 2px;');
    expect(css).toContain(':focus-visible');
  });

  it('caps hover movement at -1px and never scales interactive controls', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    expect(css).toContain('.bread-button:hover:not(:disabled)');
    expect(css).toContain('transform: translateY(-1px);');
    expect(css).not.toMatch(/transform:\s*scale\(/);
    expect(css).not.toMatch(/translateY\(-(?:[2-9]|\d{2,})px\)/);
  });

  it('suppresses non-essential transforms and animations under reduced motion', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('transition-duration: 0.01ms !important;');
    expect(reduced).toContain('animation-duration: 0.01ms !important;');
    expect(reduced).toContain('.bread-button:hover:not(:disabled)');
    expect(reduced).toContain('.bread-button:active:not(:disabled)');
    expect(reduced).toContain('transform: none;');
  });

  it('provides one shared secondary CreatorAttribution primitive', () => {
    expect(exports).toHaveProperty('CreatorAttribution');
    const CreatorAttribution = exports.CreatorAttribution as ((props: Record<string, unknown>) => unknown) | undefined;
    expect(typeof CreatorAttribution).toBe('function');
    const wallet = '0x1234567890abcdef1234567890abcdef12345678';
    const element = CreatorAttribution?.({ creatorAddress: wallet }) as ElementLike | undefined;
    const children = element?.props?.children as readonly ElementLike[] | undefined;
    expect(element?.props?.className).toBe('bread-creator-attribution');
    expect(element?.props?.title).toBe(wallet);
    expect(children).toHaveLength(2);
    expect(children?.[0]?.props?.children).toBe('by');
    expect(children?.[1]?.props?.children).toBe('0x1234…5678');
  });

  it('keeps creator display identity secondary while preserving the authoritative wallet', () => {
    const CreatorAttribution = exports.CreatorAttribution as ((props: Record<string, unknown>) => unknown) | undefined;
    const wallet = '0x1234567890abcdef1234567890abcdef12345678';
    const handled = CreatorAttribution?.({ creatorAddress: wallet, displayName: 'breadmaker' }) as ElementLike;
    const handledChildren = handled.props?.children as readonly ElementLike[];
    expect(handled.props?.title).toBe(wallet);
    expect(handledChildren[1]?.props?.children).toBe('@breadmaker');
    const currentUser = CreatorAttribution?.({ creatorAddress: wallet, isCurrentUser: true }) as ElementLike;
    const currentUserChildren = currentUser.props?.children as readonly ElementLike[];
    expect(currentUserChildren[1]?.props?.children).toBe('you');
    const unknown = CreatorAttribution?.({ creatorAddress: null }) as ElementLike;
    const unknownChildren = unknown.props?.children as readonly ElementLike[];
    expect(unknown.props?.title).toBeUndefined();
    expect(unknownChildren[1]?.props?.children).toBe('—');
  });

  it('styles CreatorAttribution as one quiet line without semantic success/error treatment', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    expect(css).toContain('.bread-creator-attribution {');
    expect(css).toContain('font-size: 12px');
    expect(css).toContain('line-height: 17px');
    expect(css).toContain('font-weight: 500');
    expect(css).toContain('color: var(--bread-text-secondary)');
    expect(css).toContain('white-space: nowrap');
    expect(css).toContain('text-overflow: ellipsis');
    expect(css).not.toContain('.bread-creator-attribution {\n  color: var(--bread-positive)');
    expect(css).not.toContain('.bread-creator-attribution {\n  color: var(--bread-negative)');
  });

  it('retains the existing navigation behavior until the dedicated shell/navigation lane', () => {
    expect(exports).toHaveProperty('desktopNavigation');
    expect(exports).toHaveProperty('mobileNavigation');
    expect(exports).toHaveProperty('Button');
    const desktopNavigation = exports.desktopNavigation as readonly { label: string; href: string }[];
    const mobileNavigation = exports.mobileNavigation as readonly { label: string; href: string }[];
    expect(desktopNavigation.map(({ label }) => label)).toEqual(['Explore', 'Graduating', 'Portfolio', 'Create']);
    expect(mobileNavigation.map(({ label }) => label)).toEqual(['Explore', 'Trending', 'Create', 'Portfolio']);
    const Button = exports.Button as ((props: Record<string, unknown>) => unknown) | undefined;
    expect(typeof Button).toBe('function');
    const element = Button?.({ loading: true, children: 'Confirm' }) as ElementLike | undefined;
    expect(element?.props?.['aria-busy']).toBe(true);
  });

  it('preserves button width while loading by retaining both labels in one layout slot', () => {
    const Button = exports.Button as ((props: Record<string, unknown>) => unknown) | undefined;
    const element = Button?.({ loading: true, children: 'Confirm' }) as ElementLike | undefined;
    const content = element?.props?.children as ElementLike | undefined;
    const labels = content?.props?.children as readonly ElementLike[] | undefined;
    expect(content?.props?.className).toBe('bread-button__content');
    expect(labels).toHaveLength(2);
    expect(labels?.[0]?.props?.children).toBe('Confirm');
    expect(labels?.[0]?.props?.['aria-hidden']).toBe(true);
    expect(labels?.[1]?.props?.children).toBe('Confirming...');
    expect(labels?.[1]?.props?.['aria-hidden']).toBe(false);
  });

  it('defines a visible pressed state and overlapping stable-width button labels', () => {
    const css = readFileSync(new URL('../../packages/ui/src/theme.css', import.meta.url), 'utf8');
    expect(css).toContain('.bread-button:active:not(:disabled)');
    expect(css).toContain('.bread-button__content');
    expect(css).toContain('grid-area: 1 / 1');
  });
});
