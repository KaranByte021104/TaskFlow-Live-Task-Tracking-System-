'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { searchApi, SearchResults } from '@/lib/search-api';
import { getOrCreateConversationApi } from '@/lib/chat-api';
import Avatar from './ui/avatar';
import {
  Search,
  X,
  Folder,
  CheckSquare,
  MessageCircle,
  User,
  ExternalLink,
} from 'lucide-react';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const routeRef = useRef({ pathname, search: searchParams?.toString() });

  // Update route baseline when modal opens
  useEffect(() => {
    if (isOpen) {
      routeRef.current = { pathname, search: searchParams?.toString() };
      setIsNavigating(false);
    }
  }, [isOpen, pathname, searchParams]);

  // Close only if route changes while open
  useEffect(() => {
    if (!isOpen) return;

    const currentSearch = searchParams?.toString();
    if (pathname !== routeRef.current.pathname || currentSearch !== routeRef.current.search) {
      onClose();
    }
  }, [pathname, searchParams, isOpen, onClose]);

  // Debounce query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 3000 / 10); // 300ms debounce
    return () => clearTimeout(handler);
  }, [query]);

  // Fetch search results
  const { data: results, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchApi(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  });

  // Start DM mutation
  const startDmMutation = useMutation({
    mutationFn: getOrCreateConversationApi,
    onSuccess: (conv) => {
      onClose();
      router.push(`/dashboard/messages?conversation=${conv.id}`);
    },
  });

  // Keyboard shortcut for Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      inputRef.current?.focus();
      // Disable background scrolling
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close when clicking outside modal box
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleResultClick = (type: keyof SearchResults, item: any) => {
    setIsNavigating(true);
    if (type === 'projects') {
      router.push(`/dashboard/projects/${item.id}`);
    } else if (type === 'tasks') {
      router.push(`/dashboard/projects/${item.projectId}/board?task=${item.id}`);
    } else if (type === 'comments') {
      router.push(`/dashboard/projects/${item.task.projectId}/board?task=${item.taskId}`);
    } else if (type === 'users') {
      startDmMutation.mutate(item.id);
    }
  };

  if (!isOpen) return null;

  const hasResults =
    results &&
    (results.projects.length > 0 ||
      results.tasks.length > 0 ||
      results.comments.length > 0 ||
      results.users.length > 0);

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 backdrop-blur-xs p-4 pt-16 md:pt-28"
    >
      <div
        ref={overlayRef}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl transition duration-150 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Loading Overlay */}
        {(isNavigating || startDmMutation.isPending) && (
          <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 z-50 flex flex-col items-center justify-center space-y-3.5 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Loading page...</span>
          </div>
        )}
        {/* Search Input Bar */}
        <div className="flex items-center space-x-3.5 px-4.5 py-4.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, tasks, comments, and colleagues..."
            className="flex-1 bg-transparent border-0 text-sm placeholder-slate-450 dark:placeholder-slate-500 text-slate-805 dark:text-slate-100 focus:outline-none focus:ring-0"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 dark:text-slate-500 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-[420px] overflow-y-auto p-4 space-y-5 scrollbar-thin">
          {isFetching && (
            <div className="flex flex-col items-center justify-center py-12 space-y-2 text-slate-400 dark:text-slate-500">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">Searching...</span>
            </div>
          )}

          {!isFetching && debouncedQuery.trim().length > 0 && !hasResults && (
            <div className="text-center py-16 text-slate-450 dark:text-slate-500">
              <p className="text-sm font-semibold">No results found for &quot;{debouncedQuery}&quot;</p>
              <p className="text-xs mt-1">Try checking your spelling or using different keywords.</p>
            </div>
          )}

          {!isFetching && debouncedQuery.trim().length === 0 && (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-semibold">Type query to start search</p>
              <p className="text-[10px] opacity-75 mt-1">Press Esc or click outside to dismiss</p>
            </div>
          )}

          {/* Render Categories */}
          {!isFetching && results && hasResults && (
            <div className="space-y-6">
              {/* Projects Category */}
              {results.projects.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider pl-1.5">
                    Projects
                  </h3>
                  <div className="space-y-1">
                    {results.projects.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => handleResultClick('projects', proj)}
                        className="w-full flex items-center space-x-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/35 text-left transition"
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: proj.color }}
                        >
                          <Folder className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {proj.name}
                          </p>
                          {proj.description && (
                            <p className="text-[10px] text-slate-450 dark:text-slate-500 truncate mt-0.5">
                              {proj.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Category */}
              {results.tasks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider pl-1.5">
                    Tasks
                  </h3>
                  <div className="space-y-1">
                    {results.tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleResultClick('tasks', task)}
                        className="w-full flex items-center space-x-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/35 text-left transition"
                      >
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-[10px] text-slate-450 dark:text-slate-500 truncate mt-0.5">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Category */}
              {results.comments.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider pl-1.5">
                    Comments
                  </h3>
                  <div className="space-y-1">
                    {results.comments.map((comm) => (
                      <button
                        key={comm.id}
                        onClick={() => handleResultClick('comments', comm)}
                        className="w-full flex items-center space-x-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/35 text-left transition"
                      >
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            &quot;{comm.text}&quot;
                          </p>
                          <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 truncate">
                            By {comm.user.displayName} on task: {comm.task.title}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Users Category */}
              {results.users.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider pl-1.5">
                    Colleagues (People)
                  </h3>
                  <div className="space-y-1">
                    {results.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleResultClick('users', user)}
                        className="w-full flex items-center space-x-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/35 text-left transition"
                      >
                        <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {user.displayName}
                          </p>
                          <p className="text-[10px] text-slate-450 dark:text-slate-500 truncate mt-0.5">
                            {user.email} (Click to DM)
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
