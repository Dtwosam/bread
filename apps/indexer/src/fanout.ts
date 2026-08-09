export type FanoutMessage = Readonly<{ channel: string }>;

export type FanoutSnapshot = Readonly<{
  subscribers: number;
  slowConsumerDrops: number;
  maxObservedPending: number;
}>;

type Subscriber<T extends FanoutMessage> = {
  handler: (message: T) => Promise<void>;
  pending: number;
};

export class BoundedRealtimeFanout<T extends FanoutMessage = FanoutMessage> {
  private readonly byChannel = new Map<string, Map<number, Subscriber<T>>>();
  private nextId = 1;
  private slowConsumerDrops = 0;
  private maxObservedPending = 0;
  private subscriberCount = 0;
  private readonly maxSubscribers: number;
  private readonly maxPendingPerSubscriber: number;

  constructor(input: Readonly<{
    maxPendingPerSubscriber: number;
    maxSubscribers?: number;
  }>) {
    if (!Number.isInteger(input.maxPendingPerSubscriber) || input.maxPendingPerSubscriber < 1) {
      throw new Error('maxPendingPerSubscriber must be a positive integer');
    }
    const maxSubscribers = input.maxSubscribers ?? 1_024;
    if (!Number.isInteger(maxSubscribers) || maxSubscribers < 1) throw new Error('maxSubscribers must be a positive integer');
    this.maxPendingPerSubscriber = input.maxPendingPerSubscriber;
    this.maxSubscribers = maxSubscribers;
  }

  subscribe(channel: string, handler: (message: T) => Promise<void>): () => void {
    const normalized = channel.trim();
    if (normalized.length === 0 || normalized.length > 256) throw new Error('fanout channel is empty or too long');
    if (this.subscriberCount >= this.maxSubscribers) throw new Error('fanout subscriber capacity exceeded');

    const id = this.nextId++;
    let subscribers = this.byChannel.get(normalized);
    if (!subscribers) {
      subscribers = new Map();
      this.byChannel.set(normalized, subscribers);
    }
    subscribers.set(id, { handler, pending: 0 });
    this.subscriberCount += 1;

    return () => this.remove(normalized, id);
  }

  private remove(channel: string, id: number): void {
    const subscribers = this.byChannel.get(channel);
    if (!subscribers?.delete(id)) return;
    this.subscriberCount -= 1;
    if (subscribers.size === 0) this.byChannel.delete(channel);
  }

  async publish(message: T): Promise<void> {
    const subscribers = this.byChannel.get(message.channel);
    if (!subscribers || subscribers.size === 0) return;

    for (const [id, subscriber] of [...subscribers.entries()]) {
      if (subscriber.pending >= this.maxPendingPerSubscriber) {
        this.slowConsumerDrops += 1;
        this.remove(message.channel, id);
        continue;
      }

      subscriber.pending += 1;
      this.maxObservedPending = Math.max(this.maxObservedPending, subscriber.pending);
      let delivery: Promise<void>;
      try {
        delivery = Promise.resolve(subscriber.handler(message));
      } catch {
        subscriber.pending -= 1;
        this.remove(message.channel, id);
        continue;
      }
      void delivery
        .catch(() => {
          this.remove(message.channel, id);
        })
        .finally(() => {
          subscriber.pending = Math.max(0, subscriber.pending - 1);
        });
    }

    // Allow immediately-resolving consumers to clear their in-flight slot
    // without waiting for genuinely slow consumers.
    await Promise.resolve();
  }

  snapshot(): FanoutSnapshot {
    return {
      subscribers: this.subscriberCount,
      slowConsumerDrops: this.slowConsumerDrops,
      maxObservedPending: this.maxObservedPending,
    };
  }
}
