import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesState {
  shopIds: string[];
  hydrated: boolean;
  isFavorite: (shopId: string) => boolean;
  toggle: (shopId: string) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  shopIds: [],
  hydrated: false,

  isFavorite: (shopId) => get().shopIds.includes(shopId),

  toggle: async (shopId) => {
    const current = get().shopIds;
    const next = current.includes(shopId)
      ? current.filter((id) => id !== shopId)
      : [...current, shopId];
    set({ shopIds: next });
    await AsyncStorage.setItem('favoriteShops', JSON.stringify(next));
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem('favoriteShops');
      const shopIds = stored ? JSON.parse(stored) : [];
      set({ shopIds, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
