import React, { useEffect } from 'react';
import { StatusBar, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { Sentry, isSentryEnabled } from './src/services/sentry';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD } from './src/theme/typography';
import { useAuthStore } from './src/store/authStore';
import { useFeatureFlagStore } from './src/store/featureFlagStore';
import { useNetworkStore } from './src/store/networkStore';
import { prefetchTabData } from './src/services/tabPrefetch';
import { syncPushTokenWithBackend, addNotificationResponseListener } from './src/services/pushNotifications';
import AuthScreen from './src/screens/AuthScreen';
import TabNavigator from './src/navigation/TabNavigator';
import DoctorTabNavigator from './src/navigation/DoctorTabNavigator';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import MealPlannerScreen from './src/screens/MealPlannerScreen';
import DoctorConsultationDetailScreen from './src/screens/doctor/DoctorConsultationDetailScreen';
import SupportScreen from './src/screens/SupportScreen';
import SupportTicketScreen from './src/screens/SupportTicketScreen';
import OfflineBanner from './src/components/OfflineBanner';
import { COLORS } from './src/theme/colors';
import { FONT_ASSETS } from './src/theme/typography';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

function App() {
  const { user, isGuest, isHydrated, hydrateAuth } = useAuthStore();
  const fetchFlags = useFeatureFlagStore((state) => state.fetchFlags);
  const initNetwork = useNetworkStore((state) => state.init);
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    hydrateAuth();
    fetchFlags();
  }, [hydrateAuth, fetchFlags]);

  useEffect(() => {
    const unsubscribe = initNetwork();
    return unsubscribe;
  }, [initNetwork]);

  // Warm each bottom-tab's initial data as soon as we know who's using the
  // app, so the first tap into Shop/Orders/Pets/Consult usually finds data
  // already sitting in cache instead of starting its fetch at that moment.
  useEffect(() => {
    if (!isHydrated) return;
    if (!user && !isGuest) return;
    prefetchTabData(!!user);
  }, [isHydrated, user, isGuest]);

  // Push notifications only make sense for a real signed-in account (a
  // guest session has no server-side identity to attach a device token to).
  // syncPushTokenWithBackend() itself no-ops quietly on a simulator or
  // before EAS is linked, so this is always safe to call.
  useEffect(() => {
    if (!isHydrated || !user) return;
    syncPushTokenWithBackend();
  }, [isHydrated, user]);

  // Handles a user tapping a delivered notification (app backgrounded or
  // killed). Only "/support" is wired to real navigation so far — it's the
  // one link value that maps to an unambiguous top-level screen; other
  // link values used by the backend (e.g. "/orders", "/consultations")
  // point at screens nested inside a bottom-tab navigator whose exact
  // structure varies by feature flags, so they're intentionally left
  // unhandled here rather than risk navigating to a route that doesn't
  // exist in a given build.
  useEffect(() => {
    return addNotificationResponseListener((link) => {
      if (!navigationRef.isReady()) return;
      if (link === '/support') {
        navigationRef.navigate('Support' as never);
      }
    });
  }, []);

  // Hold the same loading screen until both auth AND the brand fonts are
  // ready — rendering before fonts load would flash every screen in the OS
  // system font, then reflow once Outfit/Quicksand/Courier Prime swap in.
  if (!isHydrated || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: COLORS.canvas, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
        </View>
      </SafeAreaProvider>
    );
  }

  // If not logged in and not exploring as guest, gate behind Auth
  if (!user && !isGuest) {
    return (
      <SafeAreaProvider>
        <OfflineBanner />
        <AuthScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <OfflineBanner />
      <NavigationContainer ref={navigationRef}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {/* A doctor account gets an entirely separate tab set (Queue,
              Availability, Profile) — none of the pet-parent tabs
              (Home/Kitchen/Cart/Pets) apply to them. Decided once here,
              from the role the login response already returns, rather
              than threading a role check through every pet-parent screen. */}
          <Stack.Screen
            name="MainTabs"
            component={user?.role === 'doctor' ? DoctorTabNavigator : TabNavigator}
          />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <Stack.Screen name="Chatbot" component={ChatbotScreen} />
          <Stack.Screen name="MealPlanner" component={MealPlannerScreen} />
          <Stack.Screen name="DoctorConsultationDetail" component={DoctorConsultationDetailScreen} />
          <Stack.Screen name="Support" component={SupportScreen} />
          <Stack.Screen name="SupportTicket" component={SupportTicketScreen} />
          <Stack.Screen
            name="VideoCall"
            component={VideoCallScreen}
            options={{ gestureEnabled: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// A crash inside any screen (a bad render, a null-access bug, anything
// synchronous) previously had nothing catching it — the whole app just
// died with no recovery UI. This is the one boundary at the very top, so
// any such crash lands here instead of taking down the entire session;
// Sentry.ErrorBoundary reports it (a no-op if Sentry was never initialized)
// and resetError() lets the user retry without force-closing the app.
function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <SafeAreaProvider>
      <View
        style={{
          flex: 1,
          backgroundColor: '#F9F6F0',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 20, fontFamily: FONT_DISPLAY, color: '#362820', textAlign: 'center' }}>
          Something went wrong
        </Text>
        <Text style={{ fontSize: 13, fontFamily: FONT_BODY, color: '#6B5D52', textAlign: 'center', maxWidth: 300 }}>
          Scooby's Kitchen ran into an unexpected error. This has been reported — try again below.
        </Text>
        <TouchableOpacity
          onPress={resetError}
          style={{ marginTop: 12, backgroundColor: '#3F5E4D', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={{ fontSize: 13, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaProvider>
  );
}

function AppWithBoundary() {
  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
      <App />
    </Sentry.ErrorBoundary>
  );
}

// sentry.ts skips Sentry.init() entirely when no DSN is configured (e.g.
// local dev), but Sentry.wrap() used to run unconditionally here regardless
// — wrapping the app in a profiler that tries to report an app-start span
// to a client that was never initialized, which is exactly the "Sentry.wrap
// was called before Sentry.init" warning on every single app start.
export default isSentryEnabled ? Sentry.wrap(AppWithBoundary) : AppWithBoundary;
