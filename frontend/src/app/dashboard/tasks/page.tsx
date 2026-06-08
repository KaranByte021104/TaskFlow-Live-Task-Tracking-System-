'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getMyTasksApi, Task } from '@/lib/tasks-api';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import TaskDetailPanel from '../projects/[projectId]/components/task-detail-panel';
import { clsx } from 'clsx';

export default function MyTasksPage() {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const { data: tasks = [], isLoading, isError } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: getMyTasksApi,
  });

  const handleTaskClick = (task: Task) => {
    setActiveProjectId(task.projectId);
    setActiveTaskId(task.id);
  };

  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

  // Verify overdue status
  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === 'COMPLETED') return false;
    const due = new Date(task.dueDate);
    due.setHours(23, 59, 59, 999);
    return due < new Date();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-4 w-72 bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4 transition-colors duration-200">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
              <div className="space-y-2 flex-1 mr-4">
                <Skeleton className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800" />
                <Skeleton className="h-3.5 w-1/4 bg-slate-200 dark:bg-slate-800" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-rose-500 dark:text-rose-400 font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs transition-colors duration-200">
        Failed to load your assigned tasks. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-500" />
            My Tasks
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Review and track all the tasks assigned to you across all workspaces.
          </p>
        </div>
        <div className="flex gap-4 shrink-0 text-xs font-semibold">
          <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-blue-700 dark:text-blue-400 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors">
            <span>Pending Tasks:</span>
            <span className="text-sm font-extrabold">{pendingTasks.length}</span>
          </div>
          <div className="bg-green-50/70 dark:bg-green-950/20 border border-green-100 dark:border-green-900/40 text-green-700 dark:text-green-400 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors">
            <span>Completed:</span>
            <span className="text-sm font-extrabold">{completedTasks.length}</span>
          </div>
        </div>
      </div>

      {/* Tasks Table List */}
      {tasks.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Task Name</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {tasks.map((task) => {
                  const overdue = isOverdue(task);
                  const formattedDate = task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : 'No due date';
                  
                  return (
                    <tr
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition cursor-pointer group"
                    >
                      {/* Task Title */}
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition max-w-sm">
                        <div className="space-y-1">
                          <span className="line-clamp-2 leading-relaxed">{task.title}</span>
                          {task._count?.comments && task._count.comments > 0 ? (
                            <span className="inline-flex items-center text-[10px] text-slate-400 dark:text-slate-500 font-semibold gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {task._count.comments} {task._count.comments === 1 ? 'comment' : 'comments'}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Project Badge */}
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: (task as any).project?.color || '#cbd5e1' }}
                          />
                          <span>{(task as any).project?.name || 'Unknown Project'}</span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge value={task.priority} />
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge value={task.status} />
                      </td>

                      {/* Due Date */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.dueDate ? (
                          <div
                            className={clsx(
                              'flex items-center space-x-1.5 font-bold',
                              overdue ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-500 dark:text-slate-400'
                            )}
                          >
                            {overdue ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                            <span>{formattedDate}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-505 font-medium">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={CheckSquare}
          title="No tasks assigned to you"
          description="Enjoy your clear schedule! When project admins or members assign tasks to you, they will appear here."
        />
      )}

      {/* Task detail drawer overlay */}
      {activeTaskId && activeProjectId && (
        <TaskDetailPanel
          isOpen={!!activeTaskId}
          onClose={() => {
            setActiveTaskId(null);
            setActiveProjectId(null);
          }}
          projectId={activeProjectId}
          taskId={activeTaskId}
        />
      )}
    </div>
  );
}
