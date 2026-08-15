import { createRequire } from 'node:module';

import { createBreadDb, migrateBreadDb } from '../../../../packages/db/src/index.js';
import {
  resolveBreadRuntimeContext,
  resolveRuntimeInfrastructure,
} from '../../../indexer/src/lan/runtime-context.js';
import { createArcReadClient, observeHeadBlock } from '../../../indexer/src/lan/chain-client.js';
import { createBreadApi } from '../server.js';

const requireFromDb = createRequire(new URL('../../../../packages/db/package.json', import.meta.url));
const requireFromApi = createRequire(import.meta.url);
const { Pool } = requireFromDb('pg') as {
  Pool: new (config: Record<string, unknown>) => {
    query: (text: string) => Promise<unknown>;
    end: () => Promise<void>;
  };
};

/**
 * Real Bread read-API process for the operator LAN acceptance environment.
 *
 * This is a composition shell only: it constructs the canonical dependencies
 * and hands them to the existing `createBreadApi()`. No route, freshness,
 * capacity, rate-limit or cache behaviour is reimplemented here, and the API
 * keeps indexed projections as its primary read source with no raw-RPC
 * fallback for user-facing reads.
 */
export async function startBreadApiProcess() {
  const { network, context } = resolveBreadRuntimeContext();
  const infrastructure = resolveRuntimeInfrastructure(process.env, network);

  const host = process.env.BREAD_API_HOST?.trim() || '127.0.0.1';
  const port = Number.parseInt(process.env.BREAD_API_PORT?.trim() || '4010', 10);
  if (!Number.isInteger(port) || port <= 0) throw new Error('BREAD_API_PORT must be a positive integer');

  // Loopback-only by default. The bounded proxy is the sole LAN listener.
  if (host !== '127.0.0.1' && process.env.BREAD_ALLOW_NON_LOOPBACK_API !== '1') {
    throw new Error('refusing to bind the Bread API to a non-loopback interface');
  }

  const pool = new Pool({ connectionString: infrastructure.databaseUrl });
  await pool.query('SELECT 1');
  await migrateBreadDb(pool as never);
  const db = createBreadDb(pool);

  const chain = createArcReadClient(network);

  const { createClient } = requireFromApi('redis') as {
    createClient: (options: Record<string, unknown>) => {
      connect: () => Promise<void>;
      quit: () => Promise<unknown>;
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string, options?: unknown) => Promise<unknown>;
      incr: (key: string) => Promise<number>;
      eval: (script: string, options?: unknown) => Promise<unknown>;
      pExpire: (key: string, ms: number) => Promise<unknown>;
      on: (event: string, handler: (error: unknown) => void) => unknown;
    };
  };
  const redis = createClient({ url: infrastructure.redisUrl });
  // Cache/realtime failure is a degraded-presentation concern only; it must
  // never roll back or invent financial state.
  redis.on('error', () => {});
  await redis.connect();

  const app = createBreadApi({
    db,
    context,
    observedHeadBlock: observeHeadBlock(chain),
    redis: redis as never,
  });

  await app.listen({ host, port });

  const close = async () => {
    await app.close();
    await redis.quit().catch(() => undefined);
    await pool.end().catch(() => undefined);
  };

  return { app, close, host, port, context };
}

// The orchestrator sets this explicitly so importing the module for tests
// never starts a listener as a side effect.
if (process.env.BREAD_LAN_API_MAIN === '1') {
  startBreadApiProcess()
    .then(({ host, port }) => {
      process.stdout.write(`BREAD_API_LISTENING http://${host}:${port}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`BREAD_API_FAILED ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
