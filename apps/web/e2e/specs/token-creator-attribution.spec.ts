import { ACTIVE_TOKEN, E2E_DEPLOYER, E2E_WALLET } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

test('Token header attributes the canonical onchain creator and not the fee recipient', async ({ page }) => {
  await page.goto(`/token/${ACTIVE_TOKEN}`);

  const identity = page.locator('.bread-token-identity');
  await expect(identity).toBeVisible();

  const creator = identity.locator(`[data-creator-address="${E2E_DEPLOYER}"]`);
  await expect(creator).toBeVisible();
  await expect(creator).toHaveAttribute('title', E2E_DEPLOYER);
  await expect(creator).toContainText('by 0x1000…0002');

  await expect(identity).not.toContainText(E2E_WALLET);
});
