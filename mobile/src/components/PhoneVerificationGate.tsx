import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Clock, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
} from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { navigationRef } from '../../App';
import { PhoneNumberInput } from './PhoneNumberInput';
import { DEFAULT_COUNTRY_ISO2 } from '../constants/countries';
import { toE164, isValidForCountry, getCountry } from '../utils/phone';

import { ModalKeyboardAvoider } from './ModalKeyboardAvoider';
// Mandatory, non-dismissible phone verification -- shown app-wide whenever
// a logged-in user's phone isn't verified yet. Google and email sign-in
// never collect/confirm a phone number themselves, so this is the one
// place that happens, before anything else in the app is usable. Doesn't
// apply to guests (isGuest / user === null); browsing without an account
// is unaffected. No onClose prop on purpose -- the only way out besides
// verifying is the explicit "Sign Out" action at the bottom.
export function PhoneVerificationGate() {
  const { user, updateUser, logout } = useAuthStore();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [country, setCountry] = useState(DEFAULT_COUNTRY_ISO2);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [verificationChannel, setVerificationChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldownCountdown, setCooldownCountdown] = useState(0);

  const timerRef = useRef<any>(null);

  const shouldShow = !!user && user.is_phone_verified === false;

  // This component stays mounted for the whole session and only hides itself, so without a reset its
  // state (code screen, previous number, typed code, errors) survives a logout and the NEXT account
  // opens on the code screen showing the previous person's number. Start clean for every account.
  const accountKey = `${user?.id ?? 'none'}:${user?.is_phone_verified ? 'verified' : 'pending'}`;
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep('phone');
    setCountry(DEFAULT_COUNTRY_ISO2);
    setPhoneDigits('');
    setVerificationChannel('whatsapp');
    setVerificationCode('');
    setIsLoading(false);
    setErrorMsg(null);
    setCooldownCountdown(0);
  }, [accountKey]);

  // Back from the code screen to the number box, so a wrong number can be corrected.
  const handleChangeNumber = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep('phone');
    setVerificationCode('');
    setErrorMsg(null);
    setCooldownCountdown(0);
  };

  useEffect(() => {
    // Parses with libphonenumber-js so both the country AND the national
    // number are detected correctly, rather than assuming India and just
    // chopping off the last 10 digits (which broke for any non-Indian
    // number, and even for Indian numbers stored without a "+" -- see the
    // double-91 bug this replaced).
    if (!shouldShow || !user?.phone) return;
    const parsed = parsePhoneNumberFromString(user.phone, DEFAULT_COUNTRY_ISO2 as any);
    if (parsed && parsed.country) {
      setCountry(parsed.country);
      setPhoneDigits(parsed.nationalNumber);
    } else {
      const digitsOnly = user.phone.replace(/\D/g, '');
      setPhoneDigits(digitsOnly.slice(-10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow, accountKey]);

  useEffect(() => {
    if (cooldownCountdown > 0) {
      timerRef.current = setInterval(() => {
        setCooldownCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldownCountdown]);

  if (!shouldShow) return null;

  const fullPhoneNumber = toE164(country, phoneDigits);

  const handleContinueFromPhone = () => {
    if (!isValidForCountry(country, phoneDigits)) {
      setErrorMsg(`Please enter a valid phone number for ${getCountry(country).name}.`);
      return;
    }
    setErrorMsg(null);
    handleSendOtp();
  };

  const handleSendOtp = async (channel: 'whatsapp' | 'sms' = 'whatsapp') => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await sendWhatsAppOtp(fullPhoneNumber, channel);
      setVerificationChannel(result.channel === 'sms' ? 'sms' : 'whatsapp');
      setStep('otp');
      setCooldownCountdown(60);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Couldn't send the code. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const updatedUser = await verifyWhatsAppOtp(fullPhoneNumber, verificationCode);
      await updateUser(updatedUser);
      // Once verification is done, always land on Home -- this gate opens
      // right at app start (before the user has navigated anywhere real),
      // so there's no "where they were trying to go" to return to.
      if (navigationRef.isReady()) {
        navigationRef.navigate('MainTabs' as never);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Incorrect OTP code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <ModalKeyboardAvoider style={styles.flexFill}>
        <View style={styles.overlay}>
          <SafeAreaView edges={['bottom']} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.tagBadge}>
                <ShieldCheck size={11} color="#C2410C" />
                <Text style={styles.tagBadgeText}>ONE LAST STEP</Text>
              </View>
              <Text style={styles.title}>Verify Your Phone Number</Text>
              <Text style={styles.subtitle}>
                For order updates, delivery coordination, and account security, please verify your
                phone number before continuing.
              </Text>
            </View>

            {errorMsg && (
              <View style={styles.errorBanner}>
                <AlertCircle size={14} color="#B91C1C" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {step === 'phone' ? (
              <View style={styles.body}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                  <PhoneNumberInput
                    country={country}
                    onCountryChange={setCountry}
                    nationalNumber={phoneDigits}
                    onNationalNumberChange={setPhoneDigits}
                    placeholder="0000000000"
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  onPress={handleContinueFromPhone}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <View style={styles.rowCentered}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Sending code...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryBtnText}>Send Code via WhatsApp</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sandboxBtn}
                  onPress={() => {
                    if (!isValidForCountry(country, phoneDigits)) {
                      setErrorMsg(`Please enter a valid phone number for ${getCountry(country).name}.`);
                      return;
                    }
                    handleSendOtp('sms');
                  }}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sandboxBtnText}>Can't use WhatsApp? Send via SMS instead</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.body}>
                <Text style={styles.description}>
                  Code sent via {verificationChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to{' '}
                  <Text style={styles.phoneHighlight}>+{getCountry(country).dialCode} {phoneDigits}</Text>.
                </Text>

                <TouchableOpacity
                  style={styles.sandboxBtn}
                  onPress={handleChangeNumber}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Change the phone number"
                >
                  <Text style={styles.sandboxBtnText}>Wrong number? Change number</Text>
                </TouchableOpacity>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ENTER 6-DIGIT OTP CODE</Text>
                  <TextInput
                    style={styles.otpInput}
                    value={verificationCode}
                    onChangeText={(val) => setVerificationCode(val.replace(/\D/g, ''))}
                    placeholder="123456"
                    placeholderTextColor="#A8998C"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>

                <View style={styles.otpActionRow}>
                  {cooldownCountdown > 0 ? (
                    <View style={styles.resendBtnDisabled}>
                      <Clock size={12} color="#A8998C" />
                      <Text style={styles.resendBtnTextDisabled}>Resend ({cooldownCountdown}s)</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.resendBtn}
                      onPress={() => handleSendOtp(verificationChannel)}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.resendBtnText}>Resend</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.verifyBtn, isLoading && styles.btnDisabled]}
                    onPress={handleVerifyOtp}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    {isLoading ? (
                      <View style={styles.rowCentered}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Verifying...</Text>
                      </View>
                    ) : (
                      <View style={styles.rowCentered}>
                        <CheckCircle2 size={15} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Verify Code</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {verificationChannel === 'whatsapp' && (
                  <TouchableOpacity
                    style={styles.sandboxBtn}
                    onPress={() => {
                      setErrorMsg(null);
                      handleSendOtp('sms');
                    }}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sandboxBtnText}>Didn't get it on WhatsApp? Send via SMS instead</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.signOutBtn} onPress={() => logout()} activeOpacity={0.7}>
              <Text style={styles.signOutBtnText}>Not now — Sign Out</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </ModalKeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 35, 61, 0.65)',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: '#FAF7F2',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#EBE0D0',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#EBE0D0',
    paddingBottom: 14,
    marginBottom: 16,
    gap: 4,
  },
  tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#2C1810' },
  subtitle: { fontSize: 12, color: '#715D52', lineHeight: 17 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: { fontSize: 11.5, fontWeight: '700', color: '#B91C1C', flex: 1 },
  body: { gap: 12 },
  description: { fontSize: 12.5, color: '#2C1810', lineHeight: 18 },
  phoneHighlight: {
    fontWeight: '800',
    color: '#2C1810',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inputGroup: { gap: 6 },
  inputLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  otpInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EBE0D0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '800',
    color: '#2C1810',
    textAlign: 'center',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  attemptsText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  primaryBtn: {
    backgroundColor: '#00B67A',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.55 },
  sandboxBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  sandboxBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#715D52',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  otpActionRow: { flexDirection: 'row', gap: 10 },
  resendBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE0D0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendBtnText: { fontSize: 12, fontWeight: '700', color: '#2C1810' },
  resendBtnDisabled: {
    flex: 1,
    backgroundColor: '#F3EFE9',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  resendBtnTextDisabled: { fontSize: 11, fontWeight: '700', color: '#A8998C' },
  verifyBtn: {
    flex: 2,
    backgroundColor: '#00B67A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCentered: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signOutBtn: {
    borderTopWidth: 1,
    borderTopColor: '#EBE0D0',
    paddingTop: 14,
    marginTop: 16,
    alignItems: 'center',
  },
  signOutBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A8998C',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
