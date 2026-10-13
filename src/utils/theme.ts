import { MD3DarkTheme, type MD3Theme } from 'react-native-paper';
import { DarkTheme as NavDarkTheme, type Theme as NavTheme } from '@react-navigation/native';

/** Design tokens — Section 6 of DEVELOPMENT_PLAN.md (verbatim). */
export const ThemeTokens = {
  colors: {
    primary: '#1E293B', // Deep Slate Blue
    accent: '#0EA5E9', // Electric Blue / Teal
    background: '#0F172A', // Dark Background (Default Dark Mode)
    surface: '#1E293B', // Card Surface
    surfaceVariant: '#334155', // Elevate / Secondary Surface
    textPrimary: '#F8FAFC', // Clean White
    textMuted: '#94A3B8', // Slate Grey
    priorityHigh: '#EF4444', // Crimson Red
    priorityMedium: '#F59E0B', // Amber Gold
    priorityLow: '#10B981', // Emerald Green
    success: '#22C55E', // Success Green
    border: '#475569',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  roundness: 12,
} as const;

export const MIN_TOUCH = 48;

const c = ThemeTokens.colors;

/**
 * Paper's "primary" drives buttons, FABs, switches and focus rings. The token
 * "primary" (#1E293B) is identical to the card surface, so interactive
 * elements use the accent colour instead (see DECISIONS.md, D-07).
 */
export const paperTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: ThemeTokens.roundness / 4, // Paper multiplies roundness by 4 for most components
  colors: {
    ...MD3DarkTheme.colors,
    primary: c.accent,
    onPrimary: '#002233',
    primaryContainer: '#075985',
    onPrimaryContainer: c.textPrimary,
    secondary: c.textMuted,
    secondaryContainer: c.surfaceVariant,
    onSecondaryContainer: c.textPrimary,
    background: c.background,
    onBackground: c.textPrimary,
    surface: c.surface,
    onSurface: c.textPrimary,
    surfaceVariant: c.surfaceVariant,
    onSurfaceVariant: c.textMuted,
    outline: c.border,
    outlineVariant: c.surfaceVariant,
    error: c.priorityHigh,
    elevation: {
      level0: 'transparent',
      level1: c.surface,
      level2: c.surface,
      level3: c.surfaceVariant,
      level4: c.surfaceVariant,
      level5: c.surfaceVariant,
    },
  },
};

export const navTheme: NavTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: c.accent,
    background: c.background,
    card: c.surface,
    text: c.textPrimary,
    border: c.border,
    notification: c.priorityHigh,
  },
};
