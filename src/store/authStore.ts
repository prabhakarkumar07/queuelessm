// src/store/authStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  hydrated: false,

  /**
   * Persists auth tokens and user to AsyncStorage, then updates in-memory state.
   */
  setAuth: async (user, accessToken, refreshToken) => {
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
      ['user', JSON.stringify(user)],
    ]);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  /**
   * Clears all auth data from AsyncStorage and resets state.
   */
  clearAuth: async () => {
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
  },

  /**
   * Rehydrates auth state from AsyncStorage on app launch.
   * Must be called before rendering protected screens.
   */
  hydrate: async () => {
    try {
      const [[, accessToken], [, refreshToken], [, userJson]] =
        await AsyncStorage.multiGet(['accessToken', 'refreshToken', 'user']);

      if (accessToken && userJson) {
        const user = JSON.parse(userJson) as User;
        // Single set() call — prevents double re-render on hydration
        set({ user, accessToken, refreshToken, isAuthenticated: true, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch (e) {
      console.error('Auth hydration failed:', e);
      set({ hydrated: true });
    }
  },
}));
