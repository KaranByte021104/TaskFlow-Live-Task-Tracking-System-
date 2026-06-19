'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { Task, Activity, TaskImage, Comment } from '@/lib/tasks-api';
import { Notification } from '@/lib/notifications-api';

export interface PresenceUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function useProjectRealtime(projectId: string | null) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const { addToast } = useToastStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (!socket) return;

    let hasBeenDisconnected = false;

    const joinRoom = () => {
      if (projectId) {
        socket.emit('joinProject', projectId);
      }
    };

    // Join room if already connected
    if (socket.connected) {
      joinRoom();
    }

    const handleConnect = () => {
      if (hasBeenDisconnected) {
        addToast('Connection restored. You are back online!', 'success');
        hasBeenDisconnected = false;
      }
    };

    // Handle presence updates
    const handlePresence = (users: PresenceUser[]) => {
      queryClient.setQueryData(['presence', projectId], users);
    };

    // Clear presence list on socket disconnection (server shutdown)
    const handleDisconnect = () => {
      queryClient.setQueryData(['presence', projectId], []);
      addToast('You are offline. Trying to reconnect...', 'error');
      hasBeenDisconnected = true;
    };

    // Handle task:created event
    const handleTaskCreated = (data: { task: Task; userId: string; userDisplayName: string }) => {
      queryClient.setQueriesData({ queryKey: ['tasks', projectId] }, (old: any) => {
        if (!old) return old;
        if (old.pages) {
          const updatedPages = [...old.pages];
          if (updatedPages.length > 0) {
            const exists = updatedPages.some((page) => page.some((t: Task) => t.id === data.task.id));
            if (!exists) {
              updatedPages[0] = [data.task, ...updatedPages[0]];
            }
          } else {
            updatedPages[0] = [data.task];
          }
          return { ...old, pages: updatedPages };
        }
        if (Array.isArray(old)) {
          if (old.some((t: Task) => t.id === data.task.id)) return old;
          return [data.task, ...old];
        }
        return old;
      });

      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      if (data.userId !== currentUser?.id) {
        addToast(`${data.userDisplayName} created task: "${data.task.title}"`, 'success');
        addNotification(`${data.userDisplayName} created task: "${data.task.title}"`, 'success');
      }
    };

    // Handle task:updated event
    const handleTaskUpdated = (data: { task: Task; userId: string; userDisplayName: string }) => {
      const mergeTasks = (existing: Task, incoming: Task): Task => ({
        ...existing,
        ...incoming,
        _count: existing._count && incoming._count
          ? { ...existing._count, ...incoming._count }
          : (incoming._count || existing._count),
      });

      queryClient.setQueriesData({ queryKey: ['tasks', projectId] }, (old: any) => {
        if (!old) return old;
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: Task[]) => page.map((t) => (t.id === data.task.id ? mergeTasks(t, data.task) : t))),
          };
        }
        if (Array.isArray(old)) {
          return old.map((t: Task) => (t.id === data.task.id ? mergeTasks(t, data.task) : t));
        }
        return old;
      });

      queryClient.setQueryData(['task', projectId, data.task.id], (old: any) => {
        if (!old) return data.task;
        return mergeTasks(old, data.task);
      });
      queryClient.invalidateQueries({ queryKey: ['task-history', data.task.id] });
      queryClient.invalidateQueries({ queryKey: ['comments', data.task.id] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      if (data.userId !== currentUser?.id) {
        addToast(`${data.userDisplayName} updated task: "${data.task.title}"`, 'info');
        addNotification(`${data.userDisplayName} updated task: "${data.task.title}"`, 'info');
      }
    };

    // Handle task:deleted event
    const handleTaskDeleted = (data: { taskId: string; title: string; userId: string; userDisplayName: string }) => {
      queryClient.setQueriesData({ queryKey: ['tasks', projectId] }, (old: any) => {
        if (!old) return old;
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: Task[]) => page.filter((t) => t.id !== data.taskId)),
          };
        }
        if (Array.isArray(old)) {
          return old.filter((t: Task) => t.id !== data.taskId);
        }
        return old;
      });

      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      if (data.userId !== currentUser?.id) {
        addToast(`${data.userDisplayName} deleted task: "${data.title}"`, 'warning');
        addNotification(`${data.userDisplayName} deleted task: "${data.title}"`, 'warning');
      }
    };

    // Handle activity:new event
    const handleActivityNew = (data: { activity: Activity }) => {
      queryClient.setQueryData<Activity[]>(['activities', projectId], (old) => {
        if (!old) return [data.activity];
        if (old.some((act) => act.id === data.activity.id)) return old;
        return [data.activity, ...old];
      });
    };

    const handleProjectAdded = (data: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      addToast('You have been added to a new project!', 'success');
      addNotification('You have been added to a new project!', 'success');
    };

    const handleProjectUpdated = (data: { projectId: string; role: string }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', data.projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', data.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', data.projectId] });
      addToast(`Your role in the project was updated to ${data.role}`, 'info');
      addNotification(`Your role in the project was updated to ${data.role}`, 'info');
    };

    const handleProjectRemoved = (data: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      addToast('You have been removed from a project', 'warning');
      addNotification('You have been removed from a project', 'warning');
      if (projectId === data.projectId) {
        window.location.href = '/dashboard';
      }
    };

    const handleTaskImagesUpdated = (data: { taskId: string; images: TaskImage[] }) => {
      queryClient.setQueryData(['task-images', projectId, data.taskId], data.images);
      
      // Update image counts in the task list
      queryClient.setQueriesData({ queryKey: ['tasks', projectId] }, (old: any) => {
        if (!old) return old;
        const updateTaskImagesCount = (t: Task) => {
          if (t.id === data.taskId) {
            return {
              ...t,
              _count: {
                ...t._count,
                images: data.images.length,
              },
            };
          }
          return t;
        };

        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: Task[]) => page.map(updateTaskImagesCount)),
          };
        }
        if (Array.isArray(old)) {
          return old.map(updateTaskImagesCount);
        }
        return old;
      });

      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    };

    const handleCommentReactionUpdated = (data: { commentId: string; reactions: any[] }) => {
      queryClient.setQueriesData({ queryKey: ['comments'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((c: Comment) => {
            if (c.id === data.commentId) {
              return { ...c, reactions: data.reactions };
            }
            return c;
          });
        }
        return old;
      });
    };

    const handleNotificationNew = (notification: Notification) => {
      // 1. Show a toast notification
      addToast(notification.body, 'info');

      // 2. Increment unread count query cache
      queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => {
        return { count: (old?.count || 0) + 1 };
      });

      // 3. Prepend to recent list query cache
      queryClient.setQueryData(['notifications', 'recent'], (old: any) => {
        if (!old) return [notification];
        return [notification, ...old].slice(0, 10);
      });

      // 4. Invalidate notifications list query (for the full notifications page)
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    };

    const handleChannelMessageReceived = (data: { channelId: string; projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['project-channels', data.projectId] });
    };

    const handleConversationMessageReceived = (data: { conversationId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    socket.on('connect', handleConnect);
    socket.on('authenticated', joinRoom);
    socket.on('presence:update', handlePresence);
    socket.on('disconnect', handleDisconnect);
    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('activity:new', handleActivityNew);
    socket.on('project:added', handleProjectAdded);
    socket.on('project:updated', handleProjectUpdated);
    socket.on('project:removed', handleProjectRemoved);
    socket.on('task:images_updated', handleTaskImagesUpdated);
    socket.on('comment:reaction_updated', handleCommentReactionUpdated);
    socket.on('notification:new', handleNotificationNew);
    socket.on('channel:message_received', handleChannelMessageReceived);
    socket.on('conversation:message_received', handleConversationMessageReceived);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('authenticated', joinRoom);
      socket.off('presence:update', handlePresence);
      socket.off('disconnect', handleDisconnect);
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('activity:new', handleActivityNew);
      socket.off('project:added', handleProjectAdded);
      socket.off('project:updated', handleProjectUpdated);
      socket.off('project:removed', handleProjectRemoved);
      socket.off('task:images_updated', handleTaskImagesUpdated);
      socket.off('comment:reaction_updated', handleCommentReactionUpdated);
      socket.off('notification:new', handleNotificationNew);
      socket.off('channel:message_received', handleChannelMessageReceived);
      socket.off('conversation:message_received', handleConversationMessageReceived);

      if (socket.connected && projectId) {
        socket.emit('leaveProject', projectId);
      }
    };
  }, [socket, projectId, queryClient, currentUser, addToast]);
}
