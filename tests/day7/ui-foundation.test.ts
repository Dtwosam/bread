import { describe, expect, it } from 'vitest';

import * as ui from '../../packages/ui/src/index';

const exports = ui as Record<string, unknown>;

describe('Day 7 public web design foundation', () => {
  it('freezes the controlling 04B semantic tokens and shell geometry', () => {
    expect(exports).toHaveProperty('breadTheme');

    const theme = exports.breadTheme as
      | {
          colors: Record<string, string>;
          spacing: readonly number[];
          layout: Record<string, number>;
          breakpoints: Record<string, number>;
        }
      | undefined;

    expect(theme).toBeDefined();
    expect(theme?.colors).toMatchObject({
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
      positive: '#32D583',
      positiveSoft: '#102A20',
      negative: '#F97066',
      negativeSoft: '#351817',
      warning: '#FDB022',
      warningSoft: '#35290D',
    });
    expect(theme?.spacing).toEqual([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
    expect(theme?.layout).toMatchObject({
      mobilePageGutter: 16,
      tabletPageGutter: 24,
      desktopPageGutter: 32,
      maxWidth: 1440,
      desktopTradePanel: 360,
      desktopHeader: 64,
      mobileTopBar: 56,
      mobileBottomNav: 64,
    });
    expect(theme?.breakpoints.mobileMax).toBe(767);
    expect(theme?.breakpoints.desktopTradeCollapseBelow).toBe(1024);
  });

  it('exports the frozen public navigation and accessible loading button behavior', () => {
    expect(exports).toHaveProperty('desktopNavigation');
    expect(exports).toHaveProperty('mobileNavigation');
    expect(exports).toHaveProperty('Button');

    const desktopNavigation = exports.desktopNavigation as readonly { label: string; href: string }[];
    const mobileNavigation = exports.mobileNavigation as readonly { label: string; href: string }[];

    expect(desktopNavigation.map(({ label }) => label)).toEqual([
      'Explore',
      'Graduating',
      'Portfolio',
      'Create',
    ]);
    expect(mobileNavigation.map(({ label }) => label)).toEqual([
      'Explore',
      'Trending',
      'Create',
      'Portfolio',
    ]);

    const Button = exports.Button as ((props: Record<string, unknown>) => unknown) | undefined;
    expect(typeof Button).toBe('function');

    const element = Button?.({ loading: true, children: 'Confirm' }) as
      | { props?: Record<string, unknown> }
      | undefined;
    expect(element?.props?.['aria-busy']).toBe(true);
    expect(element?.props?.children).toBe('Confirming...');
  });
});
