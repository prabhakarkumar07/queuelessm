import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authApi } from '../lib/api';
import { registerForPushNotifications } from '../lib/notifications';
import { useAuthStore } from '../store/authStore';
import type { AuthResponse } from '../types';
import { palette, radius, ui, useEnterAnimation } from '../theme/ui';
import { Animated } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const enterStyle = useEnterAnimation();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [form, setForm] = useState({ phone: '', password: '' });
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const finishCustomerLogin = async (data: AuthResponse) => {
    await setAuth(data.user, data.accessToken, data.refreshToken);
    if (data.user.role !== 'CUSTOMER') {
      await clearAuth();
      Alert.alert('Use the dashboard', 'Staff, owner, and admin accounts should sign in on the web dashboard.');
      return;
    }
    await registerForPushNotifications();
    router.replace(redirect || '/(tabs)');
  };

  const handleLogin = async () => {
    if (!form.phone || !form.password) {
      Alert.alert('Missing fields', 'Enter your mobile number and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = (await authApi.login(form)) as { data: AuthResponse };
      await finishCustomerLogin(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invalid credentials. Please try again.';
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    if (form.phone.length !== 10) {
      Alert.alert('Mobile number required', 'Enter your 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      await authApi.requestOtp(form.phone);
      setOtpSent(true);
      Alert.alert('OTP sent', 'Enter the 6-digit code sent to your phone.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not send OTP. Please try again.';
      Alert.alert('OTP failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (form.phone.length !== 10 || otp.length !== 6) {
      Alert.alert('OTP required', 'Enter your mobile number and 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const { data } = (await authApi.verifyOtp(form.phone, otp)) as { data: AuthResponse };
      await finishCustomerLogin(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invalid OTP. Please try again.';
      Alert.alert('OTP failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View style={[styles.content, enterStyle]}>
        <View style={styles.brandRow}>
          <View style={styles.logoBox}><Text style={styles.logoText}>QL</Text></View>
          <View>
            <Text style={ui.kicker}>QueueLess</Text>
            <Text style={ui.title}>Sign in</Text>
            <Text style={ui.subtitle}>Customer access for tokens, bookings, and queue alerts.</Text>
          </View>
        </View>

        <View style={ui.panel}>
          <View style={styles.segment}>
            {(['password', 'otp'] as const).map((item) => (
              <TouchableOpacity key={item} style={[styles.segmentItem, mode === item && styles.segmentActive]} onPress={() => setMode(item)}>
                <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item === 'password' ? 'Password' : 'OTP'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formBody}>
            <Text style={ui.label}>Mobile number</Text>
            <TextInput
              style={ui.input}
              placeholder="9876543210"
              placeholderTextColor={palette.faint}
              value={form.phone}
              onChangeText={(value) => setForm((current) => ({ ...current, phone: value.replace(/\D/g, '').slice(0, 10) }))}
              keyboardType="phone-pad"
              maxLength={10}
            />

            {mode === 'password' ? (
              <>
                <Text style={[ui.label, styles.labelGap]}>Password</Text>
                <TextInput
                  style={ui.input}
                  placeholder="Password"
                  placeholderTextColor={palette.faint}
                  value={form.password}
                  onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
                  secureTextEntry
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={[ui.primaryButton, styles.submit]} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color={palette.ink} /> : <Text style={ui.primaryButtonText}>Sign in</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {otpSent ? (
                  <>
                    <Text style={[ui.label, styles.labelGap]}>OTP</Text>
                    <TextInput
                      style={ui.input}
                      placeholder="123456"
                      placeholderTextColor={palette.faint}
                      value={otp}
                      onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      onSubmitEditing={verifyOtp}
                    />
                  </>
                ) : null}
                <TouchableOpacity style={[ui.primaryButton, styles.submit]} onPress={otpSent ? verifyOtp : requestOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color={palette.ink} /> : <Text style={ui.primaryButtonText}>{otpSent ? 'Verify OTP' : 'Send OTP'}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New customer?</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/register', params: redirect ? { redirect } : {} })}>
            <Text style={styles.footerLink}>Create account</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  logoBox: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: palette.dark, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fcd34d', fontWeight: '900', fontSize: 13 },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: palette.muted, borderBottomWidth: 1, borderColor: palette.border },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: palette.dark },
  segmentText: { color: palette.subtext, fontWeight: '800', fontSize: 13 },
  segmentTextActive: { color: '#fff' },
  formBody: { padding: 16 },
  labelGap: { marginTop: 14 },
  submit: { marginTop: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  footerText: { color: palette.subtext, fontSize: 14 },
  footerLink: { color: palette.ink, fontSize: 14, fontWeight: '900' },
});
