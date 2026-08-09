import { createElement } from 'react';

export type CardProps = Readonly<{
  children?: unknown;
  className?: string;
  ariaLabel?: string;
}>;

export function Card({ children, className, ariaLabel }: CardProps) {
  const classes = ['bread-card', className].filter(Boolean).join(' ');
  return createElement('section', { className: classes, 'aria-label': ariaLabel }, children);
}
