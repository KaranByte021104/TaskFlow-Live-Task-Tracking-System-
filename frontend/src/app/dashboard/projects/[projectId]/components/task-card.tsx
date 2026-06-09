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

  const unresolvedBlockers = React.useMemo(() => {
    if (!task.dependencies) return [];
    return task.dependencies
      .filter((d: any) => d.blockedBy.status !== 'COMPLETED')
      .map((d: any) => d.blockedBy.title);
  }, [task.dependencies]);

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
        <div className="flex items-center gap-1.5 min-w-0">
          {unresolvedBlockers.length > 0 && (
            <span
              className="text-slate-400 dark:text-slate-500 shrink-0 cursor-help"
              title={`Blocked by: ${unresolvedBlockers.join(', ')}`}
            >
              🔒
            </span>
          )}
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{task.title}</h4>
        </div>
        <Badge value={task.priority} className="shrink-0" />
      </div>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(task.labels.length > 3 ? task.labels.slice(0, 2) : task.labels).map((tl) => (
            <span
              key={tl.id}
              className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white max-w-[80px] truncate"
              style={{ backgroundColor: tl.label.color }}
              title={tl.label.name}
            >
              {tl.label.name}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              +{task.labels.length - 2} more
            </span>
          )}
        </div>
      )}

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
