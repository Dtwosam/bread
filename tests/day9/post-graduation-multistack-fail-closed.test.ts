import { describe, expect, it, vi } from 'vitest';

import type { Address } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';
import { resolveCanonicalTradeRoute } from '../../packages/protocol-sdk/src/trade-route.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as Address;

const requestedToken = address('1');
const anotherStackToken = address('2');
const selectedFactory = address('3');
const curve = address('4');
const coordinator = address('5');
const adapter = address('6');
const quoteAsset = address('7');

const context = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'selected-stack',
  factoryAddress: selectedFactory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 1n,
  addresses: {
    factory: selectedFactory,
    deployer: address('8'),
    feePolicy: address('9'),
    feeEscrow: address('a'),
    emergencyController: address('b'),
    locker: address('c'),
    coordinator,
    graduationAdapter: adapter,
  },
} satisfies ProtocolContext;

describe('Day 9 multi-stack trade-context fail-closed boundary', () => {
  it('rejects a token that does not belong to the selected verified factory before any downstream route read', async () => {
    const readContract = vi.fn(async (request: { address: Address; functionName: string }) => {
      if (request.address === selectedFactory && request.functionName === 'getLaunch') {
        return {
          token: anotherStackToken,
          curve,
          deployer: address('8'),
          creatorFeeRecipient: address('9'),
          creatorTaxBps: 0,
          economicsDigest: `0x${'1'.repeat(64)}`,
          launchTimestamp: 1,
          configVersion: 1,
          graduationCoordinator: coordinator,
          graduationAdapter: adapter,
          graduationAdapterFamily: 2,
          graduationConfigHash: `0x${'2'.repeat(64)}`,
        };
      }
      throw new Error(`unexpected downstream read ${request.address}.${request.functionName}`);
    });

    await expect(resolveCanonicalTradeRoute(
      { readContract } as never,
      context,
      requestedToken,
    )).rejects.toThrow(/canonical launch token mismatch/i);

    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({
      address: selectedFactory,
      functionName: 'getLaunch',
      args: [requestedToken],
    }));
  });
});
