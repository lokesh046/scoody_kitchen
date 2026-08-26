import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { useCartStore } from '../store/cart';
import { logoutUser } from '../api/auth';
import { cleanupUnverifiedUsers } from '../api/admin';
import { 
  PawPrint, 
  ShoppingCart, 
  LogOut, 
  User, 
  Menu, 
  X 
} from 'lucide-react';

interface HeaderProps {
  activeTab?: 'shop' | 'pets' | 'consultations' | 'orders' | 'assistant' | 'profile' | 'admin' | 'doctor' | 'apply-doctor';
  onCartToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onCartToggle }) => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const cartItems = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clear);
  
  const cleanupUsersMutation = useMutation({
    mutationFn: (maxAge: number) => cleanupUnverifiedUsers(maxAge),
    onSuccess: (data) => {
      alert(data.message || `Cleaned up unverified accounts successfully.`);
    },
    onError: (err: any) => {
      alert(`Cleanup failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      clearAuth();
      clearCart();
      setIsMobileMenuOpen(false);
      navigate('/login');
    }
  };

  const navLinks = [
    { id: 'onboarding', label: 'Meal Planner 🥗', path: '/onboarding' },
    { id: 'shop', label: 'Shop Recipes', path: '/shop' },
    { id: 'pets', label: 'Know Your Pet', path: '/pets' },
    { id: 'consultations', label: 'Vet Consults', path: '/consultations' },
    { id: 'orders', label: 'My Orders', path: '/orders' },
    { id: 'assistant', label: 'AI Assistant 🐾', path: '/assistant' },
  ];

  return (
    <>
      <header className="w-full border-b border-cardboard border-opacity-25 bg-ink bg-opacity-95 backdrop-blur-md sticky top-0 z-30 shadow-sm text-paper">
        <div className="w-full px-4 lg:px-8 py-4 flex justify-between items-center lg:grid lg:grid-cols-12">
          
          {/* Left Corner: Brand Logo & Title */}
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer lg:col-span-3 justify-start select-none shrink-0" onClick={() => navigate('/')}>
            <PawPrint className="text-turmeric w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            <div>
              <h1 className="font-display font-bold text-lg sm:text-2xl tracking-tight text-paper">
                Scooby's Kitchen
              </h1>
              <p className="font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-turmeric opacity-85 hidden sm:block">
                Notebook Ledger v1.0
              </p>
            </div>
          </div>

          {/* Center: Desktop Navigation Menu */}
          <nav className="hidden lg:flex space-x-4 lg:space-x-6 font-body text-xs font-bold uppercase tracking-wider text-paper lg:col-span-6 justify-center">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => navigate(link.path)}
                className={`hover:text-turmeric transition-colors pb-1 ${
                  activeTab === link.id ? 'text-turmeric font-bold border-b-2 border-turmeric' : ''
                }`}
              >
                {link.label}
              </button>
            ))}
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className={`hover:text-turmeric transition-colors pb-1 ${
                  activeTab === 'admin' ? 'text-turmeric font-bold border-b-2 border-turmeric' : 'text-turmeric'
                }`}
              >
                Admin Panel 🛠️
              </button>
            )}
            {(user?.role === 'doctor' || user?.role === 'admin') && (
              <button
                onClick={() => navigate('/doctor')}
                className={`hover:text-turmeric transition-colors pb-1 ${
                  activeTab === 'doctor' ? 'text-turmeric font-bold border-b-2 border-turmeric' : 'text-turmeric'
                }`}
              >
                Doctor Panel 🩺
              </button>
            )}
            {user?.role === 'customer' && (
              <button
                onClick={() => navigate('/apply-doctor')}
                className={`hover:text-turmeric transition-colors pb-1 ${
                  activeTab === 'apply-doctor' ? 'text-turmeric font-bold border-b-2 border-turmeric' : 'text-turmeric'
                }`}
              >
                Apply as Doctor 🩺
              </button>
            )}
          </nav>

          {/* Right Corner: Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4 lg:col-span-3 justify-end">
            {user?.role === 'admin' && (
              <button
                onClick={() => {
                  if (confirm('Delete all unverified user accounts older than 24 hours?')) {
                    cleanupUsersMutation.mutate(24);
                  }
                }}
                disabled={cleanupUsersMutation.isPending}
                className="bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[9px] uppercase px-3 py-2 font-bold rounded-none hover-bounce disabled:opacity-50 items-center space-x-1 shrink-0 hidden sm:flex"
              >
                <span>{cleanupUsersMutation.isPending ? '🧹 Cleaning...' : '🧹 Cleanup'}</span>
              </button>
            )}

            {user && (
              <span className="font-mono text-[10px] uppercase font-bold text-turmeric hidden sm:inline">
                {user.first_name || 'User'}
              </span>
            )}

            <button 
              onClick={() => onCartToggle?.()}
              className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 relative text-paper"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartQuantity > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-turmeric text-ink font-mono text-[9px] font-bold w-4.5 h-4.5 rounded-none flex items-center justify-center">
                  {totalCartQuantity}
                </span>
              )}
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="hidden lg:flex p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="hidden lg:flex p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <User className="w-3.5 h-3.5" />
                <span>Log In</span>
              </button>
            )}

            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper lg:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Responsive Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          {/* Drawer Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-ink bg-opacity-65 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Sliding Navigation Container */}
          <div className="relative flex-1 flex flex-col max-w-[280px] w-full bg-paper border-r border-cardboard p-6 space-y-6 text-left animate-slide-in shadow-xl z-50">
            <div className="flex justify-between items-center border-b border-cardboard pb-4">
              <div>
                <h4 className="font-display font-bold text-lg text-ink">Scooby's Kitchen</h4>
                <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold">Ledger Menu</span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="text-ink opacity-70 hover:opacity-100 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col space-y-3 flex-grow overflow-y-auto">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate(link.path);
                  }}
                  className={`w-full text-left py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                    activeTab === link.id
                      ? 'bg-paperLight border-cardboard text-ink font-bold'
                      : 'border-transparent text-ink opacity-75 hover:opacity-100 hover:bg-paperLight'
                  }`}
                >
                  {link.label}
                </button>
              ))}

              {user?.role === 'admin' && (
                <div className="space-y-2 border-t border-cardboard border-dashed pt-2">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      navigate('/admin');
                    }}
                    className={`w-full text-left py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                      activeTab === 'admin'
                        ? 'bg-paperLight border-cardboard text-ink font-bold'
                        : 'border-transparent text-turmeric opacity-90 hover:opacity-100 hover:bg-paperLight'
                    }`}
                  >
                    Admin Panel 🛠️
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete all unverified user accounts older than 24 hours?')) {
                        cleanupUsersMutation.mutate(24);
                      }
                    }}
                    disabled={cleanupUsersMutation.isPending}
                    className="w-full text-left py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider border border-dashed border-cardboard text-turmeric hover:bg-paperLight hover:bg-opacity-10"
                  >
                    {cleanupUsersMutation.isPending ? '🧹 Cleaning...' : '🧹 System Cleanup'}
                  </button>
                </div>
              )}

              {(user?.role === 'doctor' || user?.role === 'admin') && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/doctor');
                  }}
                  className={`w-full text-left py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                    activeTab === 'doctor'
                      ? 'bg-paperLight border-cardboard text-ink font-bold'
                      : 'border-transparent text-turmeric opacity-90 hover:opacity-100 hover:bg-paperLight'
                  }`}
                >
                  Doctor Panel 🩺
                </button>
              )}
              {user?.role === 'customer' && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/apply-doctor');
                  }}
                  className={`w-full text-left py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                    activeTab === 'apply-doctor'
                      ? 'bg-paperLight border-cardboard text-ink font-bold'
                      : 'border-transparent text-turmeric opacity-90 hover:opacity-100 hover:bg-paperLight'
                  }`}
                >
                  Apply as Doctor 🩺
                </button>
              )}
            </nav>

            <div className="border-t border-cardboard pt-4 space-y-3">
              {user ? (
                <div className="space-y-3">
                  <div className="px-3 font-mono text-[9px] uppercase text-ink opacity-60">
                    Logged in as: <strong className="text-ink">{user.first_name || 'User'}</strong>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 px-3 border border-cardboard hover:bg-paperLight text-ink flex items-center justify-center space-x-1.5 font-body text-[10px] font-bold uppercase"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full py-2 px-3 border border-cardboard hover:bg-paperLight text-ink flex items-center justify-center space-x-1.5 font-body text-[10px] font-bold uppercase"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Log In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) Cart Shortcut */}
      {totalCartQuantity > 0 && (
        <button
          type="button"
          onClick={() => onCartToggle?.()}
          className="fixed bottom-6 right-6 z-40 bg-turmeric text-ink p-4 rounded-full border-double border-4 border-cardboard shadow-2xl hover:scale-105 hover:-translate-y-1 active:translate-y-0 active:scale-100 transition-all duration-300 flex items-center justify-center group cursor-pointer hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
          title="Open Cart Drawer"
        >
          <ShoppingCart className="w-6 h-6 animate-pulse group-hover:scale-110 transition-transform duration-300" />
          <span className="absolute -top-1.5 -right-1.5 bg-ink text-paper font-mono text-[10px] font-black w-5.5 h-5.5 rounded-full flex items-center justify-center border border-cardboard shadow-sm">
            {totalCartQuantity}
          </span>
        </button>
      )}
    </>
  );
};
