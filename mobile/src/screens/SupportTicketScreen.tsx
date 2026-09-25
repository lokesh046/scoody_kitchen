import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Send, Package, Stethoscope } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
import {
  fetchMySupportTicketById,
  replyToMySupportTicket,
  SupportTicketDetailResponse,
  SupportTicketStatus,
} from '../api/support';

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS: Record<SupportTicketStatus, { bg: string; text: string }> = {
  open: { bg: '#FFF8E8', text: COLORS.brandGold },
  in_progress: { bg: '#E8F0FE', text: '#1D5FBF' },
  resolved: { bg: '#EDF5F0', text: COLORS.forestGreen },
  closed: { bg: '#F1F1F1', text: COLORS.textMuted },
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function SupportTicketScreen({ navigation, route }: any) {
  const { ticketId } = route?.params || {};

  const [ticket, setTicket] = useState<SupportTicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const data = await fetchMySupportTicketById(ticketId);
      setTicket(data);
    } catch {
      Alert.alert('Error', 'Could not load this ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSend = async () => {
    if (!replyBody.trim() || !ticket) return;
    setSending(true);
    try {
      await replyToMySupportTicket(ticket.id, replyBody.trim());
      setReplyBody('');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not send your reply.');
    } finally {
      setSending(false);
    }
  };

  if (loading || !ticket) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <ArrowLeft size={20} color={COLORS.textCoffee} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ticket</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
        </View>
      </SafeAreaView>
    );
  }

  const statusStyle = STATUS_COLORS[ticket.status];
  const isSettled = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={20} color={COLORS.textCoffee} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{ticket.subject}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusPillText, { color: statusStyle.text }]}>{STATUS_LABEL[ticket.status]}</Text>
            </View>
          </View>

          {isSettled && (
            <Text style={styles.reopenHint}>
              This ticket is {STATUS_LABEL[ticket.status].toLowerCase()}. Replying will reopen it if you still need help.
            </Text>
          )}

          {ticket.order && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Package size={13} color={COLORS.brandGold} />
                <Text style={styles.summaryHeaderText}>About Order #{ticket.order.id}</Text>
              </View>
              <Text style={styles.summaryBody}>
                {ticket.order.items.length} item{ticket.order.items.length === 1 ? '' : 's'} &middot; ₹{ticket.order.total_amount} &middot; {ticket.order.status}
              </Text>
            </View>
          )}

          {ticket.consultation && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Stethoscope size={13} color={COLORS.brandGold} />
                <Text style={styles.summaryHeaderText}>About Your Consultation</Text>
              </View>
              <Text style={styles.summaryBody}>
                {new Date(ticket.consultation.scheduled_at).toLocaleString()} with {ticket.consultation.doctor?.user?.first_name || 'your doctor'} &middot; {ticket.consultation.status}
              </Text>
            </View>
          )}

          {ticket.messages.map((m) => (
            <View
              key={m.id}
              style={[styles.messageBubble, m.is_staff_reply ? styles.staffBubble : styles.customerBubble]}
            >
              <Text style={styles.messageMeta}>
                {m.is_staff_reply ? "Scooby's Kitchen Support" : 'You'} &middot; {formatWhen(m.created_at)}
              </Text>
              <Text style={styles.messageBody}>{m.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.replyBar}>
          <TextInput
            value={replyBody}
            onChangeText={setReplyBody}
            placeholder="Write a reply..."
            placeholderTextColor={COLORS.textLight}
            style={styles.replyInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!replyBody.trim() || sending) && styles.btnDisabled]}
            onPress={handleSend}
            disabled={!replyBody.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send reply"
            accessibilityState={{ busy: sending }}
          >
            {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Send size={16} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    backgroundColor: COLORS.canvas,
  },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: COLORS.cardAlt },
  headerTitle: { fontSize: 15, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 10, paddingBottom: 24 },
  statusRow: { flexDirection: 'row', marginBottom: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontFamily: FONT_BODY_BOLD, letterSpacing: 0.4 },
  reopenHint: { fontSize: 11.5, fontFamily: FONT_BODY, color: COLORS.textMuted, marginBottom: 4 },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryHeaderText: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: COLORS.brandGold, textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryBody: { fontSize: 12.5, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  staffBubble: { backgroundColor: COLORS.card, borderColor: COLORS.kraftBorder, alignSelf: 'flex-start' },
  customerBubble: { backgroundColor: '#EDF5F0', borderColor: COLORS.forestGreen, alignSelf: 'flex-end' },
  messageMeta: { fontSize: 9.5, fontFamily: LEDGER_MONO, color: COLORS.textMuted, marginBottom: 4 },
  messageBody: { fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textCoffee, lineHeight: 18 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    backgroundColor: COLORS.canvas,
  },
  replyInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textCoffee,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
});
