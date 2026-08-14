import { getAddress } from "viem";

import type { Address } from "../../types/src/index.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function poolAddressFromId(value: unknown): Address {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("invalid canonical graduated pool id");
  }

  const encodedPrefix = value.slice(2, 26);
  if (!/^0{24}$/.test(encodedPrefix)) {
    throw new Error("invalid canonical graduated pool id");
  }

  const pool = `0x${value.slice(-40)}`;
  if (pool.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("invalid canonical graduated pool id");
  }

  return getAddress(pool).toLowerCase() as Address;
}
