import { createElement, type ReactNode } from 'react';

export type ActivityRowProps = Readonly<{
  href: string;
  primary: ReactNode;
  secondary?: ReactNode;
  meta?: ReactNode;
}>;

export function ActivityRow({ href, primary, secondary, meta }: ActivityRowProps) {
  return createElement(
    'a',
    { className: 'bread-activity-row', href },
    createElement(
      'span',
      { className: 'bread-activity-row__content' },
      createElement('strong', { className: 'bread-activity-row__primary' }, primary),
      secondary ? createElement('span', { className: 'bread-activity-row__secondary' }, secondary) : null,
    ),
    meta ? createElement('span', { className: 'bread-activity-row__meta' }, meta) : null,
  );
}
