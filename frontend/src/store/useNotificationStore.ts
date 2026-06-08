import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

interface NotificationStore {
  notifications: NotificationItem[];
  addNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  addNotification: (message, type = 'info') => {
    const item: NotificationItem = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      type,
      timestamp: new Date(),
      read: false,
    };
    set((state) => ({
      notifications: [item, ...state.notifications].slice(0, 50), // Keep last 50 notifications
    }));
  },
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },
  clearAll: () => {
    set({ notifications: [] });
  },
}));
