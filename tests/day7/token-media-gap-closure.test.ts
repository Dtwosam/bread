import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Bread v1.6.1 token-media gap closure', () => {
  it('uses image upload only on Create and never treats an arbitrary remote URL as token-image input', () => {
    const form = read('../../apps/web/components/create/token-form.tsx');

    expect(form).toContain('type="file"');
    expect(form).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(form).toContain('5 MB');
    expect(form).not.toContain('Use a public HTTPS image URL');
    expect(form).not.toContain('placeholder="https://…"');
    expect(form).not.toMatch(/accept=["'][^"']*video/i);
    expect(form).not.toMatch(/accept=["'][^"']*svg/i);
  });

  it('owns a bounded server-side media pipeline that verifies, decodes, strips metadata and returns canonical HTTPS variants', () => {
    const processorUrl = new URL('../../apps/api/src/media/token-image.ts', import.meta.url);
    const routeUrl = new URL('../../apps/api/src/routes/media.ts', import.meta.url);

    expect(existsSync(processorUrl)).toBe(true);
    expect(existsSync(routeUrl)).toBe(true);
    if (!existsSync(processorUrl) || !existsSync(routeUrl)) return;

    const processor = read('../../apps/api/src/media/token-image.ts');
    const route = read('../../apps/api/src/routes/media.ts');
    const server = read('../../apps/api/src/server.ts');
    const packageJson = read('../../apps/api/package.json');

    expect(processor).toContain('MAX_TOKEN_IMAGE_BYTES = 5 * 1024 * 1024');
    expect(processor).toContain("new Set(['png', 'jpeg', 'webp'])");
    expect(processor).toContain('sharp(');
    expect(processor).toContain('.rotate()');
    expect(processor).toContain('.resize({ width:');
    expect(processor).toContain('.webp({ quality:');
    expect(processor).toContain('strips EXIF/XMP/IPTC metadata by default');
    expect(processor).not.toContain('.withMetadata(');
    expect(processor).toContain('width:');
    expect(processor).toContain('height:');
    expect(route).toContain("'/v1/media/token-image'");
    expect(route).toContain('application/octet-stream');
    expect(route).toContain('canonicalUrl');
    expect(route).toContain("startsWith('https://')");
    expect(server).toContain('registerTokenMediaRoutes');
    expect(packageJson).toContain('"sharp":"0.34.5"');
  });
});
