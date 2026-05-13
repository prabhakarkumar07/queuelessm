import { useThemeStore } from '../store/themeStore';
import { lightPalette, darkPalette, type Palette } from './colors';

export function useTheme(): { colors: Palette; isDark: boolean } {
  const isDark = useThemeStore((s) => s.isDark);
  return {
    colors: isDark ? darkPalette : lightPalette,
    isDark,
  };
}
