import { api } from './api';

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'MENTIONED_IN_COMMENT'
  | 'MENTIONED_IN_CHAT'
  | 'STATUS_CHANGED_ON_ASSIGNED_TASK';

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  read: boolean;
  title: string;
  body: string;
  link: string | null;
  metadata: any | null;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

export async function getNotificationsApi(
  limit?: number,
  cursor?: string,
): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.append('limit', limit.toString());
  if (cursor !== undefined) params.append('cursor', cursor);

  const response = await api.get<Notification[]>(
    `/notifications?${params.toString()}`,
  );
  return response.data;
}

export async function getUnreadCountApi(): Promise<UnreadCountResponse> {
  const response = await api.get<UnreadCountResponse>(
    '/notifications/unread-count',
  );
  return response.data;
}

export async function markAsReadApi(id: string): Promise<Notification> {
  const response = await api.patch<Notification>(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllAsReadApi(): Promise<void> {
  await api.patch('/notifications/read-all');
}
