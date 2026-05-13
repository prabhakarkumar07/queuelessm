import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/store/authStore';
import { useThemeStore } from '../src/store/themeStore';
import { useFavoritesStore } from '../src/store/favoritesStore';
import { authApi } from '../src/lib/api';
import Toast from 'react-native-toast-message';
import { palette } from '../src/theme/ui';

// Configure how notifications appear while app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const isDark = useThemeStore((s) => s.isDark);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    hydrate();
    hydrateTheme();
    hydrateFavorites();
  }, [hydrate, hydrateTheme, hydrateFavorites]);

  // Register push notifications once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const registerPushToken = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        // Get Expo push token and register with backend
        const tokenData = await Notifications.getExpoPushTokenAsync();
        await authApi.updateFcmToken(tokenData.data);

        // Android: set up notification channels for queue alerts
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('queue-alerts', {
            name: 'Queue Alerts',
            description: 'Notifications for your queue position',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: palette.info,
            sound: 'default',
          });

          await Notifications.setNotificationChannelAsync('token-called', {
            name: "It's Your Turn!",
            description: 'Alert when your token number is called',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500],
            lightColor: palette.success,
            sound: 'default',
          });
        }
      } catch (error) {
        console.warn('Push notification registration failed:', error);
      }
    };

    registerPushToken();

    // Foreground notification listener — show an in-app Toast
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      if (title && body) {
        Toast.show({
          type: 'info',
          text1: title,
          text2: body,
          position: 'top',
          visibilityTime: 5000,
        });
      }
    });

    // Response listener — handles when user TAPS the notification
    // Navigates to the correct screen based on notification data
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;

      // Navigate based on notification type
      if (data.type === 'TOKEN_CALLED' || data.type === 'TOKEN_ISSUED') {
        // Deep-link to Bookings tab when user taps "Your turn!" or booking confirmation
        router.push('/(tabs)/bookings');
      } else if (data.type === 'REVIEW_REQUEST' && data.shopId) {
        // Deep-link to shop detail for review
        router.push(`/shop/${data.shopId}`);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, [isAuthenticated, router]);

  if (!hydrated) return null;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={isDark ? '#0f172a' : palette.bg} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.bg },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          contentStyle: { backgroundColor: palette.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen
          name="shop/[id]"
          options={{
            title: 'Shop Detail',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen name="settings/theme" options={{ title: 'Appearance' }} />
        <Stack.Screen name="settings/notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="settings/payments" options={{ title: 'Payment History' }} />
        <Stack.Screen name="settings/help" options={{ title: 'Help & Support' }} />
      </Stack>
      <Toast />
    </>
  );
}
