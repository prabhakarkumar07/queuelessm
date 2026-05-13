import React, { useState } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authApi } from '../lib/api';
import { registerForPushNotifications } from '../lib/notifications';
import { useAuthStore } from '../store/authStore';
import type { AuthResponse } from '../types';
import { palette, radius, ui, useEnterAnimation } from '../theme/ui';

export default function RegisterScreen() {
  const router = useRouter();
  const enterStyle = useEnterAnimation();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!form.name.trim() || !form.phone || !form.password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      Alert.alert('Invalid phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (form.password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data } = (await authApi.register({ ...form, role: 'CUSTOMER' })) as { data: AuthResponse };
      await setAuth(data.user, data.accessToken, data.refreshToken);
      await registerForPushNotifications();
      router.replace(redirect || '/(tabs)');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Registration failed. Please try again.';
      Alert.alert('Registration failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View style={enterStyle}>
          <View style={styles.brandRow}>
            <View style={styles.logoBox}><Text style={styles.logoText}>QL</Text></View>
            <View>
              <Text style={ui.kicker}>QueueLess</Text>
              <Text style={ui.title}>Create account</Text>
              <Text style={ui.subtitle}>Use one account for tokens, appointments, rewards, and alerts.</Text>
            </View>
          </View>

          <View style={[ui.panel, styles.card]}>
            <Text style={ui.label}>Full name</Text>
            <TextInput style={ui.input} placeholder="Rahul Sharma" placeholderTextColor={palette.faint} value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} autoCapitalize="words" />

            <Text style={[ui.label, styles.labelGap]}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}><Text style={styles.countryCodeText}>+91</Text></View>
              <TextInput
                style={[ui.input, styles.phoneInput]}
                placeholder="9876543210"
                placeholderTextColor={palette.faint}
                value={form.phone}
                onChangeText={(value) => setForm((current) => ({ ...current, phone: value.replace(/\D/g, '').slice(0, 10) }))}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            <Text style={[ui.label, styles.labelGap]}>Password</Text>
            <TextInput style={ui.input} placeholder="Minimum 8 characters" placeholderTextColor={palette.faint} value={form.password} onChangeText={(value) => setForm((current) => ({ ...current, password: value }))} secureTextEntry onSubmitEditing={handleRegister} />

            <TouchableOpacity style={[ui.primaryButton, styles.submit]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color={palette.ink} /> : <Text style={ui.primaryButtonText}>Create account</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already registered?</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/login', params: redirect ? { redirect } : {} })}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  logoBox: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: palette.dark, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fcd34d', fontWeight: '900', fontSize: 13 },
  card: { padding: 16 },
  labelGap: { marginTop: 14 },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryCode: { backgroundColor: palette.muted, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  countryCodeText: { color: palette.text, fontWeight: '900' },
  phoneInput: { flex: 1 },
  submit: { marginTop: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  footerText: { color: palette.subtext, fontSize: 14 },
  footerLink: { color: palette.ink, fontSize: 14, fontWeight: '900' },
});
