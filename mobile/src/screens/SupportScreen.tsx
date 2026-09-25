import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Headset, Plus, X, ChevronRight, Package, Stethoscope } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
import {
  createSupportTicket,
  fetchMySupportTickets,
  SupportTicketCategory,
  SupportTicketResponse,
  SupportTicketStatus,
} from '../api/support';
import { fetchMyOrders, Order } from '../api/orders';
import { fetchMyConsultations, Consultation } from '../api/consultations';

const STATUS_COLORS: Record<SupportTicketStatus, { bg: string; text: string }> = {
  open: { bg: '#FFF8E8', text: COLORS.brandGold },
  in_progress: { bg: '#E8F0FE', text: '#1D5FBF' },
  resolved: { bg: '#EDF5F0', text: COLORS.forestGreen },
  closed: { bg: '#F1F1F1', text: COLORS.textMuted },
};

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const CATEGORY_OPTIONS: { value: SupportTicketCategory; label: string }[] = [
  { value: 'order_issue', label: 'Order Issue' },
  { value: 'consultation_issue', label: 'Consultation Issue' },
  { value: 'product_issue', label: 'Product Issue' },
  { value: 'payment', label: 'Payment' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function SupportScreen({ navigation }: any) {
  const [tickets, setTickets] = useState<SupportTicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<SupportTicketCategory>('other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [myConsultations, setMyConsultations] = useState<Consultation[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);

  const lastFetchedRef = useRef(0);
  const load = useCallback(async (isRefresh = false) => {
    // Skip refetching if we already have a recent copy — avoids a redundant
    // network round-trip every time this tab regains focus.
    if (!isRefresh && Date.now() - lastFetchedRef.current < 12000) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const page = await fetchMySupportTickets(1, 50);
      setTickets(page.items);
      setError(null);
      lastFetchedRef.current = Date.now();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load your support tickets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleCategoryChange = async (value: SupportTicketCategory) => {
    setCategory(value);
    setSelectedOrderId(null);
    setSelectedConsultationId(null);
    if (value === 'order_issue' && myOrders.length === 0) {
      try {
        setMyOrders(await fetchMyOrders());
      } catch {
        // Picker is optional — a failed fetch just leaves the list empty.
      }
    } else if (value === 'consultation_issue' && myConsultations.length === 0) {
      try {
        const page = await fetchMyConsultations({ limit: 50 });
        setMyConsultations(page.items);
      } catch {
        // Same as above — non-fatal, the ticket can still be submitted.
      }
    }
  };

  const handleSubmit = async () => {
    if (subject.trim().length < 3) {
      Alert.alert('Subject too short', 'Please enter at least 3 characters.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Message required', 'Please describe your issue.');
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await createSupportTicket({
        subject: subject.trim(),
        category,
        order_id: category === 'order_issue' ? selectedOrderId : null,
        consultation_id: category === 'consultation_issue' ? selectedConsultationId : null,
        message: message.trim(),
      });
      setShowForm(false);
      setSubject('');
      setMessage('');
      setCategory('other');
      setSelectedOrderId(null);
      setSelectedConsultationId(null);
      navigation.navigate('SupportTicket', { ticketId: ticket.id });
      load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not create your ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: SupportTicketResponse }) => {
      const statusStyle = STATUS_COLORS[item.status];
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('SupportTicket', { ticketId: item.id })}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Support ticket: ${item.subject}, status ${STATUS_LABEL[item.status]}`}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{STATUS_LABEL[item.status]}</Text>
            </View>
            <Text style={styles.whenText}>{formatWhen(item.created_at)}</Text>
          </View>
          <View style={styles.cardBottomRow}>
            <Text style={styles.subjectText} numberOfLines={1}>{item.subject}</Text>
            <ChevronRight size={16} color={COLORS.textLight} />
          </View>
        </TouchableOpacity>
      );
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconCircle}>
            <Headset size={18} color={COLORS.brandGold} />
          </View>
          <Text style={styles.headerTitle}>Support</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setShowForm((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showForm ? 'Cancel new ticket' : 'Start a new support ticket'}
        >
          {showForm ? <X size={16} color={COLORS.textCoffee} /> : <Plus size={16} color={COLORS.textCoffee} />}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.fieldLabelSm}>What's this about?</Text>
            <View style={styles.categoryRow}>
              {CATEGORY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => handleCategoryChange(opt.value)}
                  style={[styles.categoryChip, category === opt.value && styles.categoryChipActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Category ${opt.label}`}
                  accessibilityState={{ selected: category === opt.value }}
                >
                  <Text style={[styles.categoryChipText, category === opt.value && styles.categoryChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {category === 'order_issue' && (
              <>
                <Text style={styles.fieldLabelSm}>Which order? (optional)</Text>
                <ScrollView style={styles.pickerBox} nestedScrollEnabled>
                  {myOrders.length === 0 ? (
                    <Text style={styles.pickerEmptyText}>No orders found on your account.</Text>
                  ) : (
                    myOrders.map((order) => (
                      <TouchableOpacity
                        key={order.id}
                        onPress={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                        style={[styles.pickerRow, selectedOrderId === order.id && styles.pickerRowActive]}
                        accessibilityRole="button"
                        accessibilityLabel={`Order ${order.id}`}
                        accessibilityState={{ selected: selectedOrderId === order.id }}
                      >
                        <Package size={13} color={selectedOrderId === order.id ? '#FFFFFF' : COLORS.textCoffee} />
                        <Text style={[styles.pickerRowText, selectedOrderId === order.id && styles.pickerRowTextActive]}>
                          Order #{order.id} &middot; ₹{order.total_amount}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </>
            )}

            {category === 'consultation_issue' && (
              <>
                <Text style={styles.fieldLabelSm}>Which consultation? (optional)</Text>
                <ScrollView style={styles.pickerBox} nestedScrollEnabled>
                  {myConsultations.length === 0 ? (
                    <Text style={styles.pickerEmptyText}>No consultations found on your account.</Text>
                  ) : (
                    myConsultations.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setSelectedConsultationId(selectedConsultationId === c.id ? null : c.id)}
                        style={[styles.pickerRow, selectedConsultationId === c.id && styles.pickerRowActive]}
                        accessibilityRole="button"
                        accessibilityLabel={`Consultation on ${c.scheduled_at}`}
                        accessibilityState={{ selected: selectedConsultationId === c.id }}
                      >
                        <Stethoscope size={13} color={selectedConsultationId === c.id ? '#FFFFFF' : COLORS.textCoffee} />
                        <Text style={[styles.pickerRowText, selectedConsultationId === c.id && styles.pickerRowTextActive]} numberOfLines={1}>
                          {new Date(c.scheduled_at).toLocaleDateString()} &middot; {c.reason}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </>
            )}

            <Text style={styles.fieldLabelSm}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. My order arrived damaged"
              placeholderTextColor={COLORS.textLight}
              style={styles.input}
              maxLength={200}
            />

            <Text style={styles.fieldLabelSm}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what happened..."
              placeholderTextColor={COLORS.textLight}
              style={styles.textArea}
              multiline
              maxLength={4000}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit ticket"
              accessibilityState={{ busy: submitting }}
            >
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Submit Ticket</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={COLORS.forestGreen} />
          </View>
        ) : error ? (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load()} accessibilityRole="button" accessibilityLabel="Retry">
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.forestGreen} />}
            ListEmptyComponent={
              <View style={styles.centerFill}>
                <Text style={styles.emptyText}>No support tickets yet. Need help with something?</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    backgroundColor: COLORS.canvas,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.cardAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee },
  newBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.cardAlt, alignItems: 'center', justifyContent: 'center' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textMuted, textAlign: 'center' },
  emptyText: { fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textMuted, textAlign: 'center' },
  retryBtn: { backgroundColor: COLORS.forestGreen, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  listContent: { padding: 16, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 9.5, fontFamily: FONT_BODY_BOLD, letterSpacing: 0.4 },
  whenText: { fontSize: 10.5, fontFamily: LEDGER_MONO, color: COLORS.textMuted },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subjectText: { fontSize: 14, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee, flex: 1 },
  formCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  fieldLabelSm: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: COLORS.textMuted, textTransform: 'uppercase', marginTop: 4 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: COLORS.kraftBorder, backgroundColor: COLORS.canvas },
  categoryChipActive: { backgroundColor: COLORS.brandGold, borderColor: COLORS.brandGold },
  categoryChipText: { fontSize: 10.5, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  categoryChipTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: COLORS.textCoffee,
  },
  textArea: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: COLORS.textCoffee,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitBtn: { backgroundColor: COLORS.forestGreen, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 2 },
  submitBtnText: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
  pickerBox: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    backgroundColor: COLORS.canvas,
    padding: 6,
    gap: 4,
  },
  pickerEmptyText: { fontSize: 11.5, fontFamily: FONT_BODY, color: COLORS.textMuted, padding: 8 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
  },
  pickerRowActive: { backgroundColor: COLORS.brandGold, borderColor: COLORS.brandGold },
  pickerRowText: { fontSize: 11.5, fontFamily: FONT_BODY, color: COLORS.textCoffee, flex: 1 },
  pickerRowTextActive: { color: '#FFFFFF' },
});
