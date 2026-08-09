import type { Address, DecodedBreadEvent, Hex32 } from '../../packages/types/src/index.js';

declare const event: DecodedBreadEvent;

if (event.eventName === 'CurveBuy') {
  const buyer: Address = event.payload.buyer;
  const quoteIn: bigint = event.payload.quoteIn;
  const tokensOut: bigint = event.payload.tokensOut;
  void buyer;
  void quoteIn;
  void tokensOut;
}

if (event.eventName === 'FeePolicyUpdated') {
  const recipient: Address = event.payload.nextPolicy.protocolFeeRecipient;
  const tradeFeeBps: bigint = event.payload.nextPolicy.tradeFeeBps;
  void recipient;
  void tradeFeeBps;
}

if (event.eventName === 'GraduationCompleted') {
  const poolId: Hex32 = event.payload.poolId;
  const positionId: bigint = event.payload.positionId;
  const usdcUsed: bigint = event.payload.usdcUsed;
  void poolId;
  void positionId;
  void usdcUsed;
}

if (event.eventName === 'Transfer') {
  const from: Address = event.payload.from;
  const value: bigint = event.payload.value;
  void from;
  void value;
}
