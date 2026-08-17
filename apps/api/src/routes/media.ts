import type { FastifyInstance } from 'fastify';

import {
  MAX_TOKEN_IMAGE_BYTES,
  TokenImageValidationError,
  processTokenImage,
  storeProcessedTokenImage,
  type TokenMediaStore,
} from '../media/token-image.js';
import { markNoStore } from '../http-cache.js';

const TOKEN_IMAGE_CONTENT_TYPES = [
  'application/octet-stream',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export function registerTokenMediaRoutes(
  app: FastifyInstance,
  deps: Readonly<{ store?: TokenMediaStore }>,
): void {
  app.addContentTypeParser(
    [...TOKEN_IMAGE_CONTENT_TYPES],
    { parseAs: 'buffer', bodyLimit: MAX_TOKEN_IMAGE_BYTES },
    (_request, body, done) => done(null, body),
  );

  app.post('/v1/media/token-image', {
    config: { rateLimit: false },
    bodyLimit: MAX_TOKEN_IMAGE_BYTES,
  }, async (request, reply) => {
    markNoStore(reply);
    if (!deps.store) {
      return reply.code(503).send({
        error: {
          code: 'TOKEN_MEDIA_STORAGE_UNAVAILABLE',
          message: 'Token image upload is temporarily unavailable. You may continue without an image.',
          requestId: request.id,
        },
      });
    }

    const body = request.body;
    if (!Buffer.isBuffer(body)) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_TOKEN_IMAGE',
          message: 'Token image body must contain PNG, JPEG, or WebP bytes.',
          requestId: request.id,
        },
      });
    }

    try {
      const processed = await processTokenImage(body, request.headers['content-type']);
      const stored = await storeProcessedTokenImage(deps.store, processed);
      if (!stored.canonicalUrl.startsWith('https://')) {
        throw new Error('canonicalUrl is not HTTPS');
      }
      return reply.code(201).send({
        data: {
          assetId: stored.assetId,
          canonicalUrl: stored.canonicalUrl,
          width: stored.width,
          height: stored.height,
          variants: stored.variants.map((variant) => ({
            name: variant.name,
            canonicalUrl: variant.canonicalUrl,
            width: variant.width,
            height: variant.height,
            contentType: variant.contentType,
          })),
        },
      });
    } catch (error) {
      if (error instanceof TokenImageValidationError) {
        return reply.code(400).send({
          error: {
            code: error.code,
            message: error.message,
            requestId: request.id,
          },
        });
      }
      request.log.error({ err: error }, 'token image processing failed');
      return reply.code(503).send({
        error: {
          code: 'TOKEN_MEDIA_PROCESSING_UNAVAILABLE',
          message: 'Token image processing is temporarily unavailable. You may continue without an image.',
          requestId: request.id,
        },
      });
    }
  });
}
