import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ACTIVE_TOKEN } from '../fixtures/constants';
import { expect, test } from '../fixtures/browser';

type MatrixStatus = 'PASS' | 'EXTERNAL_EXECUTION_REQUIRED' | 'NO_FIRST_CLASS_WALLET_BROWSER_CLAIM';
type EvidenceKind =
  | 'AUTOMATED_BROWSER_ENGINE'
  | 'EMULATION'
  | 'PHYSICAL_EXECUTION'
  | 'EXTERNAL_EXECUTION'
  | 'NOT_CLAIMED';

type MatrixRow = Readonly<{
  target: string;
  status: MatrixStatus;
  evidenceKind: EvidenceKind;
  evidence: string;
}>;

const evidencePath = path.resolve(process.cwd(), '../../docs/evidence/day9-browser-device-wallet-matrix.md');

function parseMatrix(markdown: string): MatrixRow[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('---'))
    .slice(1)
    .map((line) => {
      const [target, status, evidenceKind, evidence] = line
        .split('|')
        .slice(1, -1)
        .map((value) => value.trim());
      return {
        target,
        status: status as MatrixStatus,
        evidenceKind: evidenceKind as EvidenceKind,
        evidence,
      };
    });
}

function row(rows: readonly MatrixRow[], target: string): MatrixRow {
  const found = rows.find((candidate) => candidate.target === target);
  if (!found) throw new Error(`missing release-matrix row: ${target}`);
  return found;
}

test('release matrix distinguishes automated engines, emulation, physical devices, and unclaimed wallet browsers', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One truthfulness validation is sufficient.');

  const rows = parseMatrix(await readFile(evidencePath, 'utf8'));

  for (const target of ['Desktop Chromium', 'Desktop Firefox', 'Desktop WebKit']) {
    const current = row(rows, target);
    expect(current.status).toBe('PASS');
    expect(current.evidenceKind).toBe('AUTOMATED_BROWSER_ENGINE');
    expect(current.evidence.length).toBeGreaterThan(0);
  }

  const mobileEmulation = row(rows, 'Mobile Chromium emulation');
  expect(mobileEmulation.status).toBe('PASS');
  expect(mobileEmulation.evidenceKind).toBe('EMULATION');

  for (const target of ['macOS Safari', 'iOS Safari', 'Android Chrome physical']) {
    const current = row(rows, target);
    expect(['PASS', 'EXTERNAL_EXECUTION_REQUIRED']).toContain(current.status);
    if (current.status === 'PASS') {
      expect(current.evidenceKind).toBe('PHYSICAL_EXECUTION');
      expect(current.evidence.toLowerCase()).not.toMatch(/emulat|webkit engine/);
    } else {
      expect(current.evidenceKind).toBe('EXTERNAL_EXECUTION');
    }
  }

  const walletBrowser = row(rows, 'Wallet / in-app browsers');
  expect(['PASS', 'NO_FIRST_CLASS_WALLET_BROWSER_CLAIM']).toContain(walletBrowser.status);
  if (walletBrowser.status === 'PASS') expect(walletBrowser.evidenceKind).toBe('PHYSICAL_EXECUTION');
  else expect(walletBrowser.evidenceKind).toBe('NOT_CLAIMED');
});

test('primary trade controls are keyboard reachable with visible focus and reduced motion is honored', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Keyboard focus proof is desktop-engine evidence; mobile keyboard pressure has its own retained journey.');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/token/${ACTIVE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Bread Twin' })).toBeVisible();

  const trade = page.getByRole('complementary', { name: 'Trade' });
  const connect = trade.getByRole('button', { name: 'Connect wallet' });
  await expect(connect).toBeVisible();

  let reached = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.keyboard.press('Tab');
    reached = await connect.evaluate((element) => element === document.activeElement);
    if (reached) break;
  }
  expect(reached).toBe(true);

  const focusStyle = await connect.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0);

  const motion = await connect.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      transitionDuration: style.transitionDuration,
      animationDuration: style.animationDuration,
    };
  });
  const firstTransitionSeconds = Number.parseFloat(motion.transitionDuration);
  const firstAnimationSeconds = Number.parseFloat(motion.animationDuration);
  expect(firstTransitionSeconds).toBeLessThanOrEqual(0.00001);
  expect(firstAnimationSeconds).toBeLessThanOrEqual(0.00001);
});
