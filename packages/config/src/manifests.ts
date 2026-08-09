import { z } from 'zod';

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const nullableAddressSchema = addressSchema.nullable();

const dexSchema = z
  .object({
    type: z.string().min(1),
    poolManager: nullableAddressSchema,
    positionManager: nullableAddressSchema,
    factory: nullableAddressSchema,
  })
  .strict();

const usdcSchema = z
  .object({
    address: nullableAddressSchema,
    decimals: z.number().int().nonnegative().nullable().optional(),
    role: z.string().min(1).optional(),
  })
  .strict();

export const networkManifestSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    network: z.string().min(1),
    chainId: z.number().int().positive().nullable(),
    nativeGasAsset: z.string().min(1),
    nativePrecision: z.number().int().nonnegative(),
    rpc: z.array(z.string().url()),
    websocket: z.array(z.string().url()),
    explorer: z.string().url().nullable().optional(),
    usdc: usdcSchema,
    permit2: nullableAddressSchema.optional(),
    create2Factory: nullableAddressSchema.optional(),
    multicall3: nullableAddressSchema.optional(),
    dex: dexSchema,
    deploymentStartBlock: z.number().int().nonnegative().nullable(),
    status: z.string().min(1),
  })
  .strict();

const deploymentCoreSchema = z
  .object({
    factory: nullableAddressSchema,
    deployer: nullableAddressSchema,
    feePolicy: nullableAddressSchema,
    feeEscrow: nullableAddressSchema,
    emergencyController: nullableAddressSchema,
    locker: nullableAddressSchema,
    coordinator: nullableAddressSchema,
  })
  .strict();

const adapterSchema = z
  .object({
    active: z.boolean(),
    family: z.string().nullable(),
    adapter: nullableAddressSchema,
    positionManager: nullableAddressSchema,
    poolManager: nullableAddressSchema,
    v3Factory: nullableAddressSchema,
    configHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).nullable(),
  })
  .strict();

export const protocolDeploymentManifestSchema = z
  .object({
    schema: z.literal('bread://schemas/day5-graduation-deployment-v1'),
    network: z.string().min(1),
    status: z.string().min(1),
    chainId: z.number().int().positive().nullable(),
    core: deploymentCoreSchema,
    adapter: adapterSchema,
    authorities: z
      .object({
        protocolAdmin: nullableAddressSchema,
        guardian: nullableAddressSchema,
      })
      .strict(),
    economicsConfigHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).nullable(),
    dexEvidenceHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).nullable(),
    deploymentStartBlock: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type NetworkManifest = z.infer<typeof networkManifestSchema>;
export type ProtocolDeploymentManifest = z.infer<typeof protocolDeploymentManifestSchema>;

export function parseNetworkManifest(input: unknown): NetworkManifest {
  const manifest = networkManifestSchema.parse(input);
  if (manifest.chainId !== null && manifest.usdc.address !== null && manifest.usdc.decimals !== 6) {
    throw new Error('Bread quote USDC must use 6 decimals');
  }
  return manifest;
}

export function parseProtocolDeploymentManifest(input: unknown): ProtocolDeploymentManifest {
  return protocolDeploymentManifestSchema.parse(input);
}
