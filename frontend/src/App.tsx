import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { refreshToken } from './api/client';
import { Loader2 } from 'lucide-react';
import { useCartStore } from './store/cart';
import { RequireAuth } from './components/RequireAuth';
import { ChatbotWidget } from './components/ChatbotWidget';

// Route-level code splitting via React.lazy
const HomePage = lazy(() => import('./features/home/HomePage'));
const ShopPage = lazy(() => import('./features/shop/ShopPage'));
const AuthPage = lazy(() => import('./features/auth/AuthPage').then((m) => ({ default: m.AuthPage })));
const VerifyCallback = lazy(() => import('./features/auth/VerifyCallback').then((m) => ({ default: m.VerifyCallback })));
const ProductDetailPage = lazy(() => import('./features/products/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const CheckoutPage = lazy(() => import('./features/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrdersPage = lazy(() => import('./features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const PetsPage = lazy(() => import('./features/pets/PetsPage').then((m) => ({ default: m.PetsPage })));
const ConsultationsPage = lazy(() => import('./features/consultations/ConsultationsPage').then((m) => ({ default: m.ConsultationsPage })));
const VideoCallPage = lazy(() => import('./features/consultations/VideoCallPage').then((m) => ({ default: m.VideoCallPage })));
const AssistantPage = lazy(() => import('./features/chatbot/AssistantPage').then((m) => ({ default: m.AssistantPage })));
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminDoctorsPage = lazy(() => import('./features/admin/AdminDoctorsPage').then((m) => ({ default: m.AdminDoctorsPage })));
const AdminOrdersPage = lazy(() => import('./features/admin/AdminOrdersPage'));
const AdminSupportPage = lazy(() => import('./features/admin/AdminSupportPage'));
const SupportPage = lazy(() => import('./features/support/SupportPage'));
const SupportTicketPage = lazy(() => import('./features/support/SupportTicketPage'));
const DoctorDashboard = lazy(() => import('./features/doctor/DoctorDashboard').then((m) => ({ default: m.DoctorDashboard })));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const ApplyDoctorPage = lazy(() => import('./features/consultations/ApplyDoctorPage'));
const OnboardingPage = lazy(() => import('./features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));

function RouteLoadingFallback() {
  return (
    <div className="min-h-[60vh] bg-paper flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
        <p className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
          Loading Scooby Kitchen... 🐾
        </p>
      </div>
    </div>
  );
}

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
      staleTime: 5000,
    },
  },
});

import { WebSocketNotificationListener } from './components/WebSocketNotificationListener';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <AuthEventListener />
          <WebSocketNotificationListener />
          <Suspense fallback={<RouteLoadingFallback />}>
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
              <Route path="/consultations/:id" element={<RequireAuth><ConsultationsPage /></RequireAuth>} />
              <Route path="/consultations/:id/call" element={<RequireAuth><VideoCallPage /></RequireAuth>} />
              <Route path="/consultations/room/:id" element={<RequireAuth><VideoCallPage /></RequireAuth>} />
              <Route path="/apply-doctor" element={<RequireAuth><ApplyDoctorPage /></RequireAuth>} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
              <Route path="/support" element={<RequireAuth><SupportPage /></RequireAuth>} />
              <Route path="/support/:ticketId" element={<RequireAuth><SupportTicketPage /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth adminOnly={true}><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/doctors" element={<RequireAuth adminOnly={true}><AdminDoctorsPage /></RequireAuth>} />
              <Route path="/admin/orders" element={<RequireAuth adminOnly={true}><AdminOrdersPage /></RequireAuth>} />
              <Route path="/admin/support" element={<RequireAuth adminOnly={true}><AdminSupportPage /></RequireAuth>} />
              <Route path="/doctor" element={<RequireAuth doctorOnly={true}><DoctorDashboard /></RequireAuth>} />
              <Route path="/doctor/dashboard" element={<RequireAuth doctorOnly={true}><DoctorDashboard /></RequireAuth>} />
            </Routes>
          </Suspense>
          <ChatbotWidget />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
