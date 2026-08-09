import { describe, expect, it } from 'vitest';

import {
  buildRebuildReport,
  rebuildStack,
} from '../../apps/indexer/src/reconcile.js';

const address = (value: number) => `0x${value.toString(16).padStart(40, '0')}`;
const hash = (value: number) => `0x${value.toString(16).padStart(64, '0')}`;

const context = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'task10-safety-stack',
  factoryAddress: address(1),
  quoteAsset: address(2),
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory: address(1),
    feeEscrow: address(3),
  },
} as const;

describe('Day 6 Task 10 rebuild safety/report boundary', () => {
  it('rejects a destructive rebuild before DB access when isolated-target verification is absent', async () => {
    await expect(rebuildStack({
      db: {} as never,
      client: {} as never,
      context: context as never,
      targetBlock: 100n,
      batchSize: 10n,
      loadRange: async () => ({
        fromBlock: 100n,
        toBlock: 100n,
        toBlockHash: hash(100),
        logs: [],
      }),
      chain: {} as never,
    } as never)).rejects.toThrow(/isolated.*target.*verification|required.*rebuild.*target/i);
  });

  it('builds a deterministic rebuild report hash over identity, count, checkpoint and verdict', () => {
    const input = {
      chainId: context.chainId,
      stackVersion: context.stackVersion,
      factoryAddress: context.factoryAddress,
      sourceHash: hash(10),
      manifestHash: hash(11),
      deploymentStartBlock: '100',
      targetBlock: '105',
      targetBlockHash: hash(105),
      canonicalEventCount: 7,
      rangesApplied: 1,
      targetMode: 'LOCAL_TEST' as const,
      targetIdentity: 'day6-task10-isolated-test-db',
      verdict: 'PASS' as const,
    };

    const first = buildRebuildReport(input);
    const second = buildRebuildReport(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      reportVersion: expect.any(String),
      verdict: 'PASS',
      chainId: context.chainId,
      stackVersion: context.stackVersion,
      factoryAddress: context.factoryAddress,
      canonicalEventCount: 7,
      targetBlockHash: hash(105),
      targetMode: 'LOCAL_TEST',
      targetIdentity: 'day6-task10-isolated-test-db',
    });
    expect(first.reportHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
