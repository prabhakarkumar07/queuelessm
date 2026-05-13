import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

// Note: For production, use @react-native-community/netinfo
// This is a simplified version using navigator.onLine fallback
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // In React Native, we'd use NetInfo. For now, default to online.
    // This can be replaced with proper NetInfo integration.
    setIsOnline(true);
  }, []);

  return isOnline;
}

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const { colors } = useTheme();

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.warning }]}>
      <Text style={styles.text}>You are offline. Some features may be unavailable.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
