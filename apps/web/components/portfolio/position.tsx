import Link from 'next/link';
import { formatUnits } from 'viem';

import { BREAD_LAUNCH_TOKEN_DECIMALS } from '../../../../packages/protocol-sdk/src/constants';
import type { IndexedPortfolioHolding } from '../../../../packages/types/src/index';

function holdingName(holding: IndexedPortfolioHolding): string {
  return holding.name ?? holding.symbol ?? `${holding.tokenAddress.slice(0, 6)}…${holding.tokenAddress.slice(-4)}`;
}

export function PortfolioPosition({ holding }: Readonly<{ holding: IndexedPortfolioHolding }>) {
  return (
    <Link className="bread-portfolio-position" href={`/token/${holding.tokenAddress}`}>
      <span className="bread-portfolio-position-token">
        <strong>{holdingName(holding)}</strong>
        <span>{holding.symbol ?? '—'}</span>
      </span>
      <span className="bread-portfolio-position-balance">
        <span>Balance</span>
        <strong>{formatUnits(BigInt(holding.balance), BREAD_LAUNCH_TOKEN_DECIMALS)}</strong>
      </span>
      <span className="bread-portfolio-position-value">
        <span>Current value</span>
        <strong>{holding.currentValue.status === 'AVAILABLE' ? 'Indexed USDC value available' : '—'}</strong>
      </span>
    </Link>
  );
}
