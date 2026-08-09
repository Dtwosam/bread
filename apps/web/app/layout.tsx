import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import { MobileNavigation, Navigation } from '../../../packages/ui/src/index';
import '../../../packages/ui/src/theme.css';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--bread-font-sans',
});

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="bread-shell">
          <header className="bread-header">
            <div className="bread-header__inner">
              <a className="bread-brand" href="/explore" aria-label="Bread home">
                Bread
              </a>
              <Navigation />
            </div>
          </header>

          <div className="bread-mobile-top">
            <a className="bread-brand" href="/explore" aria-label="Bread home">
              Bread
            </a>
          </div>

          {children}

          <div className="bread-mobile-bottom">
            <MobileNavigation />
          </div>
        </div>
      </body>
    </html>
  );
}
