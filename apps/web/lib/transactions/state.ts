export type TradeAction = 'BUY' | 'SELL';

export type TransactionStatus =
  | 'IDLE'
  | 'VALIDATING'
  | 'PREPARING'
  | 'AWAITING_SIGNATURE'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'REVERTED'
  | 'REPLACED'
  | 'UNKNOWN';

export type SubmittedTransactionRecord = Readonly<{
  chainId: number;
  hash: `0x${string}`;
  action: TradeAction;
  tokenAddress: `0x${string}`;
  submittedAt: string;
  status: Extract<TransactionStatus, 'SUBMITTED' | 'CONFIRMING' | 'CONFIRMED' | 'REVERTED' | 'REPLACED' | 'UNKNOWN'>;
}>;

export type TransactionState = Readonly<{
  action: TradeAction;
  tokenAddress: `0x${string}`;
  status: TransactionStatus;
  chainId?: number;
  hash?: `0x${string}`;
  submittedAt?: string;
  error?: string;
}>;

export type TransactionEvent =
  | Readonly<{ type: 'VALIDATE' }>
  | Readonly<{ type: 'PREPARE' }>
  | Readonly<{ type: 'AWAIT_SIGNATURE' }>
  | Readonly<{ type: 'SUBMIT'; record: SubmittedTransactionRecord }>
  | Readonly<{ type: 'CONFIRM' }>
  | Readonly<{ type: 'CONFIRMED' }>
  | Readonly<{ type: 'REJECT'; error?: string }>
  | Readonly<{ type: 'REVERT'; error?: string }>
  | Readonly<{ type: 'REPLACE'; record: SubmittedTransactionRecord }>
  | Readonly<{ type: 'UNKNOWN' }>
  | Readonly<{ type: 'RESET' }>;

export function createTransactionState(
  action: TradeAction,
  tokenAddress: `0x${string}`,
): TransactionState {
  return { action, tokenAddress, status: 'IDLE' };
}

const ACTIVE_LOCKED = new Set<TransactionStatus>([
  'VALIDATING',
  'PREPARING',
  'AWAITING_SIGNATURE',
  'SUBMITTED',
  'CONFIRMING',
]);

export function canSubmitTransactionAction(state: TransactionState): boolean {
  return !ACTIVE_LOCKED.has(state.status);
}

function withRecord(
  state: TransactionState,
  record: SubmittedTransactionRecord,
  status: TransactionStatus,
): TransactionState {
  return {
    ...state,
    action: record.action,
    tokenAddress: record.tokenAddress,
    chainId: record.chainId,
    hash: record.hash,
    submittedAt: record.submittedAt,
    status,
    error: undefined,
  };
}

function illegal(state: TransactionState, event: TransactionEvent): never {
  throw new Error(`Illegal transaction transition: ${state.status} -> ${event.type}`);
}

export function transitionTransactionState(
  state: TransactionState,
  event: TransactionEvent,
): TransactionState {
  switch (event.type) {
    case 'VALIDATE':
      if (state.status !== 'IDLE') return illegal(state, event);
      return { ...state, status: 'VALIDATING', error: undefined };
    case 'PREPARE':
      if (state.status !== 'VALIDATING') return illegal(state, event);
      return { ...state, status: 'PREPARING', error: undefined };
    case 'AWAIT_SIGNATURE':
      if (state.status !== 'PREPARING') return illegal(state, event);
      return { ...state, status: 'AWAITING_SIGNATURE', error: undefined };
    case 'SUBMIT':
      if (state.status !== 'AWAITING_SIGNATURE') return illegal(state, event);
      return withRecord(state, event.record, 'SUBMITTED');
    case 'CONFIRM':
      if (state.status !== 'SUBMITTED') return illegal(state, event);
      return { ...state, status: 'CONFIRMING' };
    case 'CONFIRMED':
      if (state.status !== 'CONFIRMING') return illegal(state, event);
      return { ...state, status: 'CONFIRMED' };
    case 'REJECT':
      if (state.status !== 'AWAITING_SIGNATURE') return illegal(state, event);
      return { ...state, status: 'REJECTED', error: event.error };
    case 'REVERT':
      if (state.status !== 'SUBMITTED' && state.status !== 'CONFIRMING') return illegal(state, event);
      return { ...state, status: 'REVERTED', error: event.error };
    case 'REPLACE':
      if (state.status !== 'SUBMITTED' && state.status !== 'CONFIRMING') return illegal(state, event);
      return withRecord(state, event.record, 'REPLACED');
    case 'UNKNOWN':
      if (state.status !== 'SUBMITTED' && state.status !== 'CONFIRMING') return illegal(state, event);
      return { ...state, status: 'UNKNOWN', error: undefined };
    case 'RESET':
      if (ACTIVE_LOCKED.has(state.status)) return illegal(state, event);
      return createTransactionState(state.action, state.tokenAddress);
  }
}
