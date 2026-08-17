import { createElement, type ReactNode } from 'react';

export type PageContainerVariant = 'standard' | 'explore';

export type PageContainerProps = Readonly<{
  children?: ReactNode;
  className?: string;
  variant?: PageContainerVariant;
}>;

export function PageContainer({
  children,
  className,
  variant = 'standard',
}: PageContainerProps) {
  const classes = [
    'bread-page-container',
    variant === 'explore' ? 'bread-page-container--explore' : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return createElement('div', { className: classes }, children);
}
