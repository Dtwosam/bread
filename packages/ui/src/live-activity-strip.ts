import { createElement } from 'react';

export type LiveActivityStatus = 'CHECKING' | 'FRESH' | 'LAGGING' | 'REBUILDING' | 'DEGRADED' | 'UNAVAILABLE';

export type LiveActivityStripProps = Readonly<{
  status: LiveActivityStatus;
  indexedThroughBlock?: string | null;
}>;

function statusCopy(status: LiveActivityStatus): string {
  switch (status) {
    case 'FRESH':
      return 'LIVE';
    case 'LAGGING':
      return 'Live updates delayed';
    case 'REBUILDING':
      return 'Live updates rebuilding';
    case 'CHECKING':
      return 'Checking live updates';
    default:
      return 'Live updates paused';
  }
}

export function LiveActivityStrip({ status, indexedThroughBlock }: LiveActivityStripProps) {
  const isFresh = status === 'FRESH';
  const classes = [
    'bread-live-strip',
    isFresh ? 'bread-live-strip--fresh' : 'bread-live-strip--degraded',
  ].join(' ');

  return createElement(
    'div',
    { className: classes, 'aria-live': 'polite' },
    createElement(
      'span',
      { className: 'bread-live-strip__status' },
      statusCopy(status),
    ),
    indexedThroughBlock
      ? createElement(
          'span',
          { className: 'bread-live-strip__detail bread-financial-value' },
          `Indexed through #${indexedThroughBlock}`,
        )
      : null,
  );
}
