import { describe, expect, it } from 'vitest';

import type { Address, Hex32 } from '../../packages/types/src/index.js';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/context.js';

const address = (nibble: string) => `0x${nibble.repeat(40)}` as Address;
const hash = (nibble: string) => `0x${nibble.repeat(64)}` as Hex32;

const factory = address('1');
const token = address('2');
const curve = address('3');
const seller = address('4');
const recipient = address('5');
const quoteAsset = address('6');
const blockHash = hash('a');
const transactionHash = hash('b');
const topic0 = hash('c');

const context: ProtocolContext = {
  network: 'arc-testnet',
  chainId: 5_042_002,
  stackVersion: 'day9-v3-indexing-red',
  factoryAddress: factory,
  quoteAsset,
  quoteDecimals: 6,
  deploymentStartBlock: 100n,
  addresses: {
    factory,
    deployer: address('7'),
    feePolicy: address('8'),
    feeEscrow: address('9'),
    emergencyController: address('a'),
    locker: address('b'),
    coordinator: address('c'),
    graduationAdapter: address('d'),
  },
};

const curveSell = {
  address: curve,
  blockNumber: 101n,
  blockHash,
  transactionHash,
  transactionIndex: 1,
  logIndex: 2,
  eventName: 'CurveSell',
  args: {
    seller,
    recipient,
    tokensIn: 10n,
    quoteOut: 95n,
    fee: 3n,
    tax: 2n,
  },
  topics: [topic0],
  data: '0x' as const,
};

describe('Day 9 post-graduation V3 indexing shared venue contract', () => {
  it('keeps a canonical curve trade unchanged while identifying its execution venue explicitly', async () => {
    const { normalizeTransactionLogs } = await import('../../apps/indexer/src/normalize.ts');
    const normalized = await normalizeTransactionLogs({
      client: {
        readContract: async () => {
          throw new Error('known curve trade must not require immutable launch reads');
        },
      },
      context,
      knownLaunches: [{ tokenAddress: token, curveAddress: curve }],
      logs: [curveSell],
      toBlock: 101n,
      toBlockTimestamp: 1_786_262_461n,
    });

    expect(normalized.trades).toHaveLength(1);
    expect(normalized.trades[0]).toMatchObject({
      side: 'SELL',
      token,
      curve,
      actor: seller,
      recipient,
      quoteAmount: 100n,
      tokenAmount: 10n,
      baseFee: 3n,
      creatorTax: 2n,
      executionPriceNumerator: 100n,
      executionPriceDenominator: 10n,
      venueKind: 'BREAD_CURVE',
      venueAddress: curve,
      venueFeeTier: null,
    });
  });

  it('exports additive venue columns on the single canonical trades projection', async () => {
    const db = await import('../../packages/db/src/index.ts');
    expect(Object.keys(db.trades)).toEqual(
      expect.arrayContaining(['venueKind', 'venueAddress', 'venueFeeTier']),
    );
  });
});
