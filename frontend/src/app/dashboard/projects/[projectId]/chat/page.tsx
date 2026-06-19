'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjectApi } from '@/lib/projects-api';
import { listChannelsApi, Channel } from '@/lib/chat-api';
import ChatRoom from '@/components/chat/chat-room';
import CreateChannelModal from '@/components/chat/create-channel-modal';
import ChannelSettingsModal from '@/components/chat/channel-settings-modal';
import Spinner from '@/components/ui/spinner';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Hash,
  Lock,
  Plus,
  Search,
  Settings,
  Archive,
  Compass,
  MessageSquare,
} from 'lucide-react';

export default function ProjectChatPage({ params }: { params: { projectId: string } }) {
  const currentUser = useAuthStore((state) => state.user);
  const projectId = params.projectId;

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Fetch Project
  const { data: project, isLoading: isProjectLoading, isError: isProjectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectApi(projectId),
    enabled: !!projectId,
  });

  // Fetch Channels
  const { data: channels = [], isLoading: isChannelsLoading, isError: isChannelsError } = useQuery({
    queryKey: ['project-channels', projectId],
    queryFn: () => listChannelsApi(projectId),
    enabled: !!projectId,
    refetchInterval: 10000, // Poll every 10s for unread indicators
  });

  // Determine user privilege
  const userMember = project?.members.find((m) => m.userId === currentUser?.id);
  const isPrivileged = userMember?.role === 'ADMIN' || userMember?.role === 'MANAGER';

  // Set default active channel (general channel) once loaded
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      const general = channels.find((c) => c.isGeneral);
      if (general) {
        setActiveChannelId(general.id);
      } else {
        setActiveChannelId(channels[0].id);
      }
    }
  }, [channels, activeChannelId]);

  if (isProjectLoading || isChannelsLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isProjectError || isChannelsError || !project) {
    return (
      <div className="text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <h3 className="text-lg font-bold text-red-500">Error loading chat</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
          Make sure you are a member of this project and try again.
        </p>
      </div>
    );
  }

  const projectMembers = project.members.map((m) => ({
    id: m.user.id,
    displayName: m.user.displayName,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
  }));

  // Filter channels based on search and archive status
  const filteredChannels = channels.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArchive = showArchived ? true : !c.isArchived;
    return matchesSearch && matchesArchive;
  });

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Header settings button
  const headerAction = activeChannel && isPrivileged ? (
    <button
      onClick={() => setShowSettingsModal(true)}
      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-white transition"
      title="Channel Settings"
    >
      <Settings className="w-4 h-4" />
    </button>
  ) : undefined;

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition duration-150">
      {/* Channels Sidebar List */}
      <div className="w-56 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900/60 shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-450 dark:text-slate-400 uppercase tracking-widest">
            Channels
          </h3>
          {isPrivileged && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
              title="Create Channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] placeholder-slate-400 dark:placeholder-slate-550 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Channels scroll container */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredChannels.length === 0 ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-8">
              No channels found
            </p>
          ) : (
            filteredChannels.map((chan) => {
              const isActive = chan.id === activeChannelId;
              const isUnread = chan.unreadCount ? chan.unreadCount > 0 : false;

              return (
                <button
                  key={chan.id}
                  onClick={() => setActiveChannelId(chan.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition duration-150 text-left ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold'
                      : chan.isArchived
                      ? 'text-slate-400 dark:text-slate-600 opacity-60 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                      : 'text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/25'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    {chan.isPrivate ? (
                      <Lock className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
                    ) : (
                      <Hash className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
                    )}
                    <span className={`text-xs truncate ${isUnread && !isActive ? 'font-extrabold text-slate-900 dark:text-white' : ''}`}>
                      {chan.name}
                    </span>
                    {chan.isArchived && (
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-450 dark:text-slate-500 text-[8px] font-bold px-1 py-0.2 rounded shrink-0">
                        Archived
                      </span>
                    )}
                  </div>

                  {isUnread && !isActive && (
                    <span className="bg-blue-600 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                      {chan.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Bottom Toggle */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            Show Archived
          </span>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`w-8 h-5 rounded-full p-0.5 transition duration-200 focus:outline-none ${
              showArchived ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition duration-200 ${
                showArchived ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-[#070b12] min-w-0">
        {activeChannel ? (
          <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6">
            <ChatRoom
              key={activeChannel.id}
              roomId={activeChannel.id}
              type="channel"
              members={projectMembers}
              title={`# ${activeChannel.name}`}
              subtitle={activeChannel.description || 'No description provided'}
              className="flex-1 min-h-0 w-full"
              headerAction={headerAction}
              isArchived={activeChannel.isArchived}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <MessageSquare className="w-16 h-16 stroke-[1.2] mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-350">No Channel Selected</h3>
            <p className="text-xs mt-1">Select a channel from the sidebar list to start chatting.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateChannelModal
        projectId={projectId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        members={projectMembers}
      />

      {activeChannel && (
        <ChannelSettingsModal
          channel={activeChannel}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          isPrivileged={isPrivileged}
          currentUserId={currentUser?.id || ''}
          projectMembers={projectMembers}
        />
      )}
    </div>
  );
}
