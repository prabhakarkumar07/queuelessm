import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

export const palette = {
  bg: '#f8fafc', // slate-50
  surface: '#ffffff', // white
  muted: '#f1f5f9', // slate-100
  ink: '#0f172a', // slate-900
  text: '#334155', // slate-700
  subtext: '#64748b', // slate-500
  faint: '#94a3b8', // slate-400
  border: '#e2e8f0', // slate-200
  borderStrong: '#cbd5e1', // slate-300
  accent: '#0f172a', // slate-900 (primary action)
  accentSoft: '#f1f5f9', // slate-100
  success: '#059669', // emerald-600
  successSoft: '#ecfdf5', // emerald-50
  danger: '#dc2626', // red-600
  dangerSoft: '#fef2f2', // red-50
  info: '#2563eb', // blue-600
  infoSoft: '#eff6ff', // blue-50
  warning: '#d97706', // amber-600
  warningSoft: '#fffbeb', // amber-50
  dark: '#0f172a', // slate-900
};

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
};

export const shadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

export const shadowMd = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export function useEnterAnimation() {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 150, // Faster, snappier animation
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value]);

  return {
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [4, 0], // Tighter translation
        }),
      },
    ],
  };
}

export const ui = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg,
  },
  kicker: {
    color: palette.subtext,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: palette.subtext,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow,
  },
  panelMuted: {
    backgroundColor: palette.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  row: {
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...shadow,
  },
  primaryButtonText: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...shadow,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: palette.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dangerButtonText: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.ink,
    fontSize: 14,
  },
  label: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  empty: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.borderStrong,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  emptySub: {
    color: palette.subtext,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    textAlign: 'center',
  },
});
