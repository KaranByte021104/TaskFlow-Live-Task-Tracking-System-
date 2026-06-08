import { create } from 'zustand';
import { User, getMeApi } from '../lib/auth-api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    // Write cookie for middleware access (7 days)
    document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Lax;`;
    set({ user, token, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    // Clear cookie
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax;';
    set({ user: null, token: null, isLoading: false });
  },

  initialize: async () => {
    set({ isLoading: true });
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, token: null, isLoading: false });
      return;
    }

    try {
      // Temporarily store token in state so the API client request interceptor finds it
      set({ token });
      const user = await getMeApi();
      set({ user, isLoading: false });
    } catch (error) {
      // If validation fails (e.g. token expired), clear everything
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax;';
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
