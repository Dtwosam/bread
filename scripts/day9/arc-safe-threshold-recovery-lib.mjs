const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/;
export const SAFE_SENTINEL_OWNERS = '0x0000000000000000000000000000000000000001';

function normalizeAddress(value, label) {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) {
    throw new Error(`${label} must be an address`);
  }
  return value.toLowerCase();
}

function normalizedUniqueOwners(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const owners = values.map((value, index) => normalizeAddress(value, `${label}[${index}]`));
  if (new Set(owners).size !== owners.length) throw new Error(`${label} contains duplicate owners`);
  return owners;
}

function sameOwnerSet(left, right) {
  if (left.length !== right.length) return false;
  const expected = new Set(right);
  return left.every((owner) => expected.has(owner));
}

export function predecessorForOwner(currentOwners, owner) {
  const owners = normalizedUniqueOwners(currentOwners, 'currentOwners');
  const target = normalizeAddress(owner, 'owner');
  const index = owners.indexOf(target);
  if (index === -1) throw new Error(`owner ${target} is not in the Safe owner list`);
  return index === 0 ? SAFE_SENTINEL_OWNERS : owners[index - 1];
}

export function classifySafeRecoveryState({
  currentOwners,
  originalOwners,
  recoveryOwner,
  removedOwner,
  threshold,
  startNonce,
  currentNonce,
}) {
  const current = normalizedUniqueOwners(currentOwners, 'currentOwners');
  const original = normalizedUniqueOwners(originalOwners, 'originalOwners');
  const recovery = normalizeAddress(recoveryOwner, 'recoveryOwner');
  const removed = normalizeAddress(removedOwner, 'removedOwner');

  if (original.length !== 3) throw new Error('original Safe owner set must contain exactly 3 owners');
  if (threshold !== 2n) throw new Error(`Safe recovery threshold must remain 2, got ${String(threshold)}`);
  if (typeof startNonce !== 'bigint' || startNonce < 0n) throw new Error('startNonce must be a non-negative bigint');
  if (typeof currentNonce !== 'bigint' || currentNonce < startNonce) {
    throw new Error('currentNonce must be a bigint at or after startNonce');
  }
  if (!original.includes(removed)) throw new Error('removedOwner must be one of the original Safe owners');
  if (original.includes(recovery)) throw new Error('recoveryOwner must be distinct from all original Safe owners');

  if (sameOwnerSet(current, original) && currentNonce === startNonce) {
    return 'ROTATE_TO_RECOVERY_OWNER';
  }

  const rotated = original.map((owner) => (owner === removed ? recovery : owner));
  if (sameOwnerSet(current, rotated) && currentNonce === startNonce + 1n) {
    return 'RESTORE_ORIGINAL_OWNER';
  }

  if (sameOwnerSet(current, original) && currentNonce === startNonce + 2n) {
    return 'VERIFY_COMPLETE';
  }

  throw new Error(
    `unexpected Safe recovery state: owners=${current.join(',')} threshold=${threshold} nonce=${currentNonce} startNonce=${startNonce}`,
  );
}

export function sortSafeSignatures(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('at least one Safe signature is required');
  const normalized = entries.map((entry, index) => {
    const owner = normalizeAddress(entry?.owner, `entries[${index}].owner`);
    const signature = entry?.signature;
    if (typeof signature !== 'string' || !SIGNATURE_RE.test(signature)) {
      throw new Error(`entries[${index}].signature must be a 65-byte hex signature`);
    }
    return { owner, signature: signature.toLowerCase() };
  });
  if (new Set(normalized.map((entry) => entry.owner)).size !== normalized.length) {
    throw new Error('Safe signature owners must be distinct');
  }
  return normalized.sort((left, right) => left.owner.localeCompare(right.owner));
}

export function packSafeSignatures(entries) {
  return `0x${sortSafeSignatures(entries).map((entry) => entry.signature.slice(2)).join('')}`;
}

export function splitPackedSafeSignatures(packed) {
  if (typeof packed !== 'string' || !/^0x[0-9a-fA-F]+$/.test(packed)) {
    throw new Error('packed Safe signatures must be hex');
  }
  const body = packed.slice(2);
  const signatureHexLength = 65 * 2;
  if (body.length === 0 || body.length % signatureHexLength !== 0) {
    throw new Error('packed Safe signatures must contain complete 65-byte signatures');
  }
  const signatures = [];
  for (let offset = 0; offset < body.length; offset += signatureHexLength) {
    signatures.push(`0x${body.slice(offset, offset + signatureHexLength).toLowerCase()}`);
  }
  return signatures;
}

export function safeEthSignToStandardSignature(signature) {
  if (typeof signature !== 'string' || !SIGNATURE_RE.test(signature)) {
    throw new Error('Safe eth_sign signature must be 65-byte hex');
  }
  const safeV = Number.parseInt(signature.slice(-2), 16);
  if (safeV !== 31 && safeV !== 32) {
    throw new Error(`Safe eth_sign signature v must be 31 or 32, got ${safeV}`);
  }
  return `${signature.slice(0, -2).toLowerCase()}${(safeV - 4).toString(16).padStart(2, '0')}`;
}
