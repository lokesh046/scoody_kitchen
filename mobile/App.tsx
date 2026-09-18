import React, { useEffect } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { Sentry, isSentryEnabled } from './src/services/sentry';
import { useAuthStore } from './src/store/authStore';
import { useFeatureFlagStore } from './src/store/featureFlagStore';
import { useNetworkStore } from './src/store/networkStore';
import { prefetchTabData } from './src/services/tabPrefetch';
import AuthScreen from './src/screens/AuthScreen';
import TabNavigator from './src/navigation/TabNavigator';
import DoctorTabNavigator from './src/navigation/DoctorTabNavigator';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import MealPlannerScreen from './src/screens/MealPlannerScreen';
import DoctorConsultationDetailScreen from './src/screens/doctor/DoctorConsultationDetailScreen';
import OfflineBanner from './src/components/OfflineBanner';
import { COLORS } from './src/theme/colors';
import { FONT_ASSETS } from './src/theme/typography';

const Stack = createNativeStackNavigator();

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
      <NavigationContainer>
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

// sentry.ts skips Sentry.init() entirely when no DSN is configured (e.g.
// local dev), but Sentry.wrap() used to run unconditionally here regardless
// — wrapping the app in a profiler that tries to report an app-start span
// to a client that was never initialized, which is exactly the "Sentry.wrap
// was called before Sentry.init" warning on every single app start.
export default isSentryEnabled ? Sentry.wrap(App) : App;
