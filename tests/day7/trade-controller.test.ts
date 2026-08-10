import { describe, expect, it } from 'vitest';

import type { ProtocolContext } from '../../packages/protocol-sdk/src/index.js';
import { readTradeReviewSnapshot } from '../../packages/protocol-sdk/src/trade-review.js';
import { prepareTradeForSignature } from '../../apps/web/lib/transactions/controller.js';

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5042002,
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
};

const curve = address('9');
const token = address('a');
const account = address('b');

function mockClient() {
  const reads: string[] = [];
  const simulations: Array<Record<string, unknown>> = [];
  return {
    reads,
    simulations,
    client: {
      async readContract(request: { functionName: string }) {
        reads.push(request.functionName);
        switch (request.functionName) {
          case 'getReserves':
            return [1_000_000n, 2_000_000n] as const;
          case 'reservedTokens':
            return 0n;
          case 'tradeFeeBps':
            return 100n;
          case 'creatorTaxBps':
            return 50n;
          case 'currentSnipeTaxBps':
            return 0n;
          default:
            throw new Error(`unexpected read ${request.functionName}`);
        }
      },
      async simulateContract(request: Record<string, unknown>) {
        simulations.push(request);
        return { request };
      },
    } as never,
  };
}

describe('Day 7 Task 5 pre-sign trade preparation', () => {
  it('reads the exact current curve snapshot from canonical chain state', async () => {
    const { client, reads } = mockClient();
    const snapshot = await readTradeReviewSnapshot(client, curve);

    expect(snapshot).toEqual({
      quoteReserve: 1_000_000n,
      tokenReserve: 2_000_000n,
      reservedTokens: 0n,
      tradeFeeBps: 100,
      creatorTaxBps: 50,
      openingTaxBps: 0,
    });
    expect(new Set(reads)).toEqual(
      new Set(['getReserves', 'reservedTokens', 'tradeFeeBps', 'creatorTaxBps', 'currentSnipeTaxBps']),
    );
  });

  it('revalidates wallet chain, rereads finance, derives min output and simulates immediately before signature', async () => {
    const { client, reads, simulations } = mockClient();
    const prepared = await prepareTradeForSignature({
      client,
      context,
      walletChainId: 5042002,
      account,
      action: 'BUY',
      tokenAddress: token,
      curveAddress: curve,
      inputAmount: 10_000n,
      slippageBps: 50,
    });

    expect(reads.length).toBe(5);
    expect(prepared.review.minimumOutput).toBe(19_409n);
    expect(prepared.transaction.functionName).toBe('buy');
    expect(prepared.transaction.args).toEqual([10_000n, 19_409n, account]);
    expect(prepared.transaction.allowance).toEqual({
      token: context.quoteAsset,
      spender: curve,
      amount: 10_000n,
    });
    expect(simulations).toHaveLength(1);
    expect(simulations[0]).toMatchObject({
      address: curve,
      functionName: 'buy',
      args: [10_000n, 19_409n, account],
      account,
    });
  });

  it('prepares sells from the same current-state review and never applies opening tax to sell', async () => {
    const { client } = mockClient();
    const prepared = await prepareTradeForSignature({
      client,
      context,
      walletChainId: 5042002,
      account,
      action: 'SELL',
      tokenAddress: token,
      curveAddress: curve,
      inputAmount: 10_000n,
      slippageBps: 50,
    });

    expect(prepared.review.action).toBe('SELL');
    expect(prepared.review.openingTaxBps).toBe(0);
    expect(prepared.transaction.functionName).toBe('sell');
    expect(prepared.transaction.args).toEqual([10_000n, 4_877n, account]);
    expect(prepared.transaction.allowance).toEqual({ token, spender: curve, amount: 10_000n });
  });

  it('fails closed on wrong wallet chain before reading or simulating financial state', async () => {
    const { client, reads, simulations } = mockClient();

    await expect(
      prepareTradeForSignature({
        client,
        context,
        walletChainId: 1,
        account,
        action: 'BUY',
        tokenAddress: token,
        curveAddress: curve,
        inputAmount: 10_000n,
        slippageBps: 50,
      }),
    ).rejects.toThrow(/wrong network/i);

    expect(reads).toHaveLength(0);
    expect(simulations).toHaveLength(0);
  });
});
