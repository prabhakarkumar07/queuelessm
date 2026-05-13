import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { formatDistanceToNow } from 'date-fns';
import { getShopOperatingStatus } from '../lib/shopStatus';
import { shopApi, tokenApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { FavoriteButton } from '../components/FavoriteButton';
import { ShopCardSkeleton } from '../components/Skeleton';
import type { Shop, Token } from '../types';
import { palette, radius, ui, useEnterAnimation } from '../theme/ui';

const CATEGORY_LABEL: Record<string, string> = {
  CLINIC: 'Clinic',
  SALON: 'Salon',
  BANK: 'Bank',
  GOVERNMENT: 'Government',
  RESTAURANT: 'Restaurant',
  OTHER: 'Shop',
};

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  CLINIC: 'medical-outline',
  SALON: 'cut-outline',
  BANK: 'business-outline',
  GOVERNMENT: 'document-text-outline',
  RESTAURANT: 'restaurant-outline',
  OTHER: 'storefront-outline',
};

const STATUS_COLOR: Record<string, string> = {
  WAITING: palette.info,
  CALLED: palette.accent,
  SERVING: palette.success,
};

const FALLBACK_LOCATION = { latitude: 22.5726, longitude: 88.3639 };

function ActiveTokenCard({ token, onCancel }: { token: Token; onCancel: () => void }) {
  const urgent = token.status === 'CALLED' || token.status === 'SERVING';

  return (
    <View style={[styles.activeToken, urgent && styles.activeTokenUrgent]}>
      <View style={styles.activeTokenTop}>
        <View>
          <Text style={ui.kicker}>Active token</Text>
          <Text style={[styles.tokenNumber, { color: STATUS_COLOR[token.status] ?? palette.ink }]}>{token.displayNumber}</Text>
        </View>
        <View style={[ui.chip, urgent ? styles.chipAmber : styles.chipBlue]}>
          <Text style={[ui.chipText, urgent ? styles.chipAmberText : styles.chipBlueText]}>{token.status}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{token.shopName}</Text>
      <View style={styles.compactStats}>
        {token.queuePosition != null ? <Stat label="Ahead" value={Math.max(0, token.queuePosition - 1)} /> : null}
        {token.estimatedWaitMins != null ? <Stat label="Wait" value={`${token.estimatedWaitMins}m`} /> : null}
        <Stat label="Issued" value={formatDistanceToNow(new Date(token.issuedAt), { addSuffix: false })} />
      </View>
      <TouchableOpacity style={ui.dangerButton} onPress={onCancel}>
        <Text style={ui.dangerButtonText}>Cancel token</Text>
      </TouchableOpacity>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ShopRow({ shop, onPress, onOpenMap }: { shop: Shop; onPress: () => void; onOpenMap: () => void }) {
  const status = getShopOperatingStatus(shop);

  return (
    <TouchableOpacity style={styles.shopRow} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.shopInitial}>
        <Ionicons name={CATEGORY_ICON[shop.category] ?? 'storefront-outline'} size={19} color={palette.accent} />
      </View>
      <View style={styles.shopBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
          {shop.distanceKm != null ? <Text style={styles.distance}>{shop.distanceKm} km</Text> : null}
        </View>
        <Text style={styles.shopAddress} numberOfLines={1}>{shop.address}</Text>
        <View style={styles.metaLine}>
          <View style={[ui.chip, status.isOpen ? styles.chipGreen : styles.chipMuted]}>
            <Text style={[ui.chipText, status.isOpen ? styles.chipGreenText : styles.chipMutedText]}>{status.label}</Text>
          </View>
          <View style={ui.chip}>
            <Text style={ui.chipText}>{CATEGORY_LABEL[shop.category] ?? shop.category}</Text>
          </View>
          {shop.currentQueueSize != null ? (
            <View style={ui.chip}>
              <Text style={ui.chipText}>{shop.currentQueueSize} waiting</Text>
            </View>
          ) : null}
          {shop.queuePaused ? (
            <View style={[ui.chip, styles.chipRed]}>
              <Text style={[ui.chipText, styles.chipRedText]}>Paused</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.statusDetail} numberOfLines={1}>{status.detail}</Text>
      </View>
      <View style={styles.shopActions}>
        <FavoriteButton shopId={shop.id} size={16} />
        <TouchableOpacity style={styles.iconButton} onPress={onOpenMap}>
          <Ionicons name="map-outline" size={17} color={palette.accent} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const enterStyle = useEnterAnimation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isCustomer = isAuthenticated && user?.role === 'CUSTOMER';

  const [activeToken, setActiveToken] = useState<Token | null>(null);
  const [nearbyShops, setNearbyShops] = useState<Shop[]>([]);
  const [searchResults, setSearchResults] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const favoriteIds = useFavoritesStore((s) => s.shopIds);

  const loadData = useCallback(async () => {
    try {
      if (isCustomer) {
        const historyRes = await tokenApi.getMyHistory(0, 5);
        const active = historyRes.data.content.find((token: Token) => ['WAITING', 'CALLED', 'SERVING'].includes(token.status));
        setActiveToken(active ?? null);
      } else {
        setActiveToken(null);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const shopsRes = await shopApi.getNearby(loc.coords.latitude, loc.coords.longitude, 10);
        setNearbyShops(shopsRes.data);
        setLocationError(false);
      } else {
        const shopsRes = await shopApi.getNearby(FALLBACK_LOCATION.latitude, FALLBACK_LOCATION.longitude, 25);
        setNearbyShops(shopsRes.data);
        setLocationError(true);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isCustomer]);

  useEffect(() => {
    loadData();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadData]);

  useEffect(() => {
    if (!activeToken || !isCustomer) return;
    const id = setInterval(async () => {
      try {
        const historyRes = await tokenApi.getMyHistory(0, 5);
        const active = historyRes.data.content.find((token: Token) => ['WAITING', 'CALLED', 'SERVING'].includes(token.status));
        setActiveToken(active ?? null);
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, [activeToken, isCustomer]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await shopApi.searchPublic(query);
        if (!cancelled) setSearchResults(data);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleCancelToken = () => {
    if (!activeToken) return;
    Alert.alert('Cancel token', 'Leave this queue?', [
      { text: 'Keep token', style: 'cancel' },
      {
        text: 'Cancel token',
        style: 'destructive',
        onPress: async () => {
          try {
            await tokenApi.cancel(activeToken.id);
            setActiveToken(null);
          } catch {
            Alert.alert('Error', 'Failed to cancel token');
          }
        },
      },
    ]);
  };

  const openShopInMaps = async (shop: Shop) => {
    const query = encodeURIComponent(`${shop.name}, ${shop.address}, ${shop.city}`);
    const url = shop.latitude != null && shop.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Map unavailable', 'Unable to open maps right now.');
    }
  };

  if (loading) {
    return (
      <View style={ui.screen}>
        <View style={ui.content}>
          <ShopCardSkeleton />
        </View>
      </View>
    );
  }

  const isSearchingAllShops = searchQuery.trim().length > 0;
  const visibleShops = isSearchingAllShops ? searchResults : nearbyShops;
  const favoriteShops = nearbyShops.filter((shop) => favoriteIds.includes(shop.id));

  return (
    <Animated.View style={[ui.screen, enterStyle]}>
      <ScrollView
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={palette.accent} />}
      >
        <View style={styles.header}>
          <View style={styles.brandMark}><Text style={styles.brandText}>QL</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={ui.kicker}>QueueLess</Text>
            <Text style={ui.title}>{isCustomer ? `${user?.name?.split(' ')[0] ?? 'Hi'}, find a queue` : 'Find a shop'}</Text>
            <Text style={ui.subtitle}>Search nearby branches, check live wait, and book when ready.</Text>
          </View>
          {isCustomer ? (
            <TouchableOpacity onPress={() => router.push('/(tabs)/bookings')} style={styles.iconButton}>
              <Ionicons name="time-outline" size={18} color={palette.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/login')} style={styles.smallPrimary}>
              <Text style={styles.smallPrimaryText}>Sign in</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={palette.subtext} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shop, category, or area"
            placeholderTextColor={palette.faint}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searching ? <ActivityIndicator size="small" color={palette.accent} /> : null}
        </View>

        {!isCustomer ? (
          <View style={styles.guestPanel}>
            <View>
              <Text style={styles.cardTitle}>Browse first</Text>
              <Text style={styles.cardSub}>You only need an account when you join a queue or book an appointment.</Text>
            </View>
            <View style={styles.guestActions}>
              <TouchableOpacity style={ui.primaryButton} onPress={() => router.push('/register')}><Text style={ui.primaryButtonText}>Create account</Text></TouchableOpacity>
              <TouchableOpacity style={ui.secondaryButton} onPress={() => router.push('/login')}><Text style={ui.secondaryButtonText}>Login</Text></TouchableOpacity>
            </View>
          </View>
        ) : null}

        {isCustomer && activeToken ? (
          <ActiveTokenCard token={activeToken} onCancel={handleCancelToken} />
        ) : (
          <View style={ui.empty}>
            <Text style={ui.emptyTitle}>{isCustomer ? 'No active token' : 'Search first, book later'}</Text>
            <Text style={ui.emptySub}>{isCustomer ? 'Join a queue below or search for another branch.' : 'Open a shop to view services and availability before signing in.'}</Text>
          </View>
        )}

        {/* Saved Shops section */}
        {!isSearchingAllShops && favoriteShops.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Saved shops</Text>
            </View>
            {favoriteShops.map((shop) => (
              <ShopRow key={shop.id} shop={shop} onPress={() => router.push(`/shop/${shop.id}`)} onOpenMap={() => openShopInMaps(shop)} />
            ))}
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{isSearchingAllShops ? 'Search results' : 'Nearby shops'}</Text>
          {!isSearchingAllShops && locationError ? <Text style={styles.locationError}>City-wide</Text> : null}
        </View>

        {visibleShops.length === 0 ? (
          <View style={ui.empty}>
            <Text style={ui.emptyTitle}>{isSearchingAllShops ? 'No matching shops' : 'No shops found nearby'}</Text>
            <Text style={ui.emptySub}>Try another search or refresh the list.</Text>
          </View>
        ) : (
          visibleShops.map((shop) => (
            <ShopRow key={shop.id} shop={shop} onPress={() => router.push(`/shop/${shop.id}`)} onOpenMap={() => openShopInMaps(shop)} />
          ))
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  brandMark: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.dark, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#fcd34d', fontSize: 12, fontWeight: '900' },
  smallPrimary: { backgroundColor: palette.accent, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10 },
  smallPrimaryText: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  searchBox: { ...ui.panelMuted, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 12 },
  searchInput: { flex: 1, color: palette.ink, fontSize: 14, padding: 0 },
  guestPanel: { ...ui.panel, padding: 14, marginBottom: 12, gap: 12 },
  guestActions: { flexDirection: 'row', gap: 8 },
  cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  cardSub: { color: palette.subtext, fontSize: 13, lineHeight: 19, marginTop: 4 },
  activeToken: { ...ui.panel, padding: 14, marginTop: 12, marginBottom: 12 },
  activeTokenUrgent: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },
  activeTokenTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tokenNumber: { fontSize: 46, fontWeight: '900', lineHeight: 50 },
  compactStats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border, marginVertical: 12 },
  statCell: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRightWidth: 1, borderRightColor: palette.border },
  statValue: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  statLabel: { color: palette.subtext, fontSize: 10, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shopRow: { ...ui.row, flexDirection: 'row', padding: 12, marginTop: 9, gap: 10, alignItems: 'center' },
  shopInitial: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: '#fed7aa', alignItems: 'center', justifyContent: 'center' },
  shopBody: { flex: 1, minWidth: 0 },
  shopName: { color: palette.ink, fontSize: 15, fontWeight: '900', flex: 1 },
  shopAddress: { color: palette.subtext, fontSize: 12, marginTop: 2 },
  distance: { color: palette.faint, fontSize: 11, fontWeight: '800' },
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  statusDetail: { color: palette.faint, fontSize: 11, marginTop: 6 },
  iconButton: { width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  shopActions: { gap: 6, alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 4 },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  locationError: { color: palette.accent, fontSize: 12, fontWeight: '800' },
  chipGreen: { backgroundColor: palette.successSoft, borderColor: '#bbf7d0' },
  chipGreenText: { color: palette.success },
  chipBlue: { backgroundColor: palette.infoSoft, borderColor: '#bfdbfe' },
  chipBlueText: { color: palette.info },
  chipAmber: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  chipAmberText: { color: palette.accent },
  chipMuted: { backgroundColor: '#f5f5f4' },
  chipMutedText: { color: palette.subtext },
  chipRed: { backgroundColor: palette.dangerSoft, borderColor: '#fecaca' },
  chipRedText: { color: palette.danger },
});
