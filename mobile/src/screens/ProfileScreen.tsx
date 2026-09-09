import React, { useState, useCallback, useRef, memo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ShieldCheck,
  Package,
  LogOut,
  ChevronRight,
  PawPrint,
  FileCheck2,
  Stethoscope,
  Camera,
  Edit3,
  X,
  Check,
  Lock,
  Phone,
  User as UserIcon,
  Image as ImageIcon,
  AlertCircle,
  LogIn,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../theme/colors';
import { BrandMedallion } from '../components/BrandLogo';
import { useAuthStore, UserProfile } from '../store/authStore';
import { usePetStore } from '../store/petStore';
import { fetchMyOrders, Order } from '../api/orders';
import { fetchMyPets } from '../api/pets';
import { updateUserProfile, uploadAvatarImage } from '../api/auth';
import { PhoneVerificationModal } from '../components/PhoneVerificationModal';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';

// ============================================================================
// 1. PURE HOISTED UTILITIES & HELPERS
// ============================================================================

const formatPhoneForInput = (rawPhone?: string | null): string => {
  if (!rawPhone) return '';
  const clean = rawPhone.trim().replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('+91')) {
    return clean.slice(3);
  }
  return clean;
};

const getAvatarInitial = (user?: UserProfile | null): string => {
  if (!user) return 'G';
  if (user.first_name) return user.first_name[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return 'P';
};

// ============================================================================
// 2. PURE MEMOIZED SUB-COMPONENTS
// ============================================================================

interface ProfileHeroCardProps {
  user: UserProfile | null;
  onEditPress: () => void;
  onVerifyPhonePress: (phone: string) => void;
  onSignInPress: () => void;
}

const ProfileHeroCard = memo(function ProfileHeroCard({
  user,
  onEditPress,
  onVerifyPhonePress,
  onSignInPress,
}: ProfileHeroCardProps) {
  const avatarInitial = getAvatarInitial(user);

  return (
    <View style={styles.profileCard}>
      <View style={styles.avatarWrapper}>
        {user?.profile_image_url ? (
          <Image
            source={{ uri: user.profile_image_url }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{avatarInitial}</Text>
          </View>
        )}

        {/* Quick Camera Action Badge */}
        {user ? (
          <TouchableOpacity
            style={styles.cameraBadge}
            onPress={onEditPress}
            activeOpacity={0.8}
            accessibilityLabel="Change avatar picture"
          >
            <Camera size={13} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.userName}>
        {user
          ? `${user.first_name || 'Pet Parent'} ${user.last_name || ''}`.trim()
          : 'Guest Explorer'}
      </Text>
      <Text style={styles.userEmail}>
        {user ? user.email : 'Browsing without account'}
      </Text>

      {user ? (
        user.phone ? (
          <View style={styles.userPhoneRow}>
            <Phone size={12} color={COLORS.textMuted} />
            <Text style={styles.userPhoneText}>{user.phone}</Text>
            {user.is_phone_verified ? (
              <View style={styles.verifiedMiniPill}>
                <Check size={10} color="#047857" />
                <Text style={styles.verifiedMiniPillText}>Verified</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.unverifiedMiniPill}
                onPress={() => onVerifyPhonePress(formatPhoneForInput(user.phone))}
                activeOpacity={0.8}
              >
                <Text style={styles.unverifiedMiniPillText}>Verify via SMS</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addPhonePrompt}
            onPress={onEditPress}
            activeOpacity={0.8}
          >
            <Phone size={12} color="#C2410C" />
            <Text style={styles.addPhonePromptText}>+ Add & Verify Phone</Text>
          </TouchableOpacity>
        )
      ) : (
        <View style={styles.guestPromptBox}>
          <Text style={styles.guestPromptText}>
            Sign in to track live orders, register pets, and book consultations.
          </Text>
        </View>
      )}

      {/* Badges Matrix */}
      <View style={styles.badgeRow}>
        <View style={[styles.roleBadge, { backgroundColor: '#EDF5F0' }]}>
          <ShieldCheck size={12} color={COLORS.forestGreen} />
          <Text style={[styles.roleText, { color: COLORS.forestGreen }]}>
            {user ? `ROLE: ${user.role.toUpperCase()}` : 'GUEST MODE'}
          </Text>
        </View>

        {user?.is_email_verified && (
          <View style={[styles.roleBadge, { backgroundColor: '#FAF4EB' }]}>
            <FileCheck2 size={12} color={COLORS.brandGold} />
            <Text style={[styles.roleText, { color: COLORS.brandGold }]}>
              Verified Email
            </Text>
          </View>
        )}

        {user?.is_phone_verified && (
          <View style={[styles.roleBadge, { backgroundColor: '#EBF3FB' }]}>
            <Phone size={12} color="#2563EB" />
            <Text style={[styles.roleText, { color: '#2563EB' }]}>
              Phone Verified
            </Text>
          </View>
        )}
      </View>

      {/* Action CTA: Edit Profile or Sign In */}
      {user ? (
        <TouchableOpacity
          style={styles.editProfileBtn}
          onPress={onEditPress}
          activeOpacity={0.8}
        >
          <Edit3 size={14} color={COLORS.forestGreen} strokeWidth={2.2} />
          <Text style={styles.editProfileBtnText}>Edit Profile Ledger</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.signInCtaBtn}
          onPress={onSignInPress}
          activeOpacity={0.85}
        >
          <LogIn size={15} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.signInCtaBtnText}>Sign In / Create Account</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

interface ProfileStatsMatrixProps {
  petsCount: number;
  ordersCount: number;
}

const ProfileStatsMatrix = memo(function ProfileStatsMatrix({
  petsCount,
  ordersCount,
}: ProfileStatsMatrixProps) {
  return (
    <View style={styles.statsCard}>
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{petsCount}</Text>
        <Text style={styles.statLabel}>Registered Pets</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{ordersCount}</Text>
        <Text style={styles.statLabel}>Fresh Orders</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>100%</Text>
        <Text style={styles.statLabel}>Human-Grade</Text>
      </View>
    </View>
  );
});

interface AccountHubMenuProps {
  ordersCount: number;
  petsCount: number;
  onNavigateOrders: () => void;
  onNavigatePets: () => void;
  onNavigateConsult: () => void;
}

const AccountHubMenu = memo(function AccountHubMenu({
  ordersCount,
  petsCount,
  onNavigateOrders,
  onNavigatePets,
  onNavigateConsult,
}: AccountHubMenuProps) {
  return (
    <View style={styles.menuCard}>
      <Text style={styles.menuHeading}>Account Hub</Text>

      {/* Orders Hub Item */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onNavigateOrders}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <View style={[styles.menuIconCircle, { backgroundColor: '#FAF5EE' }]}>
            <Package size={18} color={COLORS.brandGold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuItemTitle}>My Orders</Text>
            <Text style={styles.menuItemSub}>
              Track live deliveries and view past receipts
            </Text>
          </View>
        </View>
        <View style={styles.menuItemRight}>
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{ordersCount}</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>

      <View style={styles.menuDivider} />

      {/* Pets Registry Item */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onNavigatePets}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <View style={[styles.menuIconCircle, { backgroundColor: '#EDF5F0' }]}>
            <PawPrint size={18} color={COLORS.forestGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuItemTitle}>Registered Pets</Text>
            <Text style={styles.menuItemSub}>
              Health metrics, allergies, and breed profiles
            </Text>
          </View>
        </View>
        <View style={styles.menuItemRight}>
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{petsCount}</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>

      <View style={styles.menuDivider} />

      {/* Vet Consultations Item */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onNavigateConsult}
        activeOpacity={0.7}
      >
        <View style={styles.menuItemLeft}>
          <View style={[styles.menuIconCircle, { backgroundColor: '#EBF3FB' }]}>
            <Stethoscope size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuItemTitle}>Vet Consultations</Text>
            <Text style={styles.menuItemSub}>
              Book clinics and review medical records
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={COLORS.textLight} />
      </TouchableOpacity>
    </View>
  );
});

const NutritionPledgeCard = memo(function NutritionPledgeCard() {
  return (
    <View style={styles.infoCard}>
      <PawPrint size={20} color={COLORS.brandGold} fill={COLORS.brandGold} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>Canine Nutrition Quality Pledge</Text>
        <Text style={styles.infoBody}>
          Every ingredient percentage is transparently stamped in the database
          ledger. Zero starch fillers, zero meal powders, cooked below 85°C.
        </Text>
      </View>
    </View>
  );
});

// ============================================================================
// 3. ISOLATED EDIT PROFILE MODAL (Zero parent re-render cascades)
// ============================================================================

interface EditProfileModalProps {
  visible: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSaved: (updatedUser: UserProfile) => void;
  onRequestPhoneVerification: (phone: string) => void;
}

const EditProfileModal = memo(function EditProfileModal({
  visible,
  user,
  onClose,
  onSaved,
  onRequestPhoneVerification,
}: EditProfileModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (visible && user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(formatPhoneForInput(user.phone));
      setIsEditingPhone(false);
      setAvatarUri(user.profile_image_url || null);
      setFormError(null);
      setFormSuccess(null);
    }
  }, [visible, user]);

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleAvatarUpload(result.assets[0].uri);
      }
    } catch (err) {
      console.log('Gallery pick error:', err);
      setFormError('Could not access image gallery. Please check app permissions.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission',
          'Camera access is required to take a new pet parent profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleAvatarUpload(result.assets[0].uri);
      }
    } catch (err) {
      console.log('Camera error:', err);
      setFormError('Could not access camera. Please check app permissions.');
    }
  };

  const handleAvatarUpload = async (localUri: string) => {
    setIsUploadingAvatar(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const uploadRes = await uploadAvatarImage(localUri);
      setAvatarUri(uploadRes.url);
      setFormSuccess('Avatar image uploaded! Tap "Save Changes" to commit.');
    } catch (err: any) {
      console.log('Avatar upload error:', err);
      setFormError(
        err.response?.data?.detail ||
          'Failed to upload avatar image to storage. Please try another image.'
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (cleanPhone && cleanPhone.length !== 10) {
      setFormError('Phone number must be exactly 10 digits.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setFormSuccess(null);

    const phoneToSend = cleanPhone
      ? cleanPhone.startsWith('+91')
        ? cleanPhone
        : `+91${cleanPhone}`
      : undefined;

    try {
      const updatedUser = await updateUserProfile({
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        phone: phoneToSend,
        profile_image_url: avatarUri || undefined,
      });

      onSaved(updatedUser);
      setFormSuccess('Profile ledger updated successfully!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      console.log('Profile update error:', err);
      setFormError(
        err.response?.data?.detail ||
          'Failed to save profile changes. Please verify your details.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const avatarInitial = getAvatarInitial(user);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={isTablet ? modalOverlayStyle : styles.modalOverlay}
      >
        <View style={[styles.modalContent, isTablet && modalSheetContainerStyle]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Edit Profile Ledger</Text>
              <Text style={styles.modalSubtitle}>
                Update your verified pet parent details
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseBtn}
              activeOpacity={0.7}
            >
              <X size={20} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBody}
          >
            {/* Avatar Editor Section */}
            <View style={styles.avatarEditSection}>
              <View style={styles.avatarEditPreviewWrapper}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarEditPreview}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarCircle,
                      { width: 76, height: 76, borderRadius: 38 },
                    ]}
                  >
                    <Text style={[styles.avatarInitial, { fontSize: 30 }]}>
                      {avatarInitial}
                    </Text>
                  </View>
                )}

                {isUploadingAvatar && (
                  <View style={styles.avatarUploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>

              {/* Avatar Action Pills */}
              <View style={styles.avatarActionRow}>
                <TouchableOpacity
                  style={styles.avatarActionPill}
                  onPress={handlePickFromGallery}
                  disabled={isUploadingAvatar}
                  activeOpacity={0.7}
                >
                  <ImageIcon size={14} color={COLORS.forestGreen} />
                  <Text style={styles.avatarActionText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.avatarActionPill}
                  onPress={handleTakePhoto}
                  disabled={isUploadingAvatar}
                  activeOpacity={0.7}
                >
                  <Camera size={14} color={COLORS.forestGreen} />
                  <Text style={styles.avatarActionText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Feedback messages */}
            {formError && (
              <View style={styles.alertErrorBox}>
                <AlertCircle size={15} color="#B91C1C" />
                <Text style={styles.alertErrorText}>{formError}</Text>
              </View>
            )}

            {formSuccess && (
              <View style={styles.alertSuccessBox}>
                <Check size={15} color={COLORS.forestGreen} />
                <Text style={styles.alertSuccessText}>{formSuccess}</Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>FIRST NAME</Text>
              <View style={styles.inputContainer}>
                <UserIcon size={16} color={COLORS.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="First Name"
                  placeholderTextColor={COLORS.textLight}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>LAST NAME</Text>
              <View style={styles.inputContainer}>
                <UserIcon size={16} color={COLORS.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Last Name"
                  placeholderTextColor={COLORS.textLight}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.phoneLabelRow}>
                <Text style={styles.fieldLabel}>CONTACT PHONE NUMBER</Text>
                {user?.is_phone_verified && !isEditingPhone ? (
                  <View style={styles.phoneVerifiedTag}>
                    <ShieldCheck size={11} color="#047857" />
                    <Text style={styles.phoneVerifiedTagText}>
                      Verified via SMS ✓
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.phoneUnverifiedTagText}>
                    {isEditingPhone ? 'Modifying number...' : 'Unverified'}
                  </Text>
                )}
              </View>

              <View style={styles.phoneInputRow}>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.textInput,
                      user?.is_phone_verified && !isEditingPhone && styles.inputLocked,
                    ]}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.textLight}
                    value={phone}
                    onChangeText={(val) => setPhone(val.replace(/\D/g, ''))}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!user?.is_phone_verified || isEditingPhone}
                  />
                </View>

                {user?.is_phone_verified && !isEditingPhone ? (
                  <TouchableOpacity
                    style={styles.changePhoneBtn}
                    onPress={() => setIsEditingPhone(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.changePhoneBtnText}>Change</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.phoneActionsRow}>
                    {isEditingPhone && (
                      <TouchableOpacity
                        style={styles.cancelChangePhoneBtn}
                        onPress={() => {
                          setIsEditingPhone(false);
                          setPhone(formatPhoneForInput(user?.phone));
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cancelChangePhoneBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.verifyPhoneBtn}
                      onPress={() => {
                        if (!phone || phone.length !== 10) {
                          Alert.alert(
                            'Phone Required',
                            'Please enter a valid 10-digit mobile number to verify.'
                          );
                          return;
                        }
                        onRequestPhoneVerification(phone);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.verifyPhoneBtnText}>Verify via SMS</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <Text style={styles.fieldHelper}>
                Used for delivery OTP, order updates, and veterinary consultations
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PRIMARY ACCOUNT EMAIL</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Lock size={15} color={COLORS.textMuted} />
                <Text style={styles.disabledEmailText}>{user?.email}</Text>
              </View>
              <Text style={styles.fieldHelper}>
                Authentication email cannot be altered directly
              </Text>
            </View>

            {/* Save CTA */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                (isSaving || isUploadingAvatar) && styles.buttonDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={isSaving || isUploadingAvatar}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.saveButtonText}>Commit Profile Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// ============================================================================
// 4. MAIN PROFILE SCREEN COMPONENT
// ============================================================================

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, updateUser } = useAuthStore();
  const { pets, setPets } = usePetStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [, setLoadingOrders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Profile Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Phone Verification Modal State
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
        const [myOrders, myPets] = await Promise.allSettled([
          fetchMyOrders(),
          pets.length === 0 ? fetchMyPets() : Promise.resolve(pets),
        ]);

        if (myOrders.status === 'fulfilled' && myOrders.value) {
          setOrders(myOrders.value);
        }
        if (myPets.status === 'fulfilled' && myPets.value && pets.length === 0) {
          setPets(myPets.value);
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
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
      "Are you sure you want to sign out of Scooby's Kitchen?",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  }, [user, logout]);

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

  const handleRequestPhoneVerification = useCallback((phoneNumber: string) => {
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

  const handleNavigateConsult = useCallback(() => {
    navigation?.navigate('Consult');
  }, [navigation]);

  const { isTablet } = useResponsive();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ResponsiveContainer maxWidth={840}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeftGroup}>
            <BrandMedallion size="sm" />
            <View style={styles.headerTextCol}>
              <View style={styles.brandRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.brandLabel}>ACCOUNT LEDGER</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>Pet Parent Profile</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={handleLogoutConfirm}
            activeOpacity={0.8}
          >
            <LogOut size={16} color="#C25E48" />
          </TouchableOpacity>
        </View>

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

          {/* Account Hub Menu */}
          <AccountHubMenu
            ordersCount={orders.length}
            petsCount={pets.length}
            onNavigateOrders={handleNavigateOrders}
            onNavigatePets={handleNavigatePets}
            onNavigateConsult={handleNavigateConsult}
          />

          {/* Veterinary Quality Commitment */}
          <NutritionPledgeCard />

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FAF7F2',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  brandLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brandGold,
    letterSpacing: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textCoffee },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: { padding: 20, gap: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FAF4EB',
    borderWidth: 2,
    borderColor: COLORS.brandGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: COLORS.brandGold,
    backgroundColor: '#F3EFE6',
  },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: COLORS.brandGold },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.forestGreen,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  userName: { fontSize: 18, fontWeight: '800', color: COLORS.textCoffee },
  userEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  userPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  userPhoneText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  verifiedMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 4,
  },
  verifiedMiniPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#047857',
  },
  unverifiedMiniPill: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 4,
  },
  unverifiedMiniPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#C2410C',
  },
  addPhonePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  addPhonePromptText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#C2410C',
  },
  guestPromptBox: {
    marginTop: 6,
    paddingHorizontal: 12,
  },
  guestPromptText: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  signInCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  signInCtaBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  phoneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  phoneVerifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  phoneVerifiedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  phoneUnverifiedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLocked: {
    opacity: 0.8,
    backgroundColor: '#F7F4EE',
  },
  changePhoneBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  changePhoneBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  phoneActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cancelChangePhoneBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  cancelChangePhoneBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  verifyPhoneBtn: {
    backgroundColor: '#2C1810',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  verifyPhoneBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: { fontSize: 10, fontWeight: '800' },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#EDF5F0',
    borderWidth: 1,
    borderColor: '#C6E2D1',
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 26, backgroundColor: COLORS.kraftBorder },
  statNumber: { fontSize: 16, fontWeight: '800', color: COLORS.forestGreen },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  menuHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.brandGold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  menuItemSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBadge: {
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C6E2D1',
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forestGreen,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.kraftBorder,
    marginVertical: 4,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FAF4EB',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textCoffee },
  infoBody: { fontSize: 11, color: COLORS.textMuted, lineHeight: 16, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 4,
  },
  logoutText: { fontSize: 13, fontWeight: '700', color: '#991B1B' },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(54, 40, 32, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  modalSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },
  avatarEditSection: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  avatarEditPreviewWrapper: {
    position: 'relative',
  },
  avatarEditPreview: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: COLORS.brandGold,
    backgroundColor: '#FAF4EB',
  },
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C6E2D1',
  },
  avatarActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  alertErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 10,
  },
  alertErrorText: {
    fontSize: 11,
    color: '#991B1B',
    flex: 1,
    fontWeight: '600',
  },
  alertSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDF5F0',
    borderWidth: 1,
    borderColor: '#C6E2D1',
    padding: 10,
    borderRadius: 10,
  },
  alertSuccessText: {
    fontSize: 11,
    color: COLORS.forestGreen,
    flex: 1,
    fontWeight: '600',
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  countryCodeBadge: {
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  countryCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textCoffee,
    fontWeight: '600',
    height: '100%',
  },
  inputDisabled: {
    backgroundColor: '#FAF5EE',
    borderColor: COLORS.kraftBorder,
  },
  disabledEmailText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  fieldHelper: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
    paddingLeft: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 8,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
