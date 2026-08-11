import { createRequire } from 'node:module';

import { createBreadDb, migrateBreadDb, ReadRepository } from '../../../../packages/db/src/index.js';
import { applyRange } from '../apply-range.js';
import { runIndexerCatchUp, type IndexerCheckpoint } from '../catch-up.js';
import { discoverRange } from '../discovery.js';
import {
  createArcProviderSafeReadClient,
  createArcReadClient,
  observeHeadBlock,
} from './chain-client.js';
import { resolveBreadRuntimeContext, resolveRuntimeInfrastructure } from './runtime-context.js';

const requireFromDb = createRequire(new URL('../../../../packages/db/package.json', import.meta.url));
const { Pool } = requireFromDb('pg') as {
  Pool: new (config: Record<string, unknown>) => {
    query: (text: string) => Promise<unknown>;
    end: () => Promise<void>;
  };
};

const DEFAULT_OVERLAP_BLOCKS = 12n;
const DEFAULT_MAX_BATCH_BLOCKS = 500n;

function positiveBigintFromEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = BigInt(raw);
  if (parsed <= 0n) throw new Error(`${name} must be positive`);
  return parsed;
}

/**
 * Real Bread indexer process for the operator LAN acceptance environment.
 *
 * This is a composition shell around the existing replay/apply machinery:
 * `discoverRange` for bounded two-pass log discovery, `applyRange` for
 * normalization plus the transactional idempotent projection write, and
 * `runIndexerCatchUp` for checkpoint/block-hash continuity and bounded replay
 * overlap. No indexing model, reducer or checkpoint rule is reimplemented.
 *
 * Chain remains the financial source of truth; the projection is derived.
 */
export async function runBreadIndexerCatchUp() {
  const { network, context } = resolveBreadRuntimeContext();
  const infrastructure = resolveRuntimeInfrastructure(process.env, network);

  const pool = new Pool({ connectionString: infrastructure.databaseUrl });
  await pool.query('SELECT 1');
  await migrateBreadDb(pool as never);
  const db = createBreadDb(pool);
  const repository = new ReadRepository(db);
  const rawClient = createArcReadClient(network);
  const client = createArcProviderSafeReadClient(rawClient);

  const readCommittedCheckpoint = async (): Promise<IndexerCheckpoint> => {
    const committed = await repository.getCheckpoint(
      context.chainId,
      context.stackVersion,
      context.factoryAddress,
    );
    if (committed) {
      return {
        blockNumber: BigInt(committed.indexedThroughBlock),
        blockHash: committed.indexedThroughBlockHash,
      };
    }
    // Genesis for this stack is the verified deployment start block, which is
    // also the replay lower bound the canonical machinery enforces. Bounded
    // overlap clamps to that same block, so seeding here still replays the
    // deployment block itself rather than skipping its logs.
    const seedBlock = context.deploymentStartBlock;
    const seed = await client.getBlock({ blockNumber: seedBlock });
    return { blockNumber: seedBlock, blockHash: seed.hash as string };
  };

  const getBlockHash = async (blockNumber: bigint): Promise<string> => {
    const block = await client.getBlock({ blockNumber });
    return block.hash as string;
  };

  const knownLaunchAddresses = async () => {
    const launches = await repository.listLaunchIdentities(
      context.chainId,
      context.stackVersion,
      context.factoryAddress,
    );
    return launches.flatMap((launch) => [launch.tokenAddress, launch.curveAddress]);
  };

  const initialCheckpoint = await readCommittedCheckpoint();

  const result = await runIndexerCatchUp({
    context,
    initialCheckpoint,
    observeHeadBlock: observeHeadBlock(client),
    readCommittedCheckpoint,
    getBlockHash,
    overlapBlocks: positiveBigintFromEnv('BREAD_INDEXER_OVERLAP_BLOCKS', DEFAULT_OVERLAP_BLOCKS),
    maxBatchBlocks: positiveBigintFromEnv('BREAD_INDEXER_MAX_BATCH_BLOCKS', DEFAULT_MAX_BATCH_BLOCKS),
    maxCycles: Number.parseInt(process.env.BREAD_INDEXER_MAX_CYCLES?.trim() || '10000', 10),
    loadRange: async (fromBlock: bigint, toBlock: bigint) => {
      const logs = await discoverRange(
        client as never,
        context,
        (await knownLaunchAddresses()) as never,
        fromBlock,
        toBlock,
      );
      const toBlockDetail = await client.getBlock({ blockNumber: toBlock });
      return {
        fromBlock,
        toBlock,
        toBlockHash: toBlockDetail.hash as string,
        toBlockTimestamp: toBlockDetail.timestamp,
        logs,
      };
    },
    applyRange: async (range) =>
      applyRange({
        db,
        client: client as never,
        context,
        fromBlock: range.fromBlock as bigint,
        toBlock: range.toBlock as bigint,
        toBlockHash: range.toBlockHash as `0x${string}`,
        toBlockTimestamp: range.toBlockTimestamp as bigint | undefined,
        logs: range.logs as never,
      }),
  });

  await pool.end().catch(() => undefined);
  return result;
}

if (process.env.BREAD_LAN_INDEXER_MAIN === '1') {
  runBreadIndexerCatchUp()
    .then((result) => {
      process.stdout.write(
        `BREAD_INDEXER_CAUGHT_UP checkpoint=${result.checkpoint.blockNumber} head=${result.observedHeadBlock} cycles=${result.cycles}\n`,
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `BREAD_INDEXER_FAILED ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
