import { api } from './api';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tasks: number;
    members: number;
  };
}

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
}

export async function createProjectApi(data: { name: string; description?: string; color?: string }): Promise<Project> {
  const response = await api.post<Project>('/projects', data);
  return response.data;
}

export async function getProjectsApi(): Promise<Project[]> {
  const response = await api.get<Project[]>('/projects');
  return response.data;
}

export async function getProjectApi(projectId: string): Promise<ProjectDetail> {
  const response = await api.get<ProjectDetail>(`/projects/${projectId}`);
  return response.data;
}

export async function updateProjectApi(projectId: string, data: { name: string; description?: string; color?: string }): Promise<Project> {
  const response = await api.patch<Project>(`/projects/${projectId}`, data);
  return response.data;
}

export async function deleteProjectApi(projectId: string): Promise<void> {
  await api.delete(`/projects/${projectId}`);
}

export async function addProjectMemberApi(projectId: string, data: { email: string; role: 'ADMIN' | 'MANAGER' | 'MEMBER' }): Promise<ProjectMember> {
  const response = await api.post<ProjectMember>(`/projects/${projectId}/members`, data);
  return response.data;
}

export async function updateProjectMemberRoleApi(projectId: string, memberId: string, role: 'ADMIN' | 'MANAGER' | 'MEMBER'): Promise<ProjectMember> {
  const response = await api.patch<ProjectMember>(`/projects/${projectId}/members/${memberId}`, { role });
  return response.data;
}

export async function removeProjectMemberApi(projectId: string, memberId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/members/${memberId}`);
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  completionPercentage: number;
  priority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
  };
  recentActivities: any[];
  upcomingTasks: any[];
}

export async function getProjectStatsApi(projectId: string): Promise<ProjectStats> {
  const response = await api.get<ProjectStats>(`/projects/${projectId}/stats`);
  return response.data;
}

export interface DashboardStats {
  totalProjects: number;
  totalTasks: number;
  assignedTasks: number;
  overdueTasks: number;
}

export async function getDashboardStatsApi(): Promise<DashboardStats> {
  const response = await api.get<DashboardStats>('/projects/dashboard/stats');
  return response.data;
}
