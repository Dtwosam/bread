import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';

// WalletConnect origins required by the connector Bread actually ships.
// Enumerated from the installed @walletconnect/ethereum-provider dependency
// surface, not guessed:
//   - secure.walletconnect.org / secure-mobile.walletconnect.{org,com} serve
//     the Verify attestation SDK inside an iframe, so they need frame-src;
//     without it default-src 'self' blocks the frame.
//   - fonts.reown.com serves the connection modal's webfonts.
// The relay (wss://relay.walletconnect.org) and the modal/registry/analytics
// HTTP endpoints are already permitted by the existing connect-src.
const walletConnectFrameOrigins = [
  'https://secure.walletconnect.org',
  'https://secure-mobile.walletconnect.org',
  'https://secure-mobile.walletconnect.com',
].join(' ');

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https: wss:",
  "img-src 'self' https: data: blob:",
  `frame-src 'self' ${walletConnectFrameOrigins}`,
  "font-src 'self' data: https://fonts.reown.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
