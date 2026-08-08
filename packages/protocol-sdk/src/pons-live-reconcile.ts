import {
  createPublicClient,
  http,
  keccak256,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';

export const PONS_V2_REFERENCE_COMMIT =
  'd5491e20be56051a68abf47136f6890c3ce3ff7d' as const;
export const PONS_V2_CURRENT_DOCS_FACTORY =
  '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' as const satisfies Address;
export const PONS_V2_CURRENT_DOCS_CHAIN_ID = 4663 as const;

const factoryAbi = parseAbi([
  'function launchFee() view returns (uint256)',
  'function launchEnabled() view returns (bool)',
  'function maxCreatorTaxBps() view returns (uint256)',
  'function launchConfigCount() view returns (uint256)',
  'function getLaunchConfig(uint256 id) view returns ((uint256 supply, uint256 curveFeeBps, uint256 phantomQuote, uint256 graduationThreshold, uint24 poolFee, int24 tickSpacing, bool enabled))',
  'function approvedPairTokens(address pairToken) view returns (bool)',
  'function pairTokenEconomics(address pairToken) view returns (uint256 phantomQuote, uint256 graduationThreshold, uint8 decimals)',
  'function memeHook() view returns (address)',
  'function feeEscrow() view returns (address)',
  'function buybackVault() view returns (address)',
  'function locker() view returns (address)',
  'function graduationExecutor() view returns (address)',
  'function launchDeployer() view returns (address)',
  'function graduationGuard() view returns (address)',
]);

const feePolicyAbi = parseAbi([
  'function currentFeePolicy() view returns ((address protocolFeeRecipient, uint16 protocolFeeShareBps, uint16 buybackBurnBps, uint16 hookFeeBps, uint16 maxInternalPriceImpactBps))',
]);

type Observation =
  | { status: 'OK'; value: unknown }
  | { status: 'UNREADABLE'; error: string };

export type PonsLiveReconciliationOptions = {
  rpcUrl: string;
  factoryAddress?: Address;
  pairTokens?: readonly Address[];
  maxLaunchConfigs?: number;
};

export type PonsLiveReconciliationReport = {
  schemaVersion: 1;
  mode: 'READ_ONLY';
  referenceCommit: typeof PONS_V2_REFERENCE_COMMIT;
  expectedChainId: typeof PONS_V2_CURRENT_DOCS_CHAIN_ID;
  actualChainId: number;
  factoryAddress: Address;
  runtimeCode: Observation;
  factory: Record<string, Observation>;
  launchConfigs: Observation[];
  pairTokens: Record<string, Record<string, Observation>>;
  feePolicy: Observation;
  warnings: string[];
};

function normalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function reconcilePonsLiveConfig(
  options: PonsLiveReconciliationOptions,
): Promise<PonsLiveReconciliationReport> {
  if (!options.rpcUrl.trim()) throw new Error('rpcUrl is required');

  const factoryAddress = options.factoryAddress ?? PONS_V2_CURRENT_DOCS_FACTORY;
  const maxLaunchConfigs = Math.max(0, Math.min(options.maxLaunchConfigs ?? 64, 256));
  const client = createPublicClient({ transport: http(options.rpcUrl) });
  const actualChainId = await client.getChainId();
  if (actualChainId !== PONS_V2_CURRENT_DOCS_CHAIN_ID) {
    throw new Error(
      `Pons V2 reconciliation requires chain ${PONS_V2_CURRENT_DOCS_CHAIN_ID}; RPC reported ${actualChainId}`,
    );
  }

  const factory: Record<string, Observation> = {};
  const launchConfigs: Observation[] = [];
  const pairTokens: Record<string, Record<string, Observation>> = {};
  const warnings = [
    'This report is observational only and does not prove current-live source parity.',
    'Unreadable values and source/deployment mismatches must remain explicit.',
  ];

  const observe = async (read: () => Promise<unknown>): Promise<Observation> => {
    try {
      return { status: 'OK', value: normalize(await read()) };
    } catch (error) {
      return { status: 'UNREADABLE', error: errorMessage(error) };
    }
  };

  const bytecodeObservation = await observe(async () => {
    const bytecode = await client.getBytecode({ address: factoryAddress });
    if (!bytecode || bytecode === '0x') throw new Error('factory has no runtime bytecode');
    return {
      byteLength: (bytecode.length - 2) / 2,
      keccak256: keccak256(bytecode as Hex),
    };
  });

  for (const functionName of [
    'launchFee',
    'launchEnabled',
    'maxCreatorTaxBps',
    'memeHook',
    'feeEscrow',
    'buybackVault',
    'locker',
    'graduationExecutor',
    'launchDeployer',
    'graduationGuard',
  ] as const) {
    factory[functionName] = await observe(() =>
      client.readContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName,
      }),
    );
  }

  let launchConfigCount: bigint | undefined;
  try {
    launchConfigCount = await client.readContract({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: 'launchConfigCount',
    });
    factory.launchConfigCount = {
      status: 'OK',
      value: launchConfigCount.toString(),
    };
  } catch (error) {
    factory.launchConfigCount = {
      status: 'UNREADABLE',
      error: errorMessage(error),
    };
  }

  if (launchConfigCount !== undefined) {
    const readableCount = Number(
      launchConfigCount > BigInt(maxLaunchConfigs)
        ? BigInt(maxLaunchConfigs)
        : launchConfigCount,
    );
    if (launchConfigCount > BigInt(maxLaunchConfigs)) {
      warnings.push(
        `launch config enumeration truncated at ${maxLaunchConfigs} of ${launchConfigCount.toString()}`,
      );
    }
    for (let id = 0; id < readableCount; id += 1) {
      launchConfigs.push(
        await observe(() =>
          client.readContract({
            address: factoryAddress,
            abi: factoryAbi,
            functionName: 'getLaunchConfig',
            args: [BigInt(id)],
          }),
        ),
      );
    }
  }

  for (const pairToken of options.pairTokens ?? []) {
    pairTokens[pairToken] = {
      approvedPairTokens: await observe(() =>
        client.readContract({
          address: factoryAddress,
          abi: factoryAbi,
          functionName: 'approvedPairTokens',
          args: [pairToken],
        }),
      ),
      pairTokenEconomics: await observe(() =>
        client.readContract({
          address: factoryAddress,
          abi: factoryAbi,
          functionName: 'pairTokenEconomics',
          args: [pairToken],
        }),
      ),
    };
  }

  let feePolicy: Observation = {
    status: 'UNREADABLE',
    error: 'memeHook address unavailable',
  };
  const memeHookObservation = factory.memeHook;
  if (
    memeHookObservation?.status === 'OK' &&
    typeof memeHookObservation.value === 'string'
  ) {
    feePolicy = await observe(() =>
      client.readContract({
        address: memeHookObservation.value as Address,
        abi: feePolicyAbi,
        functionName: 'currentFeePolicy',
      }),
    );
  }

  return {
    schemaVersion: 1,
    mode: 'READ_ONLY',
    referenceCommit: PONS_V2_REFERENCE_COMMIT,
    expectedChainId: PONS_V2_CURRENT_DOCS_CHAIN_ID,
    actualChainId,
    factoryAddress,
    runtimeCode: bytecodeObservation,
    factory,
    launchConfigs,
    pairTokens,
    feePolicy,
    warnings,
  };
}
