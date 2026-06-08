'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { X, Activity as ActivityIcon } from 'lucide-react';
import { getActivitiesApi, Activity } from '@/lib/tasks-api';
import Avatar from '@/components/ui/avatar';
import Spinner from '@/components/ui/spinner';
import Skeleton from '@/components/ui/skeleton';

interface ActivityFeedPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export default function ActivityFeedPanel({ isOpen, onClose, projectId }: ActivityFeedPanelProps) {
  // Fetch activity logs, with 30s auto-polling interval
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', projectId],
    queryFn: () => getActivitiesApi(projectId),
    enabled: isOpen && !!projectId,
    refetchInterval: 30000, // 30 seconds
  });

  const groupActivitiesByDate = (items: Activity[]) => {
    const groups: Record<string, Activity[]> = {};

    items.forEach((item) => {
      const date = new Date(item.createdAt);
      let dateLabel = format(date, 'MMMM d, yyyy');

      if (isToday(date)) {
        dateLabel = 'Today';
      } else if (isYesterday(date)) {
        dateLabel = 'Yesterday';
      }

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(item);
    });

    return groups;
  };

  const getActionMessage = (act: Activity) => {
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

  if (!isOpen) return null;

  const grouped = groupActivitiesByDate(activities);

  return (
    <div className="fixed inset-0 z-30 flex justify-end md:pl-[240px]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content container */}
      <div className="relative w-[320px] max-w-full bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 dark:border-slate-800 animate-slide-in transition-colors duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
            <ActivityIcon className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold">Activity Feed</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Activities Feed Timeline */}
        <div className="flex-grow overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="space-y-6 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start space-x-3 text-xs">
                  <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            Object.keys(grouped).map((dateLabel) => (
              <div key={dateLabel} className="space-y-3">
                <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded inline-block">
                  {dateLabel}
                </h4>
                <div className="space-y-4 pl-1 border-l-2 border-slate-100 dark:border-slate-800 ml-2">
                  {grouped[dateLabel].map((act) => (
                    <div key={act.id} className="relative pl-5 space-y-1 text-xs">
                      {/* Circle Bullet icon */}
                      <span className="absolute -left-[7px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-blue-500 shadow-xs" />

                      <div className="flex items-start space-x-2">
                        <Avatar name={act.user.displayName} src={act.user.avatarUrl} size="sm" className="w-5 h-5 shrink-0" />
                        <div className="flex-1 text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                          {getActionMessage(act)}
                          <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                            {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center pt-12 text-slate-400 dark:text-slate-500 text-xs">No project activities logged yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
