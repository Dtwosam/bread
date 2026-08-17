import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';

import {
  advanceGraduationCandidate,
  runGraduationKeeperPass,
  type GraduationKeeperWallet,
} from '../../apps/operator/src/graduation-keeper';
import type { ProtocolContext } from '../../packages/protocol-sdk/src/index';
import type { Address } from '../../packages/types/src/index';

const token = '0x00000000000000000000000000000000000000aa' as Address;
const curve = '0x00000000000000000000000000000000000000bb' as Address;
const account = '0x00000000000000000000000000000000000000cc' as Address;

const context: ProtocolContext = {
  network: 'test',
  chainId: 5042002,
  stackVersion: 'test-stack',
  factoryAddress: '0x0000000000000000000000000000000000000001' as Address,
  quoteAsset: '0x0000000000000000000000000000000000000002' as Address,
  quoteDecimals: 6,
  deploymentStartBlock: 1n,
  addresses: {
    factory: '0x0000000000000000000000000000000000000001' as Address,
    deployer: '0x0000000000000000000000000000000000000003' as Address,
    feePolicy: '0x0000000000000000000000000000000000000004' as Address,
    feeEscrow: '0x0000000000000000000000000000000000000005' as Address,
    emergencyController: '0x0000000000000000000000000000000000000006' as Address,
    locker: '0x0000000000000000000000000000000000000007' as Address,
    coordinator: '0x0000000000000000000000000000000000000008' as Address,
  },
};

function clientForPhase(readPhase: () => number) {
  const simulations: string[] = [];
  const client = {
    readContract: async (request: { functionName: string }) => {
      if (request.functionName === 'getGraduation') return { phase: readPhase() };
      if (request.functionName === 'getLaunch') return [token, curve];
      if (request.functionName === 'readyToGraduate') return true;
      throw new Error(`unexpected read: ${request.functionName}`);
    },
    simulateContract: async (request: { functionName: string }) => {
      simulations.push(request.functionName);
      return { request };
    },
    waitForTransactionReceipt: async () => ({ status: 'success' as const }),
  } as unknown as PublicClient;
  return { client, simulations };
}

describe('automatic graduation keeper', () => {
  it('automatically advances a fully baked token from sweep through pool creation without a user wallet', async () => {
    let phase = 0;
    const { client, simulations } = clientForPhase(() => phase);
    const submitted: string[] = [];
    const wallet: GraduationKeeperWallet = {
      account,
      sendPreparedTransaction: async (request) => {
        submitted.push(request.functionName);
        phase = request.functionName === 'sweep' ? 1 : 2;
        return (`0x${submitted.length.toString(16).padStart(64, '0')}`) as `0x${string}`;
      },
    };

    const result = await advanceGraduationCandidate({ client, wallet, context, tokenAddress: token });

    expect(result.status).toBe('TERMINAL');
    if (result.status !== 'TERMINAL') return;
    expect(result.terminalStatus).toBe('ALREADY_COMPLETE');
    expect(result.stages.map((stage) => stage.stage)).toEqual(['SWEEP', 'CREATE_POOL']);
    expect(submitted).toEqual(['sweep', 'createPool']);
    expect(simulations).toEqual(['sweep', 'createPool']);
  });

  it('leaves a transient failed automatic retry safely retryable for the next keeper pass', async () => {
    const { client } = clientForPhase(() => 0);
    const wallet: GraduationKeeperWallet = {
      account,
      sendPreparedTransaction: async () => { throw new Error('temporary RPC failure'); },
    };

    const result = await advanceGraduationCandidate({ client, wallet, context, tokenAddress: token });

    expect(result.status).toBe('RETRY_REQUIRED');
    if (result.status !== 'RETRY_REQUIRED') return;
    expect(result.stages).toEqual([]);
    expect(result.error).toContain('temporary RPC failure');
  });

  it('deduplicates candidates and executes them sequentially with the operator account', async () => {
    let phase = 2;
    const { client } = clientForPhase(() => phase);
    let submissions = 0;
    const wallet: GraduationKeeperWallet = {
      account,
      sendPreparedTransaction: async () => {
        submissions += 1;
        return (`0x${submissions.toString(16).padStart(64, '0')}`) as `0x${string}`;
      },
    };

    const results = await runGraduationKeeperPass({
      client,
      wallet,
      context,
      candidates: [token, token],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('TERMINAL');
    expect(submissions).toBe(0);
    phase = 2;
  });
});
