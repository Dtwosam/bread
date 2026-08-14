import { parseAbi, parseAbiItem } from "viem";

export const graduatedV3AdapterAbi = parseAbi([
  "function family() view returns (uint8)",
  "function coordinator() view returns (address)",
  "function configHash() view returns (bytes32)",
  "function usdc() view returns (address)",
  "function positionManager() view returns (address)",
  "function v3Factory() view returns (address)",
  "function fee() view returns (uint24)",
]);

export const v3FactoryAbi = parseAbi([
  "function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)",
]);

export const v3FactoryBoundDependencyAbi = parseAbi([
  "function factory() view returns (address)",
]);

export const v3PoolAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
]);

export const v3SwapEvent = parseAbiItem(
  "event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)",
);
