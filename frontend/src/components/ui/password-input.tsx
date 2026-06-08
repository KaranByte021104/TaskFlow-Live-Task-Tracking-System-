import React, { useState, forwardRef } from 'react';
import { clsx } from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, className, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const inputStyle = clsx(
      'w-full pl-4 pr-10 py-3 rounded-lg border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-900 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
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
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            ref={ref}
            disabled={disabled}
            className={inputStyle}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
