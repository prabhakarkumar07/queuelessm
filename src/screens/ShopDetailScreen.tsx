import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Client, type IMessage } from '@stomp/stompjs';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { appointmentApi, attachmentApi, providerApi, shopApi, tokenApi } from '../lib/api';
import { getShopOperatingStatus } from '../lib/shopStatus';
import { useAuthStore } from '../store/authStore';
import type { Appointment, LiveQueue, QueueUpdateEvent, Service, ServiceProvider, Shop, Token } from '../types';
import { palette, radius, ui, useEnterAnimation } from '../theme/ui';

const WS_URL = (Constants.expoConfig?.extra?.wsUrl ?? 'ws://10.0.2.2:8080/ws-native')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');
// Safely ensure /ws-native suffix without double-replacing
const FINAL_WS_URL = WS_URL.endsWith('/ws') ? WS_URL.replace(/\/ws$/, '/ws-native') : WS_URL;

const CATEGORY_LABEL: Record<string, string> = {
  CLINIC: 'Clinic',
  SALON: 'Salon',
  BANK: 'Bank',
  GOVERNMENT: 'Govt',
  RESTAURANT: 'Food',
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

const ACTIVE_TOKEN_STATUSES = ['WAITING', 'CALLED', 'SERVING'];

function parseTimeParts(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

function roundToNextStep(date: Date, stepMinutes: number) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const remainder = next.getMinutes() % stepMinutes;
  if (remainder !== 0) next.setMinutes(next.getMinutes() + (stepMinutes - remainder));
  return next;
}

function buildAppointmentSlots(shop: Shop, service: Service | null) {
  if (!service) return [];
  const slots: string[] = [];
  const now = new Date();
  const { hour: openHour, minute: openMinute } = parseTimeParts(shop.openTime);
  const { hour: closeHour, minute: closeMinute } = parseTimeParts(shop.closeTime);
  const stepMinutes = Math.max(service.durationMins, 30);

  for (let dayOffset = 0; dayOffset < 3 && slots.length < 12; dayOffset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    
    // Check if shop is closed on this day
    const dayOfWeek = day.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    if (shop.closedDays?.includes(dayOfWeek as any)) continue;
    const start = new Date(day);
    start.setHours(openHour, openMinute, 0, 0);
    const end = new Date(day);
    end.setHours(closeHour, closeMinute, 0, 0);
    let cursor = new Date(start);
    if (dayOffset === 0 && cursor < now) cursor = roundToNextStep(new Date(now.getTime() + 15 * 60 * 1000), stepMinutes);
    while (cursor < end && slots.length < 12) {
      const slotEnd = new Date(cursor.getTime() + service.durationMins * 60 * 1000);
      if (slotEnd <= end) slots.push(cursor.toISOString());
      cursor = new Date(cursor.getTime() + stepMinutes * 60 * 1000);
    }
  }
  return slots;
}

export default function ShopDetailScreen() {
  const { id: shopId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const enterStyle = useEnterAnimation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isCustomer = isAuthenticated && user?.role === 'CUSTOMER';

  const [shop, setShop] = useState<Shop | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [queue, setQueue] = useState<LiveQueue | null>(null);
  const [activeToken, setActiveToken] = useState<Token | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [bookingAppointment, setBookingAppointment] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<Appointment | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [attachment, setAttachment] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const clientRef = useRef<Client | null>(null);

  const appointmentSlots = useMemo(() => (shop ? buildAppointmentSlots(shop, selectedService) : []), [shop, selectedService]);
  const operatingStatus = useMemo(() => (shop ? getShopOperatingStatus(shop) : null), [shop]);
  const filteredProviders = useMemo(
    () => selectedService ? providers.filter((provider) => !provider.serviceIds || provider.serviceIds.length === 0 || provider.serviceIds.includes(selectedService.id)) : providers,
    [providers, selectedService]
  );

  useEffect(() => {
    if (appointmentSlots.length === 0) {
      setSelectedSlot(null);
      return;
    }
    if (!selectedSlot || !appointmentSlots.includes(selectedSlot)) setSelectedSlot(appointmentSlots[0]);
  }, [appointmentSlots, selectedSlot]);

  useEffect(() => {
    if (selectedProvider && !filteredProviders.some((provider) => provider.id === selectedProvider.id)) setSelectedProvider(null);
  }, [filteredProviders, selectedProvider]);

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.03, duration: 850, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const loadShop = async () => {
      try {
        const [shopRes, servicesRes, providersRes, queueRes] = await Promise.all([
          shopApi.getById(shopId),
          shopApi.getServices(shopId),
          providerApi.getByShop(shopId),
          tokenApi.getLiveQueue(shopId),
        ]);
        if (cancelled) return;
        setShop(shopRes.data);
        setServices(servicesRes.data);
        setProviders(providersRes.data);
        setQueue(queueRes.data);
        if (isCustomer) {
          const { data } = await tokenApi.getMyHistory(0, 10);
          if (cancelled) return;
          setActiveToken(data.content.find((item: Token) => item.shopId === shopId && ACTIVE_TOKEN_STATUSES.includes(item.status)) ?? null);
        } else {
          setActiveToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadShop();
    return () => { cancelled = true; };
  }, [isCustomer, shopId]);

  useEffect(() => {
    if (!shopId) return;
    const client = new Client({
      brokerURL: FINAL_WS_URL,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: async () => {
        setWsConnected(true);
        try {
          const queueRes = await tokenApi.getLiveQueue(shopId);
          setQueue(queueRes.data);
          if (isCustomer) {
            const { data } = await tokenApi.getMyHistory(0, 10);
            setActiveToken(data.content.find((item: Token) => item.shopId === shopId && ACTIVE_TOKEN_STATUSES.includes(item.status)) ?? null);
          }
        } catch (e) {}

        client.subscribe(`/topic/queue/${shopId}`, async (msg: IMessage) => {
          try {
            const event: QueueUpdateEvent = JSON.parse(msg.body);
            setQueue((prev) => prev ? { ...prev, currentTokenDisplay: event.currentToken, totalWaiting: event.waitingCount, waitingTokens: event.waitingTokens, lastUpdated: event.timestamp } : prev);
            if (isCustomer) {
              const { data } = await tokenApi.getMyHistory(0, 10);
              setActiveToken(data.content.find((item: Token) => item.shopId === shopId && ACTIVE_TOKEN_STATUSES.includes(item.status)) ?? null);
            }
          } catch {}
        });
      },
      onDisconnect: () => setWsConnected(false),
      onWebSocketError: () => setWsConnected(false),
      onStompError: () => setWsConnected(false),
    });
    client.activate();
    clientRef.current = client;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (!client.connected) {
          client.activate();
        } else {
          tokenApi.getLiveQueue(shopId).then((res) => setQueue(res.data)).catch(() => {});
        }
      }
    });

    return () => { 
      subscription.remove();
      client.deactivate(); 
      clientRef.current = null; 
    };
  }, [isCustomer, shopId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setAttachment(result.assets[0]);
  };

  const uploadFile = async (entityId: string, type: 'TOKEN' | 'APPOINTMENT') => {
    if (!attachment) return;
    const formData = new FormData();
    // @ts-ignore React Native FormData accepts file-like objects.
    formData.append('file', { uri: attachment.uri, type: 'image/jpeg', name: `attachment_${Date.now()}.jpg` });
    formData.append('targetId', entityId);
    formData.append('targetType', type);
    await attachmentApi.upload(formData);
  };

  const promptLoginToBook = () => {
    Alert.alert('Login required', 'You can browse availability without an account. Login when you are ready to book.', [
      { text: 'Maybe later', style: 'cancel' },
      { text: 'Login', onPress: () => router.push({ pathname: '/login', params: { redirect: `/shop/${shopId}` } }) },
    ]);
  };

  const handleJoinQueue = async () => {
    if (!shopId || joining || !shop) return;
    if (!isCustomer) return promptLoginToBook();
    if (operatingStatus && !operatingStatus.isOpen) return Alert.alert('Shop closed', operatingStatus.detail);
    if (shop.queuePaused) return Alert.alert('Queue paused', 'The shop has temporarily paused taking new tokens. Please try again later.');
    setJoining(true);
    try {
      const { data } = await tokenApi.getToken({ shopId, serviceId: selectedService?.id, providerId: selectedProvider?.id });
      setActiveToken(data);
      if (attachment) {
        await uploadFile(data.id, 'TOKEN');
        setAttachment(null);
      }
      Alert.alert('Token issued', `Your token is ${data.displayNumber}. ${data.tokensAhead ?? 0} people are ahead. Estimated wait: ${data.estimatedWaitMins ?? 0} minutes.`);
    } catch (err: unknown) {
      Alert.alert('Error', (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to get token');
    } finally {
      setJoining(false);
    }
  };

  const handleBookAppointment = async () => {
    if (!shopId || bookingAppointment || !shop) return;
    if (!isCustomer) return promptLoginToBook();
    if (operatingStatus && !operatingStatus.isOpen) return Alert.alert('Shop closed', 'Appointments can only be booked during open hours right now.');
    if (shop.queuePaused) return Alert.alert('Queue paused', 'The shop has temporarily paused all new bookings. Please try again later.');
    if (!selectedService || !selectedSlot) return Alert.alert('Choose a time', 'Please select a service and a time slot first.');
    setBookingAppointment(true);
    try {
      const { data } = (await appointmentApi.book({ shopId, serviceId: selectedService.id, providerId: selectedProvider?.id, scheduledAt: selectedSlot })) as { data: Appointment };
      
      if (attachment) {
        await uploadFile(data.id, 'APPOINTMENT');
        setAttachment(null);
      }

      if (data.amount > 0 && data.paymentStatus === 'PENDING') {
        // Show payment overlay immediately for chargeable services
        setPendingPayment(data);
      } else {
        const shifted = data.scheduledAt !== selectedSlot;
        const message = shifted
          ? `Provider was busy, so we booked ${format(new Date(data.scheduledAt), 'dd MMM, hh:mm a')}.`
          : `Booked for ${format(new Date(data.scheduledAt), 'dd MMM, hh:mm a')}.`;
        
        Alert.alert('Appointment booked', message, [
          { text: 'View bookings', onPress: () => router.push('/(tabs)/bookings') },
          { text: 'Stay here', style: 'cancel' },
        ]);
      }
    } catch (err: unknown) {
      Alert.alert('Error', (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to book appointment');
    } finally {
      setBookingAppointment(false);
    }
  };

  const handleVerifyImmediatePayment = async (paymentId: string, signature: string) => {
    if (!pendingPayment) return;
    setVerifyingPayment(true);
    try {
      await appointmentApi.verifyPayment(pendingPayment.id, {
        razorpayPaymentId: paymentId,
        razorpayOrderId: pendingPayment.razorpayOrderId,
        razorpaySignature: signature,
      });
      setPendingPayment(null);
      Alert.alert('Success', 'Payment verified and appointment confirmed.', [
        { text: 'View bookings', onPress: () => router.push('/(tabs)/bookings') },
        { text: 'Done', style: 'cancel' }
      ]);
    } catch {
      Alert.alert('Error', 'Payment verification failed. You can try again from the Bookings tab.');
      setPendingPayment(null);
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleCancelToken = () => {
    if (!activeToken) return;
    Alert.alert('Cancel token', 'Leave this queue?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave queue', style: 'destructive', onPress: async () => {
        try { await tokenApi.cancel(activeToken.id); setActiveToken(null); }
        catch { Alert.alert('Error', 'Failed to cancel token'); }
      }},
    ]);
  };

  const openInMaps = async () => {
    if (!shop) return;
    const query = encodeURIComponent(`${shop.name}, ${shop.address}, ${shop.city}`);
    const url = shop.latitude != null && shop.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    try { await Linking.openURL(url); } catch { Alert.alert('Map unavailable', 'Unable to open maps right now.'); }
  };

  if (loading || !shop) {
    return <View style={ui.centered}><ActivityIndicator size="large" color={palette.accent} /></View>;
  }

  const brandColor = shop.primaryColor ?? palette.accent;

  return (
    <Animated.View style={[ui.screen, enterStyle]}>
      <ScrollView contentContainerStyle={ui.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={palette.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={[ui.panel, styles.hero]}>
          <View style={styles.heroTop}>
            {shop.logoUrl ? (
              <Image source={{ uri: shop.logoUrl }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={styles.categoryBox}>
                <Ionicons name={CATEGORY_ICON[shop.category] ?? 'storefront-outline'} size={22} color={palette.accent} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{shop.name}</Text>
              <Text style={styles.shopAddress}>{shop.address}, {shop.city}</Text>
            </View>
          </View>
          <View style={styles.metaLine}>
            <StatusChip label={shop.queuePaused ? 'Queue paused' : 'Queue active'} tone={shop.queuePaused ? 'danger' : 'success'} />
            {operatingStatus ? <StatusChip label={operatingStatus.label} tone={operatingStatus.isOpen ? 'success' : 'muted'} /> : null}
            <StatusChip label={`Avg ${shop.avgServiceMins} min`} />
          </View>
          {operatingStatus ? <Text style={styles.helpText}>{operatingStatus.detail}</Text> : null}
        </View>

        <TouchableOpacity style={[ui.row, styles.mapRow]} onPress={openInMaps}>
          <Ionicons name="map-outline" size={18} color={palette.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Open in Maps</Text>
            <Text style={styles.rowSub}>Directions and location details</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={palette.faint} />
        </TouchableOpacity>

        {queue ? (
          <View style={[ui.panel, styles.queuePanel]}>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, wsConnected && styles.liveDotOn]} />
              <Text style={styles.liveText}>{wsConnected ? 'Live updates' : 'Connecting'}</Text>
            </View>
            <View style={styles.queueStats}>
              <QueueStat label="Now" value={queue.currentTokenDisplay} animated scale={pulseAnim} color={brandColor} />
              <QueueStat label="Waiting" value={queue.totalWaiting} />
              <QueueStat label="Served" value={queue.totalServedToday} />
            </View>
          </View>
        ) : null}

        {!isCustomer ? (
          <View style={[ui.panelMuted, styles.infoPanel]}>
            <Text style={styles.rowTitle}>Browse availability freely</Text>
            <Text style={styles.rowSub}>Login only when you want to join or book.</Text>
            <TouchableOpacity style={[ui.primaryButton, { marginTop: 10 }]} onPress={() => router.push({ pathname: '/login', params: { redirect: `/shop/${shopId}` } })}>
              <Text style={ui.primaryButtonText}>Login to book</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isCustomer && activeToken ? (
          <View style={[ui.panel, styles.activeToken, { borderColor: `${brandColor}55` }]}>
            <View style={styles.rowBetween}>
              <Text style={ui.kicker}>Your token</Text>
              <Text style={[styles.activeTokenNumber, { color: activeToken.status === 'CALLED' ? palette.accent : brandColor }]}>{activeToken.displayNumber}</Text>
            </View>
            <Text style={styles.rowSub}>
              {activeToken.queuePosition != null && activeToken.queuePosition > 1 ? `${activeToken.queuePosition - 1} people ahead · Est. ${activeToken.estimatedWaitMins}m` : 'It is your turn.'}
            </Text>
            {activeToken.providerName ? <Text style={styles.rowSub}>With {activeToken.providerName}</Text> : null}
            <TouchableOpacity style={[ui.dangerButton, { marginTop: 12 }]} onPress={handleCancelToken}><Text style={ui.dangerButtonText}>Leave queue</Text></TouchableOpacity>
          </View>
        ) : null}

        {services.length > 0 ? (
          <Section title="Select service">
            {services.map((service) => (
              <SelectableRow key={service.id} selected={selectedService?.id === service.id} onPress={() => setSelectedService((current) => (current?.id === service.id ? null : service))}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{service.name}</Text>
                  {service.description ? <Text style={styles.rowSub}>{service.description}</Text> : null}
                  <Text style={styles.rowMeta}>{service.durationMins} min · {service.price === 0 ? 'Free' : `Rs ${service.price}`}</Text>
                </View>
              </SelectableRow>
            ))}
          </Section>
        ) : null}

        {providers.length > 0 ? (
          <Section title="Staff">
            <Text style={styles.sectionHelp}>{selectedService ? 'Filtered by selected service.' : 'Select a service to narrow staff options.'}</Text>
            <SelectableRow selected={selectedProvider === null} onPress={() => setSelectedProvider(null)}>
              <View style={{ flex: 1 }}><Text style={styles.rowTitle}>Any available staff</Text><Text style={styles.rowSub}>Fastest open counter</Text></View>
            </SelectableRow>
            {filteredProviders.map((provider) => (
              <SelectableRow key={provider.id} selected={selectedProvider?.id === provider.id} onPress={() => setSelectedProvider(provider)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{provider.name}</Text>
                  <Text style={styles.rowSub}>{provider.title}</Text>
                  {provider.serviceNames?.length ? <Text style={styles.rowMeta}>{provider.serviceNames.join(' · ')}</Text> : null}
                </View>
              </SelectableRow>
            ))}
            {selectedService && filteredProviders.length === 0 ? <View style={ui.empty}><Text style={ui.emptyTitle}>No matching staff</Text><Text style={ui.emptySub}>Use any available staff or choose another service.</Text></View> : null}
          </Section>
        ) : null}

        {selectedService ? (
          <Section title="Appointment">
            {isCustomer ? (
              <View style={[ui.panelMuted, styles.attachmentBox]}>
                <Text style={styles.rowSub}>Optional attachment for prescriptions, receipts, or notes.</Text>
                <TouchableOpacity style={[ui.secondaryButton, { marginTop: 9 }]} onPress={pickImage}><Text style={ui.secondaryButtonText}>{attachment ? 'Change file' : 'Attach file'}</Text></TouchableOpacity>
                {attachment ? <Text style={styles.rowMeta} numberOfLines={1}>{attachment.uri.split('/').pop()}</Text> : null}
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
              {appointmentSlots.map((slot) => (
                <TouchableOpacity key={slot} style={[styles.slotChip, selectedSlot === slot && styles.slotChipSelected]} onPress={() => setSelectedSlot(slot)}>
                  <Text style={[styles.slotDay, selectedSlot === slot && styles.slotSelectedText]}>{format(new Date(slot), 'dd MMM')}</Text>
                  <Text style={[styles.slotTime, selectedSlot === slot && styles.slotSelectedText]}>{format(new Date(slot), 'hh:mm a')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[ui.secondaryButton, styles.appointmentButton, (bookingAppointment || (operatingStatus != null && !operatingStatus.isOpen)) && styles.disabled]} onPress={handleBookAppointment} disabled={bookingAppointment || (operatingStatus != null && !operatingStatus.isOpen)}>
              {bookingAppointment ? <ActivityIndicator color={palette.text} /> : <Text style={ui.secondaryButtonText}>{operatingStatus && !operatingStatus.isOpen ? 'Shop closed' : 'Book appointment'}</Text>}
            </TouchableOpacity>
          </Section>
        ) : null}

        <TouchableOpacity style={[ui.primaryButton, styles.joinButton, { backgroundColor: brandColor }, (shop.queuePaused || joining || (operatingStatus != null && !operatingStatus.isOpen)) && styles.disabled]} onPress={handleJoinQueue} disabled={shop.queuePaused || joining || (operatingStatus != null && !operatingStatus.isOpen)}>
          {joining ? <ActivityIndicator color={palette.ink} /> : <Text style={ui.primaryButtonText}>{shop.queuePaused ? 'Queue paused' : operatingStatus && !operatingStatus.isOpen ? 'Shop closed' : isCustomer ? 'Get token' : 'Login to book'}</Text>}
        </TouchableOpacity>

        {queue && queue.waitingTokens.length > 0 ? (
          <Section title="Queue">
            {queue.waitingTokens.slice(0, 10).map((token, index) => (
              <View key={token.id} style={[styles.queueRow, token.id === activeToken?.id && styles.queueRowActive]}>
                <Text style={styles.queuePos}>{index + 1}</Text>
                <Text style={styles.queueToken}>{token.displayNumber}</Text>
                <Text style={styles.queueName} numberOfLines={1}>{token.userName ?? 'Customer'}</Text>
                {token.estimatedWaitMins != null ? <Text style={styles.queueWait}>{token.estimatedWaitMins}m</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}
      </ScrollView>

      {/* Payment Overlay */}
      {pendingPayment && (
        <View style={styles.paymentOverlay}>
          <View style={styles.paymentCard}>
            <Ionicons name="card" size={48} color="#3399cc" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.paymentTitle}>Complete Payment</Text>
            <Text style={styles.paymentText}>To confirm your appointment for {pendingPayment.serviceName}, please pay Rs {pendingPayment.amount}.</Text>
            
            <TouchableOpacity 
              style={[ui.primaryButton, { backgroundColor: '#3399cc', marginTop: 20 }]} 
              onPress={() => {
                setVerifyingPayment(true);
                // Simulate Razorpay SDK response
                setTimeout(() => {
                  handleVerifyImmediatePayment(
                    'pay_sim_' + Math.random().toString(36).substring(7),
                    'simulated_signature'
                  );
                }, 1500);
              }}
              disabled={verifyingPayment}
            >
              {verifyingPayment ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryButtonText}>Pay with Razorpay</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ marginTop: 15, alignSelf: 'center' }} 
              onPress={() => setPendingPayment(null)}
              disabled={verifyingPayment}
            >
              <Text style={{ color: palette.subtext, fontSize: 13, fontWeight: '700' }}>Cancel & pay later</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function StatusChip({ label, tone = 'muted' }: { label: string; tone?: 'success' | 'danger' | 'muted' }) {
  const style = tone === 'success' ? styles.chipGreen : tone === 'danger' ? styles.chipRed : {};
  const textStyle = tone === 'success' ? styles.chipGreenText : tone === 'danger' ? styles.chipRedText : {};
  return <View style={[ui.chip, style]}><Text style={[ui.chipText, textStyle]}>{label}</Text></View>;
}

function QueueStat({ label, value, animated, scale, color }: { label: string; value: string | number; animated?: boolean; scale?: Animated.Value; color?: string }) {
  const content = <Text style={[styles.queueStatValue, color ? { color } : null]}>{value}</Text>;
  return (
    <View style={styles.queueStat}>
      {animated && scale ? <Animated.View style={{ transform: [{ scale }] }}>{content}</Animated.View> : content}
      <Text style={styles.queueStatLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function SelectableRow({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity style={[styles.selectRow, selected && styles.selectRowSelected]} onPress={onPress}>
      {children}
      {selected ? <Ionicons name="checkmark-circle" size={21} color={palette.accent} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 12, paddingVertical: 6 },
  backText: { color: palette.text, fontSize: 13, fontWeight: '800' },
  hero: { padding: 14, marginBottom: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border },
  categoryBox: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: palette.accentSoft, borderWidth: 1, borderColor: '#fed7aa', alignItems: 'center', justifyContent: 'center' },
  shopName: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  shopAddress: { color: palette.subtext, fontSize: 13, marginTop: 3 },
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  helpText: { color: palette.subtext, fontSize: 12, lineHeight: 17, marginTop: 9 },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 10 },
  rowTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  rowSub: { color: palette.subtext, fontSize: 12, lineHeight: 18, marginTop: 2 },
  rowMeta: { color: palette.accent, fontSize: 11, fontWeight: '800', marginTop: 5 },
  queuePanel: { padding: 14, marginBottom: 10 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.faint },
  liveDotOn: { backgroundColor: palette.success },
  liveText: { color: palette.subtext, fontSize: 12, fontWeight: '800' },
  queueStats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border },
  queueStat: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRightWidth: 1, borderRightColor: palette.border },
  queueStatValue: { color: palette.ink, fontSize: 26, fontWeight: '900' },
  queueStatLabel: { color: palette.subtext, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 3 },
  infoPanel: { padding: 14, marginBottom: 10 },
  activeToken: { padding: 14, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  activeTokenNumber: { fontSize: 34, fontWeight: '900' },
  section: { marginTop: 8, marginBottom: 10 },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '900', marginBottom: 8 },
  sectionHelp: { color: palette.subtext, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  selectRow: { ...ui.row, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 8 },
  selectRowSelected: { borderColor: '#fed7aa', backgroundColor: palette.accentSoft },
  attachmentBox: { padding: 12, marginBottom: 10 },
  slotRow: { gap: 8, paddingRight: 18 },
  slotChip: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, minWidth: 98 },
  slotChipSelected: { borderColor: '#fed7aa', backgroundColor: palette.accentSoft },
  slotDay: { color: palette.subtext, fontSize: 12, fontWeight: '700' },
  slotTime: { color: palette.ink, fontSize: 13, fontWeight: '900', marginTop: 2 },
  slotSelectedText: { color: palette.accent },
  appointmentButton: { marginTop: 12 },
  joinButton: { marginTop: 2, marginBottom: 14 },
  disabled: { opacity: 0.45 },
  queueRow: { ...ui.row, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginBottom: 7 },
  queueRowActive: { borderColor: '#fed7aa', backgroundColor: palette.accentSoft },
  queuePos: { width: 22, textAlign: 'center', color: palette.faint, fontSize: 12, fontWeight: '800' },
  queueToken: { width: 54, color: palette.accent, fontSize: 15, fontWeight: '900' },
  queueName: { flex: 1, color: palette.text, fontSize: 13, fontWeight: '700' },
  queueWait: { color: palette.faint, fontSize: 12, fontWeight: '800' },
  chipGreen: { backgroundColor: palette.successSoft, borderColor: '#bbf7d0' },
  chipGreenText: { color: palette.success },
  chipRed: { backgroundColor: palette.dangerSoft, borderColor: '#fecaca' },
  chipRedText: { color: palette.danger },
  paymentOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 1000 },
  paymentCard: { width: '100%', backgroundColor: '#fff', borderRadius: radius.lg, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10 },
  paymentTitle: { fontSize: 20, fontWeight: '900', color: palette.ink, textAlign: 'center', marginBottom: 8 },
  paymentText: { fontSize: 14, color: palette.subtext, textAlign: 'center', lineHeight: 20 },
});
