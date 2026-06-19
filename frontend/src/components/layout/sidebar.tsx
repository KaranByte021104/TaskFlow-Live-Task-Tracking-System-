'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, CheckSquare, Plus, LogOut, Folder, X, Key, MessageSquare } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { getProjectsApi } from '../../lib/projects-api';
import { getConversationsApi } from '../../lib/chat-api';
import Avatar from '../ui/avatar';
import { clsx } from 'clsx';
import ChangePasswordModal from '../change-password-modal';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewProject: () => void;
}

export default function Sidebar({ isOpen, onClose, onNewProject }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjectsApi,
    enabled: !!user,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversationsApi,
    enabled: !!user,
  });

  const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/tasks', label: 'My Tasks', icon: CheckSquare },
    {
      href: '/dashboard/messages',
      label: 'Messages',
      icon: MessageSquare,
      unreadCount: totalUnread,
    },
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 w-[240px] transition-colors duration-200">
      {/* Top logo */}
      <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg">
            T
          </div>
          <span className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">TaskFlow</span>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="md:hidden text-slate-400 hover:text-slate-655 dark:hover:text-white focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav links */}
      <div className="px-4 py-6 space-y-7 flex-1 overflow-y-auto">
        <div className="space-y-1.5">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href === '/dashboard/messages' && pathname.startsWith('/dashboard/messages'));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition duration-150',
                  isActive
                    ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white shadow-sm'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-905 dark:hover:text-white text-slate-600 dark:text-slate-400'
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </div>
                {link.unreadCount !== undefined && link.unreadCount > 0 && (
                  <span className="bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {link.unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Projects list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            <span>Projects</span>
            <button
              onClick={() => {
                onClose();
                onNewProject();
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 p-0.5 rounded transition duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {projects.map((project) => {
              const projectPath = `/dashboard/projects/${project.id}`;
              // Match exact path or sub-settings path
              const isActive = pathname === projectPath || pathname.startsWith(`${projectPath}/`);
              return (
                <Link
                  key={project.id}
                  href={projectPath}
                  onClick={onClose}
                  className={clsx(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition duration-150',
                    isActive
                      ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white shadow-sm'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-905 dark:hover:text-white text-slate-600 dark:text-slate-400'
                  )}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                  </div>
                </Link>
              );
            })}

            {projects.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-600 px-3 py-2">No projects yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b0f19] flex items-center justify-between transition-colors duration-200">
        {user && (
          <>
            <Link
              href="/dashboard/profile"
              onClick={onClose}
              className="flex items-center space-x-3 overflow-hidden group cursor-pointer hover:opacity-85 transition"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
              <div className="truncate text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate leading-tight">{user.displayName}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-none mt-0.5">{user.email}</p>
              </div>
            </Link>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition duration-150"
                title="Change Password"
              >
                <Key className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition duration-150"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar on Desktop (always visible) */}
      <aside className="hidden md:block fixed top-0 bottom-0 left-0 z-20 w-[240px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] transition-colors duration-200">
        {sidebarContent}
      </aside>

      {/* Sidebar on Mobile (drawer) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          {/* Slide-out panel */}
          <aside className="relative z-10 h-full transform transition duration-300 ease-out">
            {sidebarContent}
          </aside>
        </div>
      )}

      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </>
  );
}
