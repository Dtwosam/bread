function sameAddress(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

export function assertArcSmokeFinalEvidence({
  creatorClaimLogCount,
  creatorCredit,
  graduationPhase,
  sweptUsdc,
  sweptTokens,
  poolTokenAmount,
  lockerPositionManager,
  graduationPositionManager,
  lockerPositionId,
  graduationPositionId,
  nftOwner,
  locker,
  replayRejected,
}) {
  if (!Number.isSafeInteger(creatorClaimLogCount) || creatorClaimLogCount < 1) {
    throw new Error('FeeClaimed evidence is required');
  }
  if (creatorCredit !== 0n) throw new Error(`creator credit remains: ${creatorCredit}`);
  if (Number(graduationPhase) !== 2) throw new Error(`graduation phase is not POOL_CREATED: ${graduationPhase}`);
  if (sweptUsdc !== 0n || sweptTokens !== 0n || poolTokenAmount !== 0n) {
    throw new Error(`graduation residue remains: ${sweptUsdc}/${sweptTokens}/${poolTokenAmount}`);
  }
  if (!sameAddress(lockerPositionManager, graduationPositionManager)) {
    throw new Error('graduation Position Manager does not match locker');
  }
  if (lockerPositionId === 0n || graduationPositionId !== lockerPositionId) {
    throw new Error('graduation position ID does not match locker');
  }
  if (!sameAddress(nftOwner, locker)) throw new Error('LP NFT is not owned by the permanent locker');
  if (replayRejected !== true) throw new Error('graduation replay was not rejected');
  return true;
}
