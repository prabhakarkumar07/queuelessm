import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { appointmentApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/useTheme';
import type { Appointment } from '../types';

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PAID: { bg: '#ecfdf5', text: '#059669', label: 'Paid' },
  PENDING: { bg: '#fffbeb', text: '#d97706', label: 'Pending' },
  FAILED: { bg: '#fef2f2', text: '#dc2626', label: 'Failed' },
  REFUNDED: { bg: '#eff6ff', text: '#2563eb', label: 'Refunded' },
};

function PaymentRow({ item }: { item: Appointment }) {
  const { colors } = useTheme();
  const status = STATUS_STYLE[item.paymentStatus] ?? STATUS_STYLE.PENDING;

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
        <Ionicons name="card-outline" size={18} color={colors.text} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.shopName, { color: colors.ink }]} numberOfLines={1}>{item.shopName}</Text>
        <Text style={[styles.service, { color: colors.subtext }]}>{item.serviceName}</Text>
        <Text style={[styles.date, { color: colors.faint }]}>{format(new Date(item.createdAt), 'dd MMM yyyy, hh:mm a')}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.ink }]}>₹{item.amount}</Text>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>
    </View>
  );
}

export default function PaymentHistoryScreen() {
  const { colors } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [payments, setPayments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPayments = useCallback(async (pageNum = 0, refresh = false) => {
    try {
      const { data } = await appointmentApi.getMy(pageNum, 20);
      const paid = data.content.filter((a: Appointment) => a.amount > 0);
      if (refresh) {
        setPayments(paid);
      } else {
        setPayments((prev) => [...prev, ...paid]);
      }
      setHasMore(data.page < data.totalPages - 1);
      setPage(pageNum);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadPayments(0, true);
    else setLoading(false);
  }, [isAuthenticated, loadPayments]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPayments(0, true);
  };

  const onEndReached = () => {
    if (hasMore && !loading) loadPayments(page + 1);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PaymentRow item={item} />}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.ink }]}>Payment History</Text>
            <Text style={[styles.subtitle, { color: colors.subtext }]}>All your appointment payments and transactions.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={32} color={colors.faint} />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>No payments yet</Text>
            <Text style={[styles.emptySub, { color: colors.subtext }]}>Your payment history will appear here after booking paid services.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  header: { paddingTop: 16, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, marginTop: 8, borderRadius: 6, borderWidth: 1, gap: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  shopName: { fontSize: 14, fontWeight: '700' },
  service: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 11, marginTop: 3 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 16, fontWeight: '900' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center', maxWidth: 260 },
});
