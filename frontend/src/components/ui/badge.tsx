import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  value: string;
  className?: string;
}

export default function Badge({ value, className }: BadgeProps) {
  const normValue = value.toUpperCase().trim();

  const baseStyle =
    'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide';

  const styles: Record<string, string> = {
    // Status
    TODO: 'bg-slate-100 text-slate-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    REVIEW: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',

    // Priority
    LOW: 'bg-green-50 text-green-700 border border-green-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
    HIGH: 'bg-red-50 text-red-700 border border-red-200',

    // Role
    ADMIN: 'bg-purple-100 text-purple-800',
    MEMBER: 'bg-blue-100 text-blue-800',
    VIEWER: 'bg-slate-100 text-slate-700',
  };

  const selectedStyle = styles[normValue] || 'bg-slate-100 text-slate-700';

  return <span className={clsx(baseStyle, selectedStyle, className)}>{value}</span>;
}
