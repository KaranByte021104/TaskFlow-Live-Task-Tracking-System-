import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  toggleTheme: () => {
    if (typeof window === 'undefined') return;
    const currentTheme = get().theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Update state
    set({ theme: newTheme });
    
    // Persist to localStorage
    localStorage.setItem('theme', newTheme);
    
    // Apply class to documentElement
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },
  initTheme: () => {
    if (typeof window === 'undefined') return;
    
    // Get from localStorage or system preference
    const storedTheme = localStorage.getItem('theme');
    let themeToApply: 'light' | 'dark' = 'light';
    
    if (storedTheme === 'dark' || storedTheme === 'light') {
      themeToApply = storedTheme;
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeToApply = prefersDark ? 'dark' : 'light';
    }
    
    set({ theme: themeToApply });
    
    if (themeToApply === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}));
