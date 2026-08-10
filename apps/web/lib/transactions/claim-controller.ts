import type { PublicClient } from 'viem';

import { breadAbiRegistry } from '../../../../packages/protocol-sdk/src/abi/generated';
import {
  prepareClaim,
  simulatePreparedTransaction,
  type PreparedBreadTransaction,
} from '../../../../packages/protocol-sdk/src/builders';
import type { ProtocolContext } from '../../../../packages/protocol-sdk/src/context';

type Address = `0x${string}`;

export type ClaimReview = Readonly<{
  recipient: Address;
  claimableUsdc: bigint;
  transaction: PreparedBreadTransaction | null;
}>;

export async function readClaimReview(
  client: Pick<PublicClient, 'readContract'>,
  context: ProtocolContext,
  recipient: Address,
): Promise<ClaimReview> {
  const raw = await client.readContract({
    address: context.addresses.feeEscrow,
    abi: breadAbiRegistry.feeEscrow,
    functionName: 'balanceOf',
    args: [recipient],
  } as never);
  if (typeof raw !== 'bigint' || raw < 0n) throw new Error('FeeEscrow returned an invalid claimable balance.');

  return {
    recipient,
    claimableUsdc: raw,
    transaction: raw === 0n ? null : prepareClaim(context, { amount: raw }),
  };
}

export async function prepareClaimForSignature(
  client: PublicClient,
  context: ProtocolContext,
  approved: ClaimReview,
): Promise<Readonly<{ review: ClaimReview; reviewChanged: boolean }>> {
  const review = await readClaimReview(client, context, approved.recipient);
  if (review.claimableUsdc !== approved.claimableUsdc) {
    return { review, reviewChanged: true };
  }
  if (!review.transaction) throw new Error('There is no USDC available to claim.');
  await simulatePreparedTransaction(client, review.transaction, approved.recipient);
  return { review, reviewChanged: false };
}
