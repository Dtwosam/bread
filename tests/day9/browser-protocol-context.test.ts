import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BREAD_LAN_STACK_VERSION } from '../../apps/indexer/src/lan/runtime-context';
import { arcProtocolContext } from '../../apps/web/lib/wallet/config';

const root = resolve(import.meta.dirname, '../..');

describe('Day 9 browser canonical protocol context', () => {
  it('resolves the verified browser context from the same canonical stack identity as LAN runtime', () => {
    const deployment = JSON.parse(
      readFileSync(resolve(root, 'config/deployments/arc-testnet.day5.json'), 'utf8'),
    ) as {
      stackVersion?: unknown;
      deploymentStartBlock: number;
      core: { factory: string };
    };

    // The verified deployment manifest intentionally does not publish a
    // stackVersion field. Browser execution must use the same canonical Day-9
    // stack identity derivation as the already-proven LAN runtime rather than
    // treating the verified deployment as unresolved.
    expect(deployment.stackVersion).toBeUndefined();

    expect(arcProtocolContext).not.toBeNull();
    expect(arcProtocolContext?.stackVersion).toBe(BREAD_LAN_STACK_VERSION);
    expect(arcProtocolContext?.factoryAddress).toBe(deployment.core.factory.toLowerCase());
    expect(arcProtocolContext?.deploymentStartBlock).toBe(BigInt(deployment.deploymentStartBlock));
  });
});
