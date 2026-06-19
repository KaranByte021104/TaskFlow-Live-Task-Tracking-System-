import { api } from './api';

export interface ProjectFile {
  id: string;
  projectId: string;
  originalName: string;
  storedName: string;
  url: string;
  size: number;
  mimeType: string;
  uploaderId: string;
  createdAt: string;
  uploader: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export async function getProjectFilesApi(projectId: string): Promise<ProjectFile[]> {
  const response = await api.get<ProjectFile[]>(`/projects/${projectId}/files`);
  return response.data;
}

export async function uploadProjectFilesApi(projectId: string, files: File[]): Promise<ProjectFile[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await api.post<ProjectFile[]>(`/projects/${projectId}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function deleteProjectFileApi(projectId: string, fileId: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(`/projects/${projectId}/files/${fileId}`);
  return response.data;
}
