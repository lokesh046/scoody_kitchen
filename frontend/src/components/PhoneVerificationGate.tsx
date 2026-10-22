import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useAuthStore } from '../store/auth';
import { auth } from '../api/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import {
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
  verifyFirebasePhoneToken,
  requestOtpPreCheck,
  logoutUser,
} from '../api/auth';
import { PhoneNumberInput } from './PhoneNumberInput';
import { DEFAULT_COUNTRY_ISO2 } from '../constants/countries';
import { toE164, isValidForCountry, getCountry } from '../utils/phone';

// Mandatory, non-dismissible phone verification -- renders on top of every
// page whenever a logged-in user's phone isn't verified yet. Google and
// email sign-in never collect/confirm a phone number themselves, so this
// is the one place that happens, before anything else in the app is usable.
// Doesn't apply to guests (user === null); browsing without an account is
// unaffected.
export const PhoneVerificationGate: React.FC = () => {
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [country, setCountry] = useState(DEFAULT_COUNTRY_ISO2);
  const [phone, setPhone] = useState('');
  const [verificationChannel, setVerificationChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownCountdown, setCooldownCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Pre-fill from the user's existing profile phone, if any (e.g. a
  // previous unverified attempt) -- otherwise start blank. Parses with
  // libphonenumber-js so both the country AND the national number are
  // detected correctly, rather than assuming India and just chopping off
  // the last 10 digits (which broke for any non-Indian number, and even
  // for Indian numbers stored without a "+" -- see the double-91 bug this
  // replaced).
  useEffect(() => {
    if (!user?.phone) return;
    const parsed = parsePhoneNumberFromString(user.phone, DEFAULT_COUNTRY_ISO2 as any);
    if (parsed && parsed.country) {
      setCountry(parsed.country);
      setPhone(parsed.nationalNumber);
    } else {
      // Unparseable legacy data -- fall back to "last 10 digits, assume
      // default country" rather than leaving the field blank.
      const digitsOnly = user.phone.replace(/\D/g, '');
      setPhone(digitsOnly.slice(-10));
    }
  }, [user?.phone]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cooldownCountdown > 0) {
      timer = setInterval(() => setCooldownCountdown((prev) => prev - 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldownCountdown]);

  const shouldShow = !!user && user.is_phone_verified === false;

  if (!shouldShow) return null;

  const handleContinueFromPhone = () => {
    if (!isValidForCountry(country, phone)) {
      setError(`Please enter a valid phone number for ${getCountry(country).name}.`);
      return;
    }
    setError(null);
    handleSendOtp('whatsapp');
  };

  const handleSendOtp = async (channel: 'whatsapp' | 'sms') => {
    setIsLoading(true);
    setError(null);
    setVerificationChannel(channel);
    const fullPhone = toE164(country, phone);

    if (channel === 'whatsapp') {
      try {
        await sendWhatsAppOtp(fullPhone);
        setStep('otp');
        setCooldownCountdown(60);
      } catch (err: any) {
        setError(
          err.response?.data?.detail || "Couldn't send a WhatsApp code. You can try SMS instead below."
        );
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const rateLimitResponse = await requestOtpPreCheck(fullPhone);
      if (rateLimitResponse.attempts_remaining !== undefined) {
        setAttemptsRemaining(rateLimitResponse.attempts_remaining);
      }

      const container = document.getElementById('phone-gate-recaptcha-container');
      if (container) {
        container.innerHTML = '<div id="phone-gate-recaptcha-anchor"></div>';
      }
      const verifier = new RecaptchaVerifier(auth, 'phone-gate-recaptcha-anchor', { size: 'invisible' });
      setRecaptchaVerifier(verifier);

      const confirmation = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmResult(confirmation);
      setStep('otp');
      setCooldownCountdown(30);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to send SMS code.');
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationCode) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const fullPhone = toE164(country, phone);

    try {
      let updatedUser;
      if (verificationChannel === 'whatsapp') {
        updatedUser = await verifyWhatsAppOtp(fullPhone, verificationCode);
      } else {
        if (!confirmResult) {
          throw new Error('Verification session has expired. Please send the code again.');
        }
        const userCredential = await confirmResult.confirm(verificationCode);
        const idToken = await userCredential.user.getIdToken();
        updatedUser = await verifyFirebasePhoneToken(idToken);
      }
      setAuth(updatedUser, accessToken);
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch {}
      }
      // Once verification is done, always land on home -- any
      // "take me back to what I was trying to reach" redirect already
      // happened at login time (see RequireAuth/AuthPage), before this
      // gate ever showed up.
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Incorrect OTP code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOutInstead = async () => {
    try {
      await logoutUser();
    } catch {
      // Clear local session regardless of whether the backend call succeeds.
    }
    clearAuth();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-ink bg-opacity-60 flex items-center justify-center p-4">
      <div id="phone-gate-recaptcha-container" />
      <div className="bg-paperLight border border-cardboard rounded-sm shadow-2xl max-w-md w-full p-6 space-y-5">
        <div className="space-y-1.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
            One Last Step
          </span>
          <h3 className="font-display font-black text-xl text-ink">Verify Your Phone Number</h3>
          <p className="font-body text-xs text-ink opacity-70 leading-relaxed">
            For order updates, delivery coordination, and account security, please verify your phone
            number before continuing.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 font-body text-xs p-2.5 rounded-sm font-bold">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
                Phone Number
              </label>
              <PhoneNumberInput
                country={country}
                onCountryChange={setCountry}
                nationalNumber={phone}
                onNationalNumberChange={setPhone}
                placeholder="9876543210"
              />
            </div>
            <button
              type="button"
              onClick={handleContinueFromPhone}
              disabled={isLoading}
              className="w-full bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs py-3 rounded-sm tracking-wider uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending code...</span>
                </>
              ) : (
                <span>Send Verification Code</span>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-body text-xs text-ink opacity-80">
              Code sent via {verificationChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to{' '}
              <strong className="font-mono text-ink">+{getCountry(country).dialCode} {phone}</strong>.
            </p>
            <div className="space-y-1">
              <label className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
                Enter 6-Digit OTP Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2 border border-cardboard rounded-sm bg-paper font-mono text-center text-lg tracking-widest text-ink focus:outline-none focus:border-turmeric transition-colors"
              />
            </div>

            {attemptsRemaining !== null && (
              <p className="font-mono text-[9px] text-paprika font-bold uppercase">
                Hourly Attempts Remaining: {attemptsRemaining} of 3
              </p>
            )}

            <div className="flex space-x-2">
              {cooldownCountdown > 0 ? (
                <button
                  type="button"
                  disabled
                  className="w-1/3 border border-cardboard border-opacity-40 font-mono text-[9px] uppercase py-2.5 rounded-sm text-cardboard cursor-not-allowed text-center bg-transparent"
                >
                  Resend ({cooldownCountdown}s)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp(verificationChannel)}
                  disabled={isLoading}
                  className="w-1/3 border border-cardboard bg-transparent hover:bg-paper font-mono text-[9px] uppercase py-2.5 rounded-sm tracking-wider text-ink cursor-pointer transition-colors"
                >
                  Resend
                </button>
              )}
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isLoading}
                className="w-2/3 bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs py-2.5 rounded-sm tracking-wider uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify Code</span>
                )}
              </button>
            </div>

            {verificationChannel === 'whatsapp' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  handleSendOtp('sms');
                }}
                disabled={isLoading}
                className="w-full font-mono text-[9px] py-1 text-ink opacity-60 hover:opacity-100 uppercase tracking-wider cursor-pointer transition-opacity disabled:opacity-30"
              >
                Can't receive WhatsApp? Send via SMS instead
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignOutInstead}
          className="w-full text-center font-mono text-[9px] uppercase tracking-wider text-ink opacity-50 hover:opacity-80 cursor-pointer transition-opacity"
        >
          Not now — Sign Out
        </button>
      </div>
    </div>
  );
};
