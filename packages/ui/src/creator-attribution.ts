import { createElement } from 'react';

export type CreatorAttributionSize = 'default' | 'token-header';

export type CreatorAttributionProps = Readonly<{
  creatorAddress?: string | null;
  displayName?: string | null;
  isCurrentUser?: boolean;
  size?: CreatorAttributionSize;
  className?: string;
}>;

function shortCreatorAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function creatorDisplay({
  creatorAddress,
  displayName,
  isCurrentUser,
}: Pick<CreatorAttributionProps, 'creatorAddress' | 'displayName' | 'isCurrentUser'>): string {
  if (isCurrentUser) return 'you';

  const trustedDisplayName = displayName?.trim();
  if (trustedDisplayName) {
    return trustedDisplayName.startsWith('@') ? trustedDisplayName : `@${trustedDisplayName}`;
  }

  const address = creatorAddress?.trim();
  return address ? shortCreatorAddress(address) : '—';
}

export function CreatorAttribution({
  creatorAddress,
  displayName,
  isCurrentUser = false,
  size = 'default',
  className,
}: CreatorAttributionProps) {
  const authoritativeWallet = creatorAddress?.trim() || undefined;
  const classes = [
    'bread-creator-attribution',
    size === 'token-header' ? 'bread-creator-attribution--token-header' : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return createElement(
    'span',
    {
      className: classes,
      title: authoritativeWallet,
      'data-creator-address': authoritativeWallet,
    },
    createElement('span', { className: 'bread-creator-attribution__prefix' }, 'by'),
    createElement(
      'span',
      { className: 'bread-creator-attribution__identity' },
      creatorDisplay({ creatorAddress, displayName, isCurrentUser }),
    ),
  );
}
