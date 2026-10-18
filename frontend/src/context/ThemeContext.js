import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const THEME_STORAGE_KEY = 'uprise_theme';

function getInitialTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch (err) {
    // Ignore localStorage access restrictions
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  const applyTheme = (nextTheme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nextTheme);
      document.documentElement.style.colorScheme = nextTheme;
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (err) {
      // Ignore localStorage access restrictions
    }
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Synchronize with system color scheme changes if user hasn't explicitly set a preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (event) => {
      try {
        const explicitPreference = localStorage.getItem(THEME_STORAGE_KEY);
        if (!explicitPreference) {
          const systemTheme = event.matches ? 'dark' : 'light';
          setThemeState(systemTheme);
        }
      } catch (err) {
        // Ignore
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
      return () => mediaQuery.removeListener(handleSystemThemeChange);
    }
  }, []);

  const setTheme = (nextTheme) => {
    if (nextTheme === 'light' || nextTheme === 'dark') {
      setThemeState(nextTheme);
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
