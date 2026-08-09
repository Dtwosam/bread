import { and, asc, desc, eq, gt, isNotNull, lt, or } from 'drizzle-orm';

import type { BreadDb } from '../client.js';
import { indexerCheckpoints, launches } from '../schema/projections.js';

export type NewLaunchCursorKey = Readonly<{
  launchBlockNumber: string;
  launchTimestamp: string;
  launchLogIndex: number;
  tokenAddress: string;
}>;

export function decimalIntegerToBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('unsafe numeric integer cannot be converted losslessly');
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new Error(`invalid lossless integer: ${value}`);
  return BigInt(value);
}

function optionalBigInt(value: string | number | bigint | null): bigint | null {
  return value === null ? null : decimalIntegerToBigInt(value);
}

function normalizeLaunchRow(row: typeof launches.$inferSelect) {
  return {
    ...row,
    creatorTaxBps: optionalBigInt(row.creatorTaxBps),
    configVersion: optionalBigInt(row.configVersion),
    launchTimestamp: optionalBigInt(row.launchTimestamp),
    initialSupply: optionalBigInt(row.initialSupply),
    phantomQuote: optionalBigInt(row.phantomQuote),
    graduationThreshold: optionalBigInt(row.graduationThreshold),
    tradeFeeBps: optionalBigInt(row.tradeFeeBps),
    protocolFeeShareBps: optionalBigInt(row.protocolFeeShareBps),
    maxCreatorTaxBps: optionalBigInt(row.maxCreatorTaxBps),
    reservedTokensBaseline: optionalBigInt(row.reservedTokensBaseline),
    launchBlockNumber: decimalIntegerToBigInt(row.launchBlockNumber),
  } as const;
}

export class ReadRepository {
  constructor(private readonly db: BreadDb) {}

  async getCheckpoint(chainId: number, stackVersion: string, factoryAddress: string) {
    const [row] = await this.db
      .select()
      .from(indexerCheckpoints)
      .where(
        and(
          eq(indexerCheckpoints.chainId, chainId),
          eq(indexerCheckpoints.stackVersion, stackVersion),
          eq(indexerCheckpoints.factoryAddress, factoryAddress.toLowerCase()),
        ),
      )
      .limit(1);
    if (!row) return undefined;
    return {
      chainId: row.chainId,
      stackVersion: row.stackVersion,
      factoryAddress: row.factoryAddress,
      deploymentStartBlock: decimalIntegerToBigInt(row.deploymentStartBlock),
      indexedThroughBlock: decimalIntegerToBigInt(row.indexedThroughBlock),
      indexedThroughBlockHash: row.indexedThroughBlockHash,
      indexedThroughBlockTimestamp:
        row.indexedThroughBlockTimestamp === null
          ? null
          : decimalIntegerToBigInt(row.indexedThroughBlockTimestamp),
      lastTransactionHash: row.lastTransactionHash,
      lastLogIndex: row.lastLogIndex,
      decoderSchemaVersion: row.decoderSchemaVersion,
      status: row.status,
      appliedAt: row.appliedAt,
      updatedAt: row.updatedAt,
    } as const;
  }

  async getLaunch(chainId: number, tokenAddress: string) {
    const [row] = await this.db
      .select()
      .from(launches)
      .where(and(eq(launches.chainId, chainId), eq(launches.tokenAddress, tokenAddress.toLowerCase())))
      .limit(1);
    return row ? normalizeLaunchRow(row) : undefined;
  }

  async listLaunchIdentities(chainId: number, stackVersion: string, factoryAddress: string) {
    return this.db
      .select({ tokenAddress: launches.tokenAddress, curveAddress: launches.curveAddress })
      .from(launches)
      .where(
        and(
          eq(launches.chainId, chainId),
          eq(launches.stackVersion, stackVersion),
          eq(launches.factoryAddress, factoryAddress.toLowerCase()),
        ),
      )
      .orderBy(asc(launches.tokenAddress));
  }

  async listNewLaunches(
    chainId: number,
    stackVersion: string,
    factoryAddress: string,
    limit: number,
    cursor?: NewLaunchCursorKey,
  ) {
    const boundedLimit = Math.max(1, Math.min(101, Math.trunc(limit)));
    const cursorPredicate = cursor
      ? or(
          lt(launches.launchBlockNumber, cursor.launchBlockNumber),
          and(
            eq(launches.launchBlockNumber, cursor.launchBlockNumber),
            lt(launches.launchTimestamp, cursor.launchTimestamp),
          ),
          and(
            eq(launches.launchBlockNumber, cursor.launchBlockNumber),
            eq(launches.launchTimestamp, cursor.launchTimestamp),
            lt(launches.launchLogIndex, cursor.launchLogIndex),
          ),
          and(
            eq(launches.launchBlockNumber, cursor.launchBlockNumber),
            eq(launches.launchTimestamp, cursor.launchTimestamp),
            eq(launches.launchLogIndex, cursor.launchLogIndex),
            gt(launches.tokenAddress, cursor.tokenAddress.toLowerCase()),
          ),
        )
      : undefined;

    const rows = await this.db
      .select()
      .from(launches)
      .where(
        and(
          eq(launches.chainId, chainId),
          eq(launches.stackVersion, stackVersion),
          eq(launches.factoryAddress, factoryAddress.toLowerCase()),
          isNotNull(launches.launchTimestamp),
          isNotNull(launches.initialSupply),
          cursorPredicate,
        ),
      )
      .orderBy(
        desc(launches.launchBlockNumber),
        desc(launches.launchTimestamp),
        desc(launches.launchLogIndex),
        asc(launches.tokenAddress),
      )
      .limit(boundedLimit);
    return rows.map(normalizeLaunchRow);
  }
}
