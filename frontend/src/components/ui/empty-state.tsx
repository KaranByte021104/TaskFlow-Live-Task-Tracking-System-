import React from 'react';
import { LucideIcon } from 'lucide-react';
import Button from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionLoading = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 max-w-lg mx-auto space-y-6">
      <div className="p-4 bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 rounded-full">
        <Icon className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} isLoading={actionLoading}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
