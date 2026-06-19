import { api } from './api';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  notifyByEmail?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function refreshApi(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    refreshToken,
  });
  return response.data;
}

export async function logoutApi(refreshToken: string): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>('/auth/logout', {
    refreshToken,
  });
  return response.data;
}

export async function registerApi(name: string, email: string, passwordStr: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', {
    name,
    email,
    password: passwordStr,
  });
  return response.data;
}

export async function loginApi(email: string, passwordStr: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', {
    email,
    password: passwordStr,
  });
  return response.data;
}

export async function getMeApi(): Promise<User> {
  const response = await api.get<User>('/auth/me');
  return response.data;
}

export async function requestOtpApi(email: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/auth/request-otp', { email });
  return response.data;
}

export async function verifyOtpApi(email: string, code: string): Promise<{ verificationToken: string }> {
  const response = await api.post<{ verificationToken: string }>('/auth/verify-otp', { email, code });
  return response.data;
}

export async function setNewPasswordApi(verificationToken: string, newPasswordStr: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/auth/set-new-password', {
    verificationToken,
    newPassword: newPasswordStr,
  });
  return response.data;
}

export async function changePasswordApi(currentPasswordStr: string, newPasswordStr: string, confirmNewPasswordStr: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/auth/change-password', {
    currentPassword: currentPasswordStr,
    newPassword: newPasswordStr,
    confirmNewPassword: confirmNewPasswordStr,
  });
  return response.data;
}


