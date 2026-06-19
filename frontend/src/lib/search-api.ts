import { api } from './api';

export interface SearchResults {
  projects: {
    id: string;
    name: string;
    description: string | null;
    color: string;
  }[];
  tasks: {
    id: string;
    title: string;
    description: string | null;
    projectId: string;
  }[];
  comments: {
    id: string;
    text: string;
    taskId: string;
    task: {
      projectId: string;
      title: string;
    };
    user: {
      displayName: string;
    };
  }[];
  users: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  }[];
}

export async function searchApi(query: string, scope?: string): Promise<SearchResults> {
  const response = await api.get<SearchResults>('/search', {
    params: { q: query, scope },
  });
  return response.data;
}
