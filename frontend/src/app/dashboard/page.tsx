'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Plus, Settings, Users, CheckSquare, ListTodo } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../../store/useAuthStore';
import { getProjectsApi, getDashboardStatsApi } from '../../lib/projects-api';
import Button from '../../components/ui/button';
import EmptyState from '../../components/ui/empty-state';
import Spinner from '../../components/ui/spinner';
import ProjectModal from '../../components/project-modal';
import Skeleton from '../../components/ui/skeleton';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    data: projects = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjectsApi,
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStatsApi,
    enabled: !!user,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-4 w-72 bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* Stats cards skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="space-y-2 flex-1 mr-4">
                <Skeleton className="h-3 w-16 bg-slate-200 dark:bg-slate-800" />
                <Skeleton className="h-7 w-8 bg-slate-200 dark:bg-slate-800" />
              </div>
              <Skeleton className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>

        {/* Projects cards skeletons */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs h-48 p-6 space-y-4">
              <Skeleton className="h-5 w-2/3 bg-slate-200 dark:bg-slate-800" />
              <Skeleton className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800" />
              <Skeleton className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800" />
              <div className="pt-4 flex justify-between">
                <Skeleton className="h-4 w-12 bg-slate-200 dark:bg-slate-800" />
                <Skeleton className="h-4 w-16 bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {getGreeting()}, {user?.displayName}!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Here is an overview of all your projects.
          </p>
        </div>
        <div>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Aggregate stats grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center justify-between transition-colors duration-200">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Total Projects</span>
              <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight block">{stats.totalProjects}</span>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm"><FolderKanban className="w-5 h-5" /></div>
          </div>
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center justify-between transition-colors duration-200">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Total Tasks</span>
              <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight block">{stats.totalTasks}</span>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm"><ListTodo className="w-5 h-5" /></div>
          </div>
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex items-center justify-between transition-colors duration-200">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">My Tasks</span>
              <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight block">{stats.assignedTasks}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 rounded-xl text-emerald-600 dark:text-emerald-400 shadow-sm"><Users className="w-5 h-5" /></div>
          </div>
          <div className={`p-5 bg-white dark:bg-slate-900 border rounded-2xl shadow-xs flex items-center justify-between transition-colors duration-200 ${stats.overdueTasks > 0 ? 'border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Overdue Tasks</span>
              <span className={`text-2xl font-extrabold tracking-tight block ${stats.overdueTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>{stats.overdueTasks}</span>
            </div>
            <div className={`p-2.5 rounded-xl border shadow-sm transition-colors ${stats.overdueTasks > 0 ? 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/60 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-750 text-slate-600 dark:text-slate-400'}`}><CheckSquare className="w-5 h-5" /></div>
          </div>
        </div>
      )}

      {/* Grid of projects */}
      {projects.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: any) => {
            const memberCount = project._count?.members || 0;
            const taskCount = project._count?.tasks || 0;
            const lastUpdated = project.updatedAt
              ? formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })
              : 'recently';

            return (
              <div
                key={project.id}
                className="relative group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden"
              >
                {/* Accent Top Color bar */}
                <div className="h-2 w-full" style={{ backgroundColor: project.color }} />

                <div className="p-6 space-y-4 flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-150 truncate">
                      <Link href={`/dashboard/projects/${project.id}`}>{project.name}</Link>
                    </h3>
                    <Link
                      href={`/dashboard/projects/${project.id}/settings`}
                      className="text-slate-400 hover:text-slate-600 dark:text-slate-550 dark:hover:text-slate-350 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition duration-150"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Link>
                  </div>

                  <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 h-10">
                    {project.description || 'No description provided.'}
                  </p>

                  {/* Task Completion Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-455 font-bold">
                      <span>Tasks Complete</span>
                      <span className="font-extrabold text-blue-650 dark:text-blue-450">{(project as any).completionPercentage || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(project as any).completionPercentage || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer metadata */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center" title="Members">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      {memberCount}
                    </span>
                    <span className="flex items-center" title="Tasks">
                      <CheckSquare className="w-3.5 h-3.5 mr-1" />
                      {taskCount}
                    </span>
                  </div>
                  <span>Updated {lastUpdated}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Create your first workspace project to start logging team tasks and workflows."
          actionLabel="Create Project"
          onAction={() => setIsModalOpen(true)}
        />
      )}

      {/* Local Project creation Modal trigger */}
      <ProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
