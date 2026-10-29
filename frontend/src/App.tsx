import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { refreshToken } from './api/client';
import { Loader2 } from 'lucide-react';
import { useCartStore } from './store/cart';
import { RequireAuth } from './components/RequireAuth';
import { ChatbotWidget } from './components/ChatbotWidget';
import { PhoneVerificationGate } from './components/PhoneVerificationGate';
import { ScrollToTop } from './components/ScrollToTop';

// Route-level code splitting via React.lazy
const HomePage = lazy(() => import('./features/home/HomePage'));
const ShopPage = lazy(() => import('./features/shop/ShopPage'));
const ShopLandingPage = lazy(() => import('./features/shop/ShopLandingPage').then((m) => ({ default: m.ShopLandingPage })));
const AuthPage = lazy(() => import('./features/auth/AuthPage').then((m) => ({ default: m.AuthPage })));
const VerifyCallback = lazy(() => import('./features/auth/VerifyCallback').then((m) => ({ default: m.VerifyCallback })));
const ProductDetailPage = lazy(() => import('./features/products/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const CheckoutPage = lazy(() => import('./features/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrdersPage = lazy(() => import('./features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const PetsPage = lazy(() => import('./features/pets/PetsPage').then((m) => ({ default: m.PetsPage })));
const PetsLandingPage = lazy(() => import('./features/pets/PetsLandingPage').then((m) => ({ default: m.PetsLandingPage })));
const ConsultationsPage = lazy(() => import('./features/consultations/ConsultationsPage').then((m) => ({ default: m.ConsultationsPage })));
const VetLandingPage = lazy(() => import('./features/consultations/VetLandingPage').then((m) => ({ default: m.VetLandingPage })));
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
const BlogListPage = lazy(() => import('./features/blog/BlogListPage').then((m) => ({ default: m.BlogListPage })));
const BlogPostPage = lazy(() => import('./features/blog/BlogPostPage').then((m) => ({ default: m.BlogPostPage })));
const PrivacyPolicyPage = lazy(() => import('./features/legal/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./features/legal/TermsPage').then((m) => ({ default: m.TermsPage })));
const NotFoundPage = lazy(() => import('./components/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

// The dark landing pages. Their loading screens must be dark too, or every visit flashes a
// cream screen before the dark hero. Keep this list in sync with the inline script in index.html.
const DARK_LANDING_PATHS = new Set(['/', '/shop', '/pets', '/consultations']);
const isDarkLandingPath = () =>
  typeof window !== 'undefined' &&
  DARK_LANDING_PATHS.has(window.location.pathname.replace(/\/+$/, '') || '/');

// index.html marks the page `dark-landing` on first load so the body is dark before React draws
// anything; this keeps that mark correct as the visitor navigates between dark and light pages.
function DarkLandingBackground() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark-landing',
      DARK_LANDING_PATHS.has(pathname.replace(/\/+$/, '') || '/'),
    );
  }, [pathname]);
  return null;
}

function RouteLoadingFallback() {
  const dark = isDarkLandingPath();
  return (
    <div className={`${dark ? 'min-h-screen bg-midnight' : 'min-h-[60vh] bg-paper'} flex items-center justify-center`}>
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
        <p className={`font-mono text-[9px] uppercase tracking-wider font-bold ${dark ? 'text-turmeric' : 'text-herb'}`}>
          Loading Hearth & One... 🐾
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
    const dark = isDarkLandingPath();
    return (
      <div className={`min-h-screen ${dark ? 'bg-midnight' : 'bg-paper'} flex items-center justify-center`}>
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
          <p className={`font-mono text-[10px] uppercase tracking-wider font-bold ${dark ? 'text-turmeric' : 'text-herb'}`}>
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
        <ScrollToTop />
        <SessionProvider>
          <AuthEventListener />
          <DarkLandingBackground />
          <WebSocketNotificationListener />
          <PhoneVerificationGate />
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopLandingPage />} />
              <Route path="/shop/app" element={<ShopPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/auth/verify" element={<VerifyCallback />} />
              <Route path="/auth/magic-link/verify" element={<VerifyCallback />} />
              <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
              <Route path="/product/:id" element={<ProductDetailPage />} />
              <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
              <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
              <Route path="/pets" element={<PetsLandingPage />} />
              <Route path="/pets/app" element={<RequireAuth><PetsPage /></RequireAuth>} />
              <Route path="/consultations" element={<VetLandingPage />} />
              <Route path="/consultations/app" element={<RequireAuth><ConsultationsPage /></RequireAuth>} />
              <Route path="/consultations/:id" element={<RequireAuth><ConsultationsPage /></RequireAuth>} />
              <Route path="/consultations/:id/call" element={<RequireAuth><VideoCallPage /></RequireAuth>} />
              <Route path="/consultations/room/:id" element={<RequireAuth><VideoCallPage /></RequireAuth>} />
              <Route path="/apply-doctor" element={<RequireAuth><ApplyDoctorPage /></RequireAuth>} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/blog" element={<BlogListPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
              <Route path="/support" element={<RequireAuth><SupportPage /></RequireAuth>} />
              <Route path="/support/:ticketId" element={<RequireAuth><SupportTicketPage /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth adminOnly={true}><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/doctors" element={<RequireAuth adminOnly={true}><AdminDoctorsPage /></RequireAuth>} />
              <Route path="/admin/orders" element={<RequireAuth adminOnly={true}><AdminOrdersPage /></RequireAuth>} />
              <Route path="/admin/support" element={<RequireAuth adminOnly={true}><AdminSupportPage /></RequireAuth>} />
              <Route path="/doctor" element={<RequireAuth doctorOnly={true}><DoctorDashboard /></RequireAuth>} />
              <Route path="/doctor/dashboard" element={<RequireAuth doctorOnly={true}><DoctorDashboard /></RequireAuth>} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <ChatbotWidget />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
