import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  MAX_TOKEN_IMAGE_BYTES,
  TokenImageValidationError,
  processTokenImage,
  type TokenMediaStore,
} from '../../apps/api/src/media/token-image';
import { registerTokenMediaRoutes } from '../../apps/api/src/routes/media';

const requireFromApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const Fastify = requireFromApi('fastify') as (options?: Record<string, unknown>) => {
  addContentTypeParser: (...args: unknown[]) => unknown;
  post: (...args: unknown[]) => unknown;
  inject: (input: Readonly<{
    method: string;
    url: string;
    headers?: Readonly<Record<string, string>>;
    payload?: Buffer;
  }>) => Promise<{ statusCode: number; json: () => Record<string, unknown> }>;
  close: () => Promise<void>;
};

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function validPng(): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const scanline = Buffer.from([0, 244, 195, 93, 255, 76, 141, 255, 255]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanline)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function captureError(promise: Promise<unknown>): Promise<TokenImageValidationError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TokenImageValidationError);
    return error as TokenImageValidationError;
  }
  throw new Error('expected token-image validation to fail');
}

describe('Bread token-image runtime pipeline', () => {
  it('decodes real image bytes, strips source payload into bounded WebP variants, and preserves dimensions', async () => {
    const processed = await processTokenImage(validPng(), 'image/png');

    expect(processed.sourceFormat).toBe('png');
    expect(processed.sourceWidth).toBe(2);
    expect(processed.sourceHeight).toBe(1);
    expect(processed.assetId).toMatch(/^[0-9a-f]{64}$/);
    expect(processed.variants.map((variant) => variant.name)).toEqual(['card', 'detail']);
    for (const variant of processed.variants) {
      expect(variant.contentType).toBe('image/webp');
      expect(variant.width).toBeGreaterThan(0);
      expect(variant.height).toBeGreaterThan(0);
      expect(variant.width).toBeLessThanOrEqual(variant.name === 'card' ? 64 : 256);
      expect(variant.height).toBeLessThanOrEqual(variant.name === 'card' ? 64 : 256);
      expect(variant.bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    }
  });

  it('rejects SVG, non-image/video bytes, MIME mismatches, and oversized payloads before storage', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const invalidSvg = await captureError(processTokenImage(svg, 'image/svg+xml'));
    expect(['UNSUPPORTED_TOKEN_IMAGE_TYPE', 'INVALID_TOKEN_IMAGE']).toContain(invalidSvg.code);

    const video = Buffer.from('00000020667479706d70343200000000', 'hex');
    const invalidVideo = await captureError(processTokenImage(video, 'video/mp4'));
    expect(['UNSUPPORTED_TOKEN_IMAGE_TYPE', 'INVALID_TOKEN_IMAGE']).toContain(invalidVideo.code);

    const mismatch = await captureError(processTokenImage(validPng(), 'image/jpeg'));
    expect(mismatch.code).toBe('TOKEN_IMAGE_MIME_MISMATCH');

    const oversized = await captureError(
      processTokenImage(Buffer.alloc(MAX_TOKEN_IMAGE_BYTES + 1), 'application/octet-stream'),
    );
    expect(oversized.code).toBe('TOKEN_IMAGE_TOO_LARGE');
  });

  it('returns only canonical HTTPS references from the provider-neutral upload route', async () => {
    const stored: Array<{ assetId: string; name: string }> = [];
    const store: TokenMediaStore = {
      put: async ({ assetId, variant }) => {
        stored.push({ assetId, name: variant.name });
        return {
          name: variant.name,
          canonicalUrl: `https://media.bread.example/token-images/${assetId}/${variant.name}.webp`,
          width: variant.width,
          height: variant.height,
          contentType: variant.contentType,
        };
      },
    };
    const app = Fastify();
    registerTokenMediaRoutes(app as never, { store });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/media/token-image',
      headers: { 'content-type': 'image/png' },
      payload: validPng(),
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      data?: { canonicalUrl?: string; variants?: Array<{ canonicalUrl?: string; width?: number; height?: number }> };
    };
    expect(body.data?.canonicalUrl).toMatch(/^https:\/\//);
    expect(body.data?.variants).toHaveLength(2);
    expect(body.data?.variants?.every((variant) => variant.canonicalUrl?.startsWith('https://'))).toBe(true);
    expect(body.data?.variants?.every((variant) => Number(variant.width) > 0 && Number(variant.height) > 0)).toBe(true);
    expect(stored.map((entry) => entry.name)).toEqual(['card', 'detail']);

    await app.close();
  });
});
