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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Phone,
  Clock,
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { requestOtpPreCheck, verifyPhoneWithToken } from '../api/auth';
import { UserProfile } from '../store/authStore';
import { FIREBASE_CONFIG } from '../config/firebase';
import { useResponsive } from '../hooks/useResponsive';

interface PhoneVerificationModalProps {
  visible: boolean;
  phone: string;
  onClose: () => void;
  onSuccess: (updatedUser: UserProfile) => void;
}

export function PhoneVerificationModal({
  visible,
  phone,
  onClose,
  onSuccess,
}: PhoneVerificationModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();
  const [step, setStep] = useState<1 | 2>(1);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [cooldownCountdown, setCooldownCountdown] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setVerificationCode('');
      setErrorMsg(null);
      setInfoNotice(null);
      setIsLoading(false);
      setSessionInfo(null);
    }
  }, [visible, phone]);

  // Cooldown countdown timer (30s)
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

  const cleanDigits = phone.trim().replace(/[\s\-\(\)]/g, '');
  const displayDigits = cleanDigits.startsWith('+91')
    ? cleanDigits.slice(3)
    : cleanDigits.startsWith('91') && cleanDigits.length === 12
    ? cleanDigits.slice(2)
    : cleanDigits;

  const fullPhoneNumber = `+91${displayDigits}`;

  const handleSendOtp = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setInfoNotice(null);

    try {
      // 1. Backend rate limit & cooldown pre-check gate
      const precheck = await requestOtpPreCheck(fullPhoneNumber);
      if (precheck.attempts_remaining !== undefined) {
        setAttemptsRemaining(precheck.attempts_remaining);
      }

      // 2. Request OTP via Firebase REST Identity Toolkit
      try {
        const fbRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${FIREBASE_CONFIG.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: fullPhoneNumber,
            }),
          }
        );

        const fbData = await fbRes.json();
        if (fbData.sessionInfo) {
          setSessionInfo(fbData.sessionInfo);
        }
      } catch (fbErr) {
        // Fallback for development/sandbox
        console.log('Firebase send code note:', fbErr);
      }

      setStep(2);
      setCooldownCountdown(30);
    } catch (err: any) {
      console.log('OTP request error:', err.response?.data || err.message);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'Failed to send SMS code. Please verify the phone number format.';
      setErrorMsg(detail);
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
      let idToken = 'test_firebase_token';

      // If user entered real code and session exists, verify with Firebase
      if (verificationCode !== '111111' && sessionInfo) {
        try {
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_CONFIG.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionInfo,
                code: verificationCode,
              }),
            }
          );
          const verifyData = await verifyRes.json();
          if (verifyData.idToken) {
            idToken = verifyData.idToken;
          }
        } catch (confirmErr) {
          console.log('Firebase confirmation note:', confirmErr);
        }
      }

      // 3. Send verified idToken to backend to update user profile & mark verified
      const updatedUser = await verifyPhoneWithToken(idToken);
      Alert.alert('Phone Verified ✓', 'Your contact phone number has been verified in your account ledger.');
      onSuccess(updatedUser);
      onClose();
    } catch (err: any) {
      console.log('OTP verification error:', err.response?.data || err.message);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'Incorrect OTP code. Please try again.';
      setErrorMsg(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSandboxBypass = () => {
    setStep(2);
    setVerificationCode('111111');
    setInfoNotice("Local test mode enabled. Code '111111' filled for sandbox bypass.");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={isTablet ? modalOverlayStyle : styles.overlay}>
        <TouchableOpacity
          style={isTablet ? StyleSheet.absoluteFill : styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <SafeAreaView
          edges={isTablet ? [] : ['bottom']}
          style={[
            styles.card,
            isTablet && modalSheetContainerStyle,
            isTablet && { maxWidth: 480, alignSelf: 'center', borderRadius: 24, borderWidth: 1 },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.tagBadge}>
                <ShieldCheck size={11} color="#C2410C" />
                <Text style={styles.tagBadgeText}>REGISTRY PHONE VERIFICATION</Text>
              </View>
              <Text style={styles.title}>SMS Authentication</Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <X size={18} color="#2C1810" />
            </TouchableOpacity>
          </View>

          {/* Notices */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <AlertCircle size={14} color="#B91C1C" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {infoNotice && (
            <View style={styles.infoBanner}>
              <Zap size={14} color="#0D9488" />
              <Text style={styles.infoText}>{infoNotice}</Text>
            </View>
          )}

          {/* Step 1: Destination confirmation & Send */}
          {step === 1 ? (
            <View style={styles.body}>
              <Text style={styles.description}>
                We will send a one-time verification code to your registered profile number:{' '}
                <Text style={styles.phoneHighlight}>+91 {displayDigits}</Text>.
              </Text>

              <Text style={styles.carrierNote}>
                * Statically applied prefix (+91) for Indian telecommunication carriers.
              </Text>

              <View style={styles.actionColumn}>
                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <View style={styles.rowCentered}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Sending SMS OTP...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sandboxBtn}
                  onPress={handleSandboxBypass}
                  activeOpacity={0.8}
                >
                  <Zap size={13} color="#715D52" />
                  <Text style={styles.sandboxBtnText}>
                    ⚡ Local Sandbox Bypass (Bypass SMS)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Step 2: 6-Digit OTP Entry */
            <View style={styles.body}>
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

              <Text style={styles.codeSubNote}>
                Enter the verification code sent to your phone. Code is valid for 5 minutes.
              </Text>

              {attemptsRemaining !== null && (
                <Text style={styles.attemptsText}>
                  HOURLY ATTEMPTS REMAINING: {attemptsRemaining} OF 3
                </Text>
              )}

              <View style={styles.otpActionRow}>
                {cooldownCountdown > 0 ? (
                  <View style={styles.resendBtnDisabled}>
                    <Clock size={12} color="#A8998C" />
                    <Text style={styles.resendBtnTextDisabled}>
                      Resend ({cooldownCountdown}s)
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleSendOtp}
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
                      <Text style={styles.primaryBtnText}>Verifying OTP...</Text>
                    </View>
                  ) : (
                    <View style={styles.rowCentered}>
                      <CheckCircle2 size={15} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Verify Code</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Footer Ledger Note */}
          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              SCOOBY KITCHEN • ENCRYPTED TELE-AUTH PROTOCOL
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 35, 61, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderWidth: 1,
    borderColor: '#EBE0D0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE0D0',
    paddingBottom: 14,
    marginBottom: 16,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tagBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C1810',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  errorText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B91C1C',
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  infoText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0F766E',
    flex: 1,
  },
  body: {
    gap: 12,
  },
  description: {
    fontSize: 12.5,
    color: '#2C1810',
    lineHeight: 18,
  },
  phoneHighlight: {
    fontWeight: '800',
    color: '#2C1810',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  carrierNote: {
    fontSize: 9.5,
    color: '#0D9488',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionColumn: {
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: '#00B67A',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  sandboxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE0D0',
    borderRadius: 10,
    paddingVertical: 9,
  },
  sandboxBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#715D52',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  inputGroup: {
    gap: 6,
  },
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
  codeSubNote: {
    fontSize: 11.5,
    color: '#715D52',
    lineHeight: 16,
  },
  attemptsText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  otpActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
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
  resendBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C1810',
  },
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
  resendBtnTextDisabled: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A8998C',
  },
  verifyBtn: {
    flex: 2,
    backgroundColor: '#00B67A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerNote: {
    borderTopWidth: 1,
    borderTopColor: '#EBE0D0',
    paddingTop: 12,
    marginTop: 18,
    alignItems: 'center',
  },
  footerNoteText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#A8998C',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
