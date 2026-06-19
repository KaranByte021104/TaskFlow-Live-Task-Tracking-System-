import { create } from 'zustand';
import { User, getMeApi, logoutApi } from '../lib/auth-api';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    // Write cookies for middleware/auth access (7 days for refresh token max-age)
    document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Lax;`;
    document.cookie = `refreshToken=${refreshToken}; path=/; max-age=604800; SameSite=Lax;`;
    set({ user, token, refreshToken, isLoading: false });
  },

  setUser: (user) => {
    set({ user });
  },

  logout: async () => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (storedRefreshToken) {
      try {
        await logoutApi(storedRefreshToken);
      } catch (error) {
        console.warn('Logout request failed on server:', error);
      }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    // Clear cookies
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax;';
    document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax;';
    set({ user: null, token: null, refreshToken: null, isLoading: false });
  },

  initialize: async () => {
    set({ isLoading: true });
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    if (!token) {
      set({ user: null, token: null, refreshToken: null, isLoading: false });
      return;
    }

    try {
      // Temporarily store token in state so the API client request interceptor finds it
      set({ token, refreshToken });
      const user = await getMeApi();
      set({ user, isLoading: false });
    } catch (error) {
      // If validation fails (e.g. token expired), clear everything
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax;';
      document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax;';
      set({ user: null, token: null, refreshToken: null, isLoading: false });
    }
  },
}));
