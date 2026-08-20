import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { refreshToken } from './api/client';
import { Loader2 } from 'lucide-react';
import { AuthPage } from './features/auth/AuthPage';
import { VerifyCallback } from './features/auth/VerifyCallback';
import { ProductDetailPage } from './features/products/ProductDetailPage';
import { useCartStore } from './store/cart';
import { RequireAuth } from './components/RequireAuth';
import { CheckoutPage } from './features/checkout/CheckoutPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { PetsPage } from './features/pets/PetsPage';
import { ConsultationsPage } from './features/consultations/ConsultationsPage';
import { AssistantPage } from './features/chatbot/AssistantPage';
import { ChatbotWidget } from './components/ChatbotWidget';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { DoctorDashboard } from './features/doctor/DoctorDashboard';
import { ProfilePage } from './features/profile/ProfilePage';
import HomePage from './features/home/HomePage';
import ShopPage from './features/shop/ShopPage';

function AuthEventListener() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const user = useAuthStore((state) => state.user);
  const loadCart = useCartStore((state) => state.loadCart);
  const clearCart = useCartStore((state) => state.clear);

  useEffect(() => {
    if (user) {
      loadCart();
    } else {
      clearCart();
    }
  }, [user, loadCart, clearCart]);

  useEffect(() => {
    const handleAuthExpired = () => {
      clearAuth();
      clearCart();
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [clearAuth, clearCart, navigate]);

  return null;
}

function SessionProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const wasLoggedIn = localStorage.getItem('scooby_logged_in') === 'true';
        
        if (!wasLoggedIn) {
          // Guest user - resolve instantly with zero backend calls
          setIsInitializing(false);
          return;
        }

        try {
          // Logged-in user - fetch new token and user profile (shared/deduplicated to prevent race conditions)
          await refreshToken();
        } catch (refreshErr) {
          // Refresh expired or invalid - clear auth
          clearAuth();
        }
      } catch (err) {
        clearAuth();
      } finally {
        setIsInitializing(false);
      }
    };
    initSession();
  }, [setAuth, clearAuth]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
          <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
            Verifying secure session ledger...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// React Query Wrapper
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <AuthEventListener />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/auth/verify" element={<VerifyCallback />} />
            <Route path="/auth/magic-link/verify" element={<VerifyCallback />} />
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
            <Route path="/pets" element={<RequireAuth><PetsPage /></RequireAuth>} />
            <Route path="/consultations" element={<RequireAuth><ConsultationsPage /></RequireAuth>} />
            <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth adminOnly={true}><AdminDashboard /></RequireAuth>} />
            <Route path="/doctor" element={<RequireAuth doctorOnly={true}><DoctorDashboard /></RequireAuth>} />
          </Routes>
          <ChatbotWidget />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
