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
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LogOut, Stethoscope } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD } from '../../theme/typography';
import { getDoctorProfile, updateDoctorProfile, DoctorResponse } from '../../api/doctor';
import { useAuthStore } from '../../store/authStore';

export default function DoctorProfileScreen() {
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState<DoctorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState('');
  const [fee, setFee] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDoctorProfile();
      setProfile(data);
      setBio(data.bio || '');
      setFee(data.consultation_fee || '');
      setIsAvailable(data.is_available);
    } catch {
      Alert.alert('Error', 'Could not load your doctor profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateDoctorProfile({
        bio: bio.trim() || null,
        consultation_fee: fee.trim() || undefined,
        is_available: isAvailable,
      });
      setProfile(updated);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIconCircle}>
          <Stethoscope size={18} color={COLORS.brandGold} />
        </View>
        <Text style={styles.headerTitle}>Doctor Profile</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.identityCard}>
            <Text style={styles.doctorName}>
              Dr. {user?.first_name || ''} {user?.last_name || ''}
            </Text>
            <Text style={styles.specialization}>{profile.specialization}</Text>
            <Text style={styles.meta}>{profile.qualification} • {profile.experience_years} yrs experience</Text>
            {profile.is_verified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Consultation Fee (₹)</Text>
            <TextInput
              value={fee}
              onChangeText={(t) => setFee(t.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 499"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell pet parents about your experience..."
              placeholderTextColor={COLORS.textLight}
              style={[styles.input, styles.textArea]}
              multiline
            />
          </View>

          <View style={styles.availabilityRow}>
            <View>
              <Text style={styles.fieldLabel}>Accepting New Bookings</Text>
              <Text style={styles.availabilityHint}>
                {isAvailable ? 'Pet parents can currently book you' : 'You are hidden from new bookings'}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: COLORS.kraftBorder, true: COLORS.forestGreen }}
              accessibilityLabel="Accepting new bookings"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            accessibilityState={{ busy: saving }}
          >
            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <LogOut size={15} color={COLORS.ctaBrown} />
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
  },
  headerIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.cardAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  identityCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 16,
    padding: 16,
    gap: 3,
  },
  doctorName: { fontSize: 18, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee },
  specialization: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: COLORS.brandGold },
  meta: { fontSize: 11.5, fontFamily: FONT_BODY, color: COLORS.textMuted },
  verifiedBadge: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.forestGreen, marginTop: 4 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee, textTransform: 'uppercase' },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textCoffee,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    padding: 14,
  },
  availabilityHint: { fontSize: 10.5, fontFamily: FONT_BODY, color: COLORS.textMuted, marginTop: 3, maxWidth: 220 },
  saveBtn: { backgroundColor: COLORS.forestGreen, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.ctaBrown,
    borderRadius: 12,
    paddingVertical: 12,
  },
  logoutBtnText: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: COLORS.ctaBrown },
});
