import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import SafeAreaView from '../components/FeatureSafeArea';
import {
  LogOut,
  Check,
  Phone,
  Bug,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { ScreenHeader, headerActionStyle, HEADER_GOLD } from '../components/ScreenHeader';
import { Sentry, isSentryEnabled } from '../services/sentry';
import { useAuthStore, UserProfile } from '../store/authStore';
import { usePetStore } from '../store/petStore';
import { fetchMyOrders, Order } from '../api/orders';
import { fetchMyPets } from '../api/pets';
import { fetchMySupportUnreadCount } from '../api/support';
import { PhoneVerificationModal } from '../components/PhoneVerificationModal';
import { DEFAULT_COUNTRY_ISO2 } from '../constants/countries';
import { useResponsive } from '../hooks/useResponsive';
import { useFeatureFlag, useFeatureFlagFallback } from '../hooks/useFeatureFlag';
import ScoobyAIFAB from '../components/ScoobyAIFAB';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useFocusRefresh } from '../hooks/useFocusRefresh';
import {
  ProfileHeroCard,
  ProfileStatsMatrix,
  AccountHubMenu,
  NutritionPledgeCard,
  EditProfileModal,
} from '../components/ProfileCards';

// ============================================================================
// 4. MAIN PROFILE SCREEN COMPONENT
// ============================================================================

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, updateUser } = useAuthStore();
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);
  const chatbotFallback = useFeatureFlagFallback('ai_chatbot');
  const { pets, setPets } = usePetStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [, setLoadingOrders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Profile Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Phone Verification Modal State
  const [targetVerificationCountry, setTargetVerificationCountry] = useState(DEFAULT_COUNTRY_ISO2);
  const [targetVerificationPhone, setTargetVerificationPhone] = useState('');
  const [isPhoneVerificationModalVisible, setIsPhoneVerificationModalVisible] =
    useState(false);

  const profileLastFetchedRef = useRef(0);
  const loadData = useCallback(
    async (force = false) => {
      if (!user) return;
      // Skip refetching if we already have a recent copy — avoids a redundant
      // network round-trip every time this tab regains focus.
      if (!force && Date.now() - profileLastFetchedRef.current < 12000) {
        setRefreshing(false);
        return;
      }
      setLoadingOrders(true);
      try {
        const [myOrders, myPets, unreadCount] = await Promise.allSettled([
          fetchMyOrders(),
          pets.length === 0 ? fetchMyPets() : Promise.resolve(pets),
          fetchMySupportUnreadCount(),
        ]);

        if (myOrders.status === 'fulfilled' && myOrders.value) {
          setOrders(myOrders.value);
        }
        if (myPets.status === 'fulfilled' && myPets.value && pets.length === 0) {
          setPets(myPets.value);
        }
        if (unreadCount.status === 'fulfilled') {
          setSupportUnreadCount(unreadCount.value);
        }
        profileLastFetchedRef.current = Date.now();
      } catch (e) {
        console.log('Error refreshing profile data:', e);
      } finally {
        setLoadingOrders(false);
        setRefreshing(false);
      }
    },
    [user, pets.length, setPets]
  );

  // Sync on screen focus
  useFocusRefresh(() => {
    loadData();
  }, user?.id);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleLogoutConfirm = useCallback(() => {
    if (!user) {
      // Guest mode
      logout();
      return;
    }
    Alert.alert(
      'Sign Out',
      "Are you sure you want to sign out of Hearth & One?",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  }, [user, logout]);

  // Dev-only: fires one deliberate, clearly-labeled test error so you can
  // confirm Sentry is actually wired up end-to-end (DSN correct, network
  // path working) rather than just trusting that the config files look
  // right. Not reachable in a production build — __DEV__ is compiled out.
  const handleTestSentry = useCallback(() => {
    if (!isSentryEnabled) {
      Alert.alert(
        'Sentry Not Enabled',
        'EXPO_PUBLIC_SENTRY_DSN is missing or empty, so Sentry.init() never ran. Check your .env file.'
      );
      return;
    }
    const eventId = Sentry.captureException(
      new Error('Scooby test error — manual Sentry verification from Profile screen')
    );
    Alert.alert(
      'Test Error Sent',
      `Event ID: ${eventId}\n\nCheck your Sentry dashboard in a few seconds — it should show up under this event ID.`
    );
  }, []);

  const handleSignIn = useCallback(() => {
    logout();
  }, [logout]);

  const openEditModal = useCallback(() => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in or create an account to manage your pet parent profile.'
      );
      return;
    }
    setIsEditModalVisible(true);
  }, [user]);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalVisible(false);
  }, []);

  const handleSavedProfile = useCallback(
    async (updatedUser: UserProfile) => {
      await updateUser(updatedUser);
    },
    [updateUser]
  );

  const handleRequestPhoneVerification = useCallback((country: string, phoneNumber: string) => {
    setTargetVerificationCountry(country);
    setTargetVerificationPhone(phoneNumber);
    setIsPhoneVerificationModalVisible(true);
  }, []);

  const handleVerificationSuccess = useCallback(
    async (updatedUser: UserProfile) => {
      await updateUser(updatedUser);
      setIsPhoneVerificationModalVisible(false);
    },
    [updateUser]
  );

  // Navigation handlers
  const handleNavigateOrders = useCallback(() => {
    navigation?.navigate('OrdersTab');
  }, [navigation]);

  const handleNavigatePets = useCallback(() => {
    navigation?.navigate('Pets');
  }, [navigation]);

  // Reachable via Profile's own Account Hub row regardless of the Consult
  // tab's own disabled state (see TabNavigator/HomeScreen) — same gate and
  // alert copy as those, so this entry point can't bypass it.
  const isConsultationsEnabled = useFeatureFlag('consultations_booking', true);
  const consultationsFallback = useFeatureFlagFallback('consultations_booking');
  const handleNavigateConsult = useCallback(() => {
    if (!isConsultationsEnabled) {
      Alert.alert(
        consultationsFallback === 'coming_soon' ? 'Coming Soon' : 'Temporarily Unavailable',
        consultationsFallback === 'coming_soon'
          ? "Vet Consultations isn't available yet — check back soon!"
          : 'Vet Consultations is temporarily unavailable. Please check back later.'
      );
      return;
    }
    navigation?.navigate('Consult');
  }, [isConsultationsEnabled, consultationsFallback, navigation]);

  const handleNavigateSupport = useCallback(() => {
    navigation?.navigate('Support');
  }, [navigation]);

  const handleNavigateBlog = useCallback(() => {
    navigation?.navigate('Blog');
  }, [navigation]);

  const handleNavigatePrivacy = useCallback(() => {
    navigation?.navigate('PrivacyPolicy');
  }, [navigation]);

  const handleNavigateTerms = useCallback(() => {
    navigation?.navigate('Terms');
  }, [navigation]);

  const { isTablet } = useResponsive();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ResponsiveContainer maxWidth={840} style={{ flex: 1 }}>
        {/* Header */}
        <ScreenHeader
          title="Profile"
          rightContent={
            <TouchableOpacity
              style={[styles.iconCircleBtn, headerActionStyle]}
              onPress={handleLogoutConfirm}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              activeOpacity={0.8}
            >
              <LogOut size={16} color={HEADER_GOLD} />
            </TouchableOpacity>
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollBody}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.forestGreen]}
            />
          }
        >
          {/* User Profile Hero Card */}
          <ProfileHeroCard
            user={user}
            onEditPress={openEditModal}
            onVerifyPhonePress={handleRequestPhoneVerification}
            onSignInPress={handleSignIn}
          />

          {/* Quick Stats Matrix */}
          <ProfileStatsMatrix petsCount={pets.length} ordersCount={orders.length} />

          {isChatbotEnabled || chatbotFallback !== 'hide' ? (
            <ScoobyAIFAB inline disabledFallback={isChatbotEnabled ? undefined : chatbotFallback === 'hide' ? undefined : chatbotFallback} />
          ) : null}

          {/* Account Hub Menu */}
          <AccountHubMenu
            ordersCount={orders.length}
            petsCount={pets.length}
            supportUnreadCount={supportUnreadCount}
            onNavigateOrders={handleNavigateOrders}
            onNavigatePets={handleNavigatePets}
            onNavigateConsult={handleNavigateConsult}
            onNavigateSupport={handleNavigateSupport}
            onNavigateBlog={handleNavigateBlog}
            onNavigatePrivacy={handleNavigatePrivacy}
            onNavigateTerms={handleNavigateTerms}
            isConsultationsEnabled={isConsultationsEnabled}
            consultationsFallback={consultationsFallback}
          />

          {/* Veterinary Quality Commitment */}
          <NutritionPledgeCard />

          {/* Dev-only: manual Sentry verification trigger. __DEV__ is a
              compile-time constant, so this whole block is stripped out of
              production builds — never visible to real users. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devTestBtn}
              onPress={handleTestSentry}
              activeOpacity={0.8}
            >
              <Bug size={16} color={COLORS.textMuted} />
              <Text style={styles.devTestText}>
                Test Sentry (dev only)
              </Text>
            </TouchableOpacity>
          )}

          {/* Sign Out / Exit Guest Action */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogoutConfirm}
            activeOpacity={0.8}
          >
            <LogOut size={16} color="#C25E48" />
            <Text style={styles.logoutText}>
              {user ? 'Sign Out of Account' : 'Exit Guest Mode'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </ResponsiveContainer>

      {/* Edit Profile Modal (Self-contained draft state) */}
      <EditProfileModal
        visible={isEditModalVisible}
        user={user}
        onClose={handleCloseEditModal}
        onSaved={handleSavedProfile}
        onRequestPhoneVerification={handleRequestPhoneVerification}
      />

      {/* Phone Number OTP Verification Modal */}
      <PhoneVerificationModal
        visible={isPhoneVerificationModalVisible}
        country={targetVerificationCountry}
        phone={targetVerificationPhone || user?.phone || ''}
        onClose={() => setIsPhoneVerificationModalVisible(false)}
        onSuccess={handleVerificationSuccess}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// 5. STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: { padding: 16, gap: 14, paddingBottom: 32 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#C25E48',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  logoutText: { fontSize: 13.5, fontWeight: '800', color: '#B4472F', letterSpacing: 0.3 },
  devTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 12,
  },
  devTestText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
});
