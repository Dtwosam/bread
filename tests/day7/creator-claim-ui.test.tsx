import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const creatorPage = 'apps/web/app/creator/page.tsx';
const claimPanel = 'apps/web/components/creator/claim-panel.tsx';

describe('Day 7 Task 7 Creator claim UI integration', () => {
  it('executes only the approved claim review and exposes the shared transaction lifecycle', () => {
    const page = read(creatorPage);
    const panel = read(claimPanel);

    expect(page).toContain('executeClaimLifecycle');
    expect(page).toContain('recoverClaimTransactions');
    expect(page).toContain('TransactionStatus');
    expect(page).toContain('runtime.storage');
    expect(page).toContain('approved: claimReview');
    expect(page).toContain('setClaimReview(result.review)');

    expect(panel).toContain('Claim USDC');
    expect(panel).toContain('onClaim');
    expect(panel).toMatch(/disabled=.*!review|!review.*disabled/s);
  });

  it('refreshes the indexed creator projection after confirmed execution and reload recovery', () => {
    const page = read(creatorPage);

    expect(page).toContain('useQueryClient');
    expect(page).toContain('queryClient.invalidateQueries');
    expect(page).toContain('breadQueryKeys.creator(account)');
    expect(page).toContain('onConfirmed');
    expect(page).toContain('recoverClaimTransactions');
  });
});
