import { describe, expect, it } from 'vitest';

async function loadReadinessModule() {
  const path = '../../scripts/day9/check-rehearsal-readiness.mts';
  try {
    return await import(/* @vite-ignore */ path) as Readonly<{
      assessDay9RehearsalReadiness: (input: Readonly<{
        network: 'arc-testnet' | 'arc-mainnet';
        mode: 'CANONICAL' | 'CONTROLLED_FIXTURE';
      }>) => unknown;
    }>;
  } catch {
    return null;
  }
}

describe('Day 9 rehearsal readiness', () => {
  it('recognizes the verified Arc Testnet DEX and Bread deployment as canonical rehearsal-ready', async () => {
    const module = await loadReadinessModule();
    expect(module?.assessDay9RehearsalReadiness).toBeTypeOf('function');
    if (!module) return;

    expect(module.assessDay9RehearsalReadiness({ network: 'arc-testnet', mode: 'CANONICAL' })).toMatchObject({
      ready: true,
      mode: 'CANONICAL',
      canonicalDeploymentClaim: true,
      productionMoneyClaim: false,
    });
  });

  it('blocks Arc mainnet while official values remain absent', async () => {
    const module = await loadReadinessModule();
    expect(module?.assessDay9RehearsalReadiness).toBeTypeOf('function');
    if (!module) return;

    expect(module.assessDay9RehearsalReadiness({ network: 'arc-mainnet', mode: 'CANONICAL' })).toMatchObject({
      ready: false,
      code: 'ARC_MAINNET_VALUES_REQUIRED',
    });
  });

  it('never upgrades a controlled fixture rehearsal into canonical readiness', async () => {
    const module = await loadReadinessModule();
    expect(module?.assessDay9RehearsalReadiness).toBeTypeOf('function');
    if (!module) return;

    expect(module.assessDay9RehearsalReadiness({ network: 'arc-testnet', mode: 'CONTROLLED_FIXTURE' })).toMatchObject({
      ready: true,
      mode: 'CONTROLLED_FIXTURE',
      canonicalDeploymentClaim: false,
      productionMoneyClaim: false,
    });
  });
});
