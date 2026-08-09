import { decodeErrorResult, type Abi } from 'viem';

import type { BreadContractRole, Hex } from '../../types/src/index.js';
import type { ProtocolContext } from './context.js';
import { createBreadStackAbiBinding } from './events.js';

export type DecodedBreadError =
  | Readonly<{
      contractRole: BreadContractRole;
      errorName: string;
      args: readonly unknown[];
    }>
  | Readonly<{
      errorName: 'UNKNOWN_REVERT';
      data: Hex;
    }>;

const roleToRegistryKey = [
  ['FACTORY', 'factory'],
  ['CURVE', 'curve'],
  ['FEE_ESCROW', 'feeEscrow'],
  ['FEE_POLICY', 'feePolicy'],
  ['EMERGENCY_CONTROLLER', 'emergencyController'],
  ['GRADUATION_COORDINATOR', 'coordinator'],
  ['LOCKER', 'locker'],
  ['LAUNCH_TOKEN', 'launchToken'],
] as const;

function registeredErrorNames(abi: Abi): ReadonlySet<string> {
  return new Set(
    abi
      .filter((item): item is Extract<Abi[number], { type: 'error' }> => item.type === 'error')
      .map((item) => item.name),
  );
}

/**
 * Decodes only errors present in the ABI registry explicitly bound to this
 * ProtocolContext's stack identity. If a selector is unknown or maps to more
 * than one Bread contract role, the decoder preserves raw revert data instead
 * of inventing a contract/error attribution.
 */
export function decodeBreadError(data: Hex, context: ProtocolContext): DecodedBreadError {
  const binding = createBreadStackAbiBinding(context.stackVersion);
  const matches: Array<Exclude<DecodedBreadError, { errorName: 'UNKNOWN_REVERT' }>> = [];

  for (const [contractRole, registryKey] of roleToRegistryKey) {
    const abi = binding.registry[registryKey] as Abi;
    try {
      const decoded = decodeErrorResult({ abi, data });
      if (!registeredErrorNames(abi).has(decoded.errorName)) continue;
      matches.push({
        contractRole,
        errorName: decoded.errorName,
        args: decoded.args === undefined ? [] : Array.from(decoded.args),
      });
    } catch {
      // This ABI does not own the selector/data shape. Try the next registered role.
    }
  }

  return matches.length === 1 ? matches[0]! : { errorName: 'UNKNOWN_REVERT', data };
}
