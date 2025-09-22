/**
 * Theme Context Provider
 * Manages theme state and provides theme utilities
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { UITheme } from '../types/chat';
import { createAppTheme, defaultUITheme } from '../theme';

interface ThemeContextValue {
  uiTheme: UITheme;
  muiTheme: Theme;
  toggleTheme: () => void;
  updateTheme: (updates: Partial<UITheme>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = 'fund-management-chatbot-theme';

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [uiTheme, setUITheme] = useState<UITheme>(() => {
    // Load theme from localStorage
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        const parsed = JSON.parse(savedTheme);
        return { ...defaultUITheme, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
    return defaultUITheme;
  });

  const [muiTheme, setMUITheme] = useState<Theme>(() => 
    createTheme(createAppTheme(uiTheme.mode))
  );

  // Update MUI theme when UI theme changes
  useEffect(() => {
    const newMUITheme = createTheme(createAppTheme(uiTheme.mode));
    setMUITheme(newMUITheme);
    
    // Save to localStorage
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(uiTheme));
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }, [uiTheme]);

  // Apply theme-specific CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    
    // Set CSS custom properties for easy access in styled-components
    root.style.setProperty('--primary-color', uiTheme.primaryColor);
    root.style.setProperty('--font-size-base', 
      uiTheme.fontSize === 'small' ? '14px' : 
      uiTheme.fontSize === 'large' ? '16px' : '15px'
    );
    root.style.setProperty('--compact-mode', uiTheme.compactMode ? '1' : '0');
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', uiTheme.primaryColor);
    }
  }, [uiTheme]);

  const toggleTheme = () => {
    setUITheme(prev => ({
      ...prev,
      mode: prev.mode === 'light' ? 'dark' : 'light'
    }));
  };

  const updateTheme = (updates: Partial<UITheme>) => {
    setUITheme(prev => ({ ...prev, ...updates }));
  };

  const resetTheme = () => {
    setUITheme(defaultUITheme);
    localStorage.removeItem(THEME_STORAGE_KEY);
  };

  const contextValue: ThemeContextValue = {
    uiTheme,
    muiTheme,
    toggleTheme,
    updateTheme,
    resetTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Hook for accessing theme colors
export const useThemeColors = () => {
  const { muiTheme } = useTheme();
  
  return {
    primary: muiTheme.palette.primary.main,
    secondary: muiTheme.palette.secondary.main,
    success: muiTheme.palette.success.main,
    warning: muiTheme.palette.warning.main,
    error: muiTheme.palette.error.main,
    background: muiTheme.palette.background.default,
    paper: muiTheme.palette.background.paper,
    textPrimary: muiTheme.palette.text.primary,
    textSecondary: muiTheme.palette.text.secondary,
  };
};

// Hook for responsive breakpoints
export const useBreakpoints = () => {
  const { muiTheme } = useTheme();
  
  return {
    up: muiTheme.breakpoints.up,
    down: muiTheme.breakpoints.down,
    between: muiTheme.breakpoints.between,
    only: muiTheme.breakpoints.only,
    values: muiTheme.breakpoints.values,
  };
};
