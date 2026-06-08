'use client';

import React from 'react';
import { format } from 'date-fns';
import { MessageSquare, Calendar, AlertCircle, Paperclip } from 'lucide-react';
import { Task } from '@/lib/tasks-api';
import Badge from '@/components/ui/badge';
import Avatar from '@/components/ui/avatar';
import { clsx } from 'clsx';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isReadOnly?: boolean;
}

export default function TaskCard({ task, onClick, isReadOnly = false }: TaskCardProps) {
  const commentCount = task._count?.comments || 0;
  const imageCount = task._count?.images || 0;

  // Determine if task is overdue
  const isOverdue = React.useMemo(() => {
    if (!task.dueDate || task.status === 'COMPLETED') return false;
    // Set hours to end of day to be fair
    const due = new Date(task.dueDate);
    due.setHours(23, 59, 59, 999);
    return due < new Date();
  }, [task.dueDate, task.status]);

  const formattedDate = task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : null;

  return (
    <div
      onClick={onClick}
      draggable={!isReadOnly}
      onDragStart={(e) => {
        if (isReadOnly) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition duration-200 cursor-pointer space-y-4 select-none"
    >
      {/* Title & Priority Badge header */}
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{task.title}</h4>
        <Badge value={task.priority} className="shrink-0" />
      </div>

      {/* Due Date marker */}
      {formattedDate && (
        <div
          className={clsx(
            'flex items-center text-xs space-x-1.5 font-medium',
            isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          {isOverdue ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
          <span>{isOverdue ? `Overdue: ${formattedDate}` : `Due: ${formattedDate}`}</span>
        </div>
      )}

      {/* Card footer details: assignee info & comments count */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
        <div>
          {task.assignee ? (
            <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
              <Avatar
                name={task.assignee.displayName}
                src={task.assignee.avatarUrl}
                size="sm"
                className="hover:scale-105 transition"
              />
              <span className="font-medium hidden sm:inline" title={task.assignee.displayName}>
                {task.assignee.displayName}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Unassigned</span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-slate-400 dark:text-slate-500 text-xs font-semibold">
          {imageCount > 0 && (
            <div className="flex items-center space-x-0.5" title="Attachments">
              <Paperclip className="w-3.5 h-3.5" />
              <span>{imageCount}</span>
            </div>
          )}
          <div className="flex items-center space-x-1" title="Comments">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{commentCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
