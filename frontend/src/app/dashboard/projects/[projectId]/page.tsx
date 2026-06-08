'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjectStatsApi } from '@/lib/projects-api';
import { ListTodo, CheckCircle2, Clock, Pause, Calendar, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Spinner from '@/components/ui/spinner';
import Avatar from '@/components/ui/avatar';
import Badge from '@/components/ui/badge';
import Link from 'next/link';

export default function ProjectDashboardPage({ params }: { params: { projectId: string } }) {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['project-stats', params.projectId],
    queryFn: () => getProjectStatsApi(params.projectId),
    refetchInterval: 10000, // Refresh stats every 10s
    enabled: !!params.projectId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="text-center py-8 text-rose-500">
        Failed to load project dashboard statistics.
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats.totalTasks,
      icon: <ListTodo className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      bg: 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-100/50 dark:border-blue-900/40',
    },
    {
      title: 'Completed',
      value: stats.completedTasks,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-100/50 dark:border-emerald-900/40',
    },
    {
      title: 'In Progress',
      value: stats.inProgressTasks,
      icon: <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      bg: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-100/50 dark:border-amber-900/40',
    },
    {
      title: 'Pending',
      value: stats.pendingTasks,
      icon: <Pause className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    },
  ];

  const getActionMessage = (act: any) => {
    const user = act.user.displayName;
    const taskTitle = act.task?.title || act.metadata?.taskTitle || 'a task';

    switch (act.type) {
      case 'TASK_CREATED':
        return `${user} created task "${taskTitle}"`;
      case 'TASK_UPDATED':
        return `${user} updated task "${taskTitle}"`;
      case 'TASK_COMPLETED':
        return `${user} completed task "${taskTitle}"`;
      case 'STATUS_CHANGED':
        const oldStatus = act.metadata?.oldStatus || 'unknown';
        const newStatus = act.metadata?.newStatus || 'unknown';
        return `${user} moved "${taskTitle}" from ${oldStatus} to ${newStatus}`;
      case 'MEMBER_ADDED':
        const invitee = act.metadata?.invitedUserEmail || 'member';
        return `${user} invited ${invitee} to the project`;
      case 'MEMBER_REMOVED':
        return `${user} removed a member from the project`;
      case 'COMMENT_ADDED':
        return `${user} commented on "${taskTitle}"`;
      default:
        return `${user} performed an action`;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className={`p-5 rounded-2xl border backdrop-blur-xs flex items-center justify-between shadow-xs transition-colors duration-200 ${card.bg}`}
          >
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {card.title}
              </span>
              <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight block">
                {card.value}
              </span>
            </div>
            <div className="p-3 bg-white dark:bg-slate-950 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 transition-colors">
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Completion Progress Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3 transition-colors duration-200">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
          <span>Project Completion Progress</span>
          <span className="text-blue-600 dark:text-blue-400">{stats.completionPercentage}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-950 h-3.5 rounded-full overflow-hidden flex">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Side-by-Side: Recent Activity & Upcoming Deadlines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Panel: Recent Activity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5 flex flex-col transition-colors duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Recent Activity</h3>
            <Link
              href={`/dashboard/projects/${params.projectId}/board`}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition"
            >
              Go to Board <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 space-y-4">
            {stats.recentActivities.length > 0 ? (
              stats.recentActivities.map((act) => (
                <div key={act.id} className="flex items-start space-x-3 text-xs">
                  <Avatar name={act.user.displayName} src={act.user.avatarUrl} size="sm" className="w-6 h-6 shrink-0" />
                  <div className="flex-1 text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
                    <div>{getActionMessage(act)}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                      {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic text-xs">
                No recent activity logged yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Upcoming Due Dates */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5 flex flex-col transition-colors duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Upcoming Due Dates</h3>
            <span className="text-[10px] bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors">
              Next 7 Days
            </span>
          </div>

          <div className="flex-grow space-y-4">
            {stats.upcomingTasks.length > 0 ? (
              stats.upcomingTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition gap-3"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block line-clamp-1">
                      {t.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge value={t.priority} />
                      {t.assignee && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          <Avatar name={t.assignee.displayName} src={t.assignee.avatarUrl} size="sm" className="w-4 h-4" />
                          <span>{t.assignee.displayName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold shrink-0">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>{format(new Date(t.dueDate), 'EEE, MMM d')}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic text-xs">
                No upcoming deadlines in the next 7 days.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
