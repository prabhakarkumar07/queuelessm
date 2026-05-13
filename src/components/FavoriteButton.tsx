import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavoritesStore } from '../store/favoritesStore';
import { useTheme } from '../theme/useTheme';

interface FavoriteButtonProps {
  shopId: string;
  size?: number;
}

export function FavoriteButton({ shopId, size = 20 }: FavoriteButtonProps) {
  const { colors } = useTheme();
  const isFavorite = useFavoritesStore((s) => s.isFavorite(shopId));
  const toggle = useFavoritesStore((s) => s.toggle);

  return (
    <TouchableOpacity
      onPress={() => toggle(shopId)}
      style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }]}
      activeOpacity={0.7}
      accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      accessibilityRole="button"
    >
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={size}
        color={isFavorite ? '#ef4444' : colors.faint}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
