import { api } from './api';
import { User } from './auth-api';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  assigneeId: string | null;
  creatorId: string;
  dueDate: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  assignee?: User | null;
  creator?: User;
  labels?: TaskLabel[];
  dependencies?: any[];
  _count?: {
    comments: number;
    images?: number;
  };
}

export interface Activity {
  id: string;
  type: 'TASK_CREATED' | 'TASK_UPDATED' | 'STATUS_CHANGED' | 'TASK_COMPLETED' | 'COMMENT_ADDED' | 'MEMBER_ADDED' | 'MEMBER_REMOVED';
  projectId: string;
  userId: string;
  taskId: string | null;
  metadata: any | null;
  createdAt: string;
  user: {
    displayName: string;
    avatarUrl: string | null;
  };
  task?: {
    title: string;
  } | null;
}

export interface TaskDetail extends Task {
  comments: any[];
}

export async function createTaskApi(
  projectId: string,
  data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    dueDate?: string;
  }
): Promise<Task> {
  const response = await api.post<Task>(`/projects/${projectId}/tasks`, data);
  return response.data;
}

export async function getTasksApi(
  projectId: string,
  filters: {
    status?: TaskStatus;
    assigneeId?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  } = {}
): Promise<Task[]> {
  const response = await api.get<Task[]>(`/projects/${projectId}/tasks`, {
    params: filters,
  });
  return response.data;
}

export async function getTaskApi(projectId: string, taskId: string): Promise<TaskDetail> {
  const response = await api.get<TaskDetail>(`/projects/${projectId}/tasks/${taskId}`);
  return response.data;
}

export async function updateTaskApi(
  projectId: string,
  taskId: string,
  data: {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string | null;
    dueDate?: string | null;
  }
): Promise<Task> {
  const response = await api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, data);
  return response.data;
}

export async function deleteTaskApi(projectId: string, taskId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/tasks/${taskId}`);
}

export async function getActivitiesApi(projectId: string): Promise<Activity[]> {
  const response = await api.get<Activity[]>(`/projects/${projectId}/activities`);
  return response.data;
}

export interface CommentReaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface Comment {
  id: string;
  text: string;
  taskId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  reactions?: CommentReaction[];
}

export interface GroupedReaction {
  emoji: string;
  count: number;
  users: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  }[];
  reactedByMe: boolean;
}

export async function toggleCommentReactionApi(commentId: string, emoji: string): Promise<void> {
  await api.post(`/comments/${commentId}/reactions`, { emoji });
}

export async function getCommentReactionsApi(commentId: string): Promise<GroupedReaction[]> {
  const response = await api.get<GroupedReaction[]>(`/comments/${commentId}/reactions`);
  return response.data;
}

export async function createCommentApi(taskId: string, text: string): Promise<Comment> {
  const response = await api.post<Comment>(`/tasks/${taskId}/comments`, { text });
  return response.data;
}

export async function getCommentsApi(taskId: string): Promise<Comment[]> {
  const response = await api.get<Comment[]>(`/tasks/${taskId}/comments`);
  return response.data;
}

export async function updateCommentApi(commentId: string, text: string): Promise<Comment> {
  const response = await api.patch<Comment>(`/comments/${commentId}`, { text });
  return response.data;
}

export async function deleteCommentApi(commentId: string): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}

export async function getMyTasksApi(): Promise<Task[]> {
  const response = await api.get<Task[]>('/projects/tasks/assigned');
  return response.data;
}

export interface TaskImage {
  id: string;
  taskId: string;
  originalName: string;
  storedName: string;
  url: string;
  size: number;
  mimeType: string;
  uploaderId: string;
  createdAt: string;
  uploader?: User;
}

export async function uploadTaskImagesApi(taskId: string, formData: FormData): Promise<TaskImage[]> {
  const response = await api.post<TaskImage[]>(`/tasks/${taskId}/images`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function getTaskImagesApi(taskId: string): Promise<TaskImage[]> {
  const response = await api.get<TaskImage[]>(`/tasks/${taskId}/images`);
  return response.data;
}

export async function deleteTaskImageApi(imageId: string): Promise<void> {
  await api.delete(`/images/${imageId}`);
}

export async function getTaskHistoryApi(taskId: string): Promise<Activity[]> {
  const response = await api.get<Activity[]>(`/tasks/${taskId}/history`);
  return response.data;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  projectId: string;
  createdAt: string;
}

export interface TaskLabel {
  id: string;
  taskId: string;
  labelId: string;
  label: Label;
}

export async function getProjectLabelsApi(projectId: string): Promise<Label[]> {
  const response = await api.get<Label[]>(`/projects/${projectId}/labels`);
  return response.data;
}

export async function createProjectLabelApi(
  projectId: string,
  data: { name: string; color: string }
): Promise<Label> {
  const response = await api.post<Label>(`/projects/${projectId}/labels`, data);
  return response.data;
}

export async function updateLabelApi(
  labelId: string,
  data: { name?: string; color?: string }
): Promise<Label> {
  const response = await api.patch<Label>(`/labels/${labelId}`, data);
  return response.data;
}

export async function deleteLabelApi(labelId: string): Promise<void> {
  await api.delete(`/labels/${labelId}`);
}

export async function addLabelToTaskApi(taskId: string, labelId: string): Promise<Task> {
  const response = await api.post<Task>(`/tasks/${taskId}/labels`, { labelId });
  return response.data;
}

export async function removeLabelFromTaskApi(taskId: string, labelId: string): Promise<Task> {
  const response = await api.delete<Task>(`/tasks/${taskId}/labels/${labelId}`);
  return response.data;
}

export interface TaskDependencyLists {
  blockedBy: any[];
  blocking: any[];
}

export async function getTaskDependenciesApi(taskId: string): Promise<TaskDependencyLists> {
  const response = await api.get<TaskDependencyLists>(`/tasks/${taskId}/dependencies`);
  return response.data;
}

export async function addDependencyApi(taskId: string, blockedByTaskId: string): Promise<Task> {
  const response = await api.post<Task>(`/tasks/${taskId}/dependencies`, { blockedByTaskId });
  return response.data;
}

export async function removeDependencyApi(taskId: string, blockedByTaskId: string): Promise<Task> {
  const response = await api.delete<Task>(`/tasks/${taskId}/dependencies/${blockedByTaskId}`);
  return response.data;
}



