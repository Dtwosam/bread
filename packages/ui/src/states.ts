import { createElement } from 'react';

export function Skeleton({ label = 'Loading' }: Readonly<{ label?: string }>) {
  return createElement(
    'div',
    { className: 'bread-skeleton', role: 'status', 'aria-live': 'polite', 'aria-label': label },
    createElement('span', { className: 'bread-visually-hidden' }, label),
  );
}

export function EmptyState({ title, detail }: Readonly<{ title: string; detail?: string }>) {
  return createElement(
    'section',
    { className: 'bread-state bread-state--empty' },
    createElement('h2', null, title),
    detail ? createElement('p', null, detail) : null,
  );
}

export function ErrorState({ title, detail }: Readonly<{ title: string; detail?: string }>) {
  return createElement(
    'section',
    { className: 'bread-state bread-state--error', role: 'alert' },
    createElement('h2', null, title),
    detail ? createElement('p', null, detail) : null,
  );
}
