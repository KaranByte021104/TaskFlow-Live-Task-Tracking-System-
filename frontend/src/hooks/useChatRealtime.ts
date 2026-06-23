'use client';

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { Message } from '@/lib/chat-api';

export function useChatRealtime(roomId: string | null, type: 'channel' | 'conversation') {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const typingTimeoutRef = useRef<{ [userId: string]: NodeJS.Timeout }>({});

  // Reset typing indicators when room changes
  useEffect(() => {
    setTypingUsers([]);
  }, [roomId]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const roomName = type === 'channel' ? `channel:${roomId}` : `conversation:${roomId}`;

    const joinRoom = () => {
      const event = type === 'channel' ? 'joinChannel' : 'joinConversation';
      socket.emit(event, roomId);
    };

    if (socket.connected) {
      joinRoom();
    }

    const handleConnect = () => {
      joinRoom();
    };

    // Handle new message
    const handleMessageNew = (message: Message) => {
      // Check if message belongs to current active room
      const isCurrentRoom = type === 'channel' 
        ? message.channelId === roomId 
        : message.conversationId === roomId;

      if (!isCurrentRoom) return;

      // Update messages cache
      queryClient.setQueryData<Message[]>(['messages', type, roomId], (old) => {
        if (!old) return [message];
        // Prevent duplicates
        if (old.some((m) => m.id === message.id)) return old;
        return [...old, message];
      });

      // Clear typing indicator for this user when they send a message
      setTypingUsers((prev) => prev.filter((u) => u.id !== message.senderId));
      if (typingTimeoutRef.current[message.senderId]) {
        clearTimeout(typingTimeoutRef.current[message.senderId]);
        delete typingTimeoutRef.current[message.senderId];
      }

      // Invalidate conversations list so unread counts / preview updates
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['project-channels'] });
      queryClient.invalidateQueries({ queryKey: ['project-channel'] });
    };

    // Handle typing indicator updates
    const handleTypingUpdate = (data: {
      userId: string;
      name: string;
      typing: boolean;
      channelId?: string;
      conversationId?: string;
    }) => {
      const isCurrentRoom = type === 'channel'
        ? data.channelId === roomId
        : data.conversationId === roomId;

      if (!isCurrentRoom) return;

      if (data.typing) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.id === data.userId)) return prev;
          return [...prev, { id: data.userId, name: data.name }];
        });

        // Set safety timeout to remove indicator after 5 seconds of inactivity
        if (typingTimeoutRef.current[data.userId]) {
          clearTimeout(typingTimeoutRef.current[data.userId]);
        }
        typingTimeoutRef.current[data.userId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== data.userId));
        }, 5000);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u.id !== data.userId));
        if (typingTimeoutRef.current[data.userId]) {
          clearTimeout(typingTimeoutRef.current[data.userId]);
          delete typingTimeoutRef.current[data.userId];
        }
      }
    };

    socket.on('connect', handleConnect);
    socket.on('authenticated', joinRoom);
    socket.on('message:new', handleMessageNew);
    socket.on('typing:update', handleTypingUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('authenticated', joinRoom);
      socket.off('message:new', handleMessageNew);
      socket.off('typing:update', handleTypingUpdate);

      // Leave room
      if (socket.connected) {
        const leaveEvent = type === 'channel' ? 'leaveChannel' : 'leaveConversation';
        socket.emit(leaveEvent, roomId);
      }

      // Clean up timeouts
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
      typingTimeoutRef.current = {};
    };
  }, [socket, roomId, type, queryClient]);

  // Method to send typing state
  const sendTypingState = (isTyping: boolean) => {
    if (!socket || !roomId) return;
    const event = isTyping ? 'typing:start' : 'typing:stop';
    const payload = type === 'channel' ? { channelId: roomId } : { conversationId: roomId };
    socket.emit(event, payload);
  };

  return { typingUsers, sendTypingState };
}
