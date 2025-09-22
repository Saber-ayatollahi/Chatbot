/**
 * Enhanced Theme System for Phase 3 UI
 * Comprehensive theming with Material-UI and styled-components
 */

import { ThemeOptions } from '@mui/material/styles';
import { UITheme } from '../types/chat';

// Color palette
export const colors = {
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3',
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
  },
  secondary: {
    50: '#f3e5f5',
    100: '#e1bee7',
    200: '#ce93d8',
    300: '#ba68c8',
    400: '#ab47bc',
    500: '#9c27b0',
    600: '#8e24aa',
    700: '#7b1fa2',
    800: '#6a1b9a',
    900: '#4a148c',
  },
  success: {
    50: '#e8f5e8',
    100: '#c8e6c9',
    200: '#a5d6a7',
    300: '#81c784',
    400: '#66bb6a',
    500: '#4caf50',
    600: '#43a047',
    700: '#388e3c',
    800: '#2e7d32',
    900: '#1b5e20',
  },
  warning: {
    50: '#fff8e1',
    100: '#ffecb3',
    200: '#ffe082',
    300: '#ffd54f',
    400: '#ffca28',
    500: '#ffc107',
    600: '#ffb300',
    700: '#ffa000',
    800: '#ff8f00',
    900: '#ff6f00',
  },
  error: {
    50: '#ffebee',
    100: '#ffcdd2',
    200: '#ef9a9a',
    300: '#e57373',
    400: '#ef5350',
    500: '#f44336',
    600: '#e53935',
    700: '#d32f2f',
    800: '#c62828',
    900: '#b71c1c',
  },
  grey: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
  confidence: {
    veryLow: '#f44336',
    low: '#ff9800',
    medium: '#2196f3',
    high: '#4caf50',
  },
  chat: {
    userBubble: '#2196f3',
    assistantBubble: '#f5f5f5',
    userBubbleDark: '#1976d2',
    assistantBubbleDark: '#424242',
    background: '#fafafa',
    backgroundDark: '#121212',
  }
};

// Typography
export const typography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  fontSize: {
    small: 12,
    medium: 14,
    large: 16,
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semiBold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  }
};

// Spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Shadows
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

// Border radius
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Breakpoints
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};

// Create Material-UI theme
export const createAppTheme = (mode: 'light' | 'dark' = 'light'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: colors.primary[500],
      light: colors.primary[300],
      dark: colors.primary[700],
    },
    secondary: {
      main: colors.secondary[500],
      light: colors.secondary[300],
      dark: colors.secondary[700],
    },
    success: {
      main: colors.success[500],
      light: colors.success[300],
      dark: colors.success[700],
    },
    warning: {
      main: colors.warning[500],
      light: colors.warning[300],
      dark: colors.warning[700],
    },
    error: {
      main: colors.error[500],
      light: colors.error[300],
      dark: colors.error[700],
    },
    background: {
      default: mode === 'light' ? '#fafafa' : '#121212',
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
    },
    text: {
      primary: mode === 'light' ? colors.grey[900] : colors.grey[50],
      secondary: mode === 'light' ? colors.grey[600] : colors.grey[400],
    },
  },
  typography: {
    fontFamily: typography.fontFamily,
    h1: {
      fontSize: '2.5rem',
      fontWeight: typography.fontWeight.bold,
      lineHeight: typography.lineHeight.tight,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: typography.fontWeight.semiBold,
      lineHeight: typography.lineHeight.tight,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: typography.fontWeight.semiBold,
      lineHeight: typography.lineHeight.normal,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: typography.lineHeight.relaxed,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: typography.lineHeight.normal,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: typography.lineHeight.normal,
    },
  },
  shape: {
    borderRadius: borderRadius.md,
  },
  spacing: spacing.sm,
  breakpoints: {
    values: breakpoints,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: typography.fontWeight.medium,
          borderRadius: borderRadius.lg,
          padding: `${spacing.sm}px ${spacing.md}px`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.lg,
          boxShadow: shadows.md,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.lg,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: borderRadius.lg,
          },
        },
      },
    },
  },
});

// Default UI theme
export const defaultUITheme: UITheme = {
  mode: 'light',
  primaryColor: colors.primary[500],
  fontSize: 'medium',
  compactMode: false,
};

// Confidence color mapping
export const getConfidenceColor = (level: string): string => {
  switch (level) {
    case 'very_low':
      return colors.confidence.veryLow;
    case 'low':
      return colors.confidence.low;
    case 'medium':
      return colors.confidence.medium;
    case 'high':
      return colors.confidence.high;
    default:
      return colors.grey[500];
  }
};

// Content type colors
export const contentTypeColors = {
  text: colors.primary[500],
  table: colors.secondary[500],
  list: colors.success[500],
  procedure: colors.warning[500],
  definition: colors.primary[700],
  comparison: colors.secondary[700],
};

// Animation variants
export const animationVariants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
  bounce: {
    animate: {
      y: [0, -4, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  },
};

// Z-index values
export const zIndex = {
  drawer: 1200,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
};
