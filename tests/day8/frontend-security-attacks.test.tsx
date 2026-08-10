import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeExternalMetadataUrl } from '../../apps/web/lib/security/external-url';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Day 8 malicious metadata and frontend release-integrity attacks', () => {
  it.each([
    ['javascript:alert(1)', 'javascript scheme'],
    ['JaVaScRiPt:alert(1)', 'mixed-case javascript scheme'],
    ['java\nscript:alert(1)', 'ASCII-control-obfuscated javascript scheme'],
    ['java\tscript:alert(1)', 'tab-obfuscated javascript scheme'],
    ['data:text/html,<script>alert(1)</script>', 'data scheme'],
    ['file:///etc/passwd', 'file scheme'],
    ['ftp://example.com/file', 'non-http scheme'],
    ['//example.com/path', 'scheme-relative URL'],
    ['example.com/path', 'incomplete host-like URL'],
    ['https://user:password@example.com/path', 'embedded credentials'],
  ])('rejects hostile creator metadata URL %s (%s)', (value) => {
    expect(() => normalizeExternalMetadataUrl(value, 'Website')).toThrow();
  });

  it.each([
    ['https://example.com/path?q=1#fragment', 'https://example.com/path?q=1#fragment'],
    ['  http://example.com/path  ', 'http://example.com/path'],
    ['https://example.com/%0Ajavascript:alert(1)', 'https://example.com/%0Ajavascript:alert(1)'],
  ])('accepts complete http(s) metadata URLs without reinterpreting path text: %s', (value, expected) => {
    expect(normalizeExternalMetadataUrl(value, 'Website')).toBe(expected);
  });

  it('keeps raw HTML injection APIs out of the public web source tree', () => {
    const publicWebFiles = [
      'apps/web/app/create/page.tsx',
      'apps/web/components/create/token-form.tsx',
      'apps/web/components/token/token-client.tsx',
      'apps/web/components/token/token-identity.tsx',
      'apps/web/components/token/token-tabs.tsx',
      'apps/web/components/explore/explore-client.tsx',
      'apps/web/components/search-surface.tsx',
      'apps/web/components/trade/trade-experience.tsx',
    ];

    for (const path of publicWebFiles) {
      const source = read(path);
      expect(source, path).not.toMatch(/dangerouslySetInnerHTML|\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML/);
    }
  });

  it('renders indexed token identity values through React text expressions rather than HTML sinks', () => {
    const identity = read('apps/web/components/token/token-identity.tsx');

    expect(identity).toContain("{token.name?.trim() || 'Unnamed token'}");
    expect(identity).toContain("{token.symbol?.trim() ? `$${token.symbol.trim()}` : '—'}");
    expect(identity).not.toMatch(/dangerouslySetInnerHTML|\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML/);
  });

  it('keeps the production CSP and browser hardening boundary restrictive', () => {
    const config = read('apps/web/next.config.ts');

    expect(config).toMatch(/default-src\s+'self'/);
    expect(config).toMatch(/object-src\s+'none'/);
    expect(config).toMatch(/base-uri\s+'self'/);
    expect(config).toMatch(/form-action\s+'self'/);
    expect(config).toMatch(/frame-ancestors\s+'none'/);
    expect(config).toContain("key: 'X-Content-Type-Options'");
    expect(config).toContain("value: 'nosniff'");
    expect(config).toContain("key: 'Referrer-Policy'");
    expect(config).toContain("key: 'Permissions-Policy'");
    expect(config).toContain("...(isDevelopment ? [] : ['upgrade-insecure-requests'])");
    expect(config).toContain("isDevelopment ? \" 'unsafe-eval'\" : ''");
  });
});
