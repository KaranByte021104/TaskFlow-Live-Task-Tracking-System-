'use client';

import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  UserPlus,
  FileEdit,
  MessageSquare,
  CheckCircle,
  MessageCircle,
  AlertCircle,
  MailOpen,
  Filter,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  getNotificationsApi,
  markAsReadApi,
  markAllAsReadApi,
  Notification,
} from '@/lib/notifications-api';
import Spinner from '@/components/ui/spinner';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: ({ pageParam }) => getNotificationsApi(15, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 15) return undefined;
      return lastPage[lastPage.length - 1].id;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: markAsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllAsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await markReadMutation.mutateAsync(n.id);
    }
    if (n.link) {
      router.push(n.link);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    const className = "w-5 h-5";
    switch (type) {
      case 'TASK_ASSIGNED':
        return <UserPlus className={`${className} text-blue-500`} />;
      case 'TASK_UPDATED':
        return <FileEdit className={`${className} text-indigo-500`} />;
      case 'MENTIONED_IN_COMMENT':
        return <MessageSquare className={`${className} text-emerald-500`} />;
      case 'MENTIONED_IN_CHAT':
        return <MessageCircle className={`${className} text-purple-500`} />;
      case 'STATUS_CHANGED_ON_ASSIGNED_TASK':
        return <CheckCircle className={`${className} text-orange-500`} />;
      default:
        return <Bell className={`${className} text-slate-500`} />;
    }
  };

  // Flatten pages notifications
  const allNotifications = data ? data.pages.flat() : [];
  const filteredNotifications = filter === 'unread' 
    ? allNotifications.filter(n => !n.read) 
    : allNotifications;

  const hasUnread = allNotifications.some((n) => !n.read);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-4 w-72 bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-rose-500 dark:text-rose-400 font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs transition-colors duration-200">
        Failed to load notifications. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-500" />
            Notifications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Keep track of task assignments, mentions, and updates relevant to you.
          </p>
        </div>
        
        {hasUnread && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Toggles */}
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            filter === 'all'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            filter === 'unread'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Unread
        </button>
      </div>

      {/* List */}
      {filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 shadow-xs transition-colors duration-200">
            {filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition flex items-start gap-4 cursor-pointer relative ${
                  !n.read ? 'bg-blue-50/10 dark:bg-blue-950/5' : ''
                }`}
              >
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 shrink-0">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="space-y-1 flex-1 min-w-0 pr-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{n.title}</h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed break-words">{n.body}</p>
                </div>
                {!n.read && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
            ))}
          </div>

          {hasNextPage && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isFetchingNextPage ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={MailOpen}
          title={filter === 'unread' ? "No unread notifications" : "No notifications yet"}
          description={filter === 'unread' ? "You have read all your notifications!" : "You will receive updates here when tasks are assigned to you or you are mentioned."}
        />
      )}
    </div>
  );
}
