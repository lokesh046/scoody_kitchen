import React, { useEffect } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { Sentry } from './src/services/sentry';
import { useAuthStore } from './src/store/authStore';
import { useFeatureFlagStore } from './src/store/featureFlagStore';
import { prefetchTabData } from './src/services/tabPrefetch';
import AuthScreen from './src/screens/AuthScreen';
import TabNavigator from './src/navigation/TabNavigator';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import { COLORS } from './src/theme/colors';
import { FONT_ASSETS } from './src/theme/typography';

const Stack = createNativeStackNavigator();

function App() {
  const { user, isGuest, isHydrated, hydrateAuth } = useAuthStore();
  const fetchFlags = useFeatureFlagStore((state) => state.fetchFlags);
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    hydrateAuth();
    fetchFlags();
  }, [hydrateAuth, fetchFlags]);

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
  // system font, then reflow once Outfit/Quicksand/IBM Plex Mono swap in.
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
        <AuthScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <Stack.Screen name="Chatbot" component={ChatbotScreen} />
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

export default Sentry.wrap(App);
