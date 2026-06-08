'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Menu, Bell, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { getProjectApi } from '../../lib/projects-api';
import Avatar from '../ui/avatar';
import { useProjectRealtime, PresenceUser } from '@/hooks/useProjectRealtime';
import { useNotificationStore } from '@/store/useNotificationStore';

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  
  
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const [showNotifications, setShowNotifications] = useState(false);
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const clearAll = useNotificationStore((state) => state.clearAll);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    markAllAsRead();
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

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition duration-150 focus:outline-none"
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
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-[10px] text-slate-500 hover:text-red-650 dark:text-slate-400 dark:hover:text-red-400 font-semibold"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50 dark:divide-slate-750 scrollbar-thin">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div key={n.id} className="p-3 hover:bg-slate-50/70 dark:hover:bg-slate-700/50 transition flex items-start gap-2.5">
                        <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                          n.type === 'success' ? 'bg-green-500' :
                          n.type === 'warning' ? 'bg-amber-500' :
                          n.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                        <div className="space-y-1 text-xs">
                          <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{n.message}</p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              </div>
            </>
          )}
        </div>


      </div>
    </header>
  );
}
