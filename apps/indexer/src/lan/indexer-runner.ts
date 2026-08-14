import { createRequire } from 'node:module';

import { createBreadDb, migrateBreadDb, ReadRepository } from '../../../../packages/db/src/index.js';
import {
  BREAD_PROJECTION_CACHE_SCHEMA_VERSION,
  projectionCacheGenerationKey,
} from '../../../../packages/types/src/index.js';
import { applyRange } from '../apply-range.js';
import { runIndexerCatchUp, type IndexerCheckpoint } from '../catch-up.js';
import { discoverRange } from '../discovery.js';
import {
  PostCommitDegradedError,
  PostCommitPublisher,
} from '../post-commit.js';
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
const requireFromIndexer = createRequire(new URL('../../package.json', import.meta.url));

type RuntimeRedisClient = Readonly<{
  isReady: boolean;
  on: (event: 'error', listener: (error: unknown) => void) => unknown;
  connect: () => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  destroy: () => void;
}>;

const { createClient } = requireFromIndexer('redis') as {
  createClient: (input: Readonly<{ url: string }>) => RuntimeRedisClient;
};

const DEFAULT_OVERLAP_BLOCKS = 12n;
const DEFAULT_MAX_BATCH_BLOCKS = 500n;
const DEFAULT_CONTINUOUS_INTERVAL_MS = 10_000;
const MAX_PROJECTION_CACHE_INVALIDATION_BATCH = 128;

type ProjectionCacheInvalidationRedis = Readonly<{
  incr: (key: string) => Promise<number>;
}>;

type ProjectionCachePostCommitResult = Readonly<{
  insertedEventIds?: readonly string[];
  projectionCacheChannels?: readonly string[];
  checkpoint?: Readonly<{ blockNumber: bigint; blockHash: string }>;
  [key: string]: unknown;
}>;

export type ProjectionCacheInvalidationResult = Readonly<{
  status: 'PUBLISHED' | 'DEGRADED';
  invalidatedChannels: readonly string[];
  failedChannels: readonly string[];
}>;

type ProjectionCacheInvalidationInput =
  | Readonly<{
      redis: ProjectionCacheInvalidationRedis;
      schemaVersion: string;
      channels: readonly string[];
    }>
  | Readonly<{
      publisher: Pick<PostCommitPublisher, 'publish'>;
      insertedEventIds: readonly string[];
      channels: readonly string[];
      checkpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
    }>;

function uniqueSortedChannels(channels: readonly string[]): readonly string[] {
  return [...new Set(channels)].sort();
}

export async function publishProjectionCacheInvalidations(
  input: ProjectionCacheInvalidationInput,
): Promise<ProjectionCacheInvalidationResult> {
  const channels = uniqueSortedChannels(input.channels);
  const invalidatedChannels: string[] = [];
  const failedChannels: string[] = [];

  for (
    let offset = 0;
    offset < channels.length;
    offset += MAX_PROJECTION_CACHE_INVALIDATION_BATCH
  ) {
    const batch = channels.slice(
      offset,
      offset + MAX_PROJECTION_CACHE_INVALIDATION_BATCH,
    );

    if ('publisher' in input) {
      try {
        await input.publisher.publish({
          insertedEventIds: input.insertedEventIds,
          channels: batch,
          checkpoint: input.checkpoint,
        });
        invalidatedChannels.push(...batch);
      } catch (error) {
        if (error instanceof PostCommitDegradedError) {
          const failed = new Set(error.failures.map((failure) => failure.channel));
          failedChannels.push(...batch.filter((channel) => failed.has(channel)));
          invalidatedChannels.push(...batch.filter((channel) => !failed.has(channel)));
        } else {
          failedChannels.push(...batch);
        }
      }
      continue;
    }

    const results = await Promise.all(
      batch.map(async (channel) => {
        try {
          await input.redis.incr(
            projectionCacheGenerationKey({
              schemaVersion: input.schemaVersion,
              channel,
            }),
          );
          return true;
        } catch {
          return false;
        }
      }),
    );

    for (let index = 0; index < batch.length; index += 1) {
      const channel = batch[index];
      if (channel === undefined) continue;
      if (results[index]) invalidatedChannels.push(channel);
      else failedChannels.push(channel);
    }
  }

  return {
    status: failedChannels.length === 0 ? 'PUBLISHED' : 'DEGRADED',
    invalidatedChannels,
    failedChannels,
  };
}

export function createProjectionCachePublishHook(input: Readonly<{
  redis: ProjectionCacheInvalidationRedis;
  schemaVersion: string;
}>) {
  const publisher = new PostCommitPublisher({
    invalidate: (channel) =>
      input.redis.incr(
        projectionCacheGenerationKey({
          schemaVersion: input.schemaVersion,
          channel,
        }),
      ),
    fanout: async () => undefined,
  });

  return async (result: ProjectionCachePostCommitResult): Promise<void> => {
    const channels = result.projectionCacheChannels ?? [];
    if (channels.length === 0) return;
    if (!result.checkpoint) {
      throw new Error('projection cache post-commit checkpoint is missing');
    }

    const publication = await publishProjectionCacheInvalidations({
      publisher,
      insertedEventIds: result.insertedEventIds ?? [],
      channels,
      checkpoint: result.checkpoint,
    });
    if (publication.status === 'DEGRADED') {
      throw new Error(
        `projection cache invalidation degraded across ${publication.failedChannels.length} channel(s)`,
      );
    }
  };
}

function positiveBigintFromEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = BigInt(raw);
  if (parsed <= 0n) throw new Error(`${name} must be positive`);
  return parsed;
}

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
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
  const redisClient = createClient({ url: infrastructure.redisUrl });
  redisClient.on('error', () => undefined);
  let redisConnectError: string | undefined;
  try {
    await redisClient.connect();
  } catch (error) {
    redisConnectError = error instanceof Error ? error.message : String(error);
  }

  const redisInvalidation: ProjectionCacheInvalidationRedis = {
    incr: async (key) => {
      if (redisConnectError || !redisClient.isReady) {
        throw new Error(
          redisConnectError
            ? `Redis unavailable: ${redisConnectError}`
            : 'Redis unavailable',
        );
      }
      return redisClient.incr(key);
    },
  };
  const publish = createProjectionCachePublishHook({
    redis: redisInvalidation,
    schemaVersion: BREAD_PROJECTION_CACHE_SCHEMA_VERSION,
  });

  try {
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

    return await runIndexerCatchUp({
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
      applyRange: async (range) => {
        const applied = await applyRange({
          db,
          client: client as never,
          context,
          fromBlock: range.fromBlock as bigint,
          toBlock: range.toBlock as bigint,
          toBlockHash: range.toBlockHash as `0x${string}`,
          toBlockTimestamp: range.toBlockTimestamp as bigint | undefined,
          logs: range.logs as never,
        });
        if (
          process.env.BREAD_LAN_INDEXER_MAIN === '1' ||
          process.env.BREAD_LAN_INDEXER_CONTINUOUS === '1'
        ) {
          process.stdout.write(`BREAD_INDEXER_PROGRESS checkpoint=${String(range.toBlock)}\n`);
        }
        return applied;
      },
      publish,
    });
  } finally {
    redisClient.destroy();
    await pool.end().catch(() => undefined);
  }
}

export async function runBreadIndexerContinuously() {
  const intervalMs = positiveIntegerFromEnv(
    'BREAD_LAN_INDEXER_CONTINUOUS_INTERVAL_MS',
    DEFAULT_CONTINUOUS_INTERVAL_MS,
  );

  while (true) {
    const result = await runBreadIndexerCatchUp();
    process.stdout.write(
      `BREAD_INDEXER_SYNCED checkpoint=${result.checkpoint.blockNumber} head=${result.observedHeadBlock} cycles=${result.cycles} degraded_post_commit_cycles=${result.degradedPostCommitCycles}\n`,
    );
    await new Promise((done) => setTimeout(done, intervalMs));
  }
}

if (process.env.BREAD_LAN_INDEXER_CONTINUOUS === '1') {
  runBreadIndexerContinuously().catch((error: unknown) => {
    process.stderr.write(
      `BREAD_INDEXER_FAILED ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
} else if (process.env.BREAD_LAN_INDEXER_MAIN === '1') {
  runBreadIndexerCatchUp()
    .then((result) => {
      process.stdout.write(
        `BREAD_INDEXER_CAUGHT_UP checkpoint=${result.checkpoint.blockNumber} head=${result.observedHeadBlock} cycles=${result.cycles} degraded_post_commit_cycles=${result.degradedPostCommitCycles}\n`,
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `BREAD_INDEXER_FAILED ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
