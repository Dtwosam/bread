const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function assertAddress(value, label) {
  if (!ADDRESS_RE.test(value ?? '') || /^0x0{40}$/i.test(value)) {
    throw new Error(`${label} must be a non-zero EVM address`);
  }
  return value.toLowerCase();
}

export function validateAuthoritySet({ deployer, guardian, owners }) {
  if (!Array.isArray(owners) || owners.length !== 3) {
    throw new Error('exactly three Safe owners are required');
  }

  const normalizedDeployer = assertAddress(deployer, 'deployer');
  const normalizedGuardian = assertAddress(guardian, 'guardian');
  const normalizedOwners = owners.map((owner, index) => assertAddress(owner, `owner${index + 1}`));

  if (normalizedDeployer === normalizedGuardian) {
    throw new Error('Guardian must be separate from deployment authority');
  }

  const ownerSet = new Set(normalizedOwners);
  if (ownerSet.size !== 3) throw new Error('Safe owners must be distinct');
  if (ownerSet.has(normalizedDeployer)) throw new Error('deployment authority must not be a Safe owner');
  if (ownerSet.has(normalizedGuardian)) throw new Error('Guardian must not be a Safe owner');
}

export function renderSecretEnv(values) {
  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${String(value).replaceAll('\n', '')}`)
    .join('\n')}\n`;
}

export function publicAuthoritySummary({ deployer, guardian, owners, secretFile }) {
  validateAuthoritySet({ deployer, guardian, owners });
  return {
    status: 'DAY9_ARC_SAFE_TEST_AUTHORITIES_PREPARED',
    deploymentAuthority: deployer,
    guardian,
    safeOwners: [...owners],
    threshold: 2,
    ownerCount: 3,
    secretFile,
    secretsPrinted: false,
    productionAuthorityClaim: false,
    nextAction: 'FUND_DEPLOYMENT_AUTHORITY_THEN_CREATE_CHAIN_SPECIFIC_2_OF_3_SAFE',
  };
}
