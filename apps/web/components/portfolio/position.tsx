import { CreatorAttribution } from '@bread/ui';
import Link from 'next/link';
import { formatUnits } from 'viem';

import { BREAD_LAUNCH_TOKEN_DECIMALS } from '../../../../packages/protocol-sdk/src/constants';
import type { IndexedPortfolioHolding } from '../../../../packages/types/src/index';
import { formatIndexedCurrentValueUsdc } from '../../lib/portfolio/value';

function holdingName(holding: IndexedPortfolioHolding): string {
  return holding.name ?? holding.symbol ?? `${holding.tokenAddress.slice(0, 6)}…${holding.tokenAddress.slice(-4)}`;
}

function tokenInitial(holding: IndexedPortfolioHolding): string {
  return (holding.name ?? holding.symbol ?? 'B').trim().slice(0, 1).toUpperCase() || 'B';
}

export function PortfolioPosition({ holding }: Readonly<{ holding: IndexedPortfolioHolding }>) {
  const currentValue = formatIndexedCurrentValueUsdc(holding.currentValue) ?? '—';
  const tokenHref = `/token/${holding.tokenAddress}`;

  return (
    <tr className="bread-portfolio-position">
      <td className="bread-portfolio-position-token">
        <span>Token</span>
        <div className="bread-portfolio-position-token__identity">
          <span className="bread-portfolio-position-token__image" aria-hidden="true">
            {tokenInitial(holding)}
          </span>
          <div>
            <Link href={tokenHref}>
              <strong>{holdingName(holding)}</strong>
            </Link>
            <code>{holding.symbol ? `$${holding.symbol}` : holding.tokenAddress}</code>
            <CreatorAttribution creatorAddress={holding.creatorAddress} />
          </div>
        </div>
      </td>
      <td className="bread-portfolio-position-balance">
        <span>Amount held</span>
        <strong>{formatUnits(BigInt(holding.balance), BREAD_LAUNCH_TOKEN_DECIMALS)}</strong>
      </td>
      <td className="bread-portfolio-position-value">
        <span>Current value</span>
        <strong>{currentValue}</strong>
      </td>
      <td className="bread-portfolio-position-trade">
        <span>Action</span>
        <Link className="bread-portfolio-trade-action" href={tokenHref}>Trade</Link>
      </td>
    </tr>
  );
}
