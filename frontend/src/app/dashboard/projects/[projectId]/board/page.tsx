'use client';

import React, { useState } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Activity as ActivityIcon, X } from 'lucide-react';
import { getProjectApi } from '../../../../../lib/projects-api';
import { getTasksApi, updateTaskApi, TaskStatus, Task } from '../../../../../lib/tasks-api';
import Button from '../../../../../components/ui/button';
import Spinner from '../../../../../components/ui/spinner';
import Skeleton from '../../../../../components/ui/skeleton';
import TaskCard from '../components/task-card';
import CreateTaskModal from '../components/create-task-modal';
import TaskDetailPanel from '../components/task-detail-panel';
import ActivityFeedPanel from '../components/activity-feed-panel';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

const COLUMNS: { status: TaskStatus; label: string; bg: string }[] = [
  { status: 'TODO', label: 'To Do', bg: 'bg-slate-100/60 dark:bg-slate-950/30' },
  { status: 'IN_PROGRESS', label: 'In Progress', bg: 'bg-blue-50/40 dark:bg-blue-950/20' },
  { status: 'REVIEW', label: 'Review', bg: 'bg-amber-50/40 dark:bg-amber-950/20' },
  { status: 'COMPLETED', label: 'Completed', bg: 'bg-green-50/40 dark:bg-green-950/20' },
];

export default function KanbanBoardPage({ params }: { params: { projectId: string } }) {
  const currentUser = useAuthStore((state) => state.user);
  const { addToast } = useToastStore();
  const [showActivities, setShowActivities] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>('TODO');

  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [activeMobileColumn, setActiveMobileColumn] = useState<TaskStatus>('TODO');

  const queryClient = useQueryClient();

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTaskApi(params.projectId, taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      const queryKey = ['tasks', params.projectId, search, assigneeFilter];
      await queryClient.cancelQueries({ queryKey });
      const previousTasks = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: Task[]) =>
              page.map((t) => (t.id === taskId ? { ...t, status } : t))
            ),
          };
        }
        if (Array.isArray(old)) {
          return old.map((t) => (t.id === taskId ? { ...t, status } : t));
        }
        return old;
      });

      return { previousTasks };
    },
    onError: (err: any, variables, context) => {
      const queryKey = ['tasks', params.projectId, search, assigneeFilter];
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKey, context.previousTasks);
      }
      const message = err.response?.data?.message || 'Failed to update task status.';
      addToast(message, 'error');
    },
    onSuccess: (updatedTask) => {
      const queryKey = ['tasks', params.projectId, search, assigneeFilter];
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['task', params.projectId, updatedTask.id] });
      queryClient.invalidateQueries({ queryKey: ['task-history', updatedTask.id] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', params.projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus) => {
    updateTaskStatusMutation.mutate({ taskId, status });
  };

  // Fetch project details for name & members list
  const { data: project } = useQuery({
    queryKey: ['project', params.projectId],
    queryFn: () => getProjectApi(params.projectId),
    enabled: !!params.projectId,
  });

  const userMembership = project?.members.find((m) => m.userId === currentUser?.id);
  const isViewer = userMembership?.role === 'VIEWER';

  // Fetch tasks with search & assignee filters and cursor-based infinite pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['tasks', params.projectId, search, assigneeFilter],
    queryFn: ({ pageParam }) =>
      getTasksApi(params.projectId, {
        search: search || undefined,
        assigneeId: assigneeFilter || undefined,
        cursor: pageParam || undefined,
        limit: 15,
      }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 15) return undefined;
      return lastPage[lastPage.length - 1].id;
    },
    enabled: !!params.projectId,
  });

  const tasks = data ? data.pages.flatMap((page) => page) : [];

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onPressN: () => {
      if (!isViewer) openCreateModal('TODO');
    },
    onPressSlash: () => {
      document.getElementById('tasks-search-input')?.focus();
    },
  });

  const openCreateModal = (status: TaskStatus) => {
    setCreateStatus(status);
    setIsCreateOpen(true);
  };

  const tasksByColumn = (status: TaskStatus) => {
    return tasks.filter((t) => t.status === status);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] -m-6 overflow-hidden">
      {/* Kanban main content area */}
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
        {/* Filter / Action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs transition-colors duration-200">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                id="tasks-search-input"
                type="text"
                placeholder="Search tasks... (Shortcut: /)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-450 transition-colors duration-200"
              />
            </div>

            {/* Assignee Filter Dropdown */}
            <div className="relative flex items-center gap-1.5">
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="pl-3 pr-8 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-450 font-semibold transition-colors duration-200"
              >
                <option value="" className="dark:bg-slate-900 dark:text-slate-400">Filter by Assignee</option>
                {project?.members.map((m) => (
                  <option key={m.id} value={m.user.id} className="dark:bg-slate-900 dark:text-slate-200">
                    {m.user.displayName}
                  </option>
                ))}
              </select>
              {assigneeFilter && (
                <button
                  onClick={() => setAssigneeFilter('')}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition duration-150 focus:outline-none"
                  title="Clear assignee filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* Toggle Activities Feed Button */}
            <Button
              variant={showActivities ? 'primary' : 'secondary'}
              onClick={() => setShowActivities(!showActivities)}
              className="flex items-center"
            >
              <ActivityIcon className="w-4 h-4 mr-2" />
              Activity Feed
            </Button>

            {/* Create Task Button */}
            {!isViewer && (
              <Button
                onClick={() => openCreateModal('TODO')}
                className="flex items-center"
                title="Create a new task (Shortcut: N)"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Task
              </Button>
            )}
          </div>
        </div>

        {/* Board scroll container */}
        {isLoading ? (
          <div className="flex-1 flex gap-5 overflow-x-auto pb-4 items-start scrollbar-thin">
            {COLUMNS.map((col) => (
              <div
                key={col.status}
                className="w-[280px] sm:w-[300px] flex-shrink-0 flex flex-col max-h-full border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs overflow-hidden animate-fade-in"
              >
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
                  <Skeleton className="h-4 w-20 bg-slate-200 dark:bg-slate-800" />
                  <Skeleton className="h-4 w-6 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20 flex-1">
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3 shadow-2xs">
                    <Skeleton className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800" />
                    <div className="flex justify-between items-center pt-2">
                      <Skeleton className="h-5 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <Skeleton className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3 shadow-2xs">
                    <Skeleton className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="h-3 w-1/3 bg-slate-200 dark:bg-slate-800" />
                    <div className="flex justify-between items-center pt-2">
                      <Skeleton className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <Skeleton className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3 shadow-2xs">
                    <Skeleton className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800" />
                    <div className="flex justify-between items-center pt-2">
                      <Skeleton className="h-5 w-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <Skeleton className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Column switcher tabs */}
            <div className="flex md:hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 rounded-xl mb-4 gap-1 shrink-0 shadow-xs transition-colors">
              {COLUMNS.map((col) => {
                const isActive = activeMobileColumn === col.status;
                const colTasks = tasksByColumn(col.status);
                return (
                  <button
                    key={col.status}
                    onClick={() => setActiveMobileColumn(col.status)}
                    className={clsx(
                      'flex-1 py-2 text-center text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5',
                      isActive
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    <span>{col.label.split(' ')[0]}</span>
                    <span className={clsx(
                      'text-[9px] px-1.5 py-0.5 rounded-full font-bold',
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    )}>
                      {colTasks.length}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 flex gap-5 overflow-x-auto pb-4 items-start scrollbar-thin">
              {COLUMNS.map((col) => {
                const colTasks = tasksByColumn(col.status);
                const isMobileVisible = activeMobileColumn === col.status;
                return (
                  <div
                    key={col.status}
                    className={clsx(
                      "w-[280px] sm:w-[300px] md:flex flex-shrink-0 flex flex-col max-h-full border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs transition-colors duration-200",
                      isMobileVisible ? 'flex w-full' : 'hidden'
                    )}
                  >
                  {/* Column Header */}
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{col.label}</span>
                      <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full font-bold">
                        {colTasks.length}
                      </span>
                    </div>
                    {!isViewer && (
                      <button
                        onClick={() => openCreateModal(col.status)}
                        className="text-slate-400 hover:text-slate-700 dark:text-slate-550 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-lg transition"
                        title={`Add task to ${col.label}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Tasks List area (vertical scroll inside column) */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (isViewer) return;
                      const taskId = e.dataTransfer.getData('text/plain');
                      if (taskId) {
                        handleUpdateTaskStatus(taskId, col.status);
                      }
                    }}
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                        if (hasNextPage && !isFetchingNextPage) {
                          fetchNextPage();
                        }
                      }
                    }}
                    className={clsx('flex-1 overflow-y-auto p-4 space-y-4 min-h-[150px]', col.bg)}
                  >
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isReadOnly={isViewer}
                        onClick={() => setActiveTaskId(task.id)}
                      />
                    ))}

                    {isFetchingNextPage && (
                      <div className="flex justify-center py-2 shrink-0">
                        <Spinner className="w-5 h-5" />
                      </div>
                    )}

                    {colTasks.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs italic">
                        Empty column
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>

      {/* Activities Panel Drawer (opens on right) */}
      <ActivityFeedPanel
        isOpen={showActivities}
        onClose={() => setShowActivities(false)}
        projectId={params.projectId}
      />

      {/* Task Creation Modal overlay */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        projectId={params.projectId}
        status={createStatus}
      />

      {/* Task Details slide panel */}
      {activeTaskId && (
        <TaskDetailPanel
          isOpen={!!activeTaskId}
          onClose={() => setActiveTaskId(null)}
          projectId={params.projectId}
          taskId={activeTaskId}
          onTaskClick={(id) => setActiveTaskId(id)}
        />
      )}
    </div>
  );
}
