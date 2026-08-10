import { expect, test as base, type Page } from '@playwright/test';

import {
  createIndexedApiFixtureState,
  installIndexedApiRoutes,
  type IndexedApiFixtureState,
} from './indexed-api';
import { createRpcFixtureState, installRpcRoutes, type RpcFixtureState } from './rpc';
import { installInjectedWallet } from './wallet';

export type BreadE2EFixtures = Readonly<{
  indexedApiState: IndexedApiFixtureState;
  rpcState: RpcFixtureState;
}>;

export const test = base.extend<BreadE2EFixtures>({
  indexedApiState: async ({}, use) => {
    await use(createIndexedApiFixtureState());
  },
  rpcState: async ({}, use) => {
    await use(createRpcFixtureState());
  },
  page: async ({ page, context, indexedApiState, rpcState }, use) => {
    await installInjectedWallet(context);
    await installIndexedApiRoutes(page, indexedApiState);
    await installRpcRoutes(page, rpcState);
    await use(page);
  },
});

export { expect };

export async function walletSnapshot(page: Page): Promise<Readonly<{
  connected: boolean;
  chainIdHex: string;
  requests: readonly Readonly<{ method: string; params: readonly unknown[] }>[];
  submittedTransactions: readonly unknown[];
}>> {
  return page.evaluate(() => {
    const controller = (window as typeof window & {
      __breadE2EWallet?: {
        snapshot(): Readonly<{
          connected: boolean;
          chainIdHex: string;
          requests: readonly Readonly<{ method: string; params: readonly unknown[] }>[];
          submittedTransactions: readonly unknown[];
        }>;
      };
    }).__breadE2EWallet;
    if (!controller) throw new Error('Injected E2E wallet controller is unavailable.');
    return controller.snapshot();
  });
}
