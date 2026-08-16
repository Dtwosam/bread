import { parseAbi, type PublicClient, type WalletClient } from 'viem';

import type { PreparedBreadTransaction } from '../../../../packages/protocol-sdk/src/builders';
import {
  findRecoverableAllowanceTransaction,
  loadRecoverableAllowanceTransactions,
  persistAllowanceTransaction,
  removeAllowanceTransaction,
  updateAllowanceTransactionStatus,
  type AllowanceTransactionRecord,
} from './allowance-storage';
import type { TradeAction } from './state';

type Address = `0x${string}`;
type TransactionHash = `0x${string}`;

const TRANSACTION_HASH = /^0x[0-9a-fA-F]{64}$/;
const ARC_NATIVE_USDC_DECIMALS = 18;
const BUY_MAX_WALLET_TRANSACTION_UPPER_BOUND = BigInt(2);

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
  storage?: Storage;
  now?: () => Date;
}>;

export type ArcBuyMaxBalance = Readonly<{
  balance: bigint;
  gasReserve: bigint;
  maxInput: bigint;
}>;

export class AllowanceConfirmationUnknownError extends Error {
  readonly hash: TransactionHash;
  readonly cause: unknown;

  constructor(hash: TransactionHash, cause: unknown) {
    super('Token approval was submitted, but its confirmation status is unknown.');
    this.name = 'AllowanceConfirmationUnknownError';
    this.hash = hash;
    this.cause = cause;
  }
}

function canonicalAmount(value: unknown, label: string): bigint {
  if (typeof value === 'bigint') return value;
  throw new Error(`Invalid ${label} returned by wallet runtime.`);
}

function replacementHash(value: unknown): TransactionHash | null {
  if (!value || typeof value !== 'object') return null;
  const transaction = (value as { transaction?: unknown }).transaction;
  if (!transaction || typeof transaction !== 'object') return null;
  const hash = (transaction as { hash?: unknown }).hash;
  return typeof hash === 'string' && TRANSACTION_HASH.test(hash) ? hash as TransactionHash : null;
}

async function readErc20Balance(
  publicClient: PublicClient,
  account: Address,
  asset: Address,
): Promise<bigint> {
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

function currentFeePerGas(value: unknown): bigint {
  if (!value || typeof value !== 'object') {
    throw new Error('Current Arc gas fee estimate is unavailable.');
  }
  const estimate = value as { maxFeePerGas?: unknown; gasPrice?: unknown };
  if (typeof estimate.maxFeePerGas === 'bigint') return estimate.maxFeePerGas;
  if (typeof estimate.gasPrice === 'bigint') return estimate.gasPrice;
  throw new Error('Current Arc gas fee estimate is unavailable.');
}

function ceilNativeGasToQuoteUnits(nativeAmount: bigint, quoteDecimals: number): bigint {
  if (!Number.isInteger(quoteDecimals) || quoteDecimals < 0 || quoteDecimals > ARC_NATIVE_USDC_DECIMALS) {
    throw new Error('Invalid Arc quote decimals for gas reserve calculation.');
  }
  const scale = BigInt(10) ** BigInt(ARC_NATIVE_USDC_DECIMALS - quoteDecimals);
  return nativeAmount === BigInt(0) ? BigInt(0) : (nativeAmount + scale - BigInt(1)) / scale;
}

async function readAllowance(
  publicClient: PublicClient,
  account: Address,
  token: Address,
  spender: Address,
): Promise<bigint> {
  return canonicalAmount(
    await publicClient.readContract({
      address: token,
      abi: ERC20_SPEND_ABI,
      functionName: 'allowance',
      args: [account, spender],
    }),
    'ERC20 allowance',
  );
}

async function waitForRecordedAllowance({
  publicClient,
  storage,
  record,
}: Readonly<{
  publicClient: PublicClient;
  storage?: Storage;
  record: AllowanceTransactionRecord;
}>): Promise<TransactionHash> {
  let currentRecord = record;
  if (storage) updateAllowanceTransactionStatus(storage, currentRecord.hash, 'CONFIRMING');

  let receipt: Awaited<ReturnType<PublicClient['waitForTransactionReceipt']>>;
  try {
    receipt = await publicClient.waitForTransactionReceipt({
      hash: currentRecord.hash,
      onReplaced: (replacement) => {
        const nextHash = replacementHash(replacement);
        if (!nextHash || nextHash === currentRecord.hash) return;
        if (storage) {
          removeAllowanceTransaction(storage, currentRecord.hash);
          currentRecord = { ...currentRecord, hash: nextHash, status: 'CONFIRMING' };
          persistAllowanceTransaction(storage, currentRecord);
        } else {
          currentRecord = { ...currentRecord, hash: nextHash, status: 'CONFIRMING' };
        }
      },
    });
  } catch (error) {
    if (storage) updateAllowanceTransactionStatus(storage, currentRecord.hash, 'UNKNOWN');
    throw new AllowanceConfirmationUnknownError(currentRecord.hash, error);
  }

  if (receipt.status !== 'success') {
    if (storage) removeAllowanceTransaction(storage, currentRecord.hash);
    throw new Error('Token approval reverted before the trade could be prepared.');
  }

  if (storage) removeAllowanceTransaction(storage, currentRecord.hash);
  return currentRecord.hash;
}

export function createTradeWalletAdapter({
  publicClient,
  walletClient,
  account,
  chainId,
  storage,
  now = () => new Date(),
}: TradeWalletAdapterInput) {
  return {
    async getAccount(): Promise<Address> {
      return account;
    },
    async getChainId(): Promise<number> {
      return chainId;
    },
    async ensurePreparedTransactionAllowance(transaction: PreparedBreadTransaction): Promise<void> {
      if (!transaction.allowance) return;
      const allowance = transaction.allowance;
      const currentAllowance = await readAllowance(
        publicClient,
        account,
        allowance.token,
        allowance.spender,
      );
      if (currentAllowance >= allowance.amount) return;

      const pending = storage
        ? findRecoverableAllowanceTransaction(storage, {
            chainId,
            account,
            token: allowance.token,
            spender: allowance.spender,
          })
        : undefined;

      if (pending) {
        await waitForRecordedAllowance({ publicClient, storage, record: pending });
        const recoveredAllowance = await readAllowance(
          publicClient,
          account,
          allowance.token,
          allowance.spender,
        );
        if (recoveredAllowance < allowance.amount) {
          throw new Error('Token approval confirmed, but the required allowance is no longer available.');
        }
        return;
      }

      const approvalHash = await walletClient.writeContract({
        account,
        address: allowance.token,
        abi: ERC20_SPEND_ABI,
        functionName: 'approve',
        args: [allowance.spender, allowance.amount],
      } as never) as TransactionHash;

      const record: AllowanceTransactionRecord = {
        chainId,
        hash: approvalHash,
        account,
        token: allowance.token,
        spender: allowance.spender,
        amount: allowance.amount.toString(10),
        submittedAt: now().toISOString(),
        status: 'SUBMITTED',
      };
      if (storage) persistAllowanceTransaction(storage, record);

      await waitForRecordedAllowance({ publicClient, storage, record });
      const confirmedAllowance = await readAllowance(
        publicClient,
        account,
        allowance.token,
        allowance.spender,
      );
      if (confirmedAllowance < allowance.amount) {
        throw new Error('Token approval confirmed, but the required allowance is no longer available.');
      }
    },
    async sendPreparedTransaction(transaction: PreparedBreadTransaction): Promise<TransactionHash> {
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

export async function recoverPersistedAllowanceTransactions({
  publicClient,
  storage,
  chainId,
}: Readonly<{
  publicClient: PublicClient;
  storage: Storage;
  chainId: number;
}>): Promise<void> {
  const records = loadRecoverableAllowanceTransactions(storage, chainId);
  for (const record of records) {
    try {
      await waitForRecordedAllowance({ publicClient, storage, record });
    } catch (error) {
      if (error instanceof AllowanceConfirmationUnknownError) continue;
      // A mined revert is terminal and waitForRecordedAllowance already removed it.
    }
  }
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
  return readErc20Balance(publicClient, account, asset);
}

/**
 * Arc native USDC and ERC-20 USDC share one underlying balance, so Buy MAX
 * cannot spend the full ERC-20 balance. Exact trade gas may be unestimable
 * before ERC-20 allowance exists; use the current block gas limit as a safe
 * per-wallet-transaction upper bound and current fee estimation, covering the
 * worst-case approval + trade pair. Conversion to 6-decimal quote units rounds
 * up so the reserve never loses a native-USDC remainder.
 */
export async function readArcBuyMaxBalance({
  publicClient,
  account,
  quoteAsset,
  quoteDecimals,
}: Readonly<{
  publicClient: PublicClient;
  account: Address;
  quoteAsset: Address;
  quoteDecimals: number;
}>): Promise<ArcBuyMaxBalance> {
  const [balance, latestBlock, feeEstimate] = await Promise.all([
    readErc20Balance(publicClient, account, quoteAsset),
    publicClient.getBlock({ blockTag: 'latest' }),
    publicClient.estimateFeesPerGas(),
  ]);
  const gasLimit = canonicalAmount(latestBlock.gasLimit, 'Arc block gas limit');
  const feePerGas = currentFeePerGas(feeEstimate);
  const nativeGasReserve = gasLimit * feePerGas * BUY_MAX_WALLET_TRANSACTION_UPPER_BOUND;
  const gasReserve = ceilNativeGasToQuoteUnits(nativeGasReserve, quoteDecimals);
  return {
    balance,
    gasReserve,
    maxInput: balance > gasReserve ? balance - gasReserve : BigInt(0),
  };
}
