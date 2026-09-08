import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'medai_theme';

function applyThemeToDom(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
  root.style.colorScheme = theme;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      applyThemeToDom(saved);
      return saved;
    }
  } catch {
    // LocalStorage unavailable
  }
  applyThemeToDom('dark');
  return 'dark';
}

interface ThemeState {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const initial = getInitialTheme();

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: initial,
  isDark: initial === 'dark',
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    applyThemeToDom(theme);
    set({ theme, isDark: theme === 'dark' });
  },
  toggleTheme: () => {
    set((state) => {
      const next: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      applyThemeToDom(next);
      return { theme: next, isDark: next === 'dark' };
    });
  },
}));
