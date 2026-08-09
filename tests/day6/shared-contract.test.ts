import { describe, expect, it } from 'vitest';

const TX_HASH = `0x${'ab'.repeat(32)}` as const;
const TESTNET_USDC = '0x3600000000000000000000000000000000000000' as const;

describe('Day 6 canonical shared contract RED', () => {
  it('builds a stable canonical event id from chain/log identity', async () => {
    const types = await import('../../packages/types/src/index.ts');
    expect(types).toHaveProperty('canonicalEventId');
    const canonicalEventId = (types as Record<string, unknown>).canonicalEventId as
      | ((input: { chainId: number; transactionHash: string; logIndex: number }) => string)
      | undefined;
    expect(canonicalEventId).toBeTypeOf('function');
    expect(canonicalEventId?.({ chainId: 5042002, transactionHash: TX_HASH, logIndex: 7 })).toBe(
      `5042002:${TX_HASH}:7`,
    );
  });

  it('rejects an unresolved deployment instead of guessing a protocol context', async () => {
    const config = await import('../../packages/config/src/index.ts');
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(config).toHaveProperty('parseNetworkManifest');
    expect(config).toHaveProperty('parseProtocolDeploymentManifest');
    expect(sdk).toHaveProperty('resolveProtocolContext');

    const parseNetworkManifest = (config as Record<string, unknown>).parseNetworkManifest as
      | ((input: unknown) => unknown)
      | undefined;
    const parseProtocolDeploymentManifest = (config as Record<string, unknown>)
      .parseProtocolDeploymentManifest as ((input: unknown) => unknown) | undefined;
    const resolveProtocolContext = (sdk as Record<string, unknown>).resolveProtocolContext as
      | ((input: { network: unknown; deployment: unknown; stackVersion: string }) => unknown)
      | undefined;

    expect(parseNetworkManifest).toBeTypeOf('function');
    expect(parseProtocolDeploymentManifest).toBeTypeOf('function');
    expect(resolveProtocolContext).toBeTypeOf('function');

    const network = parseNetworkManifest?.({
      schemaVersion: 1,
      network: 'arc-testnet',
      chainId: 5042002,
      nativeGasAsset: 'USDC',
      nativePrecision: 18,
      rpc: ['https://rpc.testnet.arc.io'],
      websocket: ['wss://rpc.testnet.arc.io'],
      explorer: 'https://testnet.arcscan.app',
      usdc: { address: TESTNET_USDC, decimals: 6, role: 'bread-financial-quote-asset' },
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      create2Factory: '0x4e59b44847b379578588920cA78FbF26c0B4956C',
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
      dex: { type: 'UNRESOLVED_TESTNET_ADAPTER', poolManager: null, positionManager: null, factory: null },
      deploymentStartBlock: null,
      status: 'bootstrap-ready',
    });

    const deployment = parseProtocolDeploymentManifest?.({
      schema: 'bread://schemas/day5-graduation-deployment-v1',
      network: 'arc-testnet',
      status: 'BLOCKED_UNTIL_VERIFIED_DEX_AND_PRODUCTION_CONFIG',
      chainId: 5042002,
      core: {
        factory: null,
        deployer: null,
        feePolicy: null,
        feeEscrow: null,
        emergencyController: null,
        locker: null,
        coordinator: null,
      },
      adapter: {
        active: false,
        family: null,
        adapter: null,
        positionManager: null,
        poolManager: null,
        v3Factory: null,
        configHash: null,
      },
      authorities: { protocolAdmin: null, guardian: null },
      economicsConfigHash: null,
      dexEvidenceHash: null,
      deploymentStartBlock: null,
    });

    expect(() => resolveProtocolContext?.({ network, deployment, stackVersion: 'bread-v1' })).toThrow(
      /unresolved/i,
    );
  });

  it('classifies canonical, known-ignored and unknown event names without guessing', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('classifyBreadLog');
    const classifyBreadLog = (sdk as Record<string, unknown>).classifyBreadLog as
      | ((role: string, eventName: string) => string)
      | undefined;
    expect(classifyBreadLog).toBeTypeOf('function');
    expect(classifyBreadLog?.('LAUNCH_TOKEN', 'Transfer')).toBe('INDEXED_CANONICAL');
    expect(classifyBreadLog?.('LAUNCH_TOKEN', 'Approval')).toBe('KNOWN_IGNORED');
    expect(classifyBreadLog?.('LAUNCH_TOKEN', 'MadeUpEvent')).toBe('UNKNOWN');
  });

  it('exports a generated ABI registry with the accepted core roles', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('breadAbiRegistry');
    const registry = (sdk as Record<string, unknown>).breadAbiRegistry as
      | Record<string, readonly unknown[]>
      | undefined;
    expect(registry).toBeDefined();
    for (const role of ['factory', 'curve', 'feeEscrow', 'feePolicy', 'emergencyController', 'coordinator', 'locker', 'launchToken']) {
      expect(registry?.[role]?.length, role).toBeGreaterThan(0);
    }
  });
});
