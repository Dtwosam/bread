import { describe, expect, it, vi } from 'vitest';

import {
  parseIndexerCliArgs,
  runIndexerCli,
  type IndexerCliSelection,
} from '../../apps/indexer/src/index.js';

describe('Day 6 Task 10 operator CLI boundary', () => {
  it('parses the canonical reconcile network/stack command without inventing deployment values', () => {
    expect(parseIndexerCliArgs(['reconcile', '--network', 'arc-testnet', '--stack', 'task10-test-stack'])).toEqual({
      command: 'reconcile',
      network: 'arc-testnet',
      stackVersion: 'task10-test-stack',
    });
  });

  it('rejects missing, duplicate and unknown operator arguments', () => {
    expect(() => parseIndexerCliArgs(['reconcile', '--network', 'arc-testnet'])).toThrow(/stack/i);
    expect(() => parseIndexerCliArgs(['reconcile', '--network', 'arc-testnet', '--network', 'arc-testnet', '--stack', 'v1'])).toThrow(/duplicate.*network/i);
    expect(() => parseIndexerCliArgs(['reconcile', '--network', 'arc-testnet', '--stack', 'v1', '--factory', '0x1234'])).toThrow(/unknown.*factory/i);
    expect(() => parseIndexerCliArgs(['unknown', '--network', 'arc-testnet', '--stack', 'v1'])).toThrow(/command/i);
  });

  it('resolves runtime dependencies through an injected resolver before execution', async () => {
    const resolve = vi.fn(async (selection: IndexerCliSelection) => ({
      command: selection.command,
      input: { marker: `${selection.network}:${selection.stackVersion}` },
    } as never));
    const execute = vi.fn(async (request: unknown) => ({ ok: true, request }));

    const result = await runIndexerCli(
      ['rebuild', '--network', 'arc-testnet', '--stack', 'task10-test-stack'],
      resolve,
      execute as never,
    );

    expect(resolve).toHaveBeenCalledWith({
      command: 'rebuild',
      network: 'arc-testnet',
      stackVersion: 'task10-test-stack',
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true });
  });
});
