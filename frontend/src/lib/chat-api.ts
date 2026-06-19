import { api } from './api';

export interface Channel {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  isGeneral: boolean;
  isArchived: boolean;
  creatorId?: string;
  createdAt: string;
  unreadCount?: number;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface Conversation {
  id: string;
  createdAt: string;
  otherParticipant: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  lastMessage: Message | null;
  lastReadAt: string;
  unreadCount: number;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  originalName: string;
  storedName: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  channelId: string | null;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  attachments: MessageAttachment[];
}

export async function getProjectChannelApi(projectId: string): Promise<Channel> {
  const response = await api.get<Channel>(`/projects/${projectId}/channel`);
  return response.data;
}

export async function getConversationsApi(): Promise<Conversation[]> {
  const response = await api.get<Conversation[]>('/conversations');
  return response.data;
}

export async function getOrCreateConversationApi(otherUserId: string): Promise<Conversation> {
  const response = await api.post<Conversation>('/conversations', { otherUserId });
  return response.data;
}

export async function getMessagesApi(
  roomId: string,
  type: 'channel' | 'conversation',
  limit?: number,
  cursor?: string,
): Promise<Message[]> {
  const endpoint = type === 'channel'
    ? `/channels/${roomId}/messages`
    : `/conversations/${roomId}/messages`;
  
  const response = await api.get<Message[]>(endpoint, {
    params: { limit, cursor },
  });
  return response.data;
}

export async function sendMessageApi(
  roomId: string,
  type: 'channel' | 'conversation',
  content: string,
  mentionedUserIds: string[],
  files?: File[],
): Promise<Message> {
  const endpoint = type === 'channel'
    ? `/channels/${roomId}/messages`
    : `/conversations/${roomId}/messages`;

  const formData = new FormData();
  formData.append('content', content);
  formData.append('mentionedUserIds', JSON.stringify(mentionedUserIds));
  
  if (files && files.length > 0) {
    files.forEach((file) => {
      formData.append('attachments', file);
    });
  }

  const response = await api.post<Message>(endpoint, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function markReadApi(
  roomId: string,
  type: 'channel' | 'conversation',
): Promise<{ success: boolean }> {
  const endpoint = type === 'channel'
    ? `/channels/${roomId}/read`
    : `/conversations/${roomId}/read`;

  const response = await api.post<{ success: boolean }>(endpoint);
  return response.data;
}

export interface DmCandidate {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export async function getDmCandidatesApi(): Promise<DmCandidate[]> {
  const response = await api.get<DmCandidate[]>('/conversations/candidates');
  return response.data;
}

export async function createChannelApi(
  projectId: string,
  data: { name: string; description?: string; isPrivate?: boolean; memberIds?: string[] }
): Promise<Channel> {
  const response = await api.post<Channel>(`/projects/${projectId}/channels`, data);
  return response.data;
}

export async function listChannelsApi(projectId: string): Promise<Channel[]> {
  const response = await api.get<Channel[]>(`/projects/${projectId}/channels`);
  return response.data;
}

export async function updateChannelApi(
  channelId: string,
  data: { name?: string; description?: string }
): Promise<Channel> {
  const response = await api.patch<Channel>(`/channels/${channelId}`, data);
  return response.data;
}

export async function archiveChannelApi(channelId: string): Promise<Channel> {
  const response = await api.post<Channel>(`/channels/${channelId}/archive`);
  return response.data;
}

export async function unarchiveChannelApi(channelId: string): Promise<Channel> {
  const response = await api.post<Channel>(`/channels/${channelId}/unarchive`);
  return response.data;
}

export async function addChannelMembersApi(channelId: string, memberIds: string[]): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>(`/channels/${channelId}/members`, { memberIds });
  return response.data;
}

export async function removeChannelMemberApi(channelId: string, targetUserId: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(`/channels/${channelId}/members/${targetUserId}`);
  return response.data;
}

export interface UserSummary {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export async function listChannelMembersApi(channelId: string): Promise<UserSummary[]> {
  const response = await api.get<UserSummary[]>(`/channels/${channelId}/members`);
  return response.data;
}
