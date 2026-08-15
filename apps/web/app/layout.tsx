import { Suspense, type ReactNode } from 'react';
import { Geist_Mono, Inter } from 'next/font/google';

import { MobileNavigation, Navigation } from '@bread/ui';
import '@bread/ui/theme.css';
import { PrimaryMobileNavigation, PrimaryNavigation } from '../components/primary-navigation';
import { Providers } from '../components/providers';
import { SearchSurface } from '../components/search-surface';
import { WalletButton } from '../components/wallet/wallet-button';
import './globals.css';
import './shell-v2.css';
import './portfolio-creator.css';
import './wallet.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--bread-font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--bread-font-mono',
});

function WatchlistShellControl() {
  return (
    <button
      type="button"
      className="bread-header__watchlist"
      aria-label="Watchlist"
      disabled
      title="Watchlist will be enabled in the Portfolio and watchlist lane."
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m12 3.7 2.5 5.06 5.58.81-4.04 3.94.95 5.56L12 16.45l-4.99 2.62.95-5.56-4.04-3.94 5.58-.81L12 3.7Z" />
      </svg>
    </button>
  );
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        <Providers>
          <div className="bread-shell">
            <header className="bread-header">
              <div className="bread-header__inner">
                <a className="bread-brand" href="/explore" aria-label="Bread home">
                  Bread
                </a>
                <Suspense fallback={<Navigation />}>
                  <PrimaryNavigation />
                </Suspense>
                <div className="bread-header__search">
                  <SearchSurface />
                </div>
                <WatchlistShellControl />
                <WalletButton />
              </div>
            </header>

            <div className="bread-mobile-top">
              <a className="bread-brand" href="/explore" aria-label="Bread home">
                Bread
              </a>
              <SearchSurface compact />
              <WalletButton />
            </div>

            {children}

            <div className="bread-mobile-bottom">
              <Suspense fallback={<MobileNavigation />}>
                <PrimaryMobileNavigation />
              </Suspense>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
