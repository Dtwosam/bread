import { parseAbi, type PublicClient, type WalletClient } from 'viem';

import type { PreparedBreadTransaction } from '../../../../packages/protocol-sdk/src/builders';
import type { TradeAction } from './state';

type Address = `0x${string}`;
type TransactionHash = `0x${string}`;

const ERC20_SPEND_ABI = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

export type TradeWalletAdapterInput = Readonly<{
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  chainId: number;
}>;

function canonicalAmount(value: unknown, label: string): bigint {
  if (typeof value === 'bigint') return value;
  throw new Error(`Invalid ${label} returned by wallet runtime.`);
}

export function createTradeWalletAdapter({
  publicClient,
  walletClient,
  account,
  chainId,
}: TradeWalletAdapterInput) {
  return {
    async getAccount(): Promise<Address> {
      return account;
    },
    async getChainId(): Promise<number> {
      return chainId;
    },
    async sendPreparedTransaction(transaction: PreparedBreadTransaction): Promise<TransactionHash> {
      if (transaction.allowance) {
        const currentAllowance = canonicalAmount(
          await publicClient.readContract({
            address: transaction.allowance.token,
            abi: ERC20_SPEND_ABI,
            functionName: 'allowance',
            args: [account, transaction.allowance.spender],
          }),
          'ERC20 allowance',
        );

        if (currentAllowance < transaction.allowance.amount) {
          const approvalHash = await walletClient.writeContract({
            account,
            address: transaction.allowance.token,
            abi: ERC20_SPEND_ABI,
            functionName: 'approve',
            args: [transaction.allowance.spender, transaction.allowance.amount],
          } as never);
          const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
          if (approvalReceipt.status !== 'success') {
            throw new Error('Token approval reverted before the trade could be submitted.');
          }
        }
      }

      return walletClient.writeContract({
        account,
        address: transaction.to,
        abi: transaction.abi,
        functionName: transaction.functionName,
        args: transaction.args,
        value: transaction.value,
      } as never) as Promise<TransactionHash>;
    },
  } as const;
}

export async function readSpendableTradeBalance({
  publicClient,
  account,
  action,
  tokenAddress,
  quoteAsset,
}: Readonly<{
  publicClient: PublicClient;
  account: Address;
  action: TradeAction;
  tokenAddress: Address;
  quoteAsset: Address;
}>): Promise<bigint> {
  const asset = action === 'BUY' ? quoteAsset : tokenAddress;
  return canonicalAmount(
    await publicClient.readContract({
      address: asset,
      abi: ERC20_SPEND_ABI,
      functionName: 'balanceOf',
      args: [account],
    }),
    'ERC20 balance',
  );
}
