import { createElement, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'buy' | 'sell' | 'secondary' | 'small';

export type ButtonProps = Readonly<{
  children?: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
}>;

export function Button({
  children,
  variant = 'primary',
  loading = false,
  loadingLabel = 'Confirming...',
  disabled = false,
  type = 'button',
  className,
  ariaLabel,
  onClick,
}: ButtonProps) {
  const classes = ['bread-button', `bread-button--${variant}`, className].filter(Boolean).join(' ');

  return createElement(
    'button',
    {
      type,
      className: classes,
      disabled: disabled || loading,
      'aria-busy': loading || undefined,
      'aria-label': ariaLabel,
      onClick,
    },
    loading ? loadingLabel : children,
  );
}
