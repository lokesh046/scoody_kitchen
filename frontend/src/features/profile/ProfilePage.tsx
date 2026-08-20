import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser, updateUserProfile, uploadAvatarImage } from '../../api/auth';
import { CartDrawer } from '../../components/CartDrawer';
import { useQuery } from '@tanstack/react-query';
import { fetchMyPets } from '../../api/pets';
import { 
  User, 
  Phone, 
  Image as ImageIcon, 
  UserCheck, 
  ArrowLeft, 
  Loader2, 
  BookOpen, 
  LogOut, 
  FileText, 
  Stethoscope, 
  FolderHeart,
  ShoppingCart,
  PawPrint,
  ShieldCheck,
  Upload
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();
  const { items: cartItems, clear: clearCart } = useCartStore();
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Form State
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [imageUrl, setImageUrl] = useState(user?.profile_image_url || '');

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
      <header className="w-full border-b border-cardboard border-opacity-25 bg-ink bg-opacity-95 backdrop-blur-md sticky top-0 z-30 shadow-sm text-paper">
        <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center md:grid md:grid-cols-12">
          
          {/* Left Corner: Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer md:col-span-3 justify-start select-none" onClick={() => navigate('/')}>
            <PawPrint className="text-turmeric w-6 h-6 animate-pulse" />
            <div>
              <h1 className="font-display font-bold text-2xl tracking-tight text-paper">
                Scooby's Kitchen
              </h1>
              <p className="font-mono text-[9px] uppercase tracking-wider text-turmeric opacity-85">
                Notebook Ledger v1.0
              </p>
            </div>
          </div>

          {/* Center: Navigation Menu */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6 font-body text-xs font-bold uppercase tracking-wider text-paper md:col-span-6 justify-center">
            <button onClick={() => navigate('/shop')} className="hover:text-turmeric transition-colors pb-1">Shop Recipes</button>
            <button onClick={() => navigate('/pets')} className="hover:text-turmeric transition-colors pb-1">Pets Ledger</button>
            <button onClick={() => navigate('/consultations')} className="hover:text-turmeric transition-colors pb-1">Vet Consults</button>
            <button onClick={() => navigate('/orders')} className="hover:text-turmeric transition-colors pb-1">My Orders</button>
            <button onClick={() => navigate('/assistant')} className="hover:text-turmeric transition-colors pb-1">AI Assistant 🐾</button>
            <button onClick={() => navigate('/profile')} className="hover:text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">My Profile</button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Admin Panel 🛠️</button>
            )}
            {(user?.role === 'doctor' || user?.role === 'admin') && (
              <button onClick={() => navigate('/doctor')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Doctor Panel 🩺</button>
            )}
          </nav>

          {/* Right Corner: Actions */}
          <div className="flex items-center space-x-4 md:col-span-3 justify-end">
            {user && (
              <span className="font-mono text-[10px] uppercase font-bold text-turmeric">
                {user.first_name || 'User'}
              </span>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 relative text-paper"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartQuantity > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-paprika text-paperLight font-mono text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                  {totalCartQuantity}
                </span>
              )}
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log In</span>
              </button>
            )}
          </div>
        </div>
      </header>

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

        {/* Success / Error Messages */}
        {errorMsg && (
          <div className="bg-red-50 border border-paprika text-paprika font-body text-xs p-3 rounded-none font-bold text-left">
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
            
            {/* Circular profile image container */}
            <div className="relative group mt-6 mb-4">
              <div className="w-40 h-40 rounded-full border border-cardboard overflow-hidden bg-paper flex items-center justify-center relative z-10 transition-transform group-hover:scale-[1.01]">
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
                  <User className="w-16 h-16 text-cardboard" />
                )}
              </div>
              <div className="absolute -inset-2 rounded-full border border-dashed border-cardboard opacity-20 group-hover:opacity-40 transition-opacity"></div>
            </div>

            {/* Interactive Image Upload Action Button */}
            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isUploadingImage}
              className="mb-6 font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:text-ink transition-colors flex items-center gap-1.5 border border-cardboard border-opacity-50 px-3 py-1.5 bg-paper hover:bg-paperLight rounded-none disabled:opacity-50"
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
            <h2 className="font-display font-bold text-2xl text-ink leading-tight px-2">
              {user?.first_name || user?.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Anonymous Keeper'}
            </h2>
            
            <span className="font-mono text-[9px] uppercase tracking-widest text-herb font-bold mt-2 px-3 py-1 bg-paper border border-cardboard border-opacity-40 rounded-none">
              {user?.role}
            </span>

            <p className="font-body text-xs text-ink opacity-65 mt-3">
              {user?.email}
            </p>

            {/* Decorative Account Ledger stats grid */}
            <div className="w-full border-t border-dashed border-cardboard mt-8 pt-6 grid grid-cols-2 gap-4 text-left">
              <div className="space-y-0.5">
                <span className="font-mono text-[8px] uppercase opacity-50 block">Auth Provider</span>
                <span className="font-body text-xs font-bold text-ink flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-herb" />
                  {user?.auth_provider || 'magic_link'}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-[8px] uppercase opacity-50 block">Registered Dogs</span>
                <span className="font-body text-xs font-bold text-ink flex items-center gap-1">
                  <PawPrint className="w-3.5 h-3.5 text-herb" />
                  {pets?.length || 0} Pets
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE COLUMN: Edit Profile details input forms */}
          <div className="lg:col-span-8 bg-paperLight border border-cardboard border-opacity-40 p-8 md:p-10 rounded-none min-h-[460px]">
            
            <div className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold mb-6 border-b border-cardboard border-opacity-25 pb-3 flex items-center gap-1">
              <span>📒 Edit Registry Details</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 text-left">
              {/* First & Last Name Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold block">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cardboard" />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold block">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cardboard" />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Phone Number Input */}
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold block">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cardboard" />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>
              </div>

              {/* Avatar URL Input */}
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold block">
                  Avatar Image URL
                </label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cardboard" />
                  <input
                    type="url"
                    placeholder="Avatar URL"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-cardboard border-opacity-60 rounded-none bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs py-3.5 rounded-none tracking-wide uppercase transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
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
          
          <div className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold mb-6 border-b border-cardboard border-opacity-25 pb-3 block">
            🛠️ Platform Operations Ledger
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            
            {/* View Pets Ledger */}
            <button
              onClick={() => navigate('/pets')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-50 hover:bg-paper rounded-none transition-colors text-ink text-left"
            >
              <div className="p-2.5 bg-paperLight rounded-none border border-cardboard border-opacity-40">
                <FolderHeart className="w-5 h-5 text-herb" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">My Pets Ledger</span>
                <span className="font-mono text-[8px] uppercase opacity-60">Register new dogs</span>
              </div>
            </button>

            {/* View Consultations */}
            <button
              onClick={() => navigate('/consultations')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-50 hover:bg-paper rounded-none transition-colors text-ink text-left"
            >
              <div className="p-2.5 bg-paperLight rounded-none border border-cardboard border-opacity-40">
                <Stethoscope className="w-5 h-5 text-herb" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Vet Consultations</span>
                <span className="font-mono text-[8px] uppercase opacity-60">Scheduled logs</span>
              </div>
            </button>

            {/* View Orders */}
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center space-x-3 p-4 border border-cardboard border-opacity-50 hover:bg-paper rounded-none transition-colors text-ink text-left"
            >
              <div className="p-2.5 bg-paperLight rounded-none border border-cardboard border-opacity-40">
                <FileText className="w-5 h-5 text-herb" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Recipe Orders</span>
                <span className="font-mono text-[8px] uppercase opacity-60">Transaction files</span>
              </div>
            </button>

            {/* Log Out */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-3 p-4 border border-paprika border-opacity-30 hover:bg-red-50 hover:bg-opacity-50 rounded-none transition-colors text-paprika text-left"
            >
              <div className="p-2.5 bg-paperLight rounded-none border border-paprika border-opacity-30">
                <LogOut className="w-5 h-5 text-paprika" />
              </div>
              <div>
                <span className="font-body font-bold text-xs block">Exit Platform</span>
                <span className="font-mono text-[8px] uppercase opacity-75">Securely Logout</span>
              </div>
            </button>

          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-cardboard border-opacity-25 pt-8 text-center text-ink opacity-60 w-full mt-12">
          <p className="font-mono text-[9px] uppercase tracking-wider">
            © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
          </p>
          <p className="font-body text-[10px] mt-1 max-w-md mx-auto leading-relaxed">
            Tested and crafted with love for pet parents who care about what goes in the bowl.
          </p>
        </footer>
      </main>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
