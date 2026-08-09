import type { ReadRepository } from '../../../../packages/db/src/index.js';
import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/index.js';
import type { FreshnessMeta } from '../../../../packages/types/src/index.js';

import type { BreadCache } from '../cache.js';
import type { RateLimitResult } from '../rate-limit.js';

export type BreadReadRouteDeps = Readonly<{
  repository: ReadRepository;
  context: ProtocolContext;
  freshness: () => Promise<FreshnessMeta>;
  cache?: BreadCache;
  feedRateLimit?: (subject: string) => Promise<RateLimitResult>;
  now?: () => Date;
}>;
