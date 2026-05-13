import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, type ThemeMode } from '../store/themeStore';
import { useTheme } from '../theme/useTheme';

const OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { mode: 'light', label: 'Light', icon: 'sunny-outline', description: 'Always use light theme' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline', description: 'Always use dark theme' },
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline', description: 'Follow device settings' },
];

export default function ThemeSettingsScreen() {
  const { colors } = useTheme();
  const currentMode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>Appearance</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>Choose how QueueLess looks on your device.</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {OPTIONS.map((option, i) => {
            const isActive = currentMode === option.mode;
            return (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.row,
                  i < OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  isActive && { backgroundColor: colors.muted },
                ]}
                onPress={() => setMode(option.mode)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: isActive ? colors.accent : colors.muted }]}>
                  <Ionicons name={option.icon} size={18} color={isActive ? colors.surface : colors.text} />
                </View>
                <View style={styles.textBox}>
                  <Text style={[styles.label, { color: colors.ink }]}>{option.label}</Text>
                  <Text style={[styles.desc, { color: colors.subtext }]}>{option.description}</Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 16 },
  card: { borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  textBox: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700' },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
});
