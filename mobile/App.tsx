import React, { useEffect } from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from './src/store/authStore';
import { useFeatureFlagStore } from './src/store/featureFlagStore';
import AuthScreen from './src/screens/AuthScreen';
import TabNavigator from './src/navigation/TabNavigator';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import { COLORS } from './src/theme/colors';

const Stack = createNativeStackNavigator();

export default function App() {
  const { user, isGuest, isHydrated, hydrateAuth } = useAuthStore();
  const fetchFlags = useFeatureFlagStore((state) => state.fetchFlags);

  useEffect(() => {
    hydrateAuth();
    fetchFlags();
  }, [hydrateAuth, fetchFlags]);

  if (!isHydrated) {
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
