import {
  rebuildStack,
  reconcileStack,
  type RebuildStackInput,
  type RebuildStackResult,
  type ReconcileStackInput,
} from "./reconcile.js";

export type IndexerCommandRequest =
  | Readonly<{ command: "rebuild"; input: RebuildStackInput }>
  | Readonly<{ command: "reconcile"; input: ReconcileStackInput }>;

export type IndexerCommandResult =
  RebuildStackResult | Awaited<ReturnType<typeof reconcileStack>>;

export type IndexerCliSelection = Readonly<{
  command: "rebuild" | "reconcile";
  network: string;
  stackVersion: string;
}>;

export type IndexerCliResolver = (
  selection: IndexerCliSelection,
) => Promise<IndexerCommandRequest> | IndexerCommandRequest;

/**
 * Injected operator command router. Runtime config, DB clients and chain readers
 * are resolved by the caller so this surface never invents network addresses,
 * economics, credentials or authority.
 */
export async function runIndexerCommand(
  request: IndexerCommandRequest,
): Promise<IndexerCommandResult> {
  switch (request.command) {
    case "rebuild":
      return rebuildStack(request.input);
    case "reconcile":
      return reconcileStack(request.input);
  }
}

function requireCliValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--"))
    throw new Error(`missing value for ${flag}`);
  return value;
}

/**
 * Parse only the source-defined operator selection. Deployment addresses,
 * credentials, chain clients and DB handles are deliberately not accepted as
 * CLI overrides; they must come from a validated/injected runtime resolver.
 */
export function parseIndexerCliArgs(
  argv: readonly string[],
): IndexerCliSelection {
  const [commandRaw, ...args] = argv;
  if (commandRaw !== "rebuild" && commandRaw !== "reconcile") {
    throw new Error(`unknown indexer command: ${commandRaw ?? "<missing>"}`);
  }

  let network: string | undefined;
  let stackVersion: string | undefined;

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = requireCliValue(flag ?? "<missing>", args[index + 1]);
    switch (flag) {
      case "--network":
        if (network !== undefined)
          throw new Error("duplicate --network argument");
        network = value;
        break;
      case "--stack":
        if (stackVersion !== undefined)
          throw new Error("duplicate --stack argument");
        stackVersion = value;
        break;
      default:
        throw new Error(`unknown operator argument: ${flag ?? "<missing>"}`);
    }
  }

  if (!network) throw new Error("missing required --network argument");
  if (!stackVersion) throw new Error("missing required --stack argument");

  return { command: commandRaw, network, stackVersion };
}

/**
 * Execute the canonical operator selection only after an injected resolver has
 * bound it to validated runtime dependencies. This keeps argv parsing separate
 * from deployment authority while still providing one deterministic CLI path.
 */
export async function runIndexerCli<T = IndexerCommandResult>(
  argv: readonly string[],
  resolve: IndexerCliResolver,
  execute: (
    request: IndexerCommandRequest,
  ) => Promise<T> = runIndexerCommand as (
    request: IndexerCommandRequest,
  ) => Promise<T>,
): Promise<T> {
  const selection = parseIndexerCliArgs(argv);
  const request = await resolve(selection);
  if (request.command !== selection.command) {
    throw new Error(
      `resolved command ${request.command} does not match requested command ${selection.command}`,
    );
  }
  return execute(request);
}

export { runIndexerCatchUp } from "./catch-up.js";
export type { IndexerCatchUpResult, IndexerCheckpoint } from "./catch-up.js";
export {
  createBoundedRpcFailoverLogClient,
  RpcFailoverExhaustedError,
  RpcProviderCapacityError,
  RpcProviderCircuitOpenError,
} from "./rpc-failover.js";
export { rebuildStack, reconcileStack } from "./reconcile.js";
export {
  createReconciliationCanonicalEventScanner,
  type ReconciliationCanonicalEventIdentity,
} from "./reconciliation-scanner.js";
export type {
  RebuildRange,
  RebuildStackInput,
  RebuildStackResult,
  ReconcileStackInput,
  ReconciliationChainReader,
} from "./reconcile.js";
