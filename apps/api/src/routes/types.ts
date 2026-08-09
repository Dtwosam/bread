import type { ReadRepository } from '../../../../packages/db/src/index.js';
import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/index.js';
import type { FreshnessMeta } from '../../../../packages/types/src/index.js';

export type BreadReadRouteDeps = Readonly<{
  repository: ReadRepository;
  context: ProtocolContext;
  freshness: () => Promise<FreshnessMeta>;
}>;
