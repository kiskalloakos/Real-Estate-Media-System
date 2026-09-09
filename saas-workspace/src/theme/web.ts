export const webTheme = {
  color: {
    blue: '#5256E0',
    white: '#FFFFFF',
    black: '#000000',
    grey: '#EEEEEE',
  },
  radius: {
    control: 16,
    card: 24,
    feature: 32,
    pill: 999,
  },
  space: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  motion: {
    fast: 160,
    standard: 220,
    deliberate: 280,
  },
  layout: {
    sidebarExpanded: 286,
    sidebarCollapsed: 92,
    contentMax: 1540,
  },
} as const;

export type WebTheme = typeof webTheme;
