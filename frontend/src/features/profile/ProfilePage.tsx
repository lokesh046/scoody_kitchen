import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser, updateUserProfile, uploadAvatarImage, verifyFirebasePhoneToken, requestOtpPreCheck } from '../../api/auth';
import { auth } from '../../api/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { CartDrawer } from '../../components/CartDrawer';
import { useQuery } from '@tanstack/react-query';
import { fetchMyPets } from '../../api/pets';
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
  User
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();
  const clearCart = useCartStore((state) => state.clear);
  
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [imageUrl, setImageUrl] = useState(user?.profile_image_url || '');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updatedUser = await updateUserProfile({
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        phone: phone || undefined,
        profile_image_url: imageUrl || undefined,
      });

      setAuth(updatedUser, accessToken);
      setSuccessMsg('Profile ledger successfully updated!');
      setTimeout(() => setSuccessMsg(null), 3000);
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
    if (!phone) {
      setErrorMsg('Please enter a phone number in profile registry first.');
      return;
    }

    // Clean spaces, dashes, and parentheses
    let formattedPhone = phone.trim().replace(/[\s\-\(\)]/g, '');

    // Auto-prepend +91 if country prefix starts without '+'
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('91') && formattedPhone.length > 10) {
        formattedPhone = '+' + formattedPhone;
      } else {
        formattedPhone = '+91' + formattedPhone;
      }
    }

    // Update input state for the user to see the formatted code
    setPhone(formattedPhone);

    // Validate using simple regex matches
    if (!/^\+[1-9]\d{1,14}$/.test(formattedPhone)) {
      setErrorMsg('Invalid phone number format. Please check the digits.');
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
    try {
      // 1. Call Backend Pre-check Gate to verify Redis rate limits
      const rateLimitResponse = await requestOtpPreCheck(phone);
      if (rateLimitResponse.attempts_remaining !== undefined) {
        setAttemptsRemaining(rateLimitResponse.attempts_remaining);
      }

      // 2. Clear previous recaptcha if any
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '<div id="recaptcha-verifier-anchor"></div>';
      }

      const verifier = new RecaptchaVerifier(auth, 'recaptcha-verifier-anchor', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        }
      });
      setRecaptchaVerifier(verifier);

      // 3. Request SMS OTP from Firebase SDK
      const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
      setConfirmResult(confirmation);
      setVerificationStep(2);
      
      // 4. Reset resend cooldown timer
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
      
      // Support bypass token for local sandbox developer test
      if (verificationCode === '111111') {
        idToken = 'test_firebase_token';
      } else {
        if (!confirmResult) {
          throw new Error('Verification session has expired. Please send OTP again.');
        }
        const userCredential = await confirmResult.confirm(verificationCode);
        idToken = await userCredential.user.getIdToken();
      }

      // Verify token on FastAPI backend
      const updatedUser = await verifyFirebasePhoneToken(idToken);
      
      // Update local storage and stores
      setAuth(updatedUser, accessToken);
      setSuccessMsg('Phone number successfully verified! Profile updated.');
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsVerifyingPhone(false);
      setIsEditingPhone(false);
      
      // Cleanup recaptcha
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

  // Trigger file input dialog
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Upload local image files directly to the backend storage provider
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
        fileInputRef.current.value = ''; // Reset input element
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Hidden file input for native uploads */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="profile" onCartToggle={() => setIsCartOpen(true)} />

      {/* Full-width Main Wrapper using all available space */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8 flex flex-col relative space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex justify-between items-center border-b border-cardboard border-opacity-20 pb-4">
          <button
            onClick={() => navigate('/shop')}
            className="flex items-center space-x-1 font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Shop Recipes</span>
          </button>
          
          <div className="flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-herb" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
              Account Registry Ledger
            </span>
          </div>
        </div>

        {/* Bold Brand Title Header */}
        <div className="space-y-1.5 text-left mb-6">
          <h2 className="font-display font-black text-4xl uppercase tracking-tight text-ink">
            Keeper Registry Profile
          </h2>
          <p className="font-body text-xs text-ink opacity-70">
            View stats, register companion details, and adjust platform settings.
          </p>
        </div>

        {/* Success / Error Messages */}
        {errorMsg && (
          <div className="bg-red-50 border border-turmeric text-paprika font-body text-xs p-3 rounded-none font-bold text-left">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-herb text-herb font-body text-xs p-3 rounded-none font-bold text-left">
            ✨ {successMsg}
          </div>
        )}

        {/* WIDE TWO-COLUMN PROFILE CONTAINER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
          
          {/* LEFT SIDE COLUMN: Profile circular avatar picture and meta ledger information */}
          <div className="lg:col-span-4 bg-paperLight border border-cardboard border-opacity-40 p-8 rounded-none flex flex-col items-center relative text-center min-h-[460px]">
            
            {/* Polaroid profile image container */}
            <div className="relative mt-6 mb-6">
              <div className="w-40 h-40 bg-white p-2 border border-cardboard shadow-md rotate-[-2deg] flex items-center justify-center shrink-0 z-10">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover polaroid-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-paper flex items-center justify-center font-display font-black text-5xl text-turmeric select-none">
                    {user?.first_name ? user.first_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Image Upload Action Button */}
            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isUploadingImage}
              className="mb-6 font-mono text-[10px] uppercase font-bold tracking-wider text-paprika hover:text-ink transition-colors flex items-center gap-1.5 border border-cardboard border-opacity-50 px-3 py-1.5 bg-paper hover:bg-paperLight rounded-none disabled:opacity-50 cursor-pointer"
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading Image...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Picture</span>
                </>
              )}
            </button>

            {/* Centered Username & Core details */}
            <h3 className="font-display font-black text-2xl text-ink uppercase tracking-tight leading-tight px-2">
              {user?.first_name || user?.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Anonymous Keeper'}
            </h3>
            
            <span className="font-mono text-[10px] uppercase tracking-widest text-paprika font-bold mt-2 px-3.5 py-1 bg-paper border border-cardboard border-opacity-40 rounded-none">
              {user?.role}
            </span>

            <p className="font-body text-xs text-ink opacity-65 mt-3">
              {user?.email}
            </p>

            {/* Decorative Account Ledger stats grid */}
            <div className="w-full border-t border-dashed border-cardboard mt-8 pt-6 grid grid-cols-2 gap-4 text-left">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] uppercase opacity-70 block text-ink">Auth Provider</span>
                <span className="font-body text-xs font-bold text-ink flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-paprika" />
                  {user?.auth_provider || 'magic_link'}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] uppercase opacity-70 block text-ink">Registered Dogs</span>
                <span className="font-body text-xs font-bold text-ink flex items-center gap-1">
                  <PawPrint className="w-3.5 h-3.5 text-paprika" />
                  {pets?.length || 0} Pets
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE COLUMN: Edit Profile details input forms */}
          <div className="lg:col-span-8 bg-paperLight border border-cardboard border-opacity-40 p-8 md:p-10 rounded-none min-h-[460px]">
            
            <div className="font-mono text-xs uppercase tracking-wider text-paprika font-bold mb-6 border-b border-cardboard border-opacity-25 pb-3 flex items-center gap-1">
              <span>📒 Edit Registry Details</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 text-left">
              {/* First & Last Name Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cardboard" />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-body text-sm text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cardboard" />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-body text-sm text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Phone Number Input */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-baseline">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">
                    Phone Number
                  </label>
                  {(user?.is_phone_verified && !isEditingPhone) ? (
                    <span className="font-mono text-[10px] text-paprika font-bold flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verified via SMS</span>
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-paprika font-bold">
                      {isEditingPhone ? "Modifying..." : "Unverified"}
                    </span>
                  )}
                </div>
                <div className="flex space-x-3">
                  <div className="relative flex-grow">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cardboard" />
                    <input
                      type="text"
                      placeholder="+919876543210 (with country code)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={user?.is_phone_verified && !isEditingPhone}
                      className="w-full pl-9 pr-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-body text-sm text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors disabled:opacity-85"
                    />
                  </div>
                  {user?.is_phone_verified && !isEditingPhone ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(true)}
                      className="bg-ink text-paper hover:bg-opacity-95 font-mono text-[10px] uppercase font-bold px-4 py-2.5 rounded-none border border-cardboard cursor-pointer shrink-0 transition-colors"
                    >
                      Change Number
                    </button>
                  ) : (
                    <div className="flex space-x-2 shrink-0">
                      {isEditingPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingPhone(false);
                            setPhone(user?.phone || '');
                          }}
                          className="bg-paper text-ink hover:bg-paperLight font-mono text-[10px] uppercase font-bold px-3 py-2.5 rounded-none border border-cardboard cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleStartPhoneVerification}
                        className="bg-ink text-paper hover:bg-opacity-95 font-mono text-[10px] uppercase font-bold px-4 py-2.5 rounded-none border border-cardboard cursor-pointer transition-colors"
                      >
                        Verify via SMS
                      </button>
                    </div>
                  )}
                </div>
              </div>



              {/* Submit button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs py-3.5 rounded-none tracking-wide uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Committing Changes...</span>
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

        {/* BOTTOM SECTION: Operations & Actions Ledger (Spans full horizontal page width) */}
        <div className="w-full bg-paperLight border border-cardboard border-opacity-40 p-8 rounded-none">
          
          <div className="font-mono text-xs uppercase tracking-wider text-paprika font-bold mb-6 border-b border-cardboard border-opacity-25 pb-3 block">
            🛠️ Platform Operations Ledger
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            
            {/* View Pets Ledger */}
            <button
              onClick={() => navigate('/pets')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-50 hover:bg-paper rounded-none transition-colors text-ink text-left"
            >
              <div className="p-2.5 bg-paperLight rounded-none border border-cardboard border-opacity-40">
                <FolderHeart className="w-5 h-5 text-paprika" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">My Pets Ledger</span>
                <span className="font-mono text-[10px] uppercase opacity-70 text-ink">Register new dogs</span>
              </div>
            </button>

            {/* View Consultations */}
            <button
              onClick={() => navigate('/consultations')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-50 hover:bg-paper rounded-none transition-colors text-ink text-left"
            >
              <div className="p-2.5 bg-paperLight rounded-none border border-cardboard border-opacity-40">
                <Stethoscope className="w-5 h-5 text-paprika" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Vet Consultations</span>
                <span className="font-mono text-[10px] uppercase opacity-70 text-ink">Scheduled logs</span>
              </div>
            </button>

            {/* View Orders */}
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-50 hover:bg-paper rounded-none transition-colors text-ink text-left"
            >
              <div className="p-2.5 bg-paperLight rounded-none border border-cardboard border-opacity-40">
                <FileText className="w-5 h-5 text-paprika" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Recipe Orders</span>
                <span className="font-mono text-[10px] uppercase opacity-70 text-ink">Transaction files</span>
              </div>
            </button>

            {/* Apply as Doctor */}
            {user?.role === 'customer' && (
              <button
                onClick={() => navigate('/apply-doctor')}
                className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-50 hover:bg-paper rounded-none transition-colors text-ink text-left cursor-pointer"
              >
                <div className="p-2.5 bg-paperLight rounded-none border border-cardboard border-opacity-40">
                  <Stethoscope className="w-5 h-5 text-paprika" />
                </div>
                <div>
                  <span className="font-body font-bold text-xs block">Apply as Doctor</span>
                  <span className="font-mono text-[10px] uppercase opacity-70 text-ink">Onboard your profile</span>
                </div>
              </button>
            )}

            {/* Log Out */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 p-4 border border-turmeric border-opacity-30 hover:bg-red-50 hover:bg-opacity-50 rounded-none transition-colors text-paprika text-left cursor-pointer"
            >
              <div className="p-2.5 bg-paperLight rounded-none border border-turmeric border-opacity-30">
                <LogOut className="w-5 h-5 text-paprika" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Exit Platform</span>
                <span className="font-mono text-[10px] uppercase opacity-85 text-paprika">Securely Logout</span>
              </div>
            </button>

          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-cardboard border-opacity-25 pt-8 text-center text-ink opacity-60 w-full mt-12">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
            © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
          </p>
          <p className="font-body text-xs mt-1 max-w-md mx-auto leading-relaxed">
            Tested and crafted with love for pet parents who care about what goes in the bowl.
          </p>
        </footer>
      </main>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container">
        <div id="recaptcha-verifier-anchor"></div>
      </div>

      {/* Retro Ledger Phone Verification Modal */}
      {isVerifyingPhone && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border-double border-4 border-cardboard rounded-none shadow-2xl max-w-md w-full p-6 space-y-6 animate-fade-in text-left">
            <div className="flex justify-between items-start border-b border-cardboard border-opacity-30 pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">
                  REGISTRY PHONE VERIFICATION
                </span>
                <h3 className="font-display font-black text-2xl text-ink uppercase tracking-tight">
                  SMS Authentication
                </h3>
              </div>
              <button 
                onClick={handleCloseVerification}
                className="text-ink hover:text-paprika font-mono font-bold text-sm cursor-pointer border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            {verifyError && (
              <div className="bg-red-50 border border-turmeric text-paprika font-body text-xs p-2.5 rounded-none font-bold">
                ⚠️ {verifyError}
              </div>
            )}

            {verificationStep === 1 ? (
              <div className="space-y-4">
                <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                  We will send a one-time verification code to your registered profile number: 
                  <strong className="text-ink ml-1 font-mono">{phone}</strong>.
                </p>
                
                <p className="font-mono text-[10px] text-paprika opacity-80">
                  * Verify your phone format includes the "+" symbol and country prefix.
                </p>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isVerifyingLoading}
                    className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs py-3.5 rounded-none tracking-wide uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer border-0"
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
                    className="w-full bg-paper hover:bg-paperLight text-ink font-mono text-[10px] py-2 rounded-none border border-cardboard border-opacity-50 uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    ⚡ Local Sandbox Bypass (Bypass SMS)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">
                    Enter 6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-mono text-center text-lg tracking-widest text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>

                <p className="font-body text-xs text-ink opacity-70 leading-relaxed">
                  Enter the verification code sent to your phone. Code is valid for 5 minutes.
                </p>

                {attemptsRemaining !== null && (
                  <p className="font-mono text-[10px] text-paprika font-bold uppercase">
                    Hourly Attempts Remaining: {attemptsRemaining} of 3
                  </p>
                )}

                <div className="pt-2 flex space-x-3">
                  {cooldownCountdown > 0 ? (
                    <button
                      type="button"
                      disabled={true}
                      className="w-1/3 border border-cardboard border-opacity-40 font-mono text-[10px] uppercase py-3 rounded-none text-cardboard cursor-not-allowed text-center bg-transparent"
                    >
                      Resend ({cooldownCountdown}s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isVerifyingLoading}
                      className="w-1/3 border border-cardboard bg-transparent hover:bg-paper font-mono text-[11px] uppercase py-3 rounded-none tracking-wide text-ink cursor-pointer transition-colors"
                    >
                      Resend
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isVerifyingLoading}
                    className="w-2/3 bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs py-3 rounded-none tracking-wide uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer border-0"
                  >
                    {isVerifyingLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verify OTP...</span>
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
