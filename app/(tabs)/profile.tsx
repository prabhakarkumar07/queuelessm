import React from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authApi } from '../../src/lib/api';
import { useAuthStore } from '../../src/store/authStore';
import { palette, radius, ui, useEnterAnimation } from '../../src/theme/ui';

export default function ProfileScreen() {
  const router = useRouter();
  const enterStyle = useEnterAnimation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isCustomer = isAuthenticated && user?.role === 'CUSTOMER';

  const handleLogout = () => {
    Alert.alert('Sign out', 'Sign out of this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try { await authApi.logout(); } catch {}
          await clearAuth();
          router.replace('/login');
        },
      },
    ]);
  };

  if (!isCustomer) {
    return (
      <Animated.View style={[ui.screen, styles.guestContainer, enterStyle]}>
        <View style={ui.empty}>
          <Feather name="user" size={32} color={palette.faint} style={{ marginBottom: 12 }} />
          <Text style={ui.emptyTitle}>Sign in when ready</Text>
          <Text style={ui.emptySub}>Manage bookings, token history, rewards, and queue alerts from one account.</Text>
          <TouchableOpacity style={[ui.primaryButton, styles.guestButton]} onPress={() => router.push({ pathname: '/login', params: { redirect: '/(tabs)/profile' } })}>
            <Text style={ui.primaryButtonText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ui.secondaryButton, styles.guestButton, { marginTop: 12 }]} onPress={() => router.push({ pathname: '/register', params: { redirect: '/(tabs)/profile' } })}>
            <Text style={ui.secondaryButtonText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  const menuItems = [
    { icon: 'bookmark', label: 'My tokens', onPress: () => router.push('/(tabs)/bookings') },
    { icon: 'calendar', label: 'Appointments', onPress: () => router.push('/(tabs)/bookings') },
    { icon: 'award', label: 'Rewards', onPress: () => router.push('/(tabs)/rewards') },
    { icon: 'credit-card', label: 'Payment history', onPress: () => router.push('/settings/payments') },
    { icon: 'bell', label: 'Notifications', onPress: () => router.push('/settings/notifications') },
    { icon: 'moon', label: 'Appearance', onPress: () => router.push('/settings/theme') },
    { icon: 'help-circle', label: 'Help & Support', onPress: () => router.push('/settings/help') },
  ];

  return (
    <Animated.View style={[ui.screen, enterStyle]}>
      <View style={ui.content}>
        <Text style={ui.kicker}>Account</Text>
        <Text style={ui.title}>Profile</Text>

        <View style={[ui.panel, styles.profilePanel]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.phone}>+91 {user?.phone}</Text>
            {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
          </View>
        </View>

        <View style={[ui.panel, styles.menu]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={item.label} style={[styles.menuItem, index < menuItems.length - 1 && styles.menuDivider]} onPress={item.onPress} activeOpacity={0.7}>
              <View style={styles.menuIconBox}>
                <Feather name={item.icon as any} size={16} color={palette.text} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={18} color={palette.faint} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={ui.dangerButton} onPress={handleLogout} activeOpacity={0.8}>
          <Feather name="log-out" size={14} color={palette.danger} />
          <Text style={ui.dangerButtonText}>Sign out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>QueueLess v1.0.0</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  guestContainer: { justifyContent: 'center', padding: 24 },
  guestButton: { marginTop: 24, width: '100%' },
  profilePanel: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginTop: 16, marginBottom: 16 },
  avatar: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: palette.dark, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.surface, fontSize: 20, fontWeight: '800' },
  name: { color: palette.ink, fontSize: 18, fontWeight: '700' },
  phone: { color: palette.subtext, fontSize: 13, marginTop: 2 },
  email: { color: palette.faint, fontSize: 12, marginTop: 2 },
  menu: { overflow: 'hidden', marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: palette.border },
  menuIconBox: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, color: palette.ink, fontSize: 14, fontWeight: '600' },
  version: { color: palette.faint, fontSize: 12, textAlign: 'center', marginTop: 24, fontWeight: '500' },
});
