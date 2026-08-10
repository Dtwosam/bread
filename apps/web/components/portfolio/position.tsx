import Link from 'next/link';
import { formatUnits } from 'viem';

import { BREAD_LAUNCH_TOKEN_DECIMALS } from '../../../../packages/protocol-sdk/src/constants';
import type { IndexedPortfolioHolding } from '../../../../packages/types/src/index';
import { formatIndexedCurrentValueUsdc } from '../../lib/portfolio/value';

function holdingName(holding: IndexedPortfolioHolding): string {
  return holding.name ?? holding.symbol ?? `${holding.tokenAddress.slice(0, 6)}…${holding.tokenAddress.slice(-4)}`;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function PortfolioPosition({ holding }: Readonly<{ holding: IndexedPortfolioHolding }>) {
  const currentValue = formatIndexedCurrentValueUsdc(holding.currentValue) ?? '—';
  const lastEvent = holding.activity.lastEvent;

  return (
    <tr className="bread-portfolio-position">
      <td className="bread-portfolio-position-token">
        <span>Token</span>
        <Link href={`/token/${holding.tokenAddress}`}>
          <strong>{holdingName(holding)}</strong>
        </Link>
        <code>{holding.symbol ?? holding.tokenAddress}</code>
      </td>
      <td className="bread-portfolio-position-balance">
        <span>Balance</span>
        <strong>{formatUnits(BigInt(holding.balance), BREAD_LAUNCH_TOKEN_DECIMALS)}</strong>
      </td>
      <td className="bread-portfolio-position-value">
        <span>Current value</span>
        <strong>{currentValue}</strong>
      </td>
      <td className="bread-portfolio-position-movement">
        <span>Movement</span>
        <strong>—</strong>
      </td>
      <td className="bread-portfolio-position-activity">
        <span>Activity</span>
        {lastEvent ? <code>{shortHash(lastEvent.transactionHash)}</code> : <strong>Block {holding.activity.asOfBlockNumber}</strong>}
      </td>
    </tr>
  );
}
