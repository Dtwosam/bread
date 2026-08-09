export const BREAD_CONFIG_PACKAGE = '@bread/config' as const;

export {
  networkManifestSchema,
  parseNetworkManifest,
  parseProtocolDeploymentManifest,
  protocolDeploymentManifestSchema,
  type NetworkManifest,
  type ProtocolDeploymentManifest,
} from './manifests.js';
