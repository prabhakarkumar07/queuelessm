import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
import { appointmentApi, reviewApi, tokenApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { Appointment, Token } from '../types';
import { palette, radius, ui, useEnterAnimation } from '../theme/ui';

type TabType = 'tokens' | 'appointments';

const TOKEN_STATUS_COLORS: Record<string, string> = {
  WAITING: palette.info,
  CALLED: palette.accent,
  SERVING: palette.success,
  SERVED: palette.success,
  SKIPPED: palette.accent,
  CANCELLED: palette.danger,
  EXPIRED: palette.subtext,
};

function canCancelToken(status: string) {
  return ['WAITING', 'CALLED', 'SERVING'].includes(status);
}

function canCancelAppointment(status: string) {
  return !['CANCELLED', 'COMPLETED'].includes(status);
}

function TokenHistoryItem({ token, onCancel, onSnooze, onReview }: { token: Token; onCancel: (token: Token) => void; onSnooze: (token: Token) => void; onReview: (token: Token) => void }) {
  const color = TOKEN_STATUS_COLORS[token.status] ?? palette.subtext;
  const canReview = token.status === 'SERVED';

  return (
    <TouchableOpacity style={styles.historyItem} onPress={() => canReview && onReview(token)} activeOpacity={canReview ? 0.75 : 1}>
      <View style={[styles.tokenBadge, { backgroundColor: `${color}14`, borderColor: `${color}45` }]}>
        <Text style={[styles.tokenBadgeText, { color }]}>{token.displayNumber}</Text>
      </View>
      <View style={styles.historyBody}>
        <Text style={styles.historyTitle} numberOfLines={1}>{token.shopName}</Text>
        <Text style={styles.historySub} numberOfLines={1}>{[token.serviceName, token.providerName ? `With ${token.providerName}` : null].filter(Boolean).join(' · ') || 'General queue'}</Text>
        <Text style={styles.historyDate}>{format(new Date(token.issuedAt), 'dd MMM, hh:mm a')}</Text>
        {canReview ? <Text style={styles.reviewPromptText}>Tap to rate experience</Text> : null}
      </View>
      <View style={styles.historyActions}>
        <View style={[ui.chip, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}><Text style={[ui.chipText, { color }]}>{token.status}</Text></View>
        {token.status === 'WAITING' ? <TouchableOpacity style={styles.inlineBtn} onPress={() => onSnooze(token)}><Text style={styles.inlineText}>Snooze</Text></TouchableOpacity> : null}
        {canCancelToken(token.status) ? <TouchableOpacity style={ui.dangerButton} onPress={() => onCancel(token)}><Text style={ui.dangerButtonText}>Cancel</Text></TouchableOpacity> : null}
      </View>
    </TouchableOpacity>
  );
}

function AppointmentItem({ appt, onPress, onReview }: { appt: Appointment; onPress: (appt: Appointment) => void; onReview: (appt: Appointment) => void }) {
  const canReview = appt.status === 'COMPLETED';
  const cancelled = appt.status === 'CANCELLED';

  return (
    <TouchableOpacity style={[styles.historyItem, cancelled && styles.cancelled]} onPress={() => (canReview ? onReview(appt) : onPress(appt))}>
      <View style={styles.apptDateBox}>
        <Text style={styles.apptDay}>{format(new Date(appt.scheduledAt), 'dd')}</Text>
        <Text style={styles.apptMonth}>{format(new Date(appt.scheduledAt), 'MMM')}</Text>
      </View>
      <View style={styles.historyBody}>
        <Text style={styles.historyTitle} numberOfLines={1}>{appt.shopName}</Text>
        <Text style={styles.historySub} numberOfLines={1}>{[appt.serviceName, appt.providerName ? `With ${appt.providerName}` : null].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.historyDate}>{format(new Date(appt.scheduledAt), 'hh:mm a')}</Text>
        {appt.amount > 0 ? <Text style={styles.priceText}>Rs {appt.amount} · {appt.paymentStatus}</Text> : null}
        {canReview ? <Text style={styles.reviewPromptText}>Tap to rate experience</Text> : null}
      </View>
      <View style={[ui.chip, cancelled ? styles.chipRed : styles.chipGreen]}>
        <Text style={[ui.chipText, cancelled ? styles.chipRedText : styles.chipGreenText]}>{appt.status}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function BookingsScreen() {
  const router = useRouter();
  const enterStyle = useEnterAnimation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isCustomer = isAuthenticated && user?.role === 'CUSTOMER';

  const [tab, setTab] = useState<TabType>('tokens');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pageRef = React.useRef(0);
  const hasMoreRef = React.useRef(true);
  const [hasMore, setHasMore] = useState(true);
  const apptPageRef = React.useRef(0);
  const apptHasMoreRef = React.useRef(true);
  const [apptHasMore, setApptHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [razorpayPaymentId, setRazorpayPaymentId] = useState('');
  const [razorpaySignature, setRazorpaySignature] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{ shopId: string; shopName: string; tokenId?: string; appointmentId?: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadTokens = useCallback(async (reset = false) => {
    if (!reset && !hasMoreRef.current) return;
    if (!reset) setLoadingMore(true);
    const nextPage = reset ? 0 : pageRef.current;
    try {
      const { data } = await tokenApi.getMyHistory(nextPage, 20);
      if (reset) {
        setTokens(data.content);
        pageRef.current = 1;
      } else {
        setTokens((prev) => [...prev, ...data.content]);
        pageRef.current = nextPage + 1;
      }
      hasMoreRef.current = !data.last;
      setHasMore(!data.last);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }, []);

  const loadAppointments = useCallback(async (reset = false) => {
    if (!reset && !apptHasMoreRef.current) return;
    if (!reset) setLoadingMore(true);
    const nextPage = reset ? 0 : apptPageRef.current;
    try {
      const { data } = await appointmentApi.getMy(nextPage, 20);
      if (reset) {
        setAppointments(data.content);
        apptPageRef.current = 1;
      } else {
        setAppointments((prev) => [...prev, ...data.content]);
        apptPageRef.current = nextPage + 1;
      }
      apptHasMoreRef.current = !data.last;
      setApptHasMore(!data.last);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }, []);

  const reloadAll = useCallback(async () => {
    pageRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    apptPageRef.current = 0;
    apptHasMoreRef.current = true;
    setApptHasMore(true);
    await Promise.all([loadTokens(true), loadAppointments(true)]);
  }, [loadAppointments, loadTokens]);

  useEffect(() => {
    if (!isCustomer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    reloadAll().finally(() => setLoading(false));
  }, [isCustomer, reloadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadAll();
    setRefreshing(false);
  };

  const handleCancelToken = (token: Token) => {
    Alert.alert('Cancel token', `Leave the queue at ${token.shopName}?`, [
      { text: 'Keep token', style: 'cancel' },
      { text: 'Cancel token', style: 'destructive', onPress: async () => {
        try { setBusyId(token.id); await tokenApi.cancel(token.id); await reloadAll(); }
        catch { Alert.alert('Error', 'Failed to cancel token'); }
        finally { setBusyId(null); }
      }},
    ]);
  };

  const handleSnoozeToken = (token: Token) => {
    Alert.alert('Snooze queue position', `Not ready yet? Push your token %s back by a few positions at ${token.shopName}?`.replace('%s', token.displayNumber), [
      { text: 'Stay here', style: 'cancel' },
      { text: 'Snooze me', onPress: async () => {
        try {
          setBusyId(token.id);
          await tokenApi.snooze(token.id);
          await reloadAll();
          Alert.alert('Snoozed', 'Your token has been pushed back in the queue.');
        } catch { Alert.alert('Error', 'Failed to snooze your position'); }
        finally { setBusyId(null); }
      }},
    ]);
  };

  const handleCancelAppointment = async (appointment: Appointment) => {
    Alert.alert('Cancel appointment', `Cancel your booking at ${appointment.shopName}?`, [
      { text: 'Keep booking', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: async () => {
        try {
          setBusyId(appointment.id);
          await appointmentApi.cancel(appointment.id, 'Cancelled by customer');
          await reloadAll();
          setSelectedAppointment(null);
        } catch { Alert.alert('Error', 'Failed to cancel appointment'); }
        finally { setBusyId(null); }
      }},
    ]);
  };

  const openReviewModal = (item: Token | Appointment) => {
    setReviewTarget({
      shopId: item.shopId,
      shopName: item.shopName,
      tokenId: 'displayNumber' in item ? item.id : undefined,
      appointmentId: 'scheduledAt' in item ? item.id : undefined,
    });
  };

  const handleReviewSubmit = async () => {
    if (!reviewTarget) return;
    setSubmittingReview(true);
    try {
      await reviewApi.create({ shopId: reviewTarget.shopId, rating: reviewRating, comment: reviewComment || undefined, tokenId: reviewTarget.tokenId, appointmentId: reviewTarget.appointmentId });
      Alert.alert('Saved', 'Thanks for the review.');
      setReviewTarget(null);
      setReviewRating(5);
      setReviewComment('');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!selectedAppointment?.razorpayOrderId) return;
    if (!razorpayPaymentId.trim() || !razorpaySignature.trim()) {
      Alert.alert('Payment details required', 'Enter the Razorpay payment ID and signature from checkout.');
      return;
    }
    try {
      setBusyId(selectedAppointment.id);
      await appointmentApi.verifyPayment(selectedAppointment.id, {
        razorpayPaymentId: razorpayPaymentId.trim(),
        razorpayOrderId: selectedAppointment.razorpayOrderId,
        razorpaySignature: razorpaySignature.trim(),
      });
      Toast.show({ type: 'success', text1: 'Payment Verified', text2: 'Your appointment is now confirmed.' });
      setRazorpayPaymentId('');
      setRazorpaySignature('');
      setSelectedAppointment(null);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Verification Failed', err.response?.data?.message || 'Check your payment details.');
    } finally {
      setBusyId(null);
    }
  };

  const simulatePayment = () => {
    if (!selectedAppointment?.razorpayOrderId) return;
    
    setBusyId(selectedAppointment.id);
    // Simulate the time it takes for a user to complete the Razorpay overlay
    setTimeout(() => {
      setBusyId(null);
      // In a real app with react-native-razorpay, these values come from the SDK callback.
      // For this dev environment, we provide instructions or mock values if testing on a local backend.
      setRazorpayPaymentId('pay_test_' + Math.random().toString(36).substring(7));
      setRazorpaySignature('simulated_sig_for_dev_mode');
      
      Alert.alert(
        'Razorpay Simulation',
        'In a production build, the Razorpay overlay would have opened automatically. I have auto-filled the test Payment ID for you. Click "Verify & Confirm" to proceed.',
        [{ text: 'Got it' }]
      );
    }, 1500);
  };

  if (loading) {
    return <View style={ui.centered}><ActivityIndicator color={palette.accent} size="large" /></View>;
  }

  if (!isCustomer) {
    return (
      <View style={[ui.screen, styles.guestContainer]}>
        <View style={ui.empty}>
          <Text style={ui.emptyTitle}>Your bookings live here</Text>
          <Text style={ui.emptySub}>Sign in to view token history, appointment details, and active bookings.</Text>
          <TouchableOpacity style={[ui.primaryButton, styles.guestButton]} onPress={() => router.push({ pathname: '/login', params: { redirect: '/(tabs)/bookings' } })}>
            <Text style={ui.primaryButtonText}>Login to continue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ui.secondaryButton, styles.guestButton]} onPress={() => router.push('/(tabs)')}>
            <Text style={ui.secondaryButtonText}>Back to discover</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const data = tab === 'tokens' ? tokens : appointments;
  const isEmpty = data.length === 0;

  return (
    <Animated.View style={[ui.screen, enterStyle]}>
      <View style={styles.header}>
        <Text style={ui.kicker}>History</Text>
        <Text style={ui.title}>Bookings</Text>
      </View>

      <View style={styles.tabBar}>
        {(['tokens', 'appointments'] as TabType[]).map((item) => (
          <TouchableOpacity key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'tokens' ? 'Tokens' : 'Appointments'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isEmpty ? (
        <View style={[ui.empty, styles.emptyState]}>
          <Text style={ui.emptyTitle}>No {tab} yet</Text>
          <Text style={ui.emptySub}>{tab === 'tokens' ? 'Join a queue and your tokens will appear here.' : 'Book an appointment and details will appear here.'}</Text>
        </View>
      ) : (
        <FlatList
          data={data as (Token | Appointment)[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            tab === 'tokens'
              ? <TokenHistoryItem token={item as Token} onCancel={handleCancelToken} onSnooze={handleSnoozeToken} onReview={openReviewModal} />
              : <AppointmentItem appt={item as Appointment} onPress={setSelectedAppointment} onReview={openReviewModal} />
          }
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
          onEndReached={() => { 
            if (tab === 'tokens' && hasMore) loadTokens(false); 
            if (tab === 'appointments' && apptHasMore) loadAppointments(false);
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.accent} style={{ padding: 20 }} /> : null}
        />
      )}

      <Modal visible={!!reviewTarget} transparent animationType="fade" onRequestClose={() => setReviewTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rate experience</Text>
            <Text style={styles.modalSub}>{reviewTarget?.shopName}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                  <Ionicons name={star <= reviewRating ? 'star' : 'star-outline'} size={34} color={palette.accent} />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.reviewInput} placeholder="Comment (optional)" placeholderTextColor={palette.faint} multiline value={reviewComment} onChangeText={setReviewComment} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[ui.secondaryButton, { flex: 1 }]} onPress={() => setReviewTarget(null)} disabled={submittingReview}><Text style={ui.secondaryButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[ui.primaryButton, { flex: 1 }]} onPress={handleReviewSubmit} disabled={submittingReview}>
                {submittingReview ? <ActivityIndicator color={palette.ink} /> : <Text style={ui.primaryButtonText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedAppointment != null} transparent animationType="slide" onRequestClose={() => setSelectedAppointment(null)}>
        <View style={styles.bottomOverlay}>
          <View style={styles.bottomCard}>
            {selectedAppointment ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Appointment details</Text>
                  <TouchableOpacity onPress={() => setSelectedAppointment(null)}><Ionicons name="close" size={22} color={palette.subtext} /></TouchableOpacity>
                </View>
                {[
                  ['Shop', selectedAppointment.shopName],
                  ['Service', selectedAppointment.serviceName],
                  ['Provider', selectedAppointment.providerName ?? 'Any available staff'],
                  ['Scheduled', format(new Date(selectedAppointment.scheduledAt), 'dd MMM yyyy, hh:mm a')],
                  ['Duration', `${selectedAppointment.durationMins} min`],
                  ['Status', selectedAppointment.status],
                  ['Payment', selectedAppointment.amount > 0 ? `Rs ${selectedAppointment.amount} · ${selectedAppointment.paymentStatus}` : selectedAppointment.paymentStatus],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>
                ))}
                {selectedAppointment.paymentStatus === 'PENDING' && selectedAppointment.amount > 0 && selectedAppointment.status !== 'CANCELLED' ? (
                  <View style={styles.paymentBox}>
                    <Text style={styles.paymentTitle}>Payment Required</Text>
                    <Text style={styles.paymentHelp}>This service requires an advance payment of Rs {selectedAppointment.amount}.</Text>
                    
                    {(!razorpayPaymentId || !razorpaySignature) ? (
                      <TouchableOpacity 
                        style={[ui.primaryButton, { marginTop: 12, backgroundColor: '#3399cc' }]} 
                        onPress={simulatePayment}
                        disabled={busyId === selectedAppointment.id}
                      >
                        {busyId === selectedAppointment.id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={ui.primaryButtonText}>Pay with Razorpay</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={{ marginTop: 8 }}>
                        <View style={styles.devTag}><Text style={styles.devTagText}>TEST MODE: DATA CAPTURED</Text></View>
                        <TextInput style={ui.input} placeholder="Payment ID" value={razorpayPaymentId} onChangeText={setRazorpayPaymentId} autoCapitalize="none" />
                        <TextInput style={[ui.input, { marginTop: 8 }]} placeholder="Signature" value={razorpaySignature} onChangeText={setRazorpaySignature} autoCapitalize="none" />
                        <TouchableOpacity style={[ui.primaryButton, { marginTop: 12 }]} onPress={handleVerifyPayment} disabled={busyId === selectedAppointment.id}>
                          {busyId === selectedAppointment.id ? <ActivityIndicator color={palette.ink} /> : <Text style={ui.primaryButtonText}>Verify & Confirm</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setRazorpayPaymentId(''); setRazorpaySignature(''); }} style={{ marginTop: 10, alignSelf: 'center' }}>
                          <Text style={{ color: palette.subtext, fontSize: 12 }}>Reset payment data</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : null}
                {canCancelAppointment(selectedAppointment.status) ? (
                  <TouchableOpacity style={ui.dangerButton} onPress={() => handleCancelAppointment(selectedAppointment)} disabled={busyId === selectedAppointment.id}>
                    {busyId === selectedAppointment.id ? <ActivityIndicator color={palette.danger} /> : <Text style={ui.dangerButtonText}>Cancel appointment</Text>}
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12 },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: palette.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: palette.border },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: palette.dark },
  tabText: { color: palette.subtext, fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  historyItem: { ...ui.row, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 9 },
  cancelled: { opacity: 0.58 },
  devTag: { backgroundColor: '#fef3c7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 8 },
  devTagText: { color: '#92400e', fontSize: 10, fontWeight: '900' },
  tokenBadge: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tokenBadgeText: { fontWeight: '900', fontSize: 15 },
  apptDateBox: { width: 48, borderRadius: radius.md, backgroundColor: palette.muted, borderWidth: 1, borderColor: palette.border, alignItems: 'center', paddingVertical: 7 },
  apptDay: { color: palette.ink, fontSize: 19, fontWeight: '900', lineHeight: 22 },
  apptMonth: { color: palette.subtext, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  historyBody: { flex: 1, minWidth: 0 },
  historyTitle: { color: palette.ink, fontWeight: '900', fontSize: 14 },
  historySub: { color: palette.subtext, fontSize: 12, marginTop: 2 },
  historyDate: { color: palette.faint, fontSize: 11, marginTop: 3 },
  historyActions: { alignItems: 'flex-end', gap: 6 },
  inlineBtn: { ...ui.secondaryButton, paddingVertical: 7, paddingHorizontal: 10 },
  inlineText: { ...ui.secondaryButtonText, fontSize: 11 },
  reviewPromptText: { color: palette.accent, fontSize: 11, fontWeight: '800', marginTop: 4 },
  priceText: { color: palette.accent, fontSize: 11, fontWeight: '800', marginTop: 3 },
  chipGreen: { backgroundColor: palette.successSoft, borderColor: '#bbf7d0' },
  chipGreenText: { color: palette.success },
  chipRed: { backgroundColor: palette.dangerSoft, borderColor: '#fecaca' },
  chipRedText: { color: palette.danger },
  emptyState: { margin: 16, marginTop: 40 },
  guestContainer: { justifyContent: 'center', padding: 24 },
  guestButton: { marginTop: 12, minWidth: 220 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,25,23,0.42)', justifyContent: 'center', padding: 22 },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(28,25,23,0.42)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: palette.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.border, padding: 18 },
  bottomCard: { backgroundColor: palette.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 1, borderColor: palette.border, padding: 18, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: palette.ink, fontSize: 19, fontWeight: '900' },
  modalSub: { color: palette.subtext, fontSize: 13, marginTop: 2, marginBottom: 18 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 18 },
  reviewInput: { ...ui.input, minHeight: 100, textAlignVertical: 'top', marginBottom: 14 },
  modalActions: { flexDirection: 'row', gap: 10 },
  detailRow: { marginBottom: 10 },
  detailLabel: { ...ui.label, marginBottom: 3 },
  detailValue: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  paymentBox: { ...ui.panelMuted, padding: 12, marginVertical: 10 },
  paymentTitle: { color: palette.ink, fontSize: 14, fontWeight: '900', marginBottom: 4 },
  paymentHelp: { color: palette.subtext, fontSize: 12, lineHeight: 17, marginBottom: 10 },
});
