import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { registerUser, requestMagicLink, verifyMagicCode, fetchCurrentUser, authenticateGoogle } from '../../api/auth';
import { Eyebrow } from '../../components/Eyebrow';
import { Key, Mail, Phone, User, CheckCircle2, ArrowLeft } from 'lucide-react';
import { DogViewer3D } from '../../components/DogViewer3D';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Toggle register vs login
  const [isRegister, setIsRegister] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  // OTP Verification Mode
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Status & Errors
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Get redirect target (defaults to '/')
  const from = (location.state as any)?.from?.pathname || '/';

  // Initialize Google Identity Services
  useEffect(() => {
    // @ts-ignore
    if (window.google && !isOtpMode) {
      // @ts-ignore
      if (!window.google_initialized) {
        // @ts-ignore
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleGoogleCredentialResponse,
        });
        // @ts-ignore
        window.google_initialized = true;
      }

      // Let React finish painting the layout first
      setTimeout(() => {
        const btn = document.getElementById('google-signin-btn');
        if (btn) {
          // @ts-ignore
          window.google.accounts.id.renderButton(
            btn,
            {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'square',
              logo_alignment: 'left',
              width: 320,
            }
          );
        }
      }, 50);
    }
  }, [isOtpMode, isRegister]);

  const handleGoogleCredentialResponse = async (response: any) => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const tokenRes = await authenticateGoogle(response.credential);
      setAuth(null, tokenRes.access_token);
      const userProfile = await fetchCurrentUser();
      setAuth(userProfile, tokenRes.access_token);
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Google authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for Requesting Login Link / Code
  const handleRequestAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isRegister) {
        // Registration
        const res = await registerUser({
          email,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          phone: phone || undefined,
        });
        setSuccessMsg(res.message || 'Verification code sent! Please check your terminal console / email.');
      } else {
        // Login
        const res = await requestMagicLink(email);
        setSuccessMsg(res.message || 'Verification code sent! Please check your terminal console / email.');
      }
      setIsOtpMode(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for Verifying Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setErrorMsg('Verification code must be exactly 6 digits.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const tokenRes = await verifyMagicCode(email, otpCode);
      
      // Fetch user profile info
      // Set the token temporarily in Zustand to allow the fetchCurrentUser call to pass headers
      setAuth(null, tokenRes.access_token);
      const userProfile = await fetchCurrentUser();
      
      // Save authenticated user and token
      setAuth(userProfile, tokenRes.access_token);

      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col md:flex-row relative">
      {/* Decorative vertical divider to fit notebook page style */}
      <div className="absolute left-6 md:left-10 top-0 bottom-0 border-l border-dashed border-cardboard opacity-50 hidden md:block z-10"></div>

      {/* Left Column: Form Section */}
      <div className="w-full md:w-1/2 min-h-screen flex items-center justify-center p-6 md:p-12 relative z-20">
        <div className="w-full max-w-md bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
        {/* Torn top edge card styling */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-paper flex overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 bg-paperLight rounded-full -translate-y-2 border border-cardboard shrink-0"
            ></div>
          ))}
        </div>

        {/* Animated Dog Mascot */}
        <div className="flex justify-center -mb-2 pt-2">
          <div className="relative w-16 h-16 group cursor-pointer">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-bounce hover:scale-110 transition-transform" style={{ animationDuration: '3s' }}>
              {/* Ears */}
              <path d="M 20,20 Q 5,25 10,45 Q 15,65 25,50 Z" fill="#2E251E" className="origin-top-left animate-wiggle-left" />
              <path d="M 80,20 Q 95,25 90,45 Q 85,65 75,50 Z" fill="#2E251E" className="origin-top-right animate-wiggle-right" />
              
              {/* Face */}
              <circle cx="50" cy="45" r="30" fill="#FAF6EC" stroke="#2E251E" strokeWidth="2.5" />
              
              {/* Eyes */}
              <circle cx="40" cy="40" r="3" fill="#2E251E" />
              <circle cx="60" cy="40" r="3" fill="#2E251E" />
              
              {/* Nose */}
              <ellipse cx="50" cy="50" rx="6" ry="4" fill="#2E251E" />
              
              {/* Mouth w/ Tongue */}
              <path d="M 46,55 Q 50,58 54,55" fill="none" stroke="#2E251E" strokeWidth="2" />
              <path d="M 48,56 Q 50,66 52,56" fill="#D34E36" className="origin-top animate-pant" />
              
              {/* Cheeks */}
              <circle cx="33" cy="48" r="4.5" fill="#E5A93C" opacity="0.6" />
              <circle cx="67" cy="48" r="4.5" fill="#E5A93C" opacity="0.6" />
            </svg>
            <div className="absolute -top-1 -left-2 text-[10px] animate-pulse opacity-75">🐾</div>
            <div className="absolute top-8 -right-3 text-[12px] animate-bounce opacity-70">🦴</div>
          </div>
        </div>

        {/* Logo and Intro */}
        <div className="text-center space-y-1.5">
          <h2 className="font-display font-bold text-2xl text-ink">Scooby's Kitchen</h2>
          <p className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
            Recipe Notebook Security Ledger
          </p>
        </div>

        {errorMsg && (
          <div className="border border-paprika bg-red-50 p-4 text-left rounded-sm font-body text-xs text-paprika">
            <span className="font-bold">Error:</span> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="border border-herb bg-emerald-50 p-4 text-left rounded-sm font-body text-xs text-herb flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Forms */}
        {!isOtpMode ? (
          <div className="space-y-6">
            {/* Toggle Headers */}
            <div className="flex border-b border-cardboard pb-2">
              <button
                onClick={() => {
                  setIsRegister(false);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-2 font-display text-base font-bold transition-colors ${
                  !isRegister
                    ? 'text-ink border-b-2 border-turmeric'
                    : 'text-cardboard hover:text-ink'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setIsRegister(true);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-2 font-display text-base font-bold transition-colors ${
                  isRegister
                    ? 'text-ink border-b-2 border-turmeric'
                    : 'text-cardboard hover:text-ink'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleRequestAuth} className="space-y-4 text-left">
              {isRegister && (
                <>
                  {/* First Name */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold block">
                      First Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold block">
                      Last Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold block">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email (Required for both) */}
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs py-3 rounded-sm tracking-wide uppercase transition-colors shadow-sm disabled:opacity-50 mt-2"
              >
                {isLoading
                  ? 'Requesting Code...'
                  : isRegister
                  ? 'Sign Up & Get Code'
                  : 'Request Login Code'}
              </button>
            </form>

            {/* Google OAuth Button */}
            <div className="space-y-4 flex flex-col items-center">
              <div className="w-full flex items-center space-x-2">
                <span className="flex-grow h-[1px] bg-cardboard opacity-55"></span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-cardboard">Or</span>
                <span className="flex-grow h-[1px] bg-cardboard opacity-55"></span>
              </div>

              <div id="google-signin-btn" className="w-full flex justify-center min-h-[40px]"></div>
            </div>
          </div>
        ) : (
          /* OTP Screen */
          <div className="space-y-6">
            <button
              onClick={() => setIsOtpMode(false)}
              className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Forms</span>
            </button>

            <div className="text-left space-y-2">
              <Eyebrow label="SECURITY VERIFICATION" />
              <h3 className="font-display text-lg font-bold text-ink italic">Enter verification code</h3>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                We sent a 6-digit verification code to <span className="font-bold">{email}</span>. 
                Please enter the code below to sign in.
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold block">
                  6-Digit OTP Code
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-9 pr-4 py-3 border border-cardboard rounded-sm bg-paperLight font-mono text-center tracking-[0.5em] text-lg text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs py-3 rounded-sm tracking-wide uppercase transition-colors shadow-sm disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify & Log In'}
              </button>
            </form>
          </div>
        )}
      </div>
      </div>

      {/* Right Column: Interactive 3D Dog Viewer (Seamless background) */}
      <div className="hidden md:flex md:w-1/2 min-h-screen bg-paper items-center justify-center relative overflow-hidden">
        <DogViewer3D />
      </div>
    </div>
  );
};
