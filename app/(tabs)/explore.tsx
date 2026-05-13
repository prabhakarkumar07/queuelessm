import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { getShopOperatingStatus } from '../../src/lib/shopStatus';
import { shopApi } from '../../src/lib/api';
import type { Shop, ShopCategory } from '../../src/types';
import { palette, radius, ui, useEnterAnimation } from '../../src/theme/ui';

type CategoryFilter = 'ALL' | ShopCategory;

const CATEGORIES: CategoryFilter[] = ['ALL', 'CLINIC', 'SALON', 'BANK', 'GOVERNMENT', 'RESTAURANT', 'OTHER'];
const FALLBACK_LOCATION = { latitude: 22.5726, longitude: 88.3639 };

const CATEGORY_LABEL: Record<CategoryFilter, string> = {
  ALL: 'All',
  CLINIC: 'Clinic',
  SALON: 'Salon',
  BANK: 'Bank',
  GOVERNMENT: 'Government',
  RESTAURANT: 'Restaurant',
  OTHER: 'Other',
};

const CATEGORY_ICON: Record<ShopCategory, keyof typeof Ionicons.glyphMap> = {
  CLINIC: 'medical-outline',
  SALON: 'cut-outline',
  BANK: 'business-outline',
  GOVERNMENT: 'document-text-outline',
  RESTAURANT: 'restaurant-outline',
  OTHER: 'storefront-outline',
};

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ShopCard({ shop, compact = false, onPress }: { shop: Shop; compact?: boolean; onPress: () => void }) {
  const status = getShopOperatingStatus(shop);

  return (
    <TouchableOpacity style={[styles.shopCard, compact && styles.compactCard]} activeOpacity={0.78} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.shopIcon}>
          <Ionicons name={CATEGORY_ICON[shop.category] ?? 'storefront-outline'} size={18} color={palette.accent} />
        </View>
        <View style={styles.shopBody}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
          <Text style={styles.shopAddress} numberOfLines={1}>{shop.address}, {shop.city}</Text>
        </View>
        {shop.distanceKm != null ? <Text style={styles.distance}>{shop.distanceKm} km</Text> : null}
      </View>

      <View style={styles.statusLine}>
        <View style={[ui.chip, status.isOpen ? styles.chipGreen : styles.chipMuted]}>
          <Text style={[ui.chipText, status.isOpen ? styles.chipGreenText : styles.chipMutedText]}>{status.label}</Text>
        </View>
        <View style={ui.chip}>
          <Text style={ui.chipText}>{CATEGORY_LABEL[shop.category]}</Text>
        </View>
        <View style={ui.chip}>
          <Text style={ui.chipText}>{shop.currentQueueSize ?? 0} waiting</Text>
        </View>
        {shop.queuePaused ? (
          <View style={[ui.chip, styles.chipRed]}>
            <Text style={[ui.chipText, styles.chipRedText]}>Paused</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsGrid}>
        <StatCell label="Waiting" value={shop.currentQueueSize ?? 0} />
        <StatCell label="Avg" value={`${shop.avgServiceMins}m`} />
        <StatCell label="Distance" value={shop.distanceKm != null ? `${shop.distanceKm}km` : '-'} />
      </View>

      {!compact ? <Text style={styles.statusDetail} numberOfLines={1}>{status.detail}</Text> : null}
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const enterStyle = useEnterAnimation();

  const [nearbyShops, setNearbyShops] = useState<Shop[]>([]);
  const [trendingShops, setTrendingShops] = useState<Shop[]>([]);
  const [popularShops, setPopularShops] = useState<Shop[]>([]);
  const [searchResults, setSearchResults] = useState<Shop[]>([]);
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [error, setError] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const filterByCategory = useCallback((shops: Shop[]) => {
    return shops.filter((shop) => category === 'ALL' || shop.category === category);
  }, [category]);

  const loadExplore = useCallback(async () => {
    setExploreLoading(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        const [nearbyRes, trendingRes, popularRes] = await Promise.all([
          shopApi.getNearby(loc.coords.latitude, loc.coords.longitude, 25),
          shopApi.getTrending(category, loc.coords.latitude, loc.coords.longitude, 10),
          shopApi.getPopular(category, loc.coords.latitude, loc.coords.longitude, 12),
        ]);
        setNearbyShops(nearbyRes.data);
        setTrendingShops(trendingRes.data);
        setPopularShops(popularRes.data);
        setLocationDenied(false);
      } else {
        const [popularRes, trendingRes] = await Promise.all([
          shopApi.getPopular(category, undefined, undefined, 20),
          shopApi.getTrending(category, undefined, undefined, 10),
        ]);
        setCurrentLocation(null);
        setNearbyShops(popularRes.data);
        setPopularShops(popularRes.data);
        setTrendingShops(trendingRes.data);
        setLocationDenied(true);
      }
    } catch {
      try {
        const [popularRes, trendingRes] = await Promise.all([
          shopApi.getPopular(category, FALLBACK_LOCATION.latitude, FALLBACK_LOCATION.longitude, 20),
          shopApi.getTrending(category, FALLBACK_LOCATION.latitude, FALLBACK_LOCATION.longitude, 10),
        ]);
        setCurrentLocation(FALLBACK_LOCATION);
        setNearbyShops(popularRes.data);
        setPopularShops(popularRes.data);
        setTrendingShops(trendingRes.data);
        setLocationDenied(true);
      } catch {
        setNearbyShops([]);
        setPopularShops([]);
        setTrendingShops([]);
        setError('Explore is unavailable right now. Pull to retry.');
      }
    } finally {
      setLoading(false);
      setExploreLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => {
    loadExplore();
  }, [loadExplore]);

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [searchRes, trendingRes, popularRes] = await Promise.all([
          shopApi.searchPublic(value),
          shopApi.getTrending(category, currentLocation?.latitude, currentLocation?.longitude, 10),
          shopApi.getPopular(category, currentLocation?.latitude, currentLocation?.longitude, 10),
        ]);
        if (!cancelled) {
          setSearchResults(searchRes.data);
          setTrendingShops(trendingRes.data);
          setPopularShops(popularRes.data);
        }
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
  }, [category, currentLocation, query]);

  const visibleMainShops = useMemo(
    () => filterByCategory(query.trim() ? searchResults : nearbyShops),
    [filterByCategory, nearbyShops, query, searchResults]
  );
  const visibleTrending = useMemo(() => filterByCategory(trendingShops), [filterByCategory, trendingShops]);
  const visiblePopular = useMemo(() => filterByCategory(popularShops), [filterByCategory, popularShops]);

  const openShop = (shop: Shop) => router.push(`/shop/${shop.id}`);

  const openMap = async () => {
    const url = `https://www.google.com/maps/search/?api=1&query=nearby+queues`;
    try {
      await Linking.openURL(url);
    } catch {}
  };

  if (loading) {
    return (
      <View style={ui.centered}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <Animated.View style={[ui.screen, enterStyle]}>
      <ScrollView
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadExplore(); }} tintColor={palette.accent} />}
      >
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Ionicons name="compass-outline" size={20} color={palette.surface} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ui.kicker}>Explore</Text>
            <Text style={ui.title}>Find a queue nearby</Text>
            <Text style={ui.subtitle}>Nearby shops, frequent searches, and active popular branches.</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={openMap}>
            <Ionicons name="map-outline" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={palette.subtext} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shop, category, city, or area"
            placeholderTextColor={palette.faint}
            value={query}
            onChangeText={setQuery}
          />
          {searching ? <ActivityIndicator size="small" color={palette.accent} /> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.categoryChip, category === item && styles.categoryChipActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{CATEGORY_LABEL[item]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {exploreLoading && !refreshing ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={styles.loadingText}>Loading customer discovery</Text>
          </View>
        ) : null}

        {error ? (
          <View style={ui.empty}>
            <Ionicons name="cloud-offline-outline" size={24} color={palette.faint} />
            <Text style={ui.emptyTitle}>Explore unavailable</Text>
            <Text style={ui.emptySub}>{error}</Text>
          </View>
        ) : null}

        {visibleTrending.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={ui.kicker}>Customer discovery</Text>
                <Text style={styles.sectionTitle}>Trending now</Text>
              </View>
              <View style={styles.frequentlyPill}>
                <Ionicons name="star" size={12} color={palette.warning} />
                <Text style={styles.frequentlyText}>Frequently searched</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {visibleTrending.map((shop) => (
                <ShopCard key={shop.id} shop={shop} compact onPress={() => openShop(shop)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={ui.kicker}>{query.trim() ? 'Search results' : locationDenied ? 'Popular fallback' : 'Nearby shops'}</Text>
              <Text style={styles.sectionTitle}>{query.trim() ? 'Matching shops' : locationDenied ? 'Popular shops' : 'Near you'}</Text>
            </View>
            {locationDenied && !query.trim() ? <Text style={styles.locationPill}>Location off</Text> : null}
          </View>
          {locationDenied && !query.trim() ? (
            <Text style={styles.helperText}>Location permission is off, so QueueLess is showing popular active shops.</Text>
          ) : null}

          {!error && visibleMainShops.length ? (
            visibleMainShops.map((shop) => <ShopCard key={shop.id} shop={shop} onPress={() => openShop(shop)} />)
          ) : !error ? (
            <View style={ui.empty}>
              <Ionicons name="search-outline" size={24} color={palette.faint} />
              <Text style={ui.emptyTitle}>No shops found</Text>
              <Text style={ui.emptySub}>Try another category, city, area, or shop name.</Text>
            </View>
          ) : null}
        </View>

        {!error && visiblePopular.length ? (
          <View style={styles.section}>
            <Text style={ui.kicker}>Frequently searched</Text>
            <Text style={styles.sectionTitle}>Popular shops</Text>
            {visiblePopular.slice(0, 6).map((shop) => <ShopCard key={shop.id} shop={shop} onPress={() => openShop(shop)} />)}
          </View>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  brandMark: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.dark, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  searchBox: { ...ui.panelMuted, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 11 },
  searchInput: { flex: 1, color: palette.ink, fontSize: 14, padding: 0 },
  categoryRow: { gap: 8, paddingVertical: 12 },
  categoryChip: { borderRadius: 999, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 12, paddingVertical: 7 },
  categoryChipActive: { backgroundColor: palette.ink, borderColor: palette.ink },
  categoryText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  categoryTextActive: { color: palette.surface },
  loadingPanel: { ...ui.panel, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginTop: 8 },
  loadingText: { color: palette.subtext, fontSize: 12, fontWeight: '700' },
  section: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  frequentlyPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: '#fde68a', backgroundColor: palette.warningSoft, paddingHorizontal: 9, paddingVertical: 5 },
  frequentlyText: { color: palette.warning, fontSize: 10, fontWeight: '900' },
  locationPill: { color: palette.warning, fontSize: 12, fontWeight: '900', paddingTop: 3 },
  helperText: { color: palette.subtext, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  rail: { gap: 10, paddingRight: 16 },
  shopCard: { ...ui.row, padding: 12, marginTop: 9 },
  compactCard: { width: 280, marginTop: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shopIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  shopBody: { flex: 1, minWidth: 0 },
  shopName: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  shopAddress: { color: palette.subtext, fontSize: 12, marginTop: 2 },
  distance: { color: palette.faint, fontSize: 11, fontWeight: '900' },
  statusLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  statsGrid: { flexDirection: 'row', overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, marginTop: 12 },
  statCell: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRightWidth: 1, borderRightColor: palette.border },
  statValue: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  statLabel: { color: palette.subtext, fontSize: 9, fontWeight: '900', marginTop: 2, textTransform: 'uppercase' },
  statusDetail: { color: palette.faint, fontSize: 11, marginTop: 7 },
  chipGreen: { backgroundColor: palette.successSoft, borderColor: '#bbf7d0' },
  chipGreenText: { color: palette.success },
  chipMuted: { backgroundColor: '#f8fafc' },
  chipMutedText: { color: palette.subtext },
  chipRed: { backgroundColor: palette.dangerSoft, borderColor: '#fecaca' },
  chipRedText: { color: palette.danger },
});
