import { createElement, type ReactNode } from 'react';

export type IconSize = 'normal' | 'primary-control' | 'navigation' | 'prominent-action';

export type IconProps = Readonly<{
  children?: ReactNode;
  className?: string;
  label?: string;
  size?: IconSize;
}>;

export function Icon({ children, className, label, size = 'normal' }: IconProps) {
  const classes = ['bread-icon', `bread-icon--${size}`, className].filter(Boolean).join(' ');
  const accessibility = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': true as const };

  return createElement('span', { className: classes, ...accessibility }, children);
}
