export const PROTOCOL_SDK_STATUS = 'day6-shared-contract' as const;

export {
  PONS_V2_CURRENT_DOCS_CHAIN_ID,
  PONS_V2_CURRENT_DOCS_FACTORY,
  PONS_V2_REFERENCE_COMMIT,
  reconcilePonsLiveConfig,
  type PonsLiveReconciliationOptions,
  type PonsLiveReconciliationReport,
} from './pons-live-reconcile.js';

export {
  resolveProtocolContext,
  type ProtocolAddresses,
  type ProtocolContext,
  type ResolveProtocolContextInput,
} from './context.js';

export {
  classifyBreadLog,
  createBreadStackAbiBinding,
  decodeBreadLog,
  isCanonicalBreadEventName,
  type BreadStackAbiBinding,
  type DecodedBreadLog,
} from './events.js';

export { breadAbiRegistry } from './abi/generated.js';
