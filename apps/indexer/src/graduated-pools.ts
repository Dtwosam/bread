type UnknownRow = Readonly<Record<string, unknown>>;

export type GraduatedPoolRegistryEntry = Readonly<{
  chainId: number;
  tokenAddress: string;
  curveAddress: string;
  poolAddress: string;
  feeTier: number;
  completion: Readonly<{
    blockNumber: bigint;
    transactionIndex: number;
    logIndex: number;
  }>;
}>;

export type GraduatedPoolRegistry = Readonly<{
  byToken: ReadonlyMap<string, GraduatedPoolRegistryEntry>;
  byPool: ReadonlyMap<string, GraduatedPoolRegistryEntry>;
}>;

function address(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(value) ||
    /^0x0{40}$/i.test(value)
  ) {
    throw new Error(`invalid graduated V3 registry ${label}`);
  }
  return value.toLowerCase();
}

function safeInteger(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`invalid graduated V3 registry ${label}`);
  }
  return value;
}

function blockNumber(value: unknown): bigint {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new Error("invalid graduated V3 registry completion block");
}

function feeTier(value: unknown): number {
  const fee = safeInteger(value, "fee tier");
  if (fee > 0xffffff) throw new Error("invalid graduated V3 registry fee tier");
  return fee;
}

function entryFromRow(row: UnknownRow): GraduatedPoolRegistryEntry {
  if (row.graduatedVenueKind !== "UNISWAP_V3") {
    throw new Error("invalid graduated V3 registry venue kind");
  }

  return {
    chainId: safeInteger(row.chainId, "chain id"),
    tokenAddress: address(row.tokenAddress, "token address"),
    curveAddress: address(row.curveAddress, "curve address"),
    poolAddress: address(row.graduatedVenueAddress, "pool address"),
    feeTier: feeTier(row.graduatedVenueFeeTier),
    completion: {
      blockNumber: blockNumber(row.graduationCompletedBlock),
      transactionIndex: safeInteger(
        row.graduationCompletedTransactionIndex,
        "completion transaction index",
      ),
      logIndex: safeInteger(
        row.graduationCompletedLogIndex,
        "completion log index",
      ),
    },
  };
}

function sameEntry(
  left: GraduatedPoolRegistryEntry,
  right: GraduatedPoolRegistryEntry,
): boolean {
  return (
    left.chainId === right.chainId &&
    left.tokenAddress === right.tokenAddress &&
    left.curveAddress === right.curveAddress &&
    left.poolAddress === right.poolAddress &&
    left.feeTier === right.feeTier &&
    left.completion.blockNumber === right.completion.blockNumber &&
    left.completion.transactionIndex === right.completion.transactionIndex &&
    left.completion.logIndex === right.completion.logIndex
  );
}

function conflict(): never {
  throw new Error("conflicting graduated V3 registry identity");
}

export function buildGraduatedPoolRegistry(
  rows: readonly UnknownRow[],
): GraduatedPoolRegistry {
  const byToken = new Map<string, GraduatedPoolRegistryEntry>();
  const byPool = new Map<string, GraduatedPoolRegistryEntry>();

  for (const row of rows) {
    const entry = entryFromRow(row);
    const existingToken = byToken.get(entry.tokenAddress);
    const existingPool = byPool.get(entry.poolAddress);

    if (existingToken && !sameEntry(existingToken, entry)) conflict();
    if (existingPool && !sameEntry(existingPool, entry)) conflict();

    if (!existingToken) byToken.set(entry.tokenAddress, entry);
    if (!existingPool) byPool.set(entry.poolAddress, entry);
  }

  return { byToken, byPool };
}
