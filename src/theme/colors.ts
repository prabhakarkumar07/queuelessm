// Light and dark palettes for QueueLess mobile app

export const lightPalette = {
  bg: '#f8fafc',
  surface: '#ffffff',
  muted: '#f1f5f9',
  ink: '#0f172a',
  text: '#334155',
  subtext: '#64748b',
  faint: '#94a3b8',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  accent: '#0f172a',
  accentSoft: '#f1f5f9',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  info: '#2563eb',
  infoSoft: '#eff6ff',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  dark: '#0f172a',
};

export const darkPalette = {
  bg: '#0f172a',
  surface: '#1e293b',
  muted: '#1e293b',
  ink: '#f8fafc',
  text: '#e2e8f0',
  subtext: '#94a3b8',
  faint: '#64748b',
  border: '#334155',
  borderStrong: '#475569',
  accent: '#f8fafc',
  accentSoft: '#1e293b',
  success: '#34d399',
  successSoft: '#064e3b',
  danger: '#f87171',
  dangerSoft: '#450a0a',
  info: '#60a5fa',
  infoSoft: '#1e3a5f',
  warning: '#fbbf24',
  warningSoft: '#451a03',
  dark: '#0f172a',
};

export type Palette = typeof lightPalette;
