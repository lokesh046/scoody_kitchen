import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Home as HomeIcon,
  UtensilsCrossed,
  Stethoscope,
  PawPrint,
  User,
  ShoppingBag,
  Package,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import HomeScreen from '../screens/HomeScreen';
import KitchenScreen from '../screens/KitchenScreen';
import VetScreen from '../screens/VetScreen';
import PetsScreen from '../screens/PetsScreen';
import OrdersScreen from '../screens/OrdersScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ScoobyAIFAB from '../components/ScoobyAIFAB';
import FloatingCartBadge from '../components/FloatingCartBadge';
import { useCartStore } from '../store/cartStore';

import { useResponsive } from '../hooks/useResponsive';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

const Tab = createBottomTabNavigator();

// Height of the tab bar's icon+label content, excluding top padding and the
// device-specific bottom safe-area inset (home indicator / gesture bar / nav buttons).
const TAB_BAR_CONTENT_HEIGHT = 48;
const TAB_BAR_TOP_PADDING = 8;

export default function TabNavigator() {
  const totalCartItems = useCartStore((state) => state.getTotalItems());
  const [currentTab, setCurrentTab] = useState<string>('Home');
  const { isTablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);
  const isShopEnabled = useFeatureFlag('shop_checkout', true);
  const isConsultationsEnabled = useFeatureFlag('consultations_booking', true);

  // Always leave at least a small breathing gap, then add whatever the device
  // reports for its home indicator / gesture pill / on-screen nav buttons so
  // the tab bar never sits underneath system UI.
  const bottomInset = Math.max(insets.bottom, 8);
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + TAB_BAR_TOP_PADDING + bottomInset;

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="Home"
        screenListeners={{
          state: (e: any) => {
            const activeRoute = e.data?.state?.routes?.[e.data.state.index]?.name;
            if (activeRoute) {
              setCurrentTab(activeRoute);
            }
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            { height: tabBarHeight, paddingBottom: bottomInset },
            isTablet && [styles.tabBarTablet, { marginBottom: Math.max(insets.bottom, 16) }],
          ],
          tabBarActiveTintColor: COLORS.forestGreen,
          tabBarInactiveTintColor: COLORS.textLight,
          tabBarLabelStyle: [
            styles.tabLabel,
            isTablet && styles.tabLabelTablet,
          ],
        }}
      >
        {/* 1. Home Screen (Primary Landing Dashboard) */}
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <HomeIcon size={20} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
          }}
        />

        {/* 2. Shop / Kitchen Tab */}
        <Tab.Screen
          name="Shop"
          component={KitchenScreen}
          options={{
            tabBarLabel: 'Shop',
            tabBarIcon: ({ color, focused }) => (
              <UtensilsCrossed size={20} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
            ...(isShopEnabled ? {} : { tabBarButton: () => null }),
          }}
        />

        {/* 3. My Orders Tab */}
        <Tab.Screen
          name="Orders"
          component={OrdersScreen}
          options={{
            tabBarLabel: 'Orders',
            tabBarIcon: ({ color, focused }) => (
              <Package size={20} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
          }}
        />

        {/* 4. Pets Tab */}
        <Tab.Screen
          name="Pets"
          component={PetsScreen}
          options={{
            tabBarLabel: 'Pets',
            tabBarIcon: ({ color, focused }) => (
              <PawPrint
                size={20}
                color={color}
                fill={focused ? color : 'none'}
                strokeWidth={focused ? 2.5 : 1.8}
              />
            ),
          }}
        />

        {/* 5. Consult / Vet Tab */}
        <Tab.Screen
          name="Consult"
          component={VetScreen}
          options={{
            tabBarLabel: 'Consult',
            tabBarIcon: ({ color, focused }) => (
              <Stethoscope size={20} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
            ...(isConsultationsEnabled ? {} : { tabBarButton: () => null }),
          }}
        />

        {/* 6. Profile Tab */}
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <User size={20} color={color} strokeWidth={focused ? 2.5 : 1.8} />
            ),
          }}
        />

        {/* Hidden Stack Routes in Tab Navigator for seamless deep-linking */}
        <Tab.Screen
          name="Cart"
          component={CartScreen}
          options={{
            tabBarItemStyle: { display: 'none' },
          }}
        />

        <Tab.Screen
          name="OrdersTab"
          component={OrdersScreen}
          options={{
            tabBarItemStyle: { display: 'none' },
          }}
        />

        {/* Alias for backward compatibility if any screen targets 'Kitchen' or 'Telemedicine' */}
        <Tab.Screen
          name="Kitchen"
          component={KitchenScreen}
          options={{
            tabBarItemStyle: { display: 'none' },
          }}
        />

        <Tab.Screen
          name="Telemedicine"
          component={VetScreen}
          options={{
            tabBarItemStyle: { display: 'none' },
          }}
        />
      </Tab.Navigator>

      {/* Persistent Scooby AI Floating Tab */}
      {isChatbotEnabled && <ScoobyAIFAB />}

      {/* Floating Cart Badge with Count (Only shows when not in Cart and cart has items) */}
      <FloatingCartBadge
        visible={isShopEnabled && currentTab !== 'Cart'}
        bottomOffset={tabBarHeight + 16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    paddingTop: TAB_BAR_TOP_PADDING,
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  tabBarTablet: {
    maxWidth: 680,
    width: '94%',
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  tabLabelTablet: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.forestGreen,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
