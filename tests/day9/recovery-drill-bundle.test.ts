import { describe, expect, it } from 'vitest';

import {
  REQUIRED_RECOVERY_DRILL_IDS,
  runRecoveryDrills,
} from '../../scripts/day9/run-recovery-drills.mts';

const required = [
  'GUARDIAN_PAUSE_NEW_LAUNCHES',
  'ESCALATE_BUY_TRADING_PAUSE',
  'PROTOCOL_ADMIN_UNPAUSE',
  'APPLICATION_ROLLBACK',
  'RPC_FAILOVER',
  'INDEXER_REBUILD_RECONCILE',
  'SUBMITTED_TX_BROWSER_REFRESH_RECOVERY',
  'FAILED_GRADUATION_RETRY',
  'GUARDIAN_ROTATION',
  'MULTISIG_SIGNER_RECOVERY_ROTATION',
] as const;

describe('Day 9 pre-launch recovery drill bundle', () => {
  it(
    'maps every required recovery drill to executable evidence or the exact multisig environment blocker',
    async () => {
      expect(REQUIRED_RECOVERY_DRILL_IDS).toEqual(required);

      const summary = await runRecoveryDrills();
      expect(summary.drills.map((drill) => drill.id)).toEqual(required);

      for (const drill of summary.drills) {
        expect(['MISSING', 'UNEXECUTED']).not.toContain(drill.status);
        expect(drill.evidence).toBeTruthy();
        expect(drill.evidenceKind).not.toBe('PROSE_ONLY');
      }

      const multisig = summary.drills.find(
        (drill) => drill.id === 'MULTISIG_SIGNER_RECOVERY_ROTATION',
      );
      expect(multisig).toBeDefined();

      if (multisig?.status === 'BLOCKED') {
        expect(summary.status).toBe('BLOCKED');
        expect(summary.blocker).toBe('DAY9_RECOVERY_DRILL_BLOCKED_MULTISIG_ENVIRONMENT');
        expect(multisig.evidenceKind).toBe('ENVIRONMENT_BLOCKER');
      } else {
        expect(multisig?.status).toBe('PASS');
        expect(summary.status).toBe('PASS');
        expect(summary.blocker).toBeNull();
      }
    },
    600_000,
  );
});
