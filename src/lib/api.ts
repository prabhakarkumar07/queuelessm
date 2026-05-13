// src/lib/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

function resolveBaseUrl() {
  const configuredUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const expoHost =
    ((Constants.expoConfig as unknown as { hostUri?: string })?.hostUri ??
      (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
        ?.debuggerHost ??
      (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
        .manifest2?.extra?.expoClient?.hostUri) ??
    '';

  const host = expoHost.split(':')[0];

  if (configuredUrl && !configuredUrl.includes('localhost')) {
    return configuredUrl;
  }

  if (configuredUrl && configuredUrl.includes('localhost')) {
    if (Platform.OS === 'android' && !host) {
      return configuredUrl.replace('localhost', '10.0.2.2');
    }

    if (host) {
      return configuredUrl.replace('localhost', host).replace('127.0.0.1', host);
    }
  }

  if (host) {
    return `http://${host}:8080`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
}

const BASE_URL = resolveBaseUrl();

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach JWT to every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — refresh token flow
let isRefreshing = false;
let queue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) {
        await useAuthStore.getState().clearAuth();
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
        const nextAccessToken = data.accessToken as string;
        const nextRefreshToken = (data.refreshToken as string | undefined) ?? refreshToken;

        await AsyncStorage.multiSet([
          ['accessToken', nextAccessToken],
          ['refreshToken', nextRefreshToken],
          ...(data.user ? [['user', JSON.stringify(data.user)] as [string, string]] : []),
        ]);

        useAuthStore.setState((state) => ({
          user: data.user ?? state.user,
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
          isAuthenticated: true,
        }));

        processQueue(null, nextAccessToken);
        original.headers.Authorization = `Bearer ${nextAccessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        await useAuthStore.getState().clearAuth();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // ——— Automatic retry for network errors (GET/PUT only) ———
    // Mobile users frequently drop between Wi-Fi and cellular.
    // We retry safe, read-only requests up to 3x with exponential backoff.
    // POST/DELETE are never retried to prevent accidental side effects.
    const retryable = original as InternalAxiosRequestConfig & { _retryCount?: number };
    const method = (original.method ?? '').toUpperCase();
    const isNetworkError = !error.response;
    const isSafeMethod = method === 'GET' || method === 'PUT';

    if (isNetworkError && isSafeMethod) {
      retryable._retryCount = (retryable._retryCount ?? 0) + 1;
      if (retryable._retryCount <= 3) {
        const delay = Math.pow(2, retryable._retryCount - 1) * 500; // 500ms, 1s, 2s
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(retryable);
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: unknown) => api.post('/api/auth/register', data),
  login: (data: unknown) => api.post('/api/auth/login', data),
  requestOtp: (phone: string) => api.post('/api/auth/otp/request', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/api/auth/otp/verify', { phone, otp }),
  me: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
  updateFcmToken: (fcmToken: string) => api.patch(`/api/auth/fcm-token?fcmToken=${fcmToken}`),
};

export const shopApi = {
  getById: (id: string) => api.get(`/api/shops/public/${id}`),
  getNearby: (lat: number, lng: number, radius = 5) =>
    api.get(`/api/shops/public/nearby?lat=${lat}&lng=${lng}&radiusKm=${radius}`),
  searchPublic: (query: string) =>
    api.get(`/api/shops/public/search?q=${encodeURIComponent(query)}`),
  getPopular: (category = 'ALL', lat?: number, lng?: number, limit = 12) =>
    api.get('/api/shops/public/popular', { params: { category, lat, lng, limit } }),
  getTrending: (category = 'ALL', lat?: number, lng?: number, limit = 12) =>
    api.get('/api/shops/public/trending', { params: { category, lat, lng, limit } }),
  getServices: (id: string) => api.get(`/api/shops/public/${id}/services`),
};

export const providerApi = {
  getByShop: (shopId: string) => api.get(`/api/shops/${shopId}/providers`),
};

export const tokenApi = {
  getToken: (data: unknown) => api.post('/api/tokens', data),
  cancel: (tokenId: string) => api.post(`/api/tokens/${tokenId}/cancel`),
  snooze: (tokenId: string) => api.post(`/api/tokens/${tokenId}/snooze`),
  rejoin: (tokenId: string) => api.post(`/api/tokens/${tokenId}/rejoin`),
  getLiveQueue: (shopId: string) => api.get(`/api/tokens/shops/${shopId}/queue`),
  getMyHistory: (page = 0, size = 20) =>
    api.get(`/api/tokens/my-history?page=${page}&size=${size}`),
};

export const appointmentApi = {
  book: (data: unknown) => api.post('/api/appointments', data),
  verifyPayment: (id: string, data: unknown) => api.post(`/api/appointments/${id}/verify-payment`, data),
  cancel: (id: string, reason?: string) =>
    api.delete(`/api/appointments/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`),
  getMy: (page = 0, size = 20) => api.get(`/api/appointments/my?page=${page}&size=${size}`),
};

export const loyaltyApi = {
  getMyLoyalty: (shopId: string) => api.get(`/api/loyalty/shop/${shopId}`),
  getMyAll: () => api.get('/api/loyalty/my'),
};

export const reviewApi = {
  create: (data: { shopId: string; rating: number; comment?: string; tokenId?: string; appointmentId?: string }) =>
    api.post('/api/reviews', data),
  getSummary: (shopId: string) => api.get(`/api/reviews/shops/${shopId}/summary`),
};
export const attachmentApi = {
  upload: (formData: FormData) => api.post('/api/attachments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
