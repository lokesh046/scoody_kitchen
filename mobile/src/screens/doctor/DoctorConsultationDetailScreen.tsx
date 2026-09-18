import React, { useCallback, useEffect, useState } from 'react';
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
import { ArrowLeft, Video, CheckCircle2, XCircle, FileText } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../../theme/typography';
import {
  getDoctorConsultationById,
  updateConsultationStatus,
  createHealthRecord,
  ConsultationResponse,
} from '../../api/doctor';
import { joinConsultation } from '../../api/consultations';
import { useAuthStore } from '../../store/authStore';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function DoctorConsultationDetailScreen({ navigation, route }: any) {
  const { consultationId } = route?.params || {};
  const { user } = useAuthStore();

  const [consultation, setConsultation] = useState<ConsultationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [joining, setJoining] = useState(false);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    if (!consultationId) return;
    setLoading(true);
    try {
      const data = await getDoctorConsultationById(consultationId);
      setConsultation(data);
    } catch {
      Alert.alert('Error', 'Could not load this consultation.');
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdateStatus = async (status: string) => {
    if (!consultation) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateConsultationStatus(consultation.id, status);
      setConsultation(updated);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleJoinCall = async () => {
    if (!consultation) return;
    setJoining(true);
    try {
      const joinData = await joinConsultation(consultation.id);
      const displayName = encodeURIComponent(
        `Dr. ${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Doctor'
      );
      const domain = joinData.jitsi_domain || 'meet.lokeshm.me';
      const room = joinData.room_name;
      const token = joinData.jitsi_token;
      const directRoomUrl = `https://${domain}/${room}?jwt=${token}#config.prejoinPageEnabled=false&config.prejoinConfig.enabled=false&config.disableDeepLinking=true&config.p2p.enabled=true&userInfo.displayName="${displayName}"`;

      navigation.navigate('VideoCall', {
        consultationId: consultation.id,
        roomUrl: directRoomUrl,
        allowedHost: domain,
        petId: consultation.pet_id,
        petName: consultation.pet?.name,
      });
    } catch (err: any) {
      Alert.alert(
        'Video Consultation',
        err?.response?.data?.detail || 'The video room is not available yet.'
      );
    } finally {
      setJoining(false);
    }
  };

  const handleSaveNote = async () => {
    if (!consultation || !diagnosis.trim()) return;
    setSavingNote(true);
    try {
      await createHealthRecord(consultation.pet_id, {
        record_type: 'diagnosis',
        description: diagnosis.trim(),
        notes: notes.trim() || undefined,
      });
      Alert.alert('Saved', 'Health record added to this pet’s history.');
      setDiagnosis('');
      setNotes('');
      setShowNoteForm(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to save health record.');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading || !consultation) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color={COLORS.textCoffee} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Consultation</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
        </View>
      </SafeAreaView>
    );
  }

  const customerName =
    `${consultation.customer?.first_name || ''} ${consultation.customer?.last_name || ''}`.trim() ||
    consultation.customer?.email ||
    'Pet Parent';
  const canJoin = consultation.status === 'CONFIRMED' || consultation.status === 'APPROVED' || consultation.status === 'IN_PROGRESS';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={COLORS.textCoffee} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Consultation</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.statusLabel}>{consultation.status}</Text>
            <Text style={styles.petName}>{consultation.pet?.name || 'Pet'}</Text>
            <Text style={styles.meta}>
              {consultation.pet?.species || ''} {consultation.pet?.breed ? `(${consultation.pet.breed})` : ''}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>Pet Parent</Text>
            <Text style={styles.fieldValue}>{customerName}</Text>
            <Text style={styles.fieldLabel}>Scheduled</Text>
            <Text style={styles.fieldValue}>{formatWhen(consultation.scheduled_at)} ({consultation.duration_minutes} min)</Text>
            <Text style={styles.fieldLabel}>Reason</Text>
            <Text style={styles.fieldValue}>{consultation.reason || 'Not specified'}</Text>
            {!!consultation.customer_notes && (
              <>
                <Text style={styles.fieldLabel}>Notes from Pet Parent</Text>
                <Text style={styles.fieldValue}>{consultation.customer_notes}</Text>
              </>
            )}
          </View>

          {consultation.status === 'PENDING' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn, updatingStatus && styles.btnDisabled]}
                onPress={() => handleUpdateStatus('CONFIRMED')}
                disabled={updatingStatus}
                accessibilityRole="button"
                accessibilityLabel="Approve consultation"
              >
                <CheckCircle2 size={16} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn, updatingStatus && styles.btnDisabled]}
                onPress={() => handleUpdateStatus('CANCELLED')}
                disabled={updatingStatus}
                accessibilityRole="button"
                accessibilityLabel="Decline consultation"
              >
                <XCircle size={16} color={COLORS.ctaBrown} />
                <Text style={[styles.actionBtnText, { color: COLORS.ctaBrown }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}

          {canJoin && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.joinBtn, joining && styles.btnDisabled]}
                onPress={handleJoinCall}
                disabled={joining}
                accessibilityRole="button"
                accessibilityLabel="Join video call"
                accessibilityState={{ busy: joining }}
              >
                {joining ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Video size={16} color="#FFFFFF" />}
                <Text style={styles.actionBtnText}>Join Video Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.completeBtn, updatingStatus && styles.btnDisabled]}
                onPress={() => handleUpdateStatus('COMPLETED')}
                disabled={updatingStatus}
                accessibilityRole="button"
                accessibilityLabel="Mark consultation completed"
              >
                <Text style={styles.actionBtnTextDark}>Mark Completed</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.noteCard}>
            <TouchableOpacity
              style={styles.noteToggle}
              onPress={() => setShowNoteForm((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showNoteForm ? 'Hide health record form' : 'Add a health record for this pet'}
            >
              <FileText size={16} color={COLORS.brandGold} />
              <Text style={styles.noteToggleText}>Add Health Record for {consultation.pet?.name || 'this pet'}</Text>
            </TouchableOpacity>

            {showNoteForm && (
              <View style={styles.noteForm}>
                <Text style={styles.fieldLabelSm}>Diagnosis / Findings</Text>
                <TextInput
                  value={diagnosis}
                  onChangeText={setDiagnosis}
                  placeholder="e.g. Mild ear infection, prescribed drops"
                  placeholderTextColor={COLORS.textLight}
                  style={styles.textArea}
                  multiline
                />
                <Text style={styles.fieldLabelSm}>Additional Notes (optional)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Follow-up instructions, medication schedule..."
                  placeholderTextColor={COLORS.textLight}
                  style={styles.textArea}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.saveNoteBtn, (!diagnosis.trim() || savingNote) && styles.btnDisabled]}
                  onPress={handleSaveNote}
                  disabled={!diagnosis.trim() || savingNote}
                  accessibilityRole="button"
                  accessibilityLabel="Save health record"
                  accessibilityState={{ disabled: !diagnosis.trim() || savingNote, busy: savingNote }}
                >
                  {savingNote ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveNoteBtnText}>Save Record</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
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
  headerTitle: { fontSize: 16, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 16,
    padding: 16,
    gap: 3,
  },
  statusLabel: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.brandGold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  petName: { fontSize: 19, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee, marginTop: 2 },
  meta: { fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textMuted },
  divider: { height: 1, backgroundColor: COLORS.kraftBorder, marginVertical: 10 },
  fieldLabel: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: COLORS.textMuted, textTransform: 'uppercase', marginTop: 8 },
  fieldValue: { fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textCoffee, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  approveBtn: { backgroundColor: COLORS.forestGreen },
  declineBtn: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.ctaBrown },
  joinBtn: { backgroundColor: COLORS.forestGreen },
  completeBtn: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.kraftBorder },
  actionBtnText: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  actionBtnTextDark: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  btnDisabled: { opacity: 0.5 },

  noteCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    padding: 4,
  },
  noteToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  noteToggleText: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  noteForm: { padding: 12, paddingTop: 0, gap: 8 },
  fieldLabelSm: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: COLORS.textMuted, textTransform: 'uppercase' },
  textArea: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: COLORS.textCoffee,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveNoteBtn: {
    backgroundColor: COLORS.brandGold,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 2,
  },
  saveNoteBtnText: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
});
