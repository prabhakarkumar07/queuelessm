import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  hydrate: () => Promise<void>;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return Appearance.getColorScheme() === 'dark';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  isDark: resolveIsDark('system'),
  hydrated: false,

  setMode: async (mode) => {
    const isDark = resolveIsDark(mode);
    set({ mode, isDark });
    await AsyncStorage.setItem('themeMode', mode);
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem('themeMode');
      const mode = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
      set({ mode, isDark: resolveIsDark(mode), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

// Listen for OS appearance changes when mode is 'system'
Appearance.addChangeListener(({ colorScheme }) => {
  const { mode } = useThemeStore.getState();
  if (mode === 'system') {
    useThemeStore.setState({ isDark: colorScheme === 'dark' });
  }
});
