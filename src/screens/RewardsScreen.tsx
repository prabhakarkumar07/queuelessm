import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Clipboard, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { loyaltyApi, shopApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { palette, radius, ui, useEnterAnimation } from '../theme/ui';

interface LoyaltyData {
  shopId: string;
  shopName: string;
  points: number;
  tier: 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD';
  bronzeThreshold: number;
  silverThreshold: number;
  goldThreshold: number;
  totalVisits: number;
}

const TIER_CONFIG = {
  GOLD: { label: 'Gold', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  SILVER: { label: 'Silver', color: '#57534e', bg: '#f5f5f4', border: '#d6d3d1' },
  BRONZE: { label: 'Bronze', color: palette.accent, bg: palette.accentSoft, border: '#fed7aa' },
  NONE: { label: 'Member', color: palette.subtext, bg: '#f5f5f4', border: palette.border },
};

function LoyaltyCard({ data }: { data: LoyaltyData }) {
  const tier = TIER_CONFIG[data.tier];
  const nextTierPoints = data.tier === 'NONE' ? data.bronzeThreshold : data.tier === 'BRONZE' ? data.silverThreshold : data.tier === 'SILVER' ? data.goldThreshold : null;
  const nextTierLabel = data.tier === 'NONE' ? 'Bronze' : data.tier === 'BRONZE' ? 'Silver' : data.tier === 'SILVER' ? 'Gold' : null;
  const progress = nextTierPoints ? Math.min(100, (data.points / nextTierPoints) * 100) : 100;

  return (
    <View style={[styles.loyaltyCard, { borderColor: tier.border, backgroundColor: tier.bg }]}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} numberOfLines={1}>{data.shopName}</Text>
          <View style={[ui.chip, { borderColor: tier.border, backgroundColor: '#ffffff80' }]}><Text style={[ui.chipText, { color: tier.color }]}>{tier.label}</Text></View>
        </View>
        <View style={styles.pointsBox}>
          <Text style={[styles.pointsNumber, { color: tier.color }]}>{data.points}</Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>
      </View>
      {nextTierPoints && nextTierLabel ? (
        <View style={styles.progressSection}>
          <View style={styles.rowBetween}>
            <Text style={styles.progressText}>{data.points} / {nextTierPoints} to {nextTierLabel}</Text>
            <Text style={[styles.progressPct, { color: tier.color }]}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: tier.color }]} /></View>
        </View>
      ) : (
        <Text style={styles.progressText}>Highest tier reached</Text>
      )}
      <View style={styles.footerRow}>
        <Text style={styles.footerStat}>{data.totalVisits} completed visits</Text>
        <Text style={styles.footerStat}>B {data.bronzeThreshold} · S {data.silverThreshold} · G {data.goldThreshold}</Text>
      </View>
    </View>
  );
}

function ReferralCard({ userId }: { userId: string }) {
  const code = `QL-${userId.slice(-6).toUpperCase()}`;
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({ message: `Use my QueueLess referral code ${code}.`, title: 'Join QueueLess' });
    } catch {}
  };

  const handleCopy = () => {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={[ui.panel, styles.referralCard]}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.cardTitle}>Referral code</Text>
          <Text style={styles.cardSub}>Share with a friend after their first visit.</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.iconButton}><Ionicons name="share-outline" size={18} color={palette.text} /></TouchableOpacity>
      </View>
      <View style={styles.codeRow}>
        <Text style={styles.referralCode}>{code}</Text>
        <TouchableOpacity style={ui.secondaryButton} onPress={handleCopy}>
          <Text style={ui.secondaryButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RewardsScreen() {
  const router = useRouter();
  const enterStyle = useEnterAnimation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isCustomer = isAuthenticated && user?.role === 'CUSTOMER';
  const [loyalties, setLoyalties] = useState<LoyaltyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data } = await loyaltyApi.getMyAll();
      setLoyalties(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isCustomer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [isCustomer, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) return <View style={ui.centered}><ActivityIndicator size="large" color={palette.accent} /></View>;

  if (!isCustomer) {
    return (
      <View style={[ui.screen, styles.guestContainer]}>
        <View style={ui.empty}>
          <Text style={ui.emptyTitle}>Rewards appear after visits</Text>
          <Text style={ui.emptySub}>Sign in to see loyalty points and tier progress at every shop you visit.</Text>
          <TouchableOpacity style={[ui.primaryButton, styles.guestButton]} onPress={() => router.push({ pathname: '/login', params: { redirect: '/(tabs)/rewards' } })}>
            <Text style={ui.primaryButtonText}>Login to view rewards</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const totalPoints = loyalties.reduce((sum, item) => sum + item.points, 0);

  return (
    <Animated.View style={[ui.screen, enterStyle]}>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}>
        <Text style={ui.kicker}>Loyalty</Text>
        <Text style={ui.title}>Rewards</Text>
        <Text style={ui.subtitle}>Points and tiers from branches you have visited.</Text>

        {user ? <ReferralCard userId={user.id} /> : null}

        {loyalties.length === 0 ? (
          <View style={ui.empty}>
            <Text style={ui.emptyTitle}>No points yet</Text>
            <Text style={ui.emptySub}>Complete a service to start earning points.</Text>
            <TouchableOpacity style={[ui.primaryButton, styles.guestButton]} onPress={() => router.push('/(tabs)')}>
              <Text style={ui.primaryButtonText}>Find a shop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <Summary label="Shops" value={loyalties.length} />
              <Summary label="Points" value={totalPoints} accent />
              <Summary label="Gold" value={loyalties.filter((item) => item.tier === 'GOLD').length} />
            </View>
            {loyalties.map((loyalty) => <LoyaltyCard key={loyalty.shopId} data={loyalty} />)}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

function Summary({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, accent && { color: palette.accent }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  referralCard: { padding: 14, marginTop: 14, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  cardSub: { color: palette.subtext, fontSize: 12, lineHeight: 17, marginTop: 3 },
  iconButton: { width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  codeRow: { marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  referralCode: { flex: 1, color: palette.ink, fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 12 },
  summaryCard: { ...ui.panel, flex: 1, padding: 12, alignItems: 'center' },
  summaryValue: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  summaryLabel: { color: palette.subtext, fontSize: 11, fontWeight: '800', marginTop: 2 },
  loyaltyCard: { borderRadius: radius.lg, borderWidth: 1, padding: 14, marginBottom: 10 },
  shopName: { color: palette.ink, fontSize: 15, fontWeight: '900', marginBottom: 8 },
  pointsBox: { alignItems: 'flex-end' },
  pointsNumber: { fontSize: 34, fontWeight: '900', lineHeight: 38 },
  pointsLabel: { color: palette.subtext, fontSize: 11, fontWeight: '800' },
  progressSection: { marginTop: 14 },
  progressText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  progressPct: { fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 6, backgroundColor: '#ffffff99', borderRadius: 999, overflow: 'hidden', marginTop: 7 },
  progressFill: { height: '100%' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  footerStat: { color: palette.subtext, fontSize: 11, fontWeight: '700' },
  guestContainer: { justifyContent: 'center', padding: 24 },
  guestButton: { marginTop: 14 },
});
