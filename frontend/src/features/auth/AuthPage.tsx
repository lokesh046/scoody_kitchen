import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { registerUser, requestMagicLink, verifyMagicCode, fetchCurrentUser, authenticateGoogle } from '../../api/auth';
import { Eyebrow } from '../../components/Eyebrow';
import { Key, Mail, Phone, User, CheckCircle2, ArrowLeft } from 'lucide-react';
import { DogViewer3D } from '../../components/DogViewer3D';

const triggerCornerConfetti = () => {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const colors = ['#D34E36', '#E5A93C', '#3F5E4D', '#F9F6F0', '#8FA89B'];
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
    shape: 'circle' | 'square';
  }
  const particles: Particle[] = [];

  const createBlast = (originX: number, angleRange: [number, number]) => {
    for (let i = 0; i < 60; i++) {
      const angle = angleRange[0] + Math.random() * (angleRange[1] - angleRange[0]);
      const speed = 10 + Math.random() * 20;
      particles.push({
        x: originX,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.1 + Math.random() * 0.2,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'circle' : 'square'
      });
    }
  };

  // Create cascades across the top edge
  const createTopShower = () => {
    for (let i = 0; i < 110; i++) {
      const angle = Math.PI / 3 + Math.random() * (Math.PI / 3);
      const speed = 3 + Math.random() * 12;
      particles.push({
        x: Math.random() * window.innerWidth,
        y: -15,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.05 + Math.random() * 0.1,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'circle' : 'square'
      });
    }
  };

  createBlast(0, [Math.PI / 8, Math.PI * 3 / 8]);
  createBlast(window.innerWidth, [Math.PI * 5 / 8, Math.PI * 7 / 8]);
  createTopShower();

  let active = true;
  const startTime = Date.now();

  const update = () => {
    if (!active) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const elapsed = Date.now() - startTime;
    if (elapsed > 2500) {
      active = false;
      window.removeEventListener('resize', resizeCanvas);
      try {
        document.body.removeChild(canvas);
      } catch (e) {}
      return;
    }

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.20; // Soft floating gravity
      p.vx *= 0.985; // Lower friction drag
      p.vy *= 0.985;
      p.rotation += p.rotationSpeed;
      
      if (elapsed > 1500) {
        p.opacity = Math.max(0, 1 - (elapsed - 1500) / 1000);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.shape === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
};

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Toggle register vs login
  const [isRegister, setIsRegister] = useState(false);

  // Field focus tracking
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
      triggerCornerConfetti();
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1600);
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

      triggerCornerConfetti();
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1600);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEyes = () => {
    if (focusedField === 'otp') {
      return (
        <>
          <line x1="37" y1="40" x2="43" y2="40" stroke="#2E251E" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-300" />
          <line x1="57" y1="40" x2="63" y2="40" stroke="#2E251E" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-300" />
        </>
      );
    }

    let leftCx = 40;
    let rightCx = 60;
    let cy = 40;

    if (focusedField === 'email') {
      leftCx = 38;
      rightCx = 58;
      cy = 43;
    } else if (focusedField === 'first_name') {
      leftCx = 36;
      rightCx = 56;
      cy = 40;
    } else if (focusedField === 'last_name') {
      leftCx = 44;
      rightCx = 64;
      cy = 40;
    } else if (focusedField === 'phone') {
      leftCx = 37;
      rightCx = 57;
      cy = 42;
    }

    return (
      <>
        <circle cx={leftCx} cy={cy} r="3" fill="#2E251E" className="transition-all duration-300 ease-out" />
        <circle cx={rightCx} cy={cy} r="3" fill="#2E251E" className="transition-all duration-300 ease-out" />
      </>
    );
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col md:flex-row relative">
      {/* Decorative vertical divider to fit notebook page style */}
      <div className="absolute left-6 md:left-10 top-0 bottom-0 border-l border-dashed border-cardboard opacity-50 hidden md:block z-10"></div>

      {/* Left Column: Form Section */}
      <div className="w-full md:w-1/2 min-h-screen flex items-center justify-center p-6 md:p-12 relative z-20">
        <div className="w-full max-w-md bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden animate-fade-in-up">
        {/* Animated Dog Mascot */}
        <div className="flex justify-center -mb-2 pt-2">
          <div className="relative w-16 h-16 group cursor-pointer">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-float-slow hover:scale-105 transition-transform" style={{ animationDuration: '4s' }}>
              {/* Ears */}
              <path d="M 20,20 Q 5,25 10,45 Q 15,65 25,50 Z" fill="#2E251E" className="origin-top-left animate-wiggle-left" />
              <path d="M 80,20 Q 95,25 90,45 Q 85,65 75,50 Z" fill="#2E251E" className="origin-top-right animate-wiggle-right" />
              
              {/* Face */}
              <circle cx="50" cy="45" r="30" fill="#FAF6EC" stroke="#2E251E" strokeWidth="2.5" />
              
              {/* Eyes */}
              {renderEyes()}
              
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
            <div className="absolute top-8 -right-3 text-[12px] animate-float-medium opacity-70">🦴</div>
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
          <div className="border border-turmeric bg-red-50 p-4 text-left rounded-sm font-body text-xs text-paprika animate-fade-in-up">
            <span className="font-bold">Error:</span> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="border border-herb bg-emerald-50 p-4 text-left rounded-sm font-body text-xs text-herb flex items-start space-x-2 animate-fade-in-up">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Forms */}
        {!isOtpMode ? (
          <div className="space-y-6">
            {/* Toggle Headers */}
            <div className="relative flex border-b border-cardboard pb-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-2 font-display text-base font-bold transition-colors ${
                  !isRegister
                    ? 'text-ink'
                    : 'text-cardboard hover:text-ink'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-2 font-display text-base font-bold transition-colors ${
                  isRegister
                    ? 'text-ink'
                    : 'text-cardboard hover:text-ink'
                }`}
              >
                Register
              </button>
              <div 
                className="absolute bottom-0 h-0.5 bg-turmeric transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  width: '50%',
                  left: isRegister ? '50%' : '0%'
                }}
              />
            </div>

            <form onSubmit={handleRequestAuth} className="space-y-4 text-left">
              {isRegister && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* First Name */}
                  <div className="space-y-1 animate-fade-in-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
                    <label className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold block">
                      First Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        onFocus={() => setFocusedField('first_name')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="John"
                        className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
                    <label className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold block">
                      Last Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        onFocus={() => setFocusedField('last_name')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Doe"
                        className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1 animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
                    <label className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold block">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-cardboard absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Email (Required for both) */}
              <div className="space-y-1 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
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
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs py-3 rounded-sm tracking-wide uppercase transition-colors shadow-sm disabled:opacity-50 mt-2 hover-bounce"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-4 w-4 text-paperLight" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Requesting Code...</span>
                  </span>
                ) : (
                  <span>{isRegister ? 'Sign Up & Get Code' : 'Request Login Code'}</span>
                )}
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
          <div className="space-y-6 animate-fade-in-up">
            <button
              onClick={() => setIsOtpMode(false)}
              className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Forms</span>
            </button>

            <div className="text-left space-y-2">
              <Eyebrow label="SECURITY VERIFICATION" />
              <h3 className="font-display text-lg font-bold text-ink italic animate-fade-in-up">Enter verification code</h3>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed animate-fade-in-up" style={{ animationDelay: '50ms', animationFillMode: 'both' }}>
                We sent a 6-digit verification code to <span className="font-bold">{email}</span>. 
                Please enter the code below to sign in.
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
              <div className="space-y-1 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
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
                    onFocus={() => setFocusedField('otp')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="123456"
                    className="w-full pl-9 pr-4 py-3 border border-cardboard rounded-sm bg-paperLight font-mono text-center tracking-[0.5em] text-lg text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs py-3 rounded-sm tracking-wide uppercase transition-colors shadow-sm disabled:opacity-50 hover-bounce"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-4 w-4 text-paperLight" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying...</span>
                  </span>
                ) : (
                  <span>Verify & Log In</span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
      </div>

      {/* Right Column: Interactive 3D Dog Viewer (Technical Blueprint Grid) */}
      <div className="hidden md:flex md:w-1/2 min-h-screen bg-paper bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:16px_24px] items-center justify-center relative overflow-hidden border-l border-cardboard border-opacity-30">
        {/* Technical Coordinate Overlay markings */}
        <div className="absolute top-6 left-6 font-mono text-[9px] text-cardboard tracking-wider select-none space-y-0.5 opacity-60">
          <div>MODEL: SHIBA.UNIT_V2</div>
          <div>COORD: X.042 Y.118 Z.000</div>
        </div>
        <div className="absolute top-6 right-6 font-mono text-[9px] text-cardboard tracking-wider select-none opacity-60">
          <div>ZOOM: ORBIT_ENABLED</div>
        </div>
        <div className="absolute bottom-6 right-6 font-mono text-[9px] text-cardboard tracking-wider select-none space-y-0.5 opacity-60 text-right">
          <div>RENDER: THREE.WEBGL</div>
          <div>FPS: 60 / LOCK</div>
        </div>

        <DogViewer3D />
      </div>
    </div>
  );
};
