import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/useTheme';

interface NotifCategory {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: NotifCategory[] = [
  { key: 'queue_updates', label: 'Queue Updates', description: 'Position changes, turn approaching, called notifications', icon: 'ticket-outline' },
  { key: 'appointment_reminders', label: 'Appointment Reminders', description: 'Upcoming appointment alerts and confirmations', icon: 'calendar-outline' },
  { key: 'promotions', label: 'Promotional Offers', description: 'Deals, discounts, and special offers from shops', icon: 'megaphone-outline' },
  { key: 'loyalty_rewards', label: 'Loyalty & Rewards', description: 'Points earned, tier upgrades, and reward notifications', icon: 'gift-outline' },
];

const STORAGE_KEY = 'notificationPreferences';

export default function NotificationPreferencesScreen() {
  const { colors } = useTheme();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setPrefs(JSON.parse(stored));
      } else {
        // Default all to enabled
        const defaults: Record<string, boolean> = {};
        CATEGORIES.forEach((c) => { defaults[c.key] = true; });
        setPrefs(defaults);
      }
      setLoaded(true);
    });
  }, []);

  const toggleCategory = async (key: string) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  if (!loaded) return null;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.ink }]}>Notifications</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>
        Choose which notifications you want to receive.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {CATEGORIES.map((category, i) => (
          <View
            key={category.key}
            style={[
              styles.row,
              i < CATEGORIES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
              <Ionicons name={category.icon} size={18} color={colors.text} />
            </View>
            <View style={styles.textBox}>
              <Text style={[styles.label, { color: colors.ink }]}>{category.label}</Text>
              <Text style={[styles.desc, { color: colors.subtext }]}>{category.description}</Text>
            </View>
            <Switch
              value={prefs[category.key] ?? true}
              onValueChange={() => toggleCategory(category.key)}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#ffffff"
            />
          </View>
        ))}
      </View>

      <Text style={[styles.footnote, { color: colors.faint }]}>
        You can also manage notifications in your device settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 16 },
  card: { borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  textBox: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700' },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  footnote: { fontSize: 11, marginTop: 16, textAlign: 'center' },
});
