import React from 'react';
import { clsx } from 'clsx';
import { PureSpinner } from './spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export default function Button({
  children,
  className,
  variant = 'primary',
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle =
    'inline-flex items-center justify-center font-semibold text-sm rounded-lg px-4 py-2.5 transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm focus:ring-blue-500',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 focus:ring-slate-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={clsx(baseStyle, variants[variant], className)}
      {...props}
    >
      {isLoading && <PureSpinner className="w-4 h-4 mr-2 text-current" />}
      {children}
    </button>
  );
}
