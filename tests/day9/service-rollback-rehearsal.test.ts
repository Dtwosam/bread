import { describe, expect, it } from 'vitest';

import { rehearseServiceRollback } from '../../scripts/day9/rehearse-service-rollback.mts';

describe('Day 9 service rollback rehearsal', () => {
  it(
    'restores the known-good web/API/indexer release after a deliberately unhealthy candidate',
    async () => {
      const result = await rehearseServiceRollback({
        knownGoodCommit: 'fe9b13f1ce271fd5423fdd76de13034dac18fee1',
        candidateMode: 'INJECTED_UNHEALTHY_APPLICATION_ONLY',
      });

      expect(result).toMatchObject({
        rollback: 'PASS',
        contractMutationCount: 0,
        authoritativeReconcile: 'PASS',
        candidateFailureObserved: true,
        routerTarget: 'KNOWN_GOOD',
        webHealth: 'PASS',
        apiHealth: 'PASS',
        indexerHealth: 'PASS',
      });
      expect(result.checkpointAfter).toBeGreaterThanOrEqual(result.checkpointBefore);
    },
    300_000,
  );
});
