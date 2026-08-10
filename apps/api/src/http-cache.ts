import type { FastifyReply } from 'fastify';

/**
 * 06I requires eligible public GETs to be absorbable by an edge/CDN while
 * preserving roughly one-second indexed visibility. Browsers must revalidate;
 * only a shared cache may reuse the response for this bounded interval.
 */
export const PUBLIC_PROJECTION_CACHE_CONTROL =
  'public, max-age=0, s-maxage=1, must-revalidate' as const;

/**
 * Operational/status and unsuccessful read responses must not be reused by an
 * intermediary as if they were current authoritative state.
 */
export const NO_STORE_CACHE_CONTROL = 'no-store' as const;

export function markPublicProjectionCacheable(reply: FastifyReply): void {
  reply.header('Cache-Control', PUBLIC_PROJECTION_CACHE_CONTROL);
}

export function markNoStore(reply: FastifyReply): void {
  reply.header('Cache-Control', NO_STORE_CACHE_CONTROL);
}
