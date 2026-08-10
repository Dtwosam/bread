import type { ReactNode } from 'react';
import { Geist_Mono, Inter } from 'next/font/google';

import { MobileNavigation, Navigation } from '@bread/ui';
import '@bread/ui/theme.css';
import { Providers } from '../components/providers';
import { SearchSurface } from '../components/search-surface';
import { WalletButton } from '../components/wallet/wallet-button';
import './globals.css';
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
                <Navigation />
                <SearchSurface />
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
              <MobileNavigation />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
