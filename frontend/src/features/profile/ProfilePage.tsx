import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser, updateUserProfile, uploadAvatarImage, verifyFirebasePhoneToken, requestOtpPreCheck } from '../../api/auth';
import { auth } from '../../api/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { CartDrawer } from '../../components/CartDrawer';
import { Eyebrow } from '../../components/Eyebrow';
import { useQuery } from '@tanstack/react-query';
import { fetchMyPets } from '../../api/pets';
import { fetchMySupportUnreadCount } from '../../api/support';
import { Header } from '../../components/Header';
import { 
  Phone, 
  UserCheck, 
  ArrowLeft, 
  Loader2, 
  BookOpen, 
  FileText, 
  Stethoscope, 
  FolderHeart,
  PawPrint,
  ShieldCheck,
  Upload,
  LogOut,
  User,
  X,
  CheckCircle2,
  Lock,
  Headset
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();
  const clearCart = useCartStore((state) => state.clear);
  
  const [isCartOpen, setIsCartOpen] = useState(false);

  const formatPhoneForState = (rawPhone?: string | null) => {
    if (!rawPhone) return '';
    const clean = rawPhone.trim().replace(/[\s\-\(\)]/g, '');
    if (clean.startsWith('+91')) {
      return clean.slice(3);
    }
    return clean;
  };

  // Form State
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(formatPhoneForState(user?.phone));
  const [imageUrl, setImageUrl] = useState(user?.profile_image_url || '');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(formatPhoneForState(user.phone));
      setImageUrl(user.profile_image_url || '');
    }
  }, [user]);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch pets count dynamically for stats ledger
  const { data: pets } = useQuery({
    queryKey: ['pets'],
    queryFn: fetchMyPets,
    enabled: !!accessToken,
  });

  const { data: supportUnreadCount } = useQuery({
    queryKey: ['mySupportUnreadCount'],
    queryFn: fetchMySupportUnreadCount,
    enabled: !!accessToken,
    refetchInterval: 60000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (phone && phone.length !== 10) {
      setErrorMsg('Phone number must be exactly 10 digits.');
      setIsLoading(false);
      return;
    }

    try {
      const updatedUser = await updateUserProfile({
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        phone: phone ? `+91${phone}` : undefined,
        profile_image_url: imageUrl || undefined,
      });

      setAuth(updatedUser, accessToken);
      setSuccessMsg('Profile ledger successfully updated!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || 
        'Failed to save profile changes. Verify details and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      clearAuth();
      clearCart();
      navigate('/login');
    }
  };

  // Phone Verification Modal State
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [verificationStep, setVerificationStep] = useState<1 | 2>(1);
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [isVerifyingLoading, setIsVerifyingLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);

  const [cooldownCountdown, setCooldownCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Manage SMS resend cooldown timer countdown
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cooldownCountdown > 0 && isVerifyingPhone) {
      timer = setInterval(() => {
        setCooldownCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldownCountdown, isVerifyingPhone]);

  const handleStartPhoneVerification = () => {
    if (!phone || phone.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit phone number.');
      return;
    }

    setErrorMsg(null);
    setVerifyError(null);
    setVerificationCode('');
    setVerificationStep(1);
    setIsVerifyingPhone(true);
  };

  const handleSendOtp = async () => {
    setIsVerifyingLoading(true);
    setVerifyError(null);
    const fullPhone = `+91${phone}`;
    try {
      // 1. Backend precheck gate
      const rateLimitResponse = await requestOtpPreCheck(fullPhone);
      if (rateLimitResponse.attempts_remaining !== undefined) {
        setAttemptsRemaining(rateLimitResponse.attempts_remaining);
      }

      // 2. Setup recaptcha
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '<div id="recaptcha-verifier-anchor"></div>';
      }

      const verifier = new RecaptchaVerifier(auth, 'recaptcha-verifier-anchor', {
        size: 'invisible',
      });
      setRecaptchaVerifier(verifier);

      // 3. Request SMS OTP
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, verifier);
      setConfirmResult(confirmation);
      setVerificationStep(2);
      setCooldownCountdown(30);
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      setVerifyError(
        err.response?.data?.detail || 
        err.message || 
        'Failed to send SMS code. Please check your credentials and format.'
      );
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {}
      }
    } finally {
      setIsVerifyingLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationCode) {
      setVerifyError('Please enter the 6-digit OTP code.');
      return;
    }
    setIsVerifyingLoading(true);
    setVerifyError(null);
    try {
      let idToken = '';
      
      // Support bypass token for local sandbox test
      if (verificationCode === '111111') {
        idToken = 'test_firebase_token';
      } else {
        if (!confirmResult) {
          throw new Error('Verification session has expired. Please send OTP again.');
        }
        const userCredential = await confirmResult.confirm(verificationCode);
        idToken = await userCredential.user.getIdToken();
      }

      const updatedUser = await verifyFirebasePhoneToken(idToken);
      
      setAuth(updatedUser, accessToken);
      setSuccessMsg('Phone number verified! Profile updated.');
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsVerifyingPhone(false);
      setIsEditingPhone(false);
      
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('OTP Verification failed:', err);
      setVerifyError(err.response?.data?.detail || err.message || 'Incorrect OTP code. Please try again.');
    } finally {
      setIsVerifyingLoading(false);
    }
  };

  const handleCloseVerification = () => {
    setIsVerifyingPhone(false);
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {}
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const uploadRes = await uploadAvatarImage(file);
      setImageUrl(uploadRes.url);
      setSuccessMsg('Avatar image uploaded successfully! Press "Commit Profile Changes" below to save.');
    } catch (err: any) {
      console.error('File upload failed:', err);
      setErrorMsg(
        err.response?.data?.detail || 
        'Failed to upload image. Please verify file format (JPG, PNG, WebP) and size (under 5MB).'
      );
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <Header activeTab="profile" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8 flex flex-col space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex justify-between items-center border-b border-cardboard border-opacity-35 pb-4">
          <button
            onClick={() => navigate('/shop')}
            className="flex items-center space-x-1.5 font-mono text-[10px] uppercase font-bold tracking-wider text-ink opacity-75 hover:opacity-100 transition-opacity"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Fresh Meal Store</span>
          </button>
          
          <div className="flex items-center space-x-1.5 font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
            <BookOpen className="w-4 h-4 text-herb" />
            <span>Account Registry Ledger</span>
          </div>
        </div>

        {/* Section Header */}
        <div className="space-y-1 text-left">
          <Eyebrow label="ACCOUNT & SECURITY REGISTRY" />
          <h1 className="font-display font-black text-2xl sm:text-4xl text-ink tracking-tight">
            Pet Parent Profile Ledger
          </h1>
          <p className="font-body text-xs sm:text-sm text-ink opacity-75 max-w-2xl mt-1">
            Review your keeper credentials, manage verified phone contacts, and access quick platform operations.
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 font-body text-xs p-3 rounded-sm font-bold text-left">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 font-body text-xs p-3 rounded-sm font-bold text-left flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
          
          {/* Left Column: Avatar & Meta */}
          <div className="lg:col-span-4 bg-paperLight border border-cardboard border-opacity-40 p-6 sm:p-8 rounded-sm flex flex-col items-center relative text-center">
            
            {/* Avatar Frame */}
            <div className="relative mt-2 mb-4">
              <div className="w-36 h-36 bg-paper rounded-sm border border-cardboard border-opacity-40 shadow-xs overflow-hidden flex items-center justify-center shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-paper flex items-center justify-center font-display font-black text-4xl text-turmeric select-none">
                    {user?.first_name ? user.first_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            </div>

            {/* Upload Button */}
            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isUploadingImage}
              className="mb-5 font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:underline flex items-center gap-1.5 border border-cardboard border-opacity-50 px-3 py-1.5 bg-paper rounded-sm disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading Image...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-herb" />
                  <span>Change Profile Photo</span>
                </>
              )}
            </button>

            {/* Name & Role */}
            <h3 className="font-display font-black text-xl text-ink">
              {user?.first_name || user?.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Keeper Account'}
            </h3>
            
            <div className="mt-2 flex items-center space-x-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold px-2.5 py-0.5 bg-paper border border-cardboard border-opacity-40 rounded-sm">
                ROLE: {user?.role}
              </span>
            </div>

            <p className="font-body text-xs text-ink opacity-70 mt-2 font-mono">
              {user?.email}
            </p>

            {/* Meta Stats Grid */}
            <div className="w-full border-t border-dashed border-cardboard border-opacity-35 mt-6 pt-5 grid grid-cols-2 gap-4 text-left font-mono text-[10px]">
              <div className="space-y-0.5">
                <span className="text-ink opacity-60 uppercase block">Auth Method</span>
                <span className="font-bold text-ink flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-herb" />
                  {user?.auth_provider || 'magic_link'}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-ink opacity-60 uppercase block">Registered Pets</span>
                <span className="font-bold text-ink flex items-center gap-1">
                  <PawPrint className="w-3.5 h-3.5 text-turmeric" />
                  {pets?.length || 0} Companions
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Edit Profile Form */}
          <div className="lg:col-span-8 bg-paperLight border border-cardboard border-opacity-40 p-6 sm:p-8 rounded-sm">
            
            <div className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold mb-6 border-b border-cardboard border-opacity-35 pb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Edit Account Information</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
                    First Name
                  </label>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
                    Last Name
                  </label>
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-baseline">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
                    Contact Phone Number
                  </label>
                  {(user?.is_phone_verified && !isEditingPhone) ? (
                    <span className="font-mono text-[9px] text-emerald-700 font-bold flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified via SMS ✓</span>
                    </span>
                  ) : (
                    <span className="font-mono text-[9px] text-amber-800 font-bold">
                      {isEditingPhone ? "Modifying number..." : "Unverified"}
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <div className="relative flex-grow flex items-center border border-cardboard rounded-sm bg-paper focus-within:border-turmeric transition-colors">
                    <div className="pl-3 pr-2 flex items-center space-x-1.5 border-r border-cardboard border-opacity-30 select-none">
                      <Phone className="w-3.5 h-3.5 text-cardboard" />
                      <span className="font-mono text-xs font-bold text-ink">+91</span>
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      disabled={user?.is_phone_verified && !isEditingPhone}
                      className="w-full px-3 py-2 bg-transparent font-mono text-xs text-ink placeholder-cardboard focus:outline-none disabled:opacity-85"
                    />
                  </div>
                  {user?.is_phone_verified && !isEditingPhone ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(true)}
                      className="bg-paper text-ink hover:bg-paperLight font-mono text-[9px] uppercase font-bold px-3 py-2 rounded-sm border border-cardboard cursor-pointer shrink-0 transition-colors"
                    >
                      Change
                    </button>
                  ) : (
                    <div className="flex space-x-1.5 shrink-0">
                      {isEditingPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingPhone(false);
                            setPhone(formatPhoneForState(user?.phone));
                          }}
                          className="bg-paper text-ink hover:bg-paperLight font-mono text-[9px] uppercase font-bold px-3 py-2 rounded-sm border border-cardboard cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleStartPhoneVerification}
                        className="bg-ink hover:bg-opacity-90 text-paper font-mono text-[9px] uppercase font-bold px-3.5 py-2 rounded-sm cursor-pointer transition-colors shadow-xs"
                      >
                        Verify via SMS
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs py-3 rounded-sm tracking-wider uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Profile Changes...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Commit Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Operations Ledger Grid */}
        <div className="w-full bg-paperLight border border-cardboard border-opacity-40 p-6 sm:p-8 rounded-sm">
          <div className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold mb-5 border-b border-cardboard border-opacity-35 pb-2.5">
            🛠️ Platform Operations Ledger
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            
            {/* View Pets */}
            <button
              onClick={() => navigate('/pets')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-35 hover:border-turmeric bg-paper hover:bg-paperLight rounded-sm transition-all text-ink text-left cursor-pointer shadow-xs"
            >
              <div className="p-2.5 bg-amber-50 rounded-sm border border-amber-200">
                <FolderHeart className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">My Pets Ledger</span>
                <span className="font-mono text-[9px] uppercase opacity-70 text-ink">{pets?.length || 0} Registered</span>
              </div>
            </button>

            {/* View Consultations */}
            <button
              onClick={() => navigate('/consultations')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-35 hover:border-turmeric bg-paper hover:bg-paperLight rounded-sm transition-all text-ink text-left cursor-pointer shadow-xs"
            >
              <div className="p-2.5 bg-blue-50 rounded-sm border border-blue-200">
                <Stethoscope className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Vet Consultations</span>
                <span className="font-mono text-[9px] uppercase opacity-70 text-ink">Tele-Health Hub</span>
              </div>
            </button>

            {/* View Orders */}
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-35 hover:border-turmeric bg-paper hover:bg-paperLight rounded-sm transition-all text-ink text-left cursor-pointer shadow-xs"
            >
              <div className="p-2.5 bg-emerald-50 rounded-sm border border-emerald-200">
                <FileText className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Recipe Orders</span>
                <span className="font-mono text-[9px] uppercase opacity-70 text-ink">Tracking & History</span>
              </div>
            </button>

            {/* Support */}
            <button
              onClick={() => navigate('/support')}
              className="relative flex items-center space-x-3 p-4 border border-cardboard border-opacity-35 hover:border-turmeric bg-paper hover:bg-paperLight rounded-sm transition-all text-ink text-left cursor-pointer shadow-xs"
            >
              {!!supportUnreadCount && supportUnreadCount > 0 && (
                <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-paprika text-white text-[9px] font-mono font-bold rounded-full">
                  {supportUnreadCount > 9 ? '9+' : supportUnreadCount}
                </span>
              )}
              <div className="p-2.5 bg-rose-50 rounded-sm border border-rose-200">
                <Headset className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Support</span>
                <span className="font-mono text-[9px] uppercase opacity-70 text-ink">Order & Consult Help</span>
              </div>
            </button>

            {/* Doctor Portal or Apply */}
            {user?.role === 'doctor' ? (
              <button
                onClick={() => navigate('/doctorpanel')}
                className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-35 hover:border-turmeric bg-paper hover:bg-paperLight rounded-sm transition-all text-ink text-left cursor-pointer shadow-xs"
              >
                <div className="p-2.5 bg-indigo-50 rounded-sm border border-indigo-200">
                  <Stethoscope className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <span className="font-body font-bold text-xs block">Doctor Portal</span>
                  <span className="font-mono text-[9px] uppercase opacity-70 text-ink">Practice Desk</span>
                </div>
              </button>
            ) : user?.role === 'admin' ? (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-35 hover:border-turmeric bg-paper hover:bg-paperLight rounded-sm transition-all text-ink text-left cursor-pointer shadow-xs"
              >
                <div className="p-2.5 bg-amber-50 rounded-sm border border-amber-200">
                  <Lock className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <span className="font-body font-bold text-xs block">Admin Dashboard</span>
                  <span className="font-mono text-[9px] uppercase opacity-70 text-ink">Platform Management</span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => navigate('/apply-doctor')}
                className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-35 hover:border-turmeric bg-paper hover:bg-paperLight rounded-sm transition-all text-ink text-left cursor-pointer shadow-xs"
              >
                <div className="p-2.5 bg-purple-50 rounded-sm border border-purple-200">
                  <Stethoscope className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <span className="font-body font-bold text-xs block">Apply as Doctor</span>
                  <span className="font-mono text-[9px] uppercase opacity-70 text-ink">Join Vet Roster</span>
                </div>
              </button>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 p-4 border border-rose-200 hover:border-rose-300 bg-rose-50/50 hover:bg-rose-50 rounded-sm transition-all text-rose-900 text-left cursor-pointer shadow-xs"
            >
              <div className="p-2.5 bg-rose-100 rounded-sm border border-rose-200">
                <LogOut className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Exit Platform</span>
                <span className="font-mono text-[9px] uppercase opacity-80 text-rose-800">Secure Logout</span>
              </div>
            </button>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-cardboard border-opacity-30 py-6 text-center text-ink opacity-60 w-full">
        <p className="font-mono text-[10px] uppercase tracking-wider">
          © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
        </p>
      </footer>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Invisible reCAPTCHA anchor */}
      <div id="recaptcha-container">
        <div id="recaptcha-verifier-anchor"></div>
      </div>

      {/* Phone Verification Modal */}
      {isVerifyingPhone && (
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-paper border border-cardboard rounded-sm shadow-2xl max-w-md w-full p-6 space-y-5 animate-fade-in text-left">
            <div className="flex justify-between items-start border-b border-cardboard border-opacity-35 pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
                  REGISTRY PHONE VERIFICATION
                </span>
                <h3 className="font-display font-black text-xl text-ink">
                  SMS Authentication
                </h3>
              </div>
              <button 
                onClick={handleCloseVerification}
                className="text-ink opacity-70 hover:opacity-100 font-mono text-sm cursor-pointer p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {verifyError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 font-body text-xs p-2.5 rounded-sm font-bold">
                ⚠️ {verifyError}
              </div>
            )}

            {verificationStep === 1 ? (
              <div className="space-y-4">
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  We will send a one-time verification code to your registered profile number: 
                  <strong className="text-ink ml-1 font-mono">+91 {phone}</strong>.
                </p>
                
                <p className="font-mono text-[9px] text-herb opacity-80">
                  * Statically applied prefix (+91) for Indian telecommunication carriers.
                </p>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isVerifyingLoading}
                    className="w-full bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs py-3 rounded-sm tracking-wider uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  >
                    {isVerifyingLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending SMS OTP...</span>
                      </>
                    ) : (
                      <span>Send Verification Code</span>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationStep(2);
                      setVerifyError("Local test mode enabled. Input '111111' to mock verification success.");
                    }}
                    className="w-full bg-paperLight hover:bg-paper text-ink font-mono text-[9px] py-2 rounded-sm border border-cardboard border-opacity-40 uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    ⚡ Local Sandbox Bypass (Bypass SMS)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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
                    className="w-full px-4 py-2 border border-cardboard rounded-sm bg-paperLight font-mono text-center text-lg tracking-widest text-ink focus:outline-none focus:border-turmeric transition-colors"
                  />
                </div>

                <p className="font-body text-xs text-ink opacity-70 leading-relaxed">
                  Enter the verification code sent to your phone. Code is valid for 5 minutes.
                </p>

                {attemptsRemaining !== null && (
                  <p className="font-mono text-[9px] text-paprika font-bold uppercase">
                    Hourly Attempts Remaining: {attemptsRemaining} of 3
                  </p>
                )}

                <div className="pt-2 flex space-x-2">
                  {cooldownCountdown > 0 ? (
                    <button
                      type="button"
                      disabled={true}
                      className="w-1/3 border border-cardboard border-opacity-40 font-mono text-[9px] uppercase py-2.5 rounded-sm text-cardboard cursor-not-allowed text-center bg-transparent"
                    >
                      Resend ({cooldownCountdown}s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isVerifyingLoading}
                      className="w-1/3 border border-cardboard bg-transparent hover:bg-paperLight font-mono text-[9px] uppercase py-2.5 rounded-sm tracking-wider text-ink cursor-pointer transition-colors"
                    >
                      Resend
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isVerifyingLoading}
                    className="w-2/3 bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs py-2.5 rounded-sm tracking-wider uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  >
                    {isVerifyingLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying OTP...</span>
                      </>
                    ) : (
                      <span>Verify Code</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
