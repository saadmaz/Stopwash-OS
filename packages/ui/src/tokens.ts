/**
 * Token values for places CSS variables can't reach (charts, PDFs, canvas).
 * Keep in sync with tokens.css.
 */
export const brand = {
  lime: '#B2E04C',
  navy: '#0B1728',
  ink: '#050A12',
  paper: '#F5F6F2',
  steel: '#A6ADB8',
  leaf: '#4A7300',
  white: '#FFFFFF',
} as const;

export const semantic = {
  light: {
    bg: '#F5F6F2',
    surface: '#FFFFFF',
    fg: '#050A12',
    fgMuted: '#4E5766',
    border: '#E2E4E0',
    primary: brand.lime,
    accent: brand.navy,
    success: '#1F7A3A',
    warning: '#A35A00',
    danger: '#C42B1C',
    info: '#1D5FBF',
  },
  dark: {
    bg: '#050A12',
    surface: '#0B1728',
    fg: '#F5F6F2',
    fgMuted: '#B4BCC8',
    border: '#1E2A3D',
    primary: brand.lime,
    accent: '#F5F6F2',
    success: '#4CC76F',
    warning: '#F0A33A',
    danger: '#FF6B5C',
    info: '#5C9CFF',
  },
} as const;

/** Categorical chart palette, readable on both themes. */
export const chartPalette = ['#0B1728', '#7FB800', '#1D5FBF', '#A35A00', '#8A4FD1', '#0E8C8C'];

export const radius = { sm: 6, md: 10, lg: 16, xl: 20, '2xl': 28 } as const;
export const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80] as const;
export const touchTarget = 44;
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export type ThemeName = keyof typeof semantic;
