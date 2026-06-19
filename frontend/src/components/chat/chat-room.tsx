'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessagesApi, sendMessageApi, markReadApi, Message } from '@/lib/chat-api';
import { useChatRealtime } from '@/hooks/useChatRealtime';
import MessageList from './message-list';
import MessageComposer from './message-composer';
import Spinner from '../ui/spinner';

interface ChatRoomProps {
  roomId: string;
  type: 'channel' | 'conversation';
  members: { id: string; displayName: string; email: string; avatarUrl: string | null }[];
  title: string;
  subtitle?: string;
  className?: string;
  headerAction?: React.ReactNode;
  isArchived?: boolean;
}

export default function ChatRoom({ roomId, type, members, title, subtitle, className = 'h-[650px]', headerAction, isArchived = false }: ChatRoomProps) {
  const queryClient = useQueryClient();
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Hook for real-time messages and typing indicators
  const { typingUsers, sendTypingState } = useChatRealtime(roomId, type);

  // Fetch initial message history
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', type, roomId],
    queryFn: () => getMessagesApi(roomId, type, 30),
    enabled: !!roomId,
    staleTime: 0,
  });

  // Reset hasMore when roomId changes
  useEffect(() => {
    setHasMore(true);
  }, [roomId]);

  // Set hasMore to false if initial fetch returns fewer than 30 messages
  useEffect(() => {
    if (messages && messages.length < 30) {
      setHasMore(false);
    } else {
      setHasMore(true);
    }
  }, [messages]);

  // Mark room as read on mount and when new messages arrive
  useEffect(() => {
    if (!roomId) return;
    markReadApi(roomId, type)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['project-channel', roomId] });
      })
      .catch((err) => console.warn('Failed to mark chat as read:', err));
  }, [roomId, type, messages.length, queryClient]);

  // Load older messages (infinite scroll)
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;
    setIsLoadingMore(true);

    try {
      const cursor = messages[0].id;
      const olderMessages = await getMessagesApi(roomId, type, 30, cursor);
      
      if (olderMessages.length < 30) {
        setHasMore(false);
      }

      if (olderMessages.length > 0) {
        queryClient.setQueryData<Message[]>(['messages', type, roomId], (old) => {
          if (!old) return olderMessages;
          const uniqueNew = olderMessages.filter((newM) => !old.some((oldM) => oldM.id === newM.id));
          return [...uniqueNew, ...old];
        });
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send a new message
  const handleSendMessage = async (content: string, mentionedUserIds: string[], files?: File[]) => {
    try {
      const newMsg = await sendMessageApi(roomId, type, content, mentionedUserIds, files);
      
      // Manually add to query cache immediately for responsive feel
      queryClient.setQueryData<Message[]>(['messages', type, roomId], (old) => {
        if (!old) return [newMsg];
        if (old.some((m) => m.id === newMsg.id)) return old;
        return [...old, newMsg];
      });

      // Trigger read state
      await markReadApi(roomId, type);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition duration-150 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/80">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
              {subtitle}
            </p>
          )}
        </div>
        {headerAction && <div className="ml-4 shrink-0 flex items-center">{headerAction}</div>}
      </div>

      {/* Message List */}
      <div className="flex-1 min-h-0 flex flex-col p-4">
        <MessageList
          messages={messages}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          isLoadingMore={isLoadingMore}
          typingUsers={typingUsers}
          members={members}
        />
      </div>

      {/* Composer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {isArchived ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            This channel is archived and read-only.
          </div>
        ) : (
          <MessageComposer
            onSend={handleSendMessage}
            members={members}
            onTyping={sendTypingState}
          />
        )}
      </div>
    </div>
  );
}
