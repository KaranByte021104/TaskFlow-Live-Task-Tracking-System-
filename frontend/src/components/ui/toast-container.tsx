'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, ToastMessage } from '@/store/useToastStore';
import { clsx } from 'clsx';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  const icons = {
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
  };

  const borderColors = {
    info: 'border-blue-100 bg-blue-50/90 hover:bg-blue-50',
    success: 'border-emerald-100 bg-emerald-50/90 hover:bg-emerald-50',
    warning: 'border-amber-100 bg-amber-50/90 hover:bg-amber-50',
    error: 'border-rose-100 bg-rose-50/90 hover:bg-rose-50',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 transform translate-y-0 scale-100 animate-slide-in",
            borderColors[toast.type]
          )}
        >
          {icons[toast.type]}
          <div className="flex-1 space-y-1">
            <div className="text-xs font-semibold text-slate-800 leading-snug pt-0.5">
              {toast.message}
            </div>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.callback();
                  removeToast(toast.id);
                }}
                className="bg-white hover:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 shadow-2xs transition"
              >
                {toast.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
