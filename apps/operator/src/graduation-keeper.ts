import type { PublicClient } from 'viem';

import {
  prepareRetryGraduation,
  simulatePreparedTransaction,
  type PreparedBreadTransaction,
  type ProtocolContext,
} from '@bread/protocol-sdk';
import type { Address } from '@bread/types';

type TransactionHash = `0x${string}`;

export type GraduationKeeperWallet = Readonly<{
  account: Address;
  sendPreparedTransaction: (request: PreparedBreadTransaction) => Promise<TransactionHash>;
}>;

export type GraduationKeeperStageResult = Readonly<{
  stage: 'SWEEP' | 'CREATE_POOL';
  transactionHash: TransactionHash;
}>;

export type GraduationKeeperResult =
  | Readonly<{
      tokenAddress: Address;
      status: 'TERMINAL';
      terminalStatus: 'ALREADY_COMPLETE' | 'RESCUED';
      stages: readonly GraduationKeeperStageResult[];
    }>
  | Readonly<{
      tokenAddress: Address;
      status: 'RETRY_REQUIRED';
      stages: readonly GraduationKeeperStageResult[];
      error: string;
    }>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Automatic graduation retry failed.';
}

/**
 * Advances one token through at most the source-defined sweep + pool-creation
 * transitions. Every transition is re-derived from fresh canonical onchain
 * coordinator/factory/curve state and simulated before the unprivileged keeper
 * submits it. No creator or ordinary-user wallet participates in this path.
 */
export async function advanceGraduationCandidate({
  client,
  wallet,
  context,
  tokenAddress,
}: Readonly<{
  client: PublicClient;
  wallet: GraduationKeeperWallet;
  context: ProtocolContext;
  tokenAddress: Address;
}>): Promise<GraduationKeeperResult> {
  const stages: GraduationKeeperStageResult[] = [];

  try {
    for (let transition = 0; transition < 2; transition += 1) {
      const review = await prepareRetryGraduation(client, context, { token: tokenAddress });
      if (review.kind === 'TERMINAL') {
        return {
          tokenAddress,
          status: 'TERMINAL',
          terminalStatus: review.status,
          stages,
        };
      }

      await simulatePreparedTransaction(client, review.transaction, wallet.account);
      const transactionHash = await wallet.sendPreparedTransaction(review.transaction);
      const receipt = await client.waitForTransactionReceipt({ hash: transactionHash });
      if (receipt.status !== 'success') {
        return {
          tokenAddress,
          status: 'RETRY_REQUIRED',
          stages,
          error: `${review.stage} transaction reverted onchain.`,
        };
      }
      stages.push({ stage: review.stage, transactionHash });
    }

    const finalReview = await prepareRetryGraduation(client, context, { token: tokenAddress });
    if (finalReview.kind === 'TERMINAL') {
      return {
        tokenAddress,
        status: 'TERMINAL',
        terminalStatus: finalReview.status,
        stages,
      };
    }

    return {
      tokenAddress,
      status: 'RETRY_REQUIRED',
      stages,
      error: 'Graduation still requires a permissionless coordinator transition after the bounded keeper pass.',
    };
  } catch (error) {
    return {
      tokenAddress,
      status: 'RETRY_REQUIRED',
      stages,
      error: errorMessage(error),
    };
  }
}

export async function runGraduationKeeperPass({
  client,
  wallet,
  context,
  candidates,
}: Readonly<{
  client: PublicClient;
  wallet: GraduationKeeperWallet;
  context: ProtocolContext;
  candidates: readonly Address[];
}>): Promise<readonly GraduationKeeperResult[]> {
  const results: GraduationKeeperResult[] = [];
  const seen = new Set<string>();

  for (const tokenAddress of candidates) {
    const key = tokenAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Sequential execution intentionally avoids same-account nonce races.
    results.push(await advanceGraduationCandidate({ client, wallet, context, tokenAddress }));
  }

  return results;
}
