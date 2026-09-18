import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Stethoscope, CalendarClock, User } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import DoctorQueueScreen from '../screens/doctor/DoctorQueueScreen';
import DoctorAvailabilityScreen from '../screens/doctor/DoctorAvailabilityScreen';
import DoctorProfileScreen from '../screens/doctor/DoctorProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_BAR_CONTENT_HEIGHT = 48;
const TAB_BAR_TOP_PADDING = 8;

// Entirely separate tab set from TabNavigator.tsx (the pet-parent app shell)
// — a doctor account never sees Home/Kitchen/Cart/Pets, since none of that
// applies to them. Which navigator mounts at all is decided once, in
// App.tsx, based on user.role.
export default function DoctorTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + TAB_BAR_TOP_PADDING + bottomInset;

  return (
    <Tab.Navigator
      initialRouteName="Queue"
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: bottomInset }],
        tabBarActiveTintColor: COLORS.forestGreen,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Queue"
        component={DoctorQueueScreen}
        options={{
          tabBarLabel: 'Queue',
          tabBarIcon: ({ color, focused }) => (
            <Stethoscope size={20} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tab.Screen
        name="Availability"
        component={DoctorAvailabilityScreen}
        options={{
          tabBarLabel: 'Availability',
          tabBarIcon: ({ color, focused }) => (
            <CalendarClock size={20} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tab.Screen
        name="DoctorProfile"
        component={DoctorProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <User size={20} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
    </Tab.Navigator>
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
  tabLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },
});
