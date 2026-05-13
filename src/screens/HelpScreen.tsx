import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../theme/useTheme';

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

const FAQS: FAQ[] = [
  { category: 'Queue', question: 'How do I join a queue?', answer: 'Open a shop, select a service (optional), and tap "Get Token". You will receive a digital token with your position.' },
  { category: 'Queue', question: 'Can I cancel my token?', answer: 'Yes. Go to your active token on the Home screen and tap "Cancel token". You will leave the queue immediately.' },
  { category: 'Queue', question: 'What happens when my turn comes?', answer: 'You will receive a push notification. The shop staff will call your token number. Arrive within the grace period to be served.' },
  { category: 'Appointments', question: 'How do I book an appointment?', answer: 'Open a shop, select a service, choose a time slot, and tap "Book appointment". For paid services, complete the payment to confirm.' },
  { category: 'Appointments', question: 'Can I reschedule?', answer: 'Yes. Go to Bookings tab, find your appointment, and tap "Reschedule" to pick a new time slot.' },
  { category: 'Payments', question: 'What payment methods are supported?', answer: 'We support UPI, debit/credit cards, and net banking through Razorpay.' },
  { category: 'Payments', question: 'How do refunds work?', answer: 'Refunds for cancelled appointments are processed within 5-7 business days to your original payment method.' },
  { category: 'Account', question: 'How do I change my password?', answer: 'Go to Profile > tap your name > Change Password. Enter your current password and set a new one.' },
  { category: 'Account', question: 'Can I delete my account?', answer: 'Contact support through the form below. We will process your account deletion request within 48 hours.' },
];

export default function HelpScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactCategory, setContactCategory] = useState('General');

  const filteredFaqs = search.trim()
    ? FAQS.filter((f) => f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase()))
    : FAQS;

  const handleSubmitTicket = () => {
    if (!contactMessage.trim()) {
      Toast.show({ type: 'error', text1: 'Please describe your issue' });
      return;
    }
    // In production, this would call a support API
    Toast.show({ type: 'success', text1: 'Support request submitted', text2: 'We will get back to you within 24 hours.' });
    setContactMessage('');
    setShowContactForm(false);
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.ink }]}>Help & Support</Text>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>Find answers or contact our team.</Text>

      {/* Search */}
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.faint} />
        <TextInput
          style={[styles.searchInput, { color: colors.ink }]}
          placeholder="Search help articles..."
          placeholderTextColor={colors.faint}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* FAQ List */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {filteredFaqs.length === 0 ? (
          <View style={styles.emptyFaq}>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>No matching articles found.</Text>
          </View>
        ) : (
          filteredFaqs.map((faq, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.faqRow, i < filteredFaqs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => setExpandedIndex(expandedIndex === i ? null : i)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.categoryText, { color: colors.subtext }]}>{faq.category}</Text>
                </View>
                <Text style={[styles.question, { color: colors.ink }]}>{faq.question}</Text>
                <Ionicons name={expandedIndex === i ? 'chevron-up' : 'chevron-down'} size={16} color={colors.faint} />
              </View>
              {expandedIndex === i && (
                <Text style={[styles.answer, { color: colors.text }]}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Contact Support */}
      <TouchableOpacity
        style={[styles.contactButton, { backgroundColor: colors.accent }]}
        onPress={() => setShowContactForm(!showContactForm)}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.surface} />
        <Text style={[styles.contactButtonText, { color: colors.surface }]}>
          {showContactForm ? 'Hide contact form' : 'Contact Support'}
        </Text>
      </TouchableOpacity>

      {showContactForm && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
          <View style={styles.formInner}>
            <Text style={[styles.formLabel, { color: colors.text }]}>Describe your issue</Text>
            <TextInput
              style={[styles.textarea, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
              placeholder="What do you need help with?"
              placeholderTextColor={colors.faint}
              value={contactMessage}
              onChangeText={setContactMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.accent }]} onPress={handleSubmitTicket}>
              <Text style={[styles.submitText, { color: colors.surface }]}>Submit Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, borderWidth: 1, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  card: { borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  faqRow: { padding: 14 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  categoryText: { fontSize: 10, fontWeight: '700' },
  question: { flex: 1, fontSize: 13, fontWeight: '700' },
  answer: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  emptyFaq: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13 },
  contactButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 6, marginTop: 16 },
  contactButtonText: { fontSize: 14, fontWeight: '700' },
  formInner: { padding: 14, gap: 10 },
  formLabel: { fontSize: 12, fontWeight: '600' },
  textarea: { borderRadius: 6, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 100 },
  submitBtn: { paddingVertical: 12, borderRadius: 6, alignItems: 'center' },
  submitText: { fontSize: 14, fontWeight: '700' },
});
