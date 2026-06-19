'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getConversationsApi,
  getOrCreateConversationApi,
  getDmCandidatesApi,
  Conversation,
} from '@/lib/chat-api';
import ChatRoom from '@/components/chat/chat-room';
import Avatar from '@/components/ui/avatar';
import Spinner from '@/components/ui/spinner';
import { useAuthStore } from '@/store/useAuthStore';
import { MessageSquare, Plus, Search, MessageCircle, X } from 'lucide-react';

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const activeConvId = searchParams.get('conversation');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');

  // Fetch DM conversations list
  const { data: conversations = [], isLoading: isConvsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversationsApi,
    enabled: !!currentUser,
    refetchInterval: 10000, // Poll every 10 seconds for robustness
  });

  // Fetch candidates to start DMs with
  const { data: candidates = [], isLoading: isCandidatesLoading } = useQuery({
    queryKey: ['dm-candidates'],
    queryFn: getDmCandidatesApi,
    enabled: !!currentUser && showNewChatModal,
  });

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  // Mutation to start/lookup conversation
  const startConversationMutation = useMutation({
    mutationFn: getOrCreateConversationApi,
    onSuccess: (newConv) => {
      // Refresh list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Redirect/select new conversation
      router.push(`/dashboard/messages?conversation=${newConv.id}`);
      setShowNewChatModal(false);
      setCandidateSearch('');
    },
  });

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    c.otherParticipant?.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter candidates
  const filteredCandidates = candidates.filter(
    (cand) =>
      cand.displayName.toLowerCase().includes(candidateSearch.toLowerCase()) &&
      // Don't show candidates that we already have active DMs with
      !conversations.some((c) => c.otherParticipant?.id === cand.id)
  );

  const handleStartChat = (otherUserId: string) => {
    startConversationMutation.mutate(otherUserId);
  };

  // Auto-select first conversation if none selected on desktop
  useEffect(() => {
    if (!activeConvId && conversations.length > 0) {
      router.push(`/dashboard/messages?conversation=${conversations[0].id}`);
    }
  }, [conversations, activeConvId, router]);

  const chatMembers = currentUser && activeConversation?.otherParticipant
    ? [
        {
          id: currentUser.id,
          displayName: currentUser.displayName,
          email: currentUser.email,
          avatarUrl: currentUser.avatarUrl,
        },
        {
          id: activeConversation.otherParticipant.id,
          displayName: activeConversation.otherParticipant.displayName,
          email: activeConversation.otherParticipant.email,
          avatarUrl: activeConversation.otherParticipant.avatarUrl,
        },
      ]
    : [];

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition duration-150">
      {/* Sidebar List */}
      <div className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900/60 shrink-0 ${
        activeConvId ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Messages</h1>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
            title="New Chat"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 p-2 space-y-1">
          {isConvsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 text-center px-4">
              <MessageCircle className="w-10 h-10 stroke-[1.5] mb-2" />
              <p className="text-xs font-semibold">No DMs found</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-2.5 text-xs text-blue-600 font-bold hover:underline"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              const other = conv.otherParticipant;
              if (!other) return null;

              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/dashboard/messages?conversation=${conv.id}`)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-2xl transition duration-150 text-left ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-slate-900 dark:text-white'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-350'
                  }`}
                >
                  <Avatar name={other.displayName} src={other.avatarUrl} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <p className="text-xs font-bold truncate">{other.displayName}</p>
                      {conv.lastMessage && (
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0">
                          {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-75 truncate mt-0.5">
                      {conv.lastMessage
                        ? `${conv.lastMessage.senderId === currentUser?.id ? 'You: ' : ''}${
                            conv.lastMessage.content
                          }`
                        : 'No messages yet'}
                    </p>
                  </div>

                  {conv.unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 min-w-[16px] text-center">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="hidden md:flex flex-1 flex-col bg-slate-50/50 dark:bg-[#070b12] min-w-0">
        {activeConversation && currentUser ? (
          <div className="flex-1 flex flex-col min-h-0 p-6">
            <ChatRoom
              roomId={activeConversation.id}
              type="conversation"
              members={chatMembers}
              title={activeConversation.otherParticipant?.displayName || 'Direct Message'}
              subtitle={activeConversation.otherParticipant?.email || ''}
              className="flex-1 min-h-0 w-full"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <MessageSquare className="w-16 h-16 stroke-[1.2] mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">No Chat Selected</h3>
            <p className="text-xs mt-1">Select a conversation from the sidebar list to start chatting.</p>
          </div>
        )}
      </div>

      {/* Mobile view override */}
      <div className={`md:hidden flex-1 flex flex-col min-w-0 ${
        activeConvId ? 'flex' : 'hidden'
      }`}>
        {activeConversation && currentUser && (
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <button
              onClick={() => router.push('/dashboard/messages')}
              className="text-xs text-blue-600 dark:text-blue-450 font-bold mb-3 flex items-center gap-1 hover:underline"
            >
              ← Back to messages
            </button>
            <ChatRoom
              roomId={activeConversation.id}
              type="conversation"
              members={chatMembers}
              title={activeConversation.otherParticipant?.displayName || 'Direct Message'}
              subtitle={activeConversation.otherParticipant?.email || ''}
              className="flex-1 min-h-0 w-full"
            />
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl transition duration-150 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">New Conversation</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5.5 h-5.5" />
              </button>
            </div>

            {/* Candidate Search */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search project members..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Candidates list */}
            <div className="max-h-60 overflow-y-auto p-2 space-y-1">
              {isCandidatesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Spinner />
                </div>
              ) : filteredCandidates.length === 0 ? (
                <p className="text-xs text-slate-450 dark:text-slate-500 text-center py-6">
                  No other colleagues found to chat with
                </p>
              ) : (
                filteredCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    onClick={() => handleStartChat(cand.id)}
                    className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition"
                  >
                    <Avatar name={cand.displayName} src={cand.avatarUrl} size="md" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {cand.displayName}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {cand.email}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
