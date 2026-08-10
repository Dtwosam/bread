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
});
