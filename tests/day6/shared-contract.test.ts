import { describe, expect, it } from 'vitest';

describe('Day 6 canonical shared contract RED', () => {
  it('exports canonical event identity behavior from @bread/types', async () => {
    const types = await import('../../packages/types/src/index.ts');
    expect(types).toHaveProperty('canonicalEventId');
    expect(typeof (types as Record<string, unknown>).canonicalEventId).toBe('function');
  });

  it('exports validated protocol-context resolution from @bread/protocol-sdk', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('resolveProtocolContext');
    expect(typeof (sdk as Record<string, unknown>).resolveProtocolContext).toBe('function');
  });

  it('exports known/ignored/unknown event classification from @bread/protocol-sdk', async () => {
    const sdk = await import('../../packages/protocol-sdk/src/index.ts');
    expect(sdk).toHaveProperty('classifyBreadLog');
    expect(typeof (sdk as Record<string, unknown>).classifyBreadLog).toBe('function');
  });
});
