import {
  rebuildStack,
  reconcileStack,
  type RebuildStackInput,
  type RebuildStackResult,
  type ReconcileStackInput,
} from './reconcile.js';

export type IndexerCommandRequest =
  | Readonly<{ command: 'rebuild'; input: RebuildStackInput }>
  | Readonly<{ command: 'reconcile'; input: ReconcileStackInput }>;

export type IndexerCommandResult = RebuildStackResult | Awaited<ReturnType<typeof reconcileStack>>;

/**
 * Injected operator command router. Runtime config, DB clients and chain readers
 * are resolved by the caller so this surface never invents network addresses,
 * economics, credentials or authority.
 */
export async function runIndexerCommand(request: IndexerCommandRequest): Promise<IndexerCommandResult> {
  switch (request.command) {
    case 'rebuild':
      return rebuildStack(request.input);
    case 'reconcile':
      return reconcileStack(request.input);
  }
}

export { rebuildStack, reconcileStack } from './reconcile.js';
export type {
  RebuildRange,
  RebuildStackInput,
  RebuildStackResult,
  ReconcileStackInput,
  ReconciliationChainReader,
} from './reconcile.js';
