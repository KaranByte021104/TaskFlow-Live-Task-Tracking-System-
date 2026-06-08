import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  isTextarea?: boolean;
  rows?: number;
}

const Input = forwardRef<HTMLInputElement & HTMLTextAreaElement, InputProps>(
  ({ label, error, className, isTextarea = false, disabled, ...props }, ref) => {
    const inputStyle = clsx(
      'w-full px-4 py-3 rounded-lg border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-900 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
      error
        ? 'border-red-300 focus:ring-red-200'
        : 'border-slate-200 dark:border-slate-800 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400'
    );

    return (
      <div className={clsx('space-y-1.5', className)}>
        {label && (
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            {label}
          </label>
        )}
        {isTextarea ? (
          <textarea
            ref={ref as any}
            disabled={disabled}
            className={inputStyle}
            {...(props as any)}
          />
        ) : (
          <input
            ref={ref as any}
            disabled={disabled}
            className={inputStyle}
            {...(props as any)}
          />
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
