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
    'maps every required recovery drill to executed evidence including the retained real Safe threshold rehearsal',
    async () => {
      expect(REQUIRED_RECOVERY_DRILL_IDS).toEqual(required);

      const summary = await runRecoveryDrills();
      expect(summary.drills.map((drill) => drill.id)).toEqual(required);

      for (const drill of summary.drills) {
        expect(['BLOCKED', 'MISSING', 'UNEXECUTED']).not.toContain(drill.status);
        expect(drill.evidence).toBeTruthy();
        expect(drill.evidenceKind).not.toBe('PROSE_ONLY');
        expect(drill.evidenceKind).not.toBe('ENVIRONMENT_BLOCKER');
      }

      const multisig = summary.drills.find(
        (drill) => drill.id === 'MULTISIG_SIGNER_RECOVERY_ROTATION',
      );
      expect(multisig).toMatchObject({
        status: 'PASS',
        evidence: 'docs/evidence/day9-safe-threshold-recovery.json',
        evidenceKind: 'EXECUTED_REHEARSAL',
      });
      expect(summary.status).toBe('PASS');
      expect(summary.blocker).toBeNull();
    },
    600_000,
  );
});
