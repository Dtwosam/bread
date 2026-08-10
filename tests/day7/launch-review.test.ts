import { describe, expect, it } from 'vitest';

import {
  prepareCanonicalLaunchReview,
  readLaunchReviewSnapshot,
} from '../../packages/protocol-sdk/src/launch-review.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;
const digest = `0x${'ab'.repeat(32)}` as `0x${string}`;

const context = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'test-stack',
  factoryAddress: address('1'),
  quoteAsset: address('2'),
  quoteDecimals: 6,
  deploymentStartBlock: 1n,
  addresses: {
    factory: address('1'),
    deployer: address('3'),
    feePolicy: address('4'),
    feeEscrow: address('5'),
    emergencyController: address('6'),
    locker: address('7'),
    coordinator: address('8'),
  },
} as const;

const launchConfig = {
  supply: 1_000_000_000n * 10n ** 18n,
  phantomQuote: 10_000_000n,
  graduationThreshold: 50_000_000n,
  launchFeeUsdc: 2_500_000n,
  graduationAdapter: address('9'),
  graduationConfigHash: `0x${'cd'.repeat(32)}`,
  enabled: true,
} as const;

const feePolicy = {
  protocolFeeRecipient: address('a'),
  tradeFeeBps: 100,
  protocolFeeShareBps: 5_000,
  maxCreatorTaxBps: 500,
} as const;

function client({ enabled = true } = {}) {
  const reads: string[] = [];
  const value = {
    async readContract(request: { functionName: string }) {
      reads.push(request.functionName);
      switch (request.functionName) {
        case 'currentLaunchConfig':
          return [{ ...launchConfig, enabled }, 7n] as const;
        case 'previewLaunchEconomics':
          return digest;
        case 'currentFeePolicy':
          return feePolicy;
        default:
          throw new Error(`unexpected read ${request.functionName}`);
      }
    },
  } as never;
  return { value, reads };
}

const creator = {
  name: 'Bread Test',
  symbol: 'BREADT',
  logo: 'https://example.com/token.png',
  description: 'A deterministic test launch.',
  twitter: 'https://x.com/example',
  telegram: 'https://t.me/example',
  website: 'https://example.com',
  creatorFeeRecipient: address('b'),
  creatorTaxBps: 250n,
} as const;

describe('Day 7 Task 6 canonical launch review', () => {
  it('reads launch config, economics digest and fee policy from canonical contracts', async () => {
    const test = client();
    const snapshot = await readLaunchReviewSnapshot(test.value, context);

    expect(test.reads).toEqual(['currentLaunchConfig', 'previewLaunchEconomics', 'currentFeePolicy']);
    expect(snapshot).toMatchObject({
      supply: launchConfig.supply,
      phantomQuote: launchConfig.phantomQuote,
      graduationThreshold: launchConfig.graduationThreshold,
      launchFeeUsdc: launchConfig.launchFeeUsdc,
      configVersion: 7n,
      economicsDigest: digest,
      tradeFeeBps: 100,
      maxCreatorTaxBps: 500,
      enabled: true,
    });
  });

  it('fails closed when the canonical Factory says launches are disabled', async () => {
    const test = client({ enabled: false });
    await expect(readLaunchReviewSnapshot(test.value, context)).rejects.toThrow(/launch.*disabled/i);
  });

  it('prepares Launch with the canonical economics digest and exact launch-fee allowance', async () => {
    const snapshot = await readLaunchReviewSnapshot(client().value, context);
    const prepared = prepareCanonicalLaunchReview({
      context,
      snapshot,
      creator,
      initialBuyQuoteIn: 0n,
      slippageBps: 50,
    });

    expect(prepared.params.expectedEconomics).toBe(digest);
    expect(prepared.params.discord).toBe('');
    expect(prepared.params.farcaster).toBe('');
    expect(prepared.transaction.functionName).toBe('launchToken');
    expect(prepared.transaction.allowance).toEqual({
      token: context.quoteAsset,
      spender: context.addresses.factory,
      amount: launchConfig.launchFeeUsdc,
    });
    expect(prepared.initialBuyReview).toBeNull();
    expect(prepared.review.buybackAvailable).toBe(false);
    expect(prepared.review.permanentLiquidityLock).toBe(true);
  });

  it('prepares Launch & Buy with launch fee plus initial buy allowance and zero opening tax', async () => {
    const snapshot = await readLaunchReviewSnapshot(client().value, context);
    const quoteIn = 25_000_000n;
    const prepared = prepareCanonicalLaunchReview({
      context,
      snapshot,
      creator,
      initialBuyQuoteIn: quoteIn,
      slippageBps: 50,
    });

    expect(prepared.transaction.functionName).toBe('launchTokenAndBuy');
    expect(prepared.transaction.allowance).toEqual({
      token: context.quoteAsset,
      spender: context.addresses.factory,
      amount: launchConfig.launchFeeUsdc + quoteIn,
    });
    expect(prepared.initialBuyReview).toMatchObject({
      action: 'BUY',
      inputAmount: quoteIn,
      openingTaxBps: 0,
      openingTax: 0n,
      slippageBps: 50,
    });
    expect(prepared.transaction.args[2]).toBe(prepared.initialBuyReview?.minimumOutput);
    expect(prepared.review.initialBuyQuoteIn).toBe(quoteIn);
  });

  it('rejects creator tax above the canonical current maximum', async () => {
    const snapshot = await readLaunchReviewSnapshot(client().value, context);
    expect(() => prepareCanonicalLaunchReview({
      context,
      snapshot,
      creator: { ...creator, creatorTaxBps: 501n },
      initialBuyQuoteIn: 0n,
      slippageBps: 50,
    })).toThrow(/creator tax.*maximum/i);
  });
});
