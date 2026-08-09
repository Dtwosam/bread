export type PostCommitHint = Readonly<{
  channel: string;
  changeKind: 'INVALIDATE';
  checkpointBlock: string;
  checkpointHash: string;
  eventIds: readonly string[];
}>;

export type PostCommitInput = Readonly<{
  insertedEventIds: readonly string[];
  channels: readonly string[];
  checkpoint: Readonly<{ blockNumber: bigint; blockHash: string }>;
}>;

export type PostCommitResult = Readonly<{
  channels: readonly string[];
  failures: readonly Readonly<{ channel: string; operation: 'INVALIDATE' | 'FANOUT'; error: string }>[];
}>;

const MAX_CHANNELS_PER_COMMIT = 128;
const MAX_EVENT_IDS_PER_HINT = 64;
const MAX_CHANNEL_LENGTH = 256;

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

export class PostCommitPublisher {
  constructor(private readonly deps: Readonly<{
    invalidate: (channel: string) => Promise<unknown>;
    fanout: (message: PostCommitHint) => Promise<unknown>;
  }>) {}

  async publish(input: PostCommitInput): Promise<PostCommitResult> {
    if (input.insertedEventIds.length === 0) return { channels: [], failures: [] };
    const channels = normalizeChannels(input.channels);
    const eventIds = input.insertedEventIds.slice(0, MAX_EVENT_IDS_PER_HINT);
    const failures: Array<{ channel: string; operation: 'INVALIDATE' | 'FANOUT'; error: string }> = [];

    for (const channel of channels) {
      try {
        await this.deps.invalidate(channel);
      } catch (error) {
        failures.push({
          channel,
          operation: 'INVALIDATE',
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const hint: PostCommitHint = {
        channel,
        changeKind: 'INVALIDATE',
        checkpointBlock: input.checkpoint.blockNumber.toString(10),
        checkpointHash: input.checkpoint.blockHash.toLowerCase(),
        eventIds,
      };
      try {
        await this.deps.fanout(hint);
      } catch (error) {
        failures.push({
          channel,
          operation: 'FANOUT',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { channels, failures };
  }
}
