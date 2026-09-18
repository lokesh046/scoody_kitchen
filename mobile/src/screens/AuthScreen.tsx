import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  PawPrint,
  Mail,
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY_SEMIBOLD, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
import { useAuthStore } from '../store/authStore';
import { BrandMedallion } from '../components/BrandLogo';
import apiClient from '../api/client';
import { captureApiError } from '../services/sentry';
import ResponsiveContainer from '../components/ResponsiveContainer';

WebBrowser.maybeCompleteAuthSession();

// Google Client ID configured in pet-platform-backend
const GOOGLE_CLIENT_ID = '372112333224-6aavjp4vg3r6ln20tk43es2dsk6e3l0q.apps.googleusercontent.com';

interface AuthScreenProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function AuthScreen({ onSuccess, onCancel }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [step, setStep] = useState<'input' | 'verify'>('input');

  // Form Fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { setAuth, continueAsGuest } = useAuthStore();

  // Official Expo Google OAuth Hook
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (request?.redirectUri) {
      console.log('🔗 [Google OAuth] Add this URI to Google Console Authorized redirect URIs:\n', request.redirectUri, '\n');
    }
  }, [request?.redirectUri]);

  // Handle Google OAuth Response
  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token || response.authentication?.idToken;
      if (idToken) {
        handleGoogleBackendAuth(idToken);
      } else {
        setErrorMsg('Google login succeeded, but no ID token was received.');
      }
    } else if (response?.type === 'error') {
      console.log('Google Auth Error:', response.error);
      setErrorMsg((response.error as any)?.message || 'Google Sign-In failed.');
    }
  }, [response]);

  // Authenticate with Backend using Google ID Token
  const handleGoogleBackendAuth = async (idToken: string) => {
    setGoogleLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiClient.post('/auth/google', {
        id_token: idToken,
      });

      const { access_token, refresh_token } = res.data;

      // Fetch user profile from backend
      const userRes = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      setAuth(userRes.data, access_token, refresh_token);
      setSuccessMsg('Signed in successfully with Google!');

      if (onSuccess) {
        setTimeout(onSuccess, 400);
      }
    } catch (err: any) {
      console.log('Google backend auth error:', err.response?.data);
      captureApiError(err, 'auth.googleSignIn');
      const detail =
        err.response?.data?.detail ||
        'Google authentication failed on server. Please check backend configuration.';
      setErrorMsg(detail);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Step 1: Send Magic Link / Code
  const handleSendCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid Gmail / Email address');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload: any = { email: cleanEmail };
      if (firstName.trim()) payload.first_name = firstName.trim();
      if (phone.trim()) payload.phone = phone.trim();

      await apiClient.post('/auth/magic-link', payload);
      setSuccessMsg(`6-digit verification code sent to ${cleanEmail}`);
      setStep('verify');
    } catch (err: any) {
      console.log('Auth request error:', err.response?.data || err.message);
      captureApiError(err, 'auth.sendCode');
      const detail =
        err.response?.data?.detail ||
        (err.message?.includes('timeout') ? 'Request timed out. Please try again.' : 'Failed to connect to backend.');
      setErrorMsg(detail);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Code
  const handleVerifyCode = async () => {
    if (!code.trim() || code.trim().length < 4) {
      setErrorMsg('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await apiClient.post('/auth/magic-link/verify-code', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });

      const { access_token, refresh_token } = res.data;

      // Fetch user profile from backend
      const userRes = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      setAuth(userRes.data, access_token, refresh_token);
      setSuccessMsg('Signed in successfully!');

      if (onSuccess) {
        setTimeout(onSuccess, 400);
      }
    } catch (err: any) {
      console.log('Verification error:', err.response?.data);
      captureApiError(err, 'auth.verifyCode');
      const detail = err.response?.data?.detail || 'Invalid or expired verification code';
      setErrorMsg(detail);
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || googleLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContainer maxWidth={520}>
            {/* Top Brand Header */}
          <View style={styles.topNav}>
            {step === 'verify' ? (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setStep('input')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Change email address"
              >
                <ArrowLeft size={18} color={COLORS.textCoffee} />
                <Text style={styles.backBtnText}>Change Email</Text>
              </TouchableOpacity>
            ) : onCancel ? (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={onCancel}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close sign-in screen"
              >
                <ArrowLeft size={18} color={COLORS.textCoffee} />
                <Text style={styles.backBtnText}>Close</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <View style={styles.brandPill}>
              <Text style={styles.brandPillText}>Scooby's Kitchen</Text>
            </View>
          </View>

          {/* Hero Branding Section */}
          <View style={styles.heroSection}>
            <BrandMedallion size="xl" style={{ marginBottom: 14 }} />
            <Text style={styles.heroSub}>
              Fresh human-grade canine nutrition & veterinary telemedicine platform.
            </Text>
          </View>

          {/* Main Auth Container */}
          <View style={styles.authCard}>
            {step === 'input' ? (
              <>
                {/* Mode Selector Tabs (Sign In vs Register) */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tabBtn, mode === 'signin' && styles.tabBtnActive]}
                    onPress={() => {
                      setMode('signin');
                      setErrorMsg('');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityRole="tab"
                    accessibilityLabel="Sign in with an existing account"
                    accessibilityState={{ selected: mode === 'signin' }}
                  >
                    <Text
                      style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}
                    onPress={() => {
                      setMode('register');
                      setErrorMsg('');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    accessibilityRole="tab"
                    accessibilityLabel="Create a new account"
                    accessibilityState={{ selected: mode === 'register' }}
                  >
                    <Text
                      style={[styles.tabText, mode === 'register' && styles.tabTextActive]}
                    >
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Error Banner */}
                {errorMsg ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                {/* 1. TOP SECTION: Email & Credential Form */}
                <View style={styles.formContainer}>
                  {mode === 'register' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Pet Parent Name</Text>
                      <View style={styles.inputWrapper}>
                        <User size={18} color={COLORS.textMuted} />
                        <TextInput
                          placeholder="e.g. Rahul Sharma"
                          placeholderTextColor={COLORS.textLight}
                          value={firstName}
                          onChangeText={setFirstName}
                          style={styles.textInput}
                        />
                      </View>
                    </View>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email / Gmail Address</Text>
                    <View style={styles.inputWrapper}>
                      <Mail size={18} color={COLORS.textMuted} />
                      <TextInput
                        placeholder="you@gmail.com"
                        placeholderTextColor={COLORS.textLight}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.textInput}
                      />
                    </View>
                  </View>

                  {mode === 'register' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
                      <View style={styles.inputWrapper}>
                        <Phone size={18} color={COLORS.textMuted} />
                        <TextInput
                          placeholder="+91 98765 43210"
                          placeholderTextColor={COLORS.textLight}
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                          style={styles.textInput}
                        />
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, isBusy && styles.submitBtnDisabled]}
                    onPress={handleSendCode}
                    disabled={isBusy}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={mode === 'signin' ? 'Send magic code' : 'Create account and send verification code'}
                    accessibilityState={{ disabled: isBusy, busy: loading }}
                  >
                    {loading ? (
                      <ActivityIndicator color={COLORS.textWhite} size="small" />
                    ) : (
                      <>
                        <Text style={styles.submitBtnText}>
                          {mode === 'signin' ? 'Send Magic Code' : 'Create & Verify Account'}
                        </Text>
                        <ArrowRight size={16} color={COLORS.textWhite} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* 2. MIDDLE DIVIDER */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* 3. BOTTOM SECTION: Google Sign-In Button */}
                <TouchableOpacity
                  style={[styles.googleBtn, (!request || isBusy) && styles.disabledBtn]}
                  onPress={() => promptAsync()}
                  disabled={!request || isBusy}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  accessibilityState={{ disabled: !request || isBusy, busy: googleLoading }}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color="#4285F4" />
                  ) : (
                    <>
                      <View style={styles.googleIconBox}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#4285F4' }}>G</Text>
                      </View>
                      <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              /* Step 2: Verification Code Screen */
              <View style={styles.formContainer}>
                <View style={styles.verifyHeader}>
                  <View style={styles.keyIconCircle}>
                    <KeyRound size={22} color={COLORS.brandGold} />
                  </View>
                  <Text style={styles.verifyTitle}>Enter 6-Digit Code</Text>
                  <Text style={styles.verifySub}>Sent securely to {email}</Text>
                </View>

                {errorMsg ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                {successMsg ? (
                  <View style={styles.successBox}>
                    <CheckCircle2 size={16} color={COLORS.forestGreen} />
                    <Text style={styles.successText}>{successMsg}</Text>
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={styles.inputWrapper}>
                    <KeyRound size={18} color={COLORS.textMuted} />
                    <TextInput
                      placeholder="• • • • • •"
                      placeholderTextColor={COLORS.textLight}
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      style={[styles.textInput, styles.monoInput]}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleVerifyCode}
                  disabled={loading}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Verify code and unlock app"
                  accessibilityState={{ disabled: loading, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.textWhite} size="small" />
                  ) : (
                    <>
                      <Text style={styles.submitBtnText}>Verify & Unlock App</Text>
                      <CheckCircle2 size={16} color={COLORS.textWhite} />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleSendCode}
                  disabled={loading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Resend verification code"
                  accessibilityState={{ disabled: loading }}
                >
                  <Text style={styles.resendBtnText}>Didn't receive code? Resend</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Continue as Guest Button */}
            <TouchableOpacity
              style={styles.guestLinkBtn}
              onPress={() => {
                continueAsGuest();
                if (onSuccess) onSuccess();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Skip sign-in and explore the menu as a guest"
            >
              <Text style={styles.guestLinkText}>Skip & Explore Menu as Guest ➔</Text>
            </TouchableOpacity>
          </View>

          {/* Trust Footnote */}
          <View style={styles.trustRow}>
            <ShieldCheck size={14} color={COLORS.forestGreen} />
            <Text style={styles.trustText}>
              Veterinary Supervised • 100% Human-Grade • 4°C Fresh Delivery
            </Text>
          </View>
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  scrollContent: { padding: 20, paddingBottom: 40 },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backBtnText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  brandPillText: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.brandGold },
  heroSection: { alignItems: 'center', marginBottom: 20 },
  heroSub: { fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, maxWidth: 300 },
  authCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.canvas,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: COLORS.card },
  tabText: { fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textMuted },
  tabTextActive: { color: COLORS.forestGreen, fontFamily: FONT_BODY_BOLD },
  formContainer: { gap: 12 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  textInput: { flex: 1, fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  // The verification code is exactly the kind of raw, precise data
  // DESIGN.md's Ledger Monospace Rule calls for — the app's own IBM Plex
  // Mono token, not a platform-default Courier/monospace fallback.
  monoInput: {
    fontSize: 18,
    letterSpacing: 8,
    fontFamily: LEDGER_MONO,
    color: COLORS.forestGreen,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: COLORS.textWhite, fontSize: 13, fontFamily: FONT_BODY_BOLD },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.kraftBorder },
  dividerText: { fontSize: 9, fontFamily: FONT_BODY_BOLD, color: COLORS.textLight, letterSpacing: 0.5 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.kraftBorder,
    paddingVertical: 12,
    borderRadius: 12,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  googleIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  verifyHeader: { alignItems: 'center', marginBottom: 12 },
  keyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  verifyTitle: { fontSize: 16, fontFamily: FONT_DISPLAY_SEMIBOLD, color: COLORS.textCoffee },
  verifySub: { fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textMuted, marginTop: 2 },
  resendBtn: { alignItems: 'center', paddingVertical: 8 },
  resendBtnText: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.brandGold },
  guestLinkBtn: { alignItems: 'center', marginTop: 18, paddingVertical: 6 },
  guestLinkText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.forestGreen },
  // DESIGN.md: "Don't use standard red/green/yellow warning colors" —
  // these were raw Tailwind hex; now the app's own accentRed/sage tints.
  errorBox: {
    backgroundColor: COLORS.accentRedTintBg,
    borderWidth: 1,
    borderColor: COLORS.accentRedTintBorder,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: { fontSize: 11, color: COLORS.accentRedTintText, fontFamily: FONT_BODY_BOLD },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.sageTintBg,
    borderWidth: 1,
    borderColor: COLORS.sageTintBorder,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  successText: { fontSize: 11, color: COLORS.forestGreen, fontFamily: FONT_BODY_BOLD },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  trustText: { fontSize: 10, fontFamily: FONT_BODY, color: COLORS.textMuted },
});
