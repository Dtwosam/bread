import arcTestnetDeployment from '../../../../config/deployments/arc-testnet.day5.json';
import arcTestnetManifest from '../../../../config/networks/arc-testnet.json';

export const ARC_TESTNET_CHAIN_ID = arcTestnetManifest.chainId;
export const ARC_TESTNET_CHAIN_ID_HEX = `0x${arcTestnetManifest.chainId.toString(16)}`;
export const ARC_TESTNET_RPC = `${arcTestnetManifest.rpc[0].replace(/\/+$/, '')}/`;
export const ARC_TESTNET_USDC = arcTestnetManifest.usdc.address as `0x${string}`;

export const CANONICAL_FACTORY = arcTestnetDeployment.core.factory as `0x${string}`;
export const CANONICAL_COORDINATOR = arcTestnetDeployment.core.coordinator as `0x${string}`;
export const CANONICAL_GRADUATION_ADAPTER = arcTestnetDeployment.adapter.adapter as `0x${string}`;
export const CANONICAL_GRADUATION_CONFIG_HASH = arcTestnetDeployment.adapter.configHash as `0x${string}`;
export const V3_FACTORY = arcTestnetManifest.dex.factory as `0x${string}`;
export const V3_POSITION_MANAGER = arcTestnetManifest.dex.positionManager as `0x${string}`;
export const V3_ROUTER = arcTestnetManifest.dex.swapRouter as `0x${string}`;
export const V3_QUOTER = arcTestnetManifest.dex.quoter as `0x${string}`;
export const E2E_V3_POOL = '0x4000000000000000000000000000000000000001' as const;

export const E2E_WALLET = '0x5000000000000000000000000000000000000001' as const;
export const E2E_SECOND_WALLET = '0x5000000000000000000000000000000000000002' as const;

export const E2E_FACTORY = '0x1000000000000000000000000000000000000001' as const;
export const E2E_DEPLOYER = '0x1000000000000000000000000000000000000002' as const;
export const E2E_FEE_POLICY = '0x1000000000000000000000000000000000000003' as const;
export const E2E_FEE_ESCROW = '0x1000000000000000000000000000000000000004' as const;
export const E2E_EMERGENCY_CONTROLLER = '0x1000000000000000000000000000000000000005' as const;
export const E2E_LOCKER = '0x1000000000000000000000000000000000000006' as const;
export const E2E_COORDINATOR = '0x1000000000000000000000000000000000000007' as const;
export const E2E_GRADUATION_ADAPTER = '0x1000000000000000000000000000000000000008' as const;

export const ACTIVE_TOKEN = '0x2000000000000000000000000000000000000001' as const;
export const PENDING_TOKEN = '0x2000000000000000000000000000000000000002' as const;
export const GRADUATED_TOKEN = '0x2000000000000000000000000000000000000003' as const;
export const NEW_LAUNCH_TOKEN = '0x2000000000000000000000000000000000000004' as const;

export const ACTIVE_CURVE = '0x3000000000000000000000000000000000000001' as const;
export const PENDING_CURVE = '0x3000000000000000000000000000000000000002' as const;
export const GRADUATED_CURVE = '0x3000000000000000000000000000000000000003' as const;
export const NEW_LAUNCH_CURVE = '0x3000000000000000000000000000000000000004' as const;

export const BLOCK_HASH = `0x${'ab'.repeat(32)}` as `0x${string}`;
export const LAUNCH_TX_HASH = `0x${'11'.repeat(32)}` as `0x${string}`;
export const BUY_TX_HASH = `0x${'22'.repeat(32)}` as `0x${string}`;
export const SELL_TX_HASH = `0x${'33'.repeat(32)}` as `0x${string}`;
export const CLAIM_TX_HASH = `0x${'44'.repeat(32)}` as `0x${string}`;
export const APPROVAL_TX_HASH = `0x${'55'.repeat(32)}` as `0x${string}`;

export const FIXTURE_BLOCK_NUMBER = BigInt(1_000);
export const FIXTURE_BLOCK_NUMBER_HEX = '0x3e8';
export const FIXTURE_TIMESTAMP = '2026-08-10T15:00:00.000Z';
