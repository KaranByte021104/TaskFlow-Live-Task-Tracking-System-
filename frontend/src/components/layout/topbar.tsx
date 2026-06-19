'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  ArrowLeft,
  UserPlus,
  FileEdit,
  MessageSquare,
  CheckCircle,
  MessageCircle,
  Search,
} from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { getProjectApi } from '../../lib/projects-api';
import Avatar from '../ui/avatar';
import { useProjectRealtime, PresenceUser } from '@/hooks/useProjectRealtime';
import SearchOverlay from '../search-overlay';
import {
  getNotificationsApi,
  getUnreadCountApi,
  markAsReadApi,
  markAllAsReadApi,
  Notification,
} from '../../lib/notifications-api';

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const [showNotifications, setShowNotifications] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keyboard shortcut listener for '/'
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Notifications queries
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCountApi,
    refetchInterval: 30000, // periodically poll every 30s as fallback
  });
  const unreadCount = unreadData?.count || 0;

  const { data: recentNotifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', 'recent'],
    queryFn: () => getNotificationsApi(10),
    enabled: showNotifications,
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
    setShowNotifications(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
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
    switch (type) {
      case 'TASK_ASSIGNED':
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'TASK_UPDATED':
        return <FileEdit className="w-4 h-4 text-indigo-500" />;
      case 'MENTIONED_IN_COMMENT':
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case 'MENTIONED_IN_CHAT':
        return <MessageCircle className="w-4 h-4 text-purple-500" />;
      case 'STATUS_CHANGED_ON_ASSIGNED_TASK':
        return <CheckCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  // Extract project id from URL if we are on a project-specific route
  // e.g. /dashboard/projects/clx123...
  const projectMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;

  // Initialize socket realtime connection and subscriptions for this project
  useProjectRealtime(projectId);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectApi(projectId!),
    enabled: !!projectId,
  });

  // Query project presence list managed by socket subscription
  const { data: presenceList = [] } = useQuery<PresenceUser[]>({
    queryKey: ['presence', projectId],
    enabled: !!projectId,
    staleTime: Infinity,
    initialData: [],
  });

  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/dashboard/tasks') return 'My Tasks';
    if (projectId) {
      if (pathname.endsWith('/settings')) {
        return project ? `${project.name} Settings` : 'Project Settings';
      }
      return project ? project.name : 'Project Workspace';
    }
    return 'Task Tracker';
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-[240px] z-10 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shadow-xs transition-colors duration-200">
      <div className="flex items-center space-x-4">
        {/* Mobile menu trigger */}
        <button
          onClick={onMenuClick}
          className="md:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-250 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition duration-150 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
        {projectId && (
          <Link
            href={pathname === `/dashboard/projects/${projectId}` ? '/dashboard' : `/dashboard/projects/${projectId}`}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition duration-150 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
            title={pathname === `/dashboard/projects/${projectId}` ? 'Back to Projects' : 'Back to Project Dashboard'}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">{getPageTitle()}</h2>
      </div>

      <div className="flex items-center space-x-5">
        {/* Presence Avatar stack */}
        {projectId && presenceList.length > 0 && (
          <div className="flex items-center -space-x-1.5 mr-2">
            {presenceList.slice(0, 4).map((member) => (
              <div
                key={member.id}
                className="relative group cursor-pointer"
                title={`${member.name} (Online)`}
              >
                <Avatar
                  name={member.name}
                  src={member.avatarUrl}
                  size="sm"
                  className="ring-2 ring-white dark:ring-slate-900 hover:z-10 transition duration-100 w-7 h-7"
                />
                <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900 bg-green-500" />
              </div>
            ))}
            {presenceList.length > 4 && (
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold ring-2 ring-white dark:ring-slate-900"
                title={`${presenceList.length - 4} more users`}
              >
                +{presenceList.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Search Trigger Button */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-55 dark:hover:bg-slate-800 transition duration-150 focus:outline-none"
          title="Search (Press /)"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="text-slate-400 hover:text-slate-655 dark:text-slate-400 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition duration-150 focus:outline-none"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* Bell Notification Dropdown */}
        <div className="relative">
          <button
            onClick={handleBellClick}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition duration-150 relative focus:outline-none"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <>
              {/* Overlay to close when clicking outside */}
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
              
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-20 overflow-hidden animate-fade-in py-1">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-[10px] text-blue-500 hover:text-blue-650 font-semibold"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 scrollbar-thin">
                  {recentNotifications.length > 0 ? (
                    recentNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 hover:bg-slate-50/70 dark:hover:bg-slate-750/50 transition flex items-start gap-3 cursor-pointer ${
                          !n.read ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {getNotificationIcon(n.type)}
                        </div>
                        <div className="space-y-1 text-xs flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{n.title}</span>
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed break-words">{n.body}</p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-slate-400 dark:text-slate-500 italic text-xs">
                      No new notifications
                    </div>
                  )}
                </div>
                
                <div className="border-t border-slate-100 dark:border-slate-700 text-center py-2 bg-slate-50/30 dark:bg-slate-800/30">
                  <Link
                    href="/dashboard/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] text-blue-500 hover:text-blue-600 font-semibold"
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>


      </div>
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
}
