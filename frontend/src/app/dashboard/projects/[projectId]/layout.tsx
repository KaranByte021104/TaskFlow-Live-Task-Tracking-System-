'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getProjectApi } from '@/lib/projects-api';
import { LayoutDashboard, Kanban, Settings } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { clsx } from 'clsx';

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  const pathname = usePathname();
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project', params.projectId],
    queryFn: () => getProjectApi(params.projectId),
    enabled: !!params.projectId,
  });

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl transition-colors duration-200">
        <h3 className="text-lg font-bold text-red-500">Error loading project</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Make sure you have access to this workspace.</p>
      </div>
    );
  }

  const tabs = [
    {
      label: 'Dashboard',
      href: `/dashboard/projects/${params.projectId}`,
      active: pathname === `/dashboard/projects/${params.projectId}`,
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      label: 'Board',
      href: `/dashboard/projects/${params.projectId}/board`,
      active: pathname === `/dashboard/projects/${params.projectId}/board`,
      icon: <Kanban className="w-4 h-4" />,
    },
    {
      label: 'Settings',
      href: `/dashboard/projects/${params.projectId}/settings`,
      active: pathname === `/dashboard/projects/${params.projectId}/settings`,
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Project header details */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-4">
        <div className="flex items-center space-x-3.5">
          <div
            className="w-4 h-4 rounded-full shadow-sm"
            style={{ backgroundColor: project.color }}
          />
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{project.description}</p>
            )}
          </div>
        </div>

        {/* Tab links */}
        <div className="flex items-center gap-1 border-b sm:border-b-0 border-slate-200 dark:border-slate-850">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 -mb-px sm:mb-0 transition duration-150 rounded-t-lg',
                tab.active
                  ? 'border-blue-500 text-blue-600 dark:text-blue-450 bg-blue-50/50 dark:bg-blue-950/20'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="pt-2">{children}</div>
    </div>
  );
}
