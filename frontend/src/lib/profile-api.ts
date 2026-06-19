import { api } from './api';
import { User } from './auth-api';

export async function getProfileApi(): Promise<User> {
  const response = await api.get<User>('/profile');
  return response.data;
}

export async function updateProfileApi(data: { name?: string; email?: string; notifyByEmail?: boolean }): Promise<User> {
  const response = await api.patch<User>('/profile', data);
  return response.data;
}

export async function uploadAvatarApi(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await api.post<User>('/profile/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function deleteAvatarApi(): Promise<User> {
  const response = await api.delete<User>('/profile/avatar');
  return response.data;
}
