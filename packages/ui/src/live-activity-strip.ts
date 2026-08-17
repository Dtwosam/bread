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
  return createElement(
    'div',
    {
      className: 'bread-live-strip',
      'data-status': status,
      'aria-live': 'polite',
    },
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
