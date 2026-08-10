import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const readIfPresent = (path: string) => existsSync(resolve(root, path)) ? read(path) : '';

const paths = {
  nextConfig: 'apps/web/next.config.ts',
  externalUrl: 'apps/web/lib/security/external-url.ts',
  createPage: 'apps/web/app/create/page.tsx',
  createForm: 'apps/web/components/create/token-form.tsx',
  searchSurface: 'apps/web/components/search-surface.tsx',
  tradeCss: 'apps/web/components/trade/trade.module.css',
} as const;

describe('Day 7 Task 9 frontend production gates', () => {
  it('owns a restrictive app-wide CSP and browser security headers at the Next boundary', () => {
    const config = read(paths.nextConfig);

    expect(config).toContain('async headers()');
    expect(config).toContain("key: 'Content-Security-Policy'");
    expect(config).toMatch(/default-src\s+'self'/);
    expect(config).toMatch(/script-src\s+'self'/);
    expect(config).toMatch(/connect-src\s+'self'[^;]*https:[^;]*wss:/);
    expect(config).toMatch(/img-src\s+'self'[^;]*https:[^;]*data:[^;]*blob:/);
    expect(config).toMatch(/object-src\s+'none'/);
    expect(config).toMatch(/base-uri\s+'self'/);
    expect(config).toMatch(/form-action\s+'self'/);
    expect(config).toMatch(/frame-ancestors\s+'none'/);
    expect(config).toContain("key: 'X-Content-Type-Options'");
    expect(config).toContain("value: 'nosniff'");
    expect(config).toContain("key: 'Referrer-Policy'");
    expect(config).toContain("key: 'Permissions-Policy'");
  });

  it('normalizes creator-supplied external metadata URLs before they enter launch params', () => {
    const boundary = readIfPresent(paths.externalUrl);
    const create = read(paths.createPage);

    expect(boundary).not.toBe('');
    expect(boundary).toContain('normalizeExternalMetadataUrl');
    expect(boundary).toMatch(/https?:/);
    expect(boundary).toMatch(/javascript:/i);
    expect(boundary).toMatch(/data:/i);
    expect(create).toContain('normalizeExternalMetadataUrl');
    expect(create).not.toContain('logo: draft.image.trim()');
    expect(create).not.toContain('twitter: draft.x.trim()');
    expect(create).not.toContain('telegram: draft.telegram.trim()');
    expect(create).not.toContain('website: draft.website.trim()');
  });

  it('contains Search keyboard focus inside the modal and restores focus after close', () => {
    const search = read(paths.searchSurface);

    expect(search).toContain('dialogRef');
    expect(search).toContain('returnFocusRef');
    expect(search).toContain("event.key === 'Tab'");
    expect(search).toContain('querySelectorAll<HTMLElement>');
    expect(search).toMatch(/\.focus\(\)/);
  });

  it('associates Create form preparation errors programmatically with the form', () => {
    const form = read(paths.createForm);
    const page = read(paths.createPage);

    expect(form).toContain('error?: string | null');
    expect(form).toContain('aria-describedby={error ? errorId : undefined}');
    expect(form).toContain('id={errorId}');
    expect(form).toContain('role="alert"');
    expect(page).toContain('error={error}');
  });

  it('caps the mobile trade sheet at the exact 90dvh source maximum while preserving safe-area scrolling', () => {
    const css = read(paths.tradeCss);

    expect(css).toMatch(/max-height:\s*min\(90dvh,\s*calc\(100dvh\s*-\s*56px\s*-\s*env\(safe-area-inset-top\)\)\)/);
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});
