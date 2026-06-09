'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Calendar, User, Eye, Info, Check, Edit2, Paperclip, Smile } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { getProjectApi } from '@/lib/projects-api';
import {
  getTaskApi,
  updateTaskApi,
  deleteTaskApi,
  TaskStatus,
  TaskPriority,
  getCommentsApi,
  createCommentApi,
  updateCommentApi,
  deleteCommentApi,
  Comment,
  getTaskImagesApi,
  TaskImage,
  toggleCommentReactionApi,
  getTaskHistoryApi,
  getProjectLabelsApi,
  addLabelToTaskApi,
  removeLabelFromTaskApi,
  getTaskDependenciesApi,
  addDependencyApi,
  removeDependencyApi,
  getTasksApi,
} from '@/lib/tasks-api';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import Avatar from '@/components/ui/avatar';
import ImageUploader from './image-uploader';
import ImageGallery from './image-gallery';
import { clsx } from 'clsx';

interface TaskDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId: string;
  onTaskClick?: (id: string) => void;
}

export default function TaskDetailPanel({ isOpen, onClose, projectId, taskId, onTaskClick }: TaskDetailPanelProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [activeEmojiPickerCommentId, setActiveEmojiPickerCommentId] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const [showLabelsDropdown, setShowLabelsDropdown] = useState(false);
  const [showDependenciesDropdown, setShowDependenciesDropdown] = useState(false);
  const [dependencySearchTerm, setDependencySearchTerm] = useState('');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch full details of project & task
  const { data: projectDetail } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectApi(projectId),
    enabled: isOpen && !!projectId,
  });

  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['task', projectId, taskId],
    queryFn: () => getTaskApi(projectId, taskId),
    enabled: isOpen && !!taskId,
  });

  // Fetch task images
  const { data: taskImages = [] } = useQuery<TaskImage[]>({
    queryKey: ['task-images', projectId, taskId],
    queryFn: () => getTaskImagesApi(taskId),
    enabled: isOpen && !!taskId,
  });

  const handleUploaded = (newImages: TaskImage[]) => {
    queryClient.setQueryData<TaskImage[]>(['task-images', projectId, taskId], (old) => {
      if (!old) return newImages;
      const filteredNew = newImages.filter((newImg) => !old.some((oldImg) => oldImg.id === newImg.id));
      return [...old, ...filteredNew];
    });
    queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
  };

  const handleDeleted = (deletedImageId: string) => {
    queryClient.setQueryData<TaskImage[]>(['task-images', projectId, taskId], (old) => {
      if (!old) return [];
      return old.filter((img) => img.id !== deletedImageId);
    });
    queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
  };

  // Check user permissions in project
  const userMembership = projectDetail?.members.find((m) => m.userId === currentUser?.id);
  const isAdmin = userMembership?.role === 'ADMIN';
  const isViewer = userMembership?.role === 'VIEWER';

  useEffect(() => {
    if (task) {
      setTitleValue(task.title);
      setDescValue(task.description || '');
    }
  }, [task]);

  const { addToast } = useToastStore();

  const updateMutation = useMutation({
    mutationFn: (data: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
      dueDate?: string | null;
    }) => updateTaskApi(projectId, taskId, data),
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      await queryClient.cancelQueries({ queryKey: ['task', projectId, taskId] });

      // Snapshot the values
      const previousTasks = queryClient.getQueryData<any>(['tasks', projectId]);
      const previousTask = queryClient.getQueryData<any>(['task', projectId, taskId]);

      // Optimistically update details
      if (previousTask) {
        queryClient.setQueryData(['task', projectId, taskId], {
          ...previousTask,
          ...newData,
        });
      }

      // Optimistically update list
      if (previousTasks) {
        if (Array.isArray(previousTasks)) {
          queryClient.setQueryData(
            ['tasks', projectId],
            previousTasks.map((t) => (t.id === taskId ? { ...t, ...newData } : t))
          );
        } else if (previousTasks.pages) {
          queryClient.setQueryData(['tasks', projectId], {
            ...previousTasks,
            pages: previousTasks.pages.map((page: any[]) =>
              page.map((t) => (t.id === taskId ? { ...t, ...newData } : t))
            ),
          });
        }
      }

      return { previousTasks, previousTask };
    },
    onError: (err, newData, context) => {
      // Rollback
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', projectId, taskId], context.previousTask);
      }

      const message = (err as any).response?.data?.message || 'Failed to update task.';
      addToast(
        `Failed to update task: ${message}`,
        'error',
        {
          label: 'Reload task',
          callback: () => {
            queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
            queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
          },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-history', taskId] });
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      addToast('Task updated successfully', 'success');
      setShowSavedMsg(true);
      setTimeout(() => setShowSavedMsg(false), 2500);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTaskApi(projectId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activities', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
  });

  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => getCommentsApi(taskId),
    enabled: isOpen && !!taskId,
  });

  const { data: history = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['task-history', taskId],
    queryFn: () => getTaskHistoryApi(taskId),
    enabled: isOpen && !!taskId,
  });

  const { data: projectLabels = [] } = useQuery({
    queryKey: ['project-labels', projectId],
    queryFn: () => getProjectLabelsApi(projectId),
    enabled: isOpen && !!projectId,
  });

  const { data: dependencyData = { blockedBy: [], blocking: [] } } = useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: () => getTaskDependenciesApi(taskId),
    enabled: isOpen && !!taskId,
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['tasks-list-all', projectId],
    queryFn: () => getTasksApi(projectId, {}),
    enabled: isOpen && !!projectId && showDependenciesDropdown,
  });

  const addDependencyMutation = useMutation({
    mutationFn: (blockedByTaskId: string) => addDependencyApi(taskId, blockedByTaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to add dependency.', 'error');
    },
  });

  const removeDependencyMutation = useMutation({
    mutationFn: (blockedByTaskId: string) => removeDependencyApi(taskId, blockedByTaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to remove dependency.', 'error');
    },
  });

  const selectableTasks = projectTasks.filter(
    (t: any) =>
      t.id !== taskId &&
      !dependencyData.blockedBy.some((b: any) => b.id === t.id) &&
      t.title.toLowerCase().includes(dependencySearchTerm.toLowerCase())
  );

  const addLabelMutation = useMutation({
    mutationFn: (labelId: string) => addLabelToTaskApi(taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: string) => removeLabelFromTaskApi(taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: (text: string) => createCommentApi(taskId, text),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, text }: { commentId: string; text: string }) => updateCommentApi(commentId, text),
    onSuccess: () => {
      setEditingCommentId(null);
      setEditingCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteCommentApi(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const toggleReactionMutation = useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: string; emoji: string }) =>
      toggleCommentReactionApi(commentId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
    },
  });

  const groupReactions = (reactions: any[] = []) => {
    const grouped: { [emoji: string]: { emoji: string; count: number; users: any[]; reactedByMe: boolean } } = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = {
          emoji: r.emoji,
          count: 0,
          users: [],
          reactedByMe: false,
        };
      }
      grouped[r.emoji].count++;
      grouped[r.emoji].users.push(r.user);
      if (r.userId === currentUser?.id) {
        grouped[r.emoji].reactedByMe = true;
      }
    }
    return Object.values(grouped);
  };

  const formatHistoryDescription = (activity: any) => {
    switch (activity.type) {
      case 'TASK_CREATED':
        return 'Created this task';
      case 'COMMENT_ADDED':
        return 'Posted a comment';
      case 'STATUS_CHANGED': {
        const oldStatus = activity.metadata?.oldStatus || 'Todo';
        const newStatus = activity.metadata?.newStatus || 'Todo';
        return `Moved from ${oldStatus.replace('_', ' ')} to ${newStatus.replace('_', ' ')}`;
      }
      case 'TASK_COMPLETED':
        return 'Completed this task';
      case 'TASK_UPDATED': {
        const changes = activity.metadata?.changes;
        if (!changes || Object.keys(changes).length === 0) {
          return 'Updated task details';
        }
        const parts = Object.entries(changes).map(([field, delta]: [string, any]) => {
          const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
          if (field === 'dueDate') {
            const formattedDate = delta.new ? format(new Date(delta.new), 'MMM d, yyyy') : 'None';
            return `Updated due date to ${formattedDate}`;
          }
          if (delta.old !== undefined && delta.new !== undefined) {
            return `Changed ${field} from ${delta.old || 'None'} to ${delta.new || 'None'}`;
          }
          return `Updated ${fieldName}`;
        });
        return parts.join(', ');
      }
      default:
        return 'Performed an action';
    }
  };

  const triggerAutoSave = (fields: Parameters<typeof updateMutation.mutate>[0]) => {
    if (isViewer) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateMutation.mutate(fields);
    }, 800);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() !== task?.title && titleValue.trim().length >= 2) {
      updateMutation.mutate({ title: titleValue.trim() });
    } else {
      setTitleValue(task?.title || '');
    }
  };

  const handleDescBlur = () => {
    setIsEditingDesc(false);
    if (descValue !== (task?.description || '')) {
      updateMutation.mutate({ description: descValue });
    }
  };

  // Safe check to allow delete
  const canDelete = isAdmin || (task && task.creatorId === currentUser?.id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Side panel container */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 border-l border-slate-100 dark:border-slate-800 animate-slide-in transition-colors duration-200">
        {/* Top Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Task Details
            </span>
            {showSavedMsg && (
              <span className="flex items-center text-xs text-green-600 dark:text-green-455 font-semibold bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded animate-fade-in-out">
                <Check className="w-3.5 h-3.5 mr-1" />
                Saved
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {canDelete && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this task?')) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                title="Delete Task"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel Content Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner />
          </div>
        ) : isError || !task ? (
          <div className="p-8 text-center text-red-500">Error loading task details.</div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
            {/* Left section: Title, description, comments (65%) */}
            <div className="flex-1 p-6 sm:p-8 space-y-6 md:w-2/3">
              {/* Task Title Input/Header */}
              <div className="space-y-1">
                {isEditingTitle && !isViewer ? (
                  <input
                    type="text"
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleBlur();
                    }}
                    autoFocus
                    className="w-full text-2xl font-extrabold text-slate-900 dark:text-slate-100 border-b border-blue-500 bg-transparent focus:outline-none py-1"
                  />
                ) : (
                  <h1
                    onClick={() => {
                      if (!isViewer) setIsEditingTitle(true);
                    }}
                    className={clsx(
                      'text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-snug',
                      !isViewer && 'hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded px-1 -mx-1 transition'
                    )}
                  >
                    {task.title}
                  </h1>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Description
                </label>
                {isEditingDesc && !isViewer ? (
                  <textarea
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    onBlur={handleDescBlur}
                    rows={6}
                    autoFocus
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-805 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400 text-sm text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50 dark:bg-slate-950"
                  />
                ) : (
                  <div
                    onClick={() => {
                      if (!isViewer) setIsEditingDesc(true);
                    }}
                    className={clsx(
                      'text-sm text-slate-600 dark:text-slate-300 leading-relaxed min-h-[100px] p-3 rounded-lg border border-transparent',
                      !isViewer ? 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-100 dark:hover:border-slate-800 cursor-pointer transition' : 'bg-slate-50 dark:bg-slate-950 border-slate-50 dark:border-slate-950'
                    )}
                  >
                    {task.description || (
                      <span className="text-slate-400 dark:text-slate-500 italic">No description added. Click to edit...</span>
                    )}
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span>Attachments ({taskImages.length})</span>
                </h4>
                
                {taskImages.length > 0 && (
                  <ImageGallery
                    images={taskImages}
                    isReadOnly={isViewer}
                    isAdmin={isAdmin}
                    onDeleted={handleDeleted}
                  />
                )}

                {!isViewer && (
                  <ImageUploader
                    taskId={taskId}
                    onUploaded={handleUploaded}
                  />
                )}
              </div>

              {/* Comments Section */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>Discussion</span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                    {comments.length}
                  </span>
                </h4>

                {/* List of comments */}
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                  {isLoadingComments ? (
                    <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Loading comments...</div>
                  ) : comments.length > 0 ? (
                    comments.map((comment) => {
                      const isAuthor = comment.userId === currentUser?.id && !isViewer;
                      const canDeleteComment = (isAuthor || isAdmin) && !isViewer;
                      const isEditing = editingCommentId === comment.id;

                      return (
                        <div key={comment.id} className="flex gap-3 group items-start text-xs p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <Avatar name={comment.user.displayName} src={comment.user.avatarUrl} size="sm" className="w-8 h-8" />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-205">{comment.user.displayName}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                              
                              {!isEditing && (
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1.5 transition">
                                  {!isViewer && (
                                    <div className="relative">
                                      <button
                                        onClick={() => {
                                          setActiveEmojiPickerCommentId(
                                            activeEmojiPickerCommentId === comment.id ? null : comment.id
                                          );
                                        }}
                                        className="text-slate-400 hover:text-blue-500 p-0.5 rounded transition"
                                        title="Add Reaction"
                                      >
                                        <Smile className="w-3.5 h-3.5" />
                                      </button>
                                      {activeEmojiPickerCommentId === comment.id && (
                                        <div className="absolute right-0 top-6 z-50 flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg shadow-xl animate-fade-in">
                                          {['👍', '👎', '❤️', '🔥', '✅', '😂', '🎉', '😕'].map((emoji) => (
                                            <button
                                              key={emoji}
                                              onClick={() => {
                                                toggleReactionMutation.mutate({ commentId: comment.id, emoji });
                                                setActiveEmojiPickerCommentId(null);
                                              }}
                                              className="hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded transition text-sm"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {isAuthor && (
                                    <button
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingCommentText(comment.text);
                                      }}
                                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 p-0.5 rounded transition"
                                      title="Edit Comment"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {canDeleteComment && (
                                    <button
                                      onClick={() => {
                                        if (confirm('Are you sure you want to delete this comment?')) {
                                          deleteCommentMutation.mutate(comment.id);
                                        }
                                      }}
                                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded transition"
                                      title="Delete Comment"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-2 mt-1.5">
                                <textarea
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  rows={2}
                                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950"
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="secondary"
                                    onClick={() => setEditingCommentId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="primary"
                                    disabled={!editingCommentText.trim() || updateCommentMutation.isPending}
                                    onClick={() =>
                                      updateCommentMutation.mutate({
                                        commentId: comment.id,
                                        text: editingCommentText.trim(),
                                      })
                                    }
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                                  {comment.text}
                                </div>
                                {comment.reactions && comment.reactions.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {groupReactions(comment.reactions).map((group) => (
                                      <button
                                        key={group.emoji}
                                        onClick={() => {
                                          if (!isViewer) {
                                            toggleReactionMutation.mutate({ commentId: comment.id, emoji: group.emoji });
                                          }
                                        }}
                                        disabled={isViewer}
                                        className={clsx(
                                          'flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition duration-150',
                                          group.reactedByMe
                                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-600 dark:text-blue-400'
                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                        )}
                                        title={group.users.map((u) => u.displayName).join(', ')}
                                      >
                                        <span>{group.emoji}</span>
                                        <span>{group.count}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-slate-400 dark:text-slate-500 italic">
                      No comments yet. Start the discussion!
                    </div>
                  )}
                </div>

                {!isViewer && (
                  <div className="flex gap-3 items-start mt-2">
                    <Avatar name={currentUser?.displayName || 'User'} src={currentUser?.avatarUrl} size="sm" className="w-8 h-8 mt-1" />
                    <div className="flex-1 space-y-2">
                      <textarea
                        placeholder="Write a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        rows={2}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-400 text-xs text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 transition-colors duration-200"
                      />
                      <div className="flex justify-end">
                        <Button
                           disabled={!commentText.trim() || createCommentMutation.isPending}
                          onClick={() => createCommentMutation.mutate(commentText.trim())}
                          className="flex items-center gap-1.5"
                        >
                          Post Comment
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* History Audit Log Section */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                <button
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                  className="flex items-center justify-between w-full text-sm font-bold text-slate-850 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <span className="flex items-center gap-2">
                    <span>History ({history.length})</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {isHistoryExpanded ? 'Collapse' : 'Expand'}
                  </span>
                </button>

                {isHistoryExpanded && (
                  <div className="space-y-4 pt-2">
                    {isLoadingHistory ? (
                      <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Loading history...</div>
                    ) : history.length > 0 ? (
                      <>
                        <div className="relative pl-6 border-l border-slate-100 dark:border-slate-800 space-y-5">
                          {(showAllHistory ? history : history.slice(0, 10)).map((act: any) => (
                            <div key={act.id} className="relative flex gap-3 text-xs items-start">
                              {/* Dot on timeline */}
                              <div className="absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900" />
                              <Avatar name={act.user.displayName} src={act.user.avatarUrl} size="sm" className="w-6 h-6 rounded-full" />
                              <div className="flex-1 space-y-0.5">
                                <div className="text-slate-800 dark:text-slate-200 font-semibold">
                                  {act.user.displayName}{' '}
                                  <span className="font-normal text-slate-600 dark:text-slate-400">
                                    {formatHistoryDescription(act)}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                  {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {history.length > 10 && !showAllHistory && (
                          <div className="flex justify-center pt-2">
                            <button
                              onClick={() => setShowAllHistory(true)}
                              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition"
                            >
                              Show full history
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4 text-slate-400 dark:text-slate-500 italic">No history logged yet.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right section: Fields/Attributes dropdown (35%) */}
            <div className="w-full md:w-1/3 p-6 bg-slate-50/50 dark:bg-slate-950/20 space-y-6 transition-colors duration-200">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                Properties
              </h4>

              <div className="space-y-4.5">
                {/* Status selection */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Status</span>
                  <div className="col-span-2">
                    <select
                      value={task.status}
                      disabled={isViewer}
                      onChange={(e) => updateMutation.mutate({ status: e.target.value as TaskStatus })}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="REVIEW">Review</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Priority selection */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Priority</span>
                  <div className="col-span-2">
                    <select
                      value={task.priority}
                      disabled={isViewer}
                      onChange={(e) => updateMutation.mutate({ priority: e.target.value as TaskPriority })}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                </div>

                {/* Assignee selection */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Assignee</span>
                  <div className="col-span-2">
                    <select
                      value={task.assigneeId || ''}
                      disabled={isViewer}
                      onChange={(e) => updateMutation.mutate({ assigneeId: e.target.value || null })}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                    >
                      <option value="">Unassigned</option>
                      {projectDetail?.members.map((m) => (
                        <option key={m.id} value={m.user.id}>
                          {m.user.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Due Date selection */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Due Date</span>
                  <div className="col-span-2">
                    <input
                      type="date"
                      value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                      disabled={isViewer}
                      onChange={(e) => updateMutation.mutate({ dueDate: e.target.value || null })}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-305 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                    />
                  </div>
                </div>

                {/* Labels selection */}
                <div className="grid grid-cols-3 items-start gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">Labels</span>
                  <div className="col-span-2 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {task.labels?.map((tl: any) => (
                        <span
                          key={tl.id}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white relative group"
                          style={{ backgroundColor: tl.label.color }}
                        >
                          <span>{tl.label.name}</span>
                          {!isViewer && (
                            <button
                              type="button"
                              onClick={() => removeLabelMutation.mutate(tl.label.id)}
                              className="hover:bg-black/20 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold text-[9px] transition"
                            >
                              &times;
                            </button>
                          )}
                        </span>
                      ))}

                      {!isViewer && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowLabelsDropdown(!showLabelsDropdown)}
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:border-slate-350 dark:hover:border-slate-600 font-bold text-xs"
                          >
                            +
                          </button>
                          {showLabelsDropdown && (
                            <div className="absolute right-0 mt-1 z-50 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 max-h-40 overflow-y-auto">
                              {projectLabels.length > 0 ? (
                                projectLabels
                                  .filter((lbl: any) => !task.labels?.some((tl: any) => tl.label.id === lbl.id))
                                  .map((lbl: any) => (
                                    <button
                                      key={lbl.id}
                                      type="button"
                                      onClick={() => {
                                        addLabelMutation.mutate(lbl.id);
                                        setShowLabelsDropdown(false);
                                      }}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-left text-xs text-slate-700 dark:text-slate-300 font-medium"
                                    >
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-black/10"
                                        style={{ backgroundColor: lbl.color }}
                                      />
                                      <span>{lbl.name}</span>
                                    </button>
                                  ))
                              ) : (
                                <div className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 italic">No labels in project</div>
                              )}
                              {projectLabels.length > 0 &&
                                projectLabels.filter((lbl: any) => !task.labels?.some((tl: any) => tl.label.id === lbl.id))
                                  .length === 0 && (
                                  <div className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 italic">All labels applied</div>
                                )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dependencies section */}
                <div className="grid grid-cols-3 items-start gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">Blocked By</span>
                  <div className="col-span-2 space-y-3">
                    {dependencyData.blockedBy.length > 0 && (
                      <div className="space-y-1.5">
                        {dependencyData.blockedBy.map((blocker: any) => (
                          <div
                            key={blocker.id}
                            className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-slate-400">🔒</span>
                              <button
                                type="button"
                                onClick={() => onTaskClick?.(blocker.id)}
                                className="hover:underline font-semibold text-slate-700 dark:text-slate-200 truncate text-left"
                                title={blocker.title}
                              >
                                {blocker.title}
                              </button>
                              <span
                                className={clsx(
                                  'text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0',
                                  blocker.status === 'COMPLETED'
                                    ? 'bg-green-50/70 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-605 dark:text-slate-400 border border-slate-200 dark:border-slate-705'
                                )}
                              >
                                {blocker.status.replace('_', ' ')}
                              </span>
                            </div>

                            {!isViewer && (
                              <button
                                type="button"
                                onClick={() => removeDependencyMutation.mutate(blocker.id)}
                                className="text-slate-400 hover:text-red-500 font-bold text-xs p-0.5 transition"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!isViewer && (
                      <div className="relative">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setShowDependenciesDropdown(!showDependenciesDropdown);
                            setDependencySearchTerm('');
                          }}
                          className="w-full flex items-center justify-center py-1 text-xs"
                        >
                          Add dependency
                        </Button>

                        {showDependenciesDropdown && (
                          <div className="absolute right-0 mt-1.5 z-55 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2.5 space-y-2 max-h-56 overflow-y-auto">
                            <input
                              type="text"
                              placeholder="Search tasks..."
                              value={dependencySearchTerm}
                              onChange={(e) => setDependencySearchTerm(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                            <div className="space-y-1">
                              {selectableTasks.length > 0 ? (
                                selectableTasks.map((t: any) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      addDependencyMutation.mutate(t.id);
                                      setShowDependenciesDropdown(false);
                                    }}
                                    className="w-full px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left text-xs text-slate-705 dark:text-slate-300 font-semibold rounded-md transition"
                                  >
                                    {t.title}
                                  </button>
                                ))
                              ) : (
                                <div className="text-center py-2 text-xs text-slate-400 dark:text-slate-500 italic">No matching tasks</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Created By Info */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Created By</span>
                  <span className="col-span-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {task.creator?.displayName || 'Unknown'}
                  </span>
                </div>

                {/* Created At */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Created</span>
                  <span className="col-span-2 text-xs text-slate-500 dark:text-slate-400">
                    {format(new Date(task.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>

                {/* Last Updated */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Updated</span>
                  <span className="col-span-2 text-xs text-slate-500 dark:text-slate-400">
                    {format(new Date(task.updatedAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
