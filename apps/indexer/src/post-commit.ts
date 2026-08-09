export type PostCommitChangeDomain = 'feed' | 'token' | 'wallet';

export type PostCommitHint = Readonly<{
  channel: string;
  changeKind: 'INVALIDATE';
  changeDomain: PostCommitChangeDomain;
  affectedIdentity: string;
  eventId: string;
  checkpointBlock: string;
  checkpointHash: string;
}>;

export type PostCommitInput = Readonly<{
  insertedEventIds: readonly string[];
  channels: readonly string[];
  checkpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
}>;

export type PostCommitFailure = Readonly<{
  channel: string;
  operation: 'INVALIDATE' | 'FANOUT';
  error: string;
}>;

export type PostCommitResult = Readonly<{
  channels: readonly string[];
  failures: readonly PostCommitFailure[];
}>;

export class PostCommitDegradedError extends Error {
  readonly code = 'POST_COMMIT_DEGRADED' as const;
  readonly channels: readonly string[];
  readonly failures: readonly PostCommitFailure[];

  constructor(input: Readonly<{ channels: readonly string[]; failures: readonly PostCommitFailure[] }>) {
    super(`post-commit cache/fanout degraded across ${input.failures.length} operation(s)`);
    this.name = 'PostCommitDegradedError';
    this.channels = input.channels;
    this.failures = input.failures;
  }
}

const MAX_CHANNELS_PER_COMMIT = 128;
const MAX_CHANNEL_LENGTH = 256;
const MAX_EVENT_ID_LENGTH = 256;
const MAX_ERROR_LENGTH = 512;

function boundedError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.slice(0, MAX_ERROR_LENGTH);
}

function normalizeChannels(channels: readonly string[]): readonly string[] {
  const unique = new Set<string>();
  for (const raw of channels) {
    const channel = raw.trim();
    if (channel.length === 0 || channel.length > MAX_CHANNEL_LENGTH) {
      throw new Error('logical channel is empty or exceeds the bounded channel length');
    }
    unique.add(channel);
    if (unique.size > MAX_CHANNELS_PER_COMMIT) {
      throw new Error('post-commit logical channel count exceeds the bounded maximum');
    }
  }
  return [...unique].sort();
}

function causalEventId(insertedEventIds: readonly string[]): string {
  const eventId = insertedEventIds.at(-1)?.trim();
  if (!eventId || eventId.length > MAX_EVENT_ID_LENGTH) {
    throw new Error('post-commit causal event id is missing or exceeds the bounded length');
  }
  return eventId;
}

function parseLogicalChannel(channel: string): Readonly<{
  changeDomain: PostCommitChangeDomain;
  affectedIdentity: string;
}> {
  const parts = channel.split(':');
  if (parts[0] === 'stack' && parts.length >= 4 && parts.at(-1) === 'feed') {
    const chainId = parts[1];
    const stackVersion = parts.slice(2, -1).join(':');
    if (!chainId || !/^\d+$/.test(chainId) || stackVersion.length === 0) {
      throw new Error('invalid stack feed logical channel');
    }
    return { changeDomain: 'feed', affectedIdentity: `${chainId}:${stackVersion}` };
  }

  if ((parts[0] === 'token' || parts[0] === 'wallet') && parts.length === 3) {
    const chainId = parts[1];
    const identity = parts[2]?.toLowerCase();
    if (!chainId || !/^\d+$/.test(chainId) || !identity || !/^0x[0-9a-f]{40}$/.test(identity)) {
      throw new Error(`invalid ${parts[0]} logical channel`);
    }
    return {
      changeDomain: parts[0],
      affectedIdentity: identity,
    };
  }

  throw new Error('unsupported logical channel shape');
}

export class PostCommitPublisher {
  constructor(private readonly deps: Readonly<{
    invalidate: (channel: string) => Promise<unknown>;
    fanout: (message: PostCommitHint) => Promise<unknown>;
  }>) {}

  async publish(input: PostCommitInput): Promise<PostCommitResult> {
    if (input.insertedEventIds.length === 0) return { channels: [], failures: [] };
    const channels = normalizeChannels(input.channels);
    const eventId = causalEventId(input.insertedEventIds);
    const failures: PostCommitFailure[] = [];

    for (const channel of channels) {
      const logical = parseLogicalChannel(channel);
      try {
        await this.deps.invalidate(channel);
      } catch (error) {
        failures.push({
          channel,
          operation: 'INVALIDATE',
          error: boundedError(error),
        });
      }

      const hint: PostCommitHint = {
        channel,
        changeKind: 'INVALIDATE',
        changeDomain: logical.changeDomain,
        affectedIdentity: logical.affectedIdentity,
        eventId,
        checkpointBlock: input.checkpoint.blockNumber.toString(10),
        checkpointHash: input.checkpoint.blockHash.toLowerCase(),
      };
      try {
        await this.deps.fanout(hint);
      } catch (error) {
        failures.push({
          channel,
          operation: 'FANOUT',
          error: boundedError(error),
        });
      }
    }

    if (failures.length > 0) {
      throw new PostCommitDegradedError({ channels, failures });
    }
    return { channels, failures: [] };
  }
}
