import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { requestAccountDeletion } from '../api/auth';
import { ModalKeyboardAvoider } from './ModalKeyboardAvoider';

interface DeleteAccountModalProps {
  visible: boolean;
  grace_days?: number;
  onClose: () => void;
  // Called after the account is scheduled for deletion (or when the user must sign in again first).
  onSignOut: () => void;
}

const errorText = (err: any): { message: string; needsSignIn: boolean } => {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (status === 403) {
    return { message: typeof detail === 'string' ? detail : 'Please sign in again, then delete your account.', needsSignIn: true };
  }
  if (typeof detail === 'string') return { message: detail, needsSignIn: false };
  return { message: 'Something went wrong. Please check your connection and try again.', needsSignIn: false };
};

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ visible, grace_days = 15, onClose, onSignOut }) => {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; needsSignIn: boolean } | null>(null);
  const [doneOn, setDoneOn] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTyped('');
      setError(null);
      setDoneOn(null);
      setBusy(false);
    }
  }, [visible]);

  const canConfirm = typed.trim().toUpperCase() === 'DELETE' && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestAccountDeletion('DELETE');
      setDoneOn(new Date(result.scheduled_for).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={doneOn ? onSignOut : onClose}>
      <ModalKeyboardAvoider style={styles.avoider}>
        <View style={styles.backdrop}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            {doneOn ? (
              <View style={styles.body}>
                <CheckCircle2 size={34} color={COLORS.successGreen} />
                <Text style={styles.title}>Deletion scheduled</Text>
                <Text style={styles.p}>
                  Your account will be permanently deleted on {doneOn}. We have emailed you the details.
                </Text>
                <Text style={styles.p}>Changed your mind? Sign in again before that date and the deletion is cancelled.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={onSignOut} activeOpacity={0.85}>
                  <Text style={styles.primaryText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.body}>
                <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel="Close" hitSlop={12}>
                  <X size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
                <AlertTriangle size={30} color={COLORS.accentRed} />
                <Text style={styles.title}>Delete your account?</Text>
                <Text style={styles.p}>
                  You will be signed out everywhere. After {grace_days} days we permanently delete your profile, pets,
                  health records, reviews and support history.
                </Text>
                <Text style={styles.p}>
                  Records of completed orders and payments are kept without your name, phone or address, because tax law
                  requires it. You can cancel any time within {grace_days} days by signing in again.
                </Text>

                <Text style={styles.label}>Type DELETE to confirm</Text>
                <TextInput
                  style={styles.input}
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="DELETE"
                  placeholderTextColor={COLORS.textLight}
                  editable={!busy}
                  accessibilityLabel="Type DELETE to confirm"
                />

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error.message}</Text>
                    {error.needsSignIn && (
                      <TouchableOpacity onPress={onSignOut} style={styles.errorAction}>
                        <Text style={styles.errorActionText}>Sign out and sign in again</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.dangerBtn, !canConfirm && styles.btnDisabled]}
                  onPress={submit}
                  disabled={!canConfirm}
                  activeOpacity={0.85}
                >
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Delete my account</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={busy}>
                  <Text style={styles.cancelText}>Keep my account</Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </View>
      </ModalKeyboardAvoider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  avoider: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(44,24,16,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.canvas, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  body: { padding: 22, gap: 10 },
  close: { position: 'absolute', top: 16, right: 16, zIndex: 2 },
  title: { fontSize: 19, fontWeight: '800', color: COLORS.textCoffee, marginTop: 4 },
  p: { fontSize: 13.5, lineHeight: 20, color: COLORS.textMuted },
  label: { fontSize: 12, fontWeight: '800', color: COLORS.textCoffee, marginTop: 6, letterSpacing: 0.3 },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textCoffee,
    letterSpacing: 1,
  },
  errorBox: { backgroundColor: COLORS.accentRedTintBg, borderColor: COLORS.accentRedTintBorder, borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  errorText: { fontSize: 13, color: COLORS.accentRedTintText, lineHeight: 19 },
  errorAction: { alignSelf: 'flex-start' },
  errorActionText: { fontSize: 13, fontWeight: '800', color: COLORS.accentRedTintText, textDecorationLine: 'underline' },
  dangerBtn: { backgroundColor: COLORS.accentRed, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6, minHeight: 50, justifyContent: 'center' },
  primaryBtn: { backgroundColor: COLORS.forestGreen, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  primaryText: { fontSize: 14.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.45 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 13.5, fontWeight: '700', color: COLORS.textMuted },
});

export default DeleteAccountModal;
