import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDocument(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  resolvedTheme: 'dark',

  setTheme: (theme: Theme) => {
    const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pulse_theme', theme);
    }
    applyThemeToDocument(resolvedTheme);
    set({ theme, resolvedTheme });
  },

  toggleTheme: () => {
    const current = get().resolvedTheme;
    const next = current === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  initializeTheme: () => {
    const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem('pulse_theme') : null) as Theme | null;
    const theme: Theme = saved || 'dark';
    const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
    applyThemeToDocument(resolvedTheme);
    set({ theme, resolvedTheme });

    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (get().theme === 'system') {
          const sys = e.matches ? 'dark' : 'light';
          applyThemeToDocument(sys);
          set({ resolvedTheme: sys });
        }
      };
      mediaQuery.addEventListener('change', listener);
    }
  },
}));
