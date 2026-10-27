import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShieldCheck,
  ChevronRight,
  FileCheck2,
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
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { COLORS } from '../theme/colors';
import { FONT_HEADING_SCRIPT, FONT_DISPLAY } from '../theme/typography';
import { UserProfile } from '../store/authStore';
import { updateUserProfile, uploadAvatarImage } from '../api/auth';
import { useResponsive } from '../hooks/useResponsive';
import { PhoneNumberInput } from './PhoneNumberInput';
import { DEFAULT_COUNTRY_ISO2 } from '../constants/countries';
import { toE164, isValidForCountry, getCountry } from '../utils/phone';

import { ModalKeyboardAvoider } from './ModalKeyboardAvoider';
import { useNavBarInset } from '../hooks/useKeyboardHeight';
// Parses with libphonenumber-js so both the country AND the national
// number are detected correctly, rather than assuming India and just
// chopping off the last 10 digits (which broke for any non-Indian number).
const parsePhoneForState = (rawPhone?: string | null): { country: string; digits: string } => {
  if (!rawPhone) return { country: DEFAULT_COUNTRY_ISO2, digits: '' };
  const parsed = parsePhoneNumberFromString(rawPhone, DEFAULT_COUNTRY_ISO2 as any);
  if (parsed && parsed.country) {
    return { country: parsed.country, digits: parsed.nationalNumber };
  }
  const digitsOnly = rawPhone.replace(/\D/g, '');
  return { country: DEFAULT_COUNTRY_ISO2, digits: digitsOnly.slice(-10) };
};

const getAvatarInitial = (user?: UserProfile | null): string => {
  if (!user) return 'G';
  if (user.first_name) return user.first_name[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return 'P';
};

interface ProfileHeroCardProps {
  user: UserProfile | null;
  onEditPress: () => void;
  onVerifyPhonePress: (country: string, phone: string) => void;
  onSignInPress: () => void;
}

export const ProfileHeroCard = memo(function ProfileHeroCard({
  user,
  onEditPress,
  onVerifyPhonePress,
  onSignInPress,
}: ProfileHeroCardProps) {
  const avatarInitial = getAvatarInitial(user);

  return (
    <LinearGradient colors={['#0E0B08', '#241B13']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={profileCardStyles.profileCard}>
      <View style={profileCardStyles.identityRow}>
      <View style={profileCardStyles.avatarRing}>
      <View style={profileCardStyles.avatarWrapper}>
        {user?.profile_image_url ? (
          <Image
            source={{ uri: user.profile_image_url }}
            style={profileCardStyles.avatarImage}
          />
        ) : (
          <View style={profileCardStyles.avatarCircle}>
            <Text style={profileCardStyles.avatarInitial}>{avatarInitial}</Text>
          </View>
        )}

        {/* Quick Camera Action Badge */}
        {user ? (
          <TouchableOpacity
            style={profileCardStyles.cameraBadge}
            onPress={onEditPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            hitSlop={8}
            accessibilityLabel="Change avatar picture"
          >
            <Camera size={13} color="#2C1810" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : null}
      </View>
      </View>

      <Text style={profileCardStyles.userName}>
        {user
          ? `${user.first_name || 'Pet Parent'} ${user.last_name || ''}`.trim()
          : 'Guest Explorer'}
      </Text>
      </View>
      {user ? (
        <View style={profileCardStyles.detailList}>
          <View style={profileCardStyles.detailRow}>
            <ShieldCheck size={16} color="#D09E6B" />
            <Text style={profileCardStyles.detailLabel}>ROLE</Text>
            <Text style={profileCardStyles.detailValue}>{user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()}</Text>
          </View>

          <View style={profileCardStyles.detailRow}>
            <FileCheck2 size={16} color="#D09E6B" />
            <Text style={profileCardStyles.detailLabel}>EMAIL</Text>
            <Text style={profileCardStyles.detailValue} numberOfLines={1}>{user.email}</Text>
            {user.is_email_verified ? (
              <Check size={15} color="#6EE7B7" strokeWidth={2.6} />
            ) : null}
          </View>

          <View style={[profileCardStyles.detailRow, profileCardStyles.detailRowLast]}>
            <Phone size={16} color="#D09E6B" />
            <Text style={profileCardStyles.detailLabel}>PHONE</Text>
            {user.phone ? (
              <>
                <Text style={profileCardStyles.detailValue} numberOfLines={1}>{user.phone}</Text>
                {user.is_phone_verified ? (
                  <Check size={15} color="#6EE7B7" strokeWidth={2.6} />
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      const parsedPhone = parsePhoneForState(user.phone);
                      onVerifyPhonePress(parsedPhone.country, parsedPhone.digits);
                    }}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={profileCardStyles.detailAction}>Verify</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <Text style={[profileCardStyles.detailValue, profileCardStyles.detailValueMuted]}>Not added</Text>
                <TouchableOpacity onPress={onEditPress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={profileCardStyles.detailAction}>Add</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          <Text style={profileCardStyles.userEmail}>Browsing without account</Text>
          <View style={profileCardStyles.guestPromptBox}>
            <Text style={profileCardStyles.guestPromptText}>
              Sign in to track live orders, register pets, and book consultations.
            </Text>
          </View>
        </>
      )}

      {/* Action CTA: Edit Profile or Sign In */}
      {user ? (
        <TouchableOpacity
          style={profileCardStyles.editProfileBtn}
          onPress={onEditPress}
          activeOpacity={0.8}
        >
          <Edit3 size={14} color="#D09E6B" strokeWidth={2.2} />
          <Text style={profileCardStyles.editProfileBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={profileCardStyles.signInCtaBtn}
          onPress={onSignInPress}
          activeOpacity={0.85}
        >
          <LogIn size={15} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={profileCardStyles.signInCtaBtnText}>Sign In / Create Account</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
});

interface ProfileStatsMatrixProps {
  petsCount: number;
  ordersCount: number;
}

export const ProfileStatsMatrix = memo(function ProfileStatsMatrix({
  petsCount,
  ordersCount,
}: ProfileStatsMatrixProps) {
  return (
    <View style={profileCardStyles.statsCard}>
      <View style={profileCardStyles.statBox}>
        <RNImage source={require('../../assets/toolkit/know-your-pet.webp')} style={profileCardStyles.statIcon} resizeMode="contain" />
        <Text style={profileCardStyles.statNumber}>{petsCount}</Text>
        <Text style={profileCardStyles.statLabel}>Registered Pets</Text>
      </View>
      <View style={profileCardStyles.statDivider} />
      <View style={profileCardStyles.statBox}>
        <RNImage source={require('../../assets/toolkit/my-orders.webp')} style={profileCardStyles.statIcon} resizeMode="contain" />
        <Text style={profileCardStyles.statNumber}>{ordersCount}</Text>
        <Text style={profileCardStyles.statLabel}>Fresh Orders</Text>
      </View>
      <View style={profileCardStyles.statDivider} />
      <View style={profileCardStyles.statBox}>
        <RNImage source={require('../../assets/toolkit/meal-planner.webp')} style={profileCardStyles.statIcon} resizeMode="contain" />
        <Text style={profileCardStyles.statNumber}>100%</Text>
        <Text style={profileCardStyles.statLabel}>Human-Grade</Text>
      </View>
    </View>
  );
});

interface AccountHubMenuProps {
  ordersCount: number;
  petsCount: number;
  supportUnreadCount: number;
  onNavigateOrders: () => void;
  onNavigatePets: () => void;
  onNavigateConsult: () => void;
  onNavigateSupport: () => void;
  onNavigateBlog: () => void;
  onNavigatePrivacy: () => void;
  onNavigateTerms: () => void;
  isConsultationsEnabled: boolean;
  consultationsFallback: 'hide' | 'coming_soon' | 'unavailable';
}

export const AccountHubMenu = memo(function AccountHubMenu({
  ordersCount,
  petsCount,
  supportUnreadCount,
  onNavigateOrders,
  onNavigatePets,
  onNavigateConsult,
  onNavigateSupport,
  onNavigateBlog,
  onNavigatePrivacy,
  onNavigateTerms,
  isConsultationsEnabled,
  consultationsFallback,
}: AccountHubMenuProps) {
  return (
    <View style={profileCardStyles.menuCard}>
      <Text style={profileCardStyles.menuHeading}>Account Hub</Text>

      {/* Orders Hub Item */}
      <TouchableOpacity
        style={profileCardStyles.menuItem}
        onPress={onNavigateOrders}
        activeOpacity={0.7}
      >
        <View style={profileCardStyles.menuItemLeft}>
          <View style={profileCardStyles.menuIconTile}>
            <RNImage source={require('../../assets/toolkit/my-orders.webp')} style={[profileCardStyles.menuIconImg]} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={profileCardStyles.menuItemTitle}>My Orders</Text>
            <Text style={profileCardStyles.menuItemSub}>
              Track live deliveries and view past receipts
            </Text>
          </View>
        </View>
        <View style={profileCardStyles.menuItemRight}>
          <View style={profileCardStyles.menuBadge}>
            <Text style={profileCardStyles.menuBadgeText}>{ordersCount}</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>

      <View style={profileCardStyles.menuDivider} />

      {/* Pets Registry Item */}
      <TouchableOpacity
        style={profileCardStyles.menuItem}
        onPress={onNavigatePets}
        activeOpacity={0.7}
      >
        <View style={profileCardStyles.menuItemLeft}>
          <View style={profileCardStyles.menuIconTile}>
            <RNImage source={require('../../assets/toolkit/know-your-pet.webp')} style={[profileCardStyles.menuIconImg]} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={profileCardStyles.menuItemTitle}>Registered Pets</Text>
            <Text style={profileCardStyles.menuItemSub}>
              Health metrics, allergies, and breed profiles
            </Text>
          </View>
        </View>
        <View style={profileCardStyles.menuItemRight}>
          <View style={profileCardStyles.menuBadge}>
            <Text style={profileCardStyles.menuBadgeText}>{petsCount}</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>

      {consultationsFallback !== 'hide' && (
        <>
          <View style={profileCardStyles.menuDivider} />

          {/* Vet Consultations Item — reachable regardless of the Consult
              tab's own disabled state, so it needs the same gate. */}
          <TouchableOpacity
            style={profileCardStyles.menuItem}
            onPress={onNavigateConsult}
            activeOpacity={0.7}
          >
            <View style={profileCardStyles.menuItemLeft}>
              <View style={profileCardStyles.menuIconTile}>
            <RNImage source={require('../../assets/toolkit/vet-consults.webp')} style={[profileCardStyles.menuIconImg, !isConsultationsEnabled && { opacity: 0.4 }]} resizeMode="contain" />
          </View>
              <View style={{ flex: 1 }}>
                <View style={profileCardStyles.menuItemTitleRow}>
                  <Text style={[profileCardStyles.menuItemTitle, !isConsultationsEnabled && profileCardStyles.menuItemTitleDisabled]}>
                    Vet Consultations
                  </Text>
                  {!isConsultationsEnabled && (
                    <View style={profileCardStyles.menuSoonPill}>
                      <Text style={profileCardStyles.menuSoonPillText}>
                        {consultationsFallback === 'coming_soon' ? 'SOON' : 'PAUSED'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={profileCardStyles.menuItemSub}>
                  Book clinics and review medical records
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          <View style={profileCardStyles.menuDivider} />
        </>
      )}

      {/* Support Item */}
      <TouchableOpacity
        style={profileCardStyles.menuItem}
        onPress={onNavigateSupport}
        activeOpacity={0.7}
      >
        <View style={profileCardStyles.menuItemLeft}>
          <View style={profileCardStyles.menuIconTile}>
            <RNImage source={require('../../assets/toolkit/ai-assistant.webp')} style={profileCardStyles.menuIconImg} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={profileCardStyles.menuItemTitle}>Support</Text>
            <Text style={profileCardStyles.menuItemSub}>
              Order issues, questions, or anything else
            </Text>
          </View>
        </View>
        <View style={profileCardStyles.menuItemRight}>
          {supportUnreadCount > 0 && (
            <View style={profileCardStyles.menuUnreadBadge}>
              <Text style={profileCardStyles.menuUnreadBadgeText}>{supportUnreadCount > 9 ? '9+' : supportUnreadCount}</Text>
            </View>
          )}
          <ChevronRight size={18} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>

      {/* Blog / Journal Item */}
      <TouchableOpacity
        style={profileCardStyles.menuItem}
        onPress={onNavigateBlog}
        activeOpacity={0.7}
      >
        <View style={profileCardStyles.menuItemLeft}>
          <View style={profileCardStyles.menuIconTile}>
            <RNImage source={require('../../assets/toolkit/journal.webp')} style={[profileCardStyles.menuIconImg]} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={profileCardStyles.menuItemTitle}>Journal</Text>
            <Text style={profileCardStyles.menuItemSub}>
              Guidance on feeding, nutrition, and dog care
            </Text>
          </View>
        </View>
        <View style={profileCardStyles.menuItemRight}>
          <ChevronRight size={18} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>

      {/* Privacy Policy Item */}
      <TouchableOpacity
        style={profileCardStyles.menuItem}
        onPress={onNavigatePrivacy}
        activeOpacity={0.7}
      >
        <View style={profileCardStyles.menuItemLeft}>
          <View style={profileCardStyles.menuIconTile}>
            <RNImage source={require('../../assets/toolkit/privacy.webp')} style={[profileCardStyles.menuIconImg]} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={profileCardStyles.menuItemTitle}>Privacy Policy</Text>
            <Text style={profileCardStyles.menuItemSub}>
              How we collect, use, and protect your data
            </Text>
          </View>
        </View>
        <View style={profileCardStyles.menuItemRight}>
          <ChevronRight size={18} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>

      {/* Terms & Conditions Item */}
      <TouchableOpacity
        style={profileCardStyles.menuItem}
        onPress={onNavigateTerms}
        activeOpacity={0.7}
      >
        <View style={profileCardStyles.menuItemLeft}>
          <View style={profileCardStyles.menuIconTile}>
            <RNImage source={require('../../assets/toolkit/terms.webp')} style={[profileCardStyles.menuIconImg]} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={profileCardStyles.menuItemTitle}>Terms & Conditions</Text>
            <Text style={profileCardStyles.menuItemSub}>
              The terms that govern using Hearth & One
            </Text>
          </View>
        </View>
        <View style={profileCardStyles.menuItemRight}>
          <ChevronRight size={18} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>
    </View>
  );
});

export const NutritionPledgeCard = memo(function NutritionPledgeCard() {
  return (
    <View style={profileCardStyles.infoCard}>
      <RNImage source={require('../../assets/toolkit/shop-recipes.webp')} style={profileCardStyles.infoIcon} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={profileCardStyles.infoTitle}>Canine Nutrition Quality Pledge</Text>
        <Text style={profileCardStyles.infoBody}>
          Every ingredient percentage is transparently stamped in the database
          ledger. Zero starch fillers, zero meal powders, cooked below 85°C.
        </Text>
      </View>
    </View>
  );
});

interface EditProfileModalProps {
  visible: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSaved: (updatedUser: UserProfile) => void;
  onRequestPhoneVerification: (country: string, phone: string) => void;
}

export const EditProfileModal = memo(function EditProfileModal({
  visible,
  user,
  onClose,
  onSaved,
  onRequestPhoneVerification,
}: EditProfileModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();
  const navInset = useNavBarInset();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY_ISO2);
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
      const parsedPhone = parsePhoneForState(user.phone);
      setCountry(parsedPhone.country);
      setPhone(parsedPhone.digits);
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
    if (phone && !isValidForCountry(country, phone)) {
      setFormError(`Please enter a valid phone number for ${getCountry(country).name}.`);
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setFormSuccess(null);

    const phoneToSend = phone ? toE164(country, phone) : undefined;

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
      <ModalKeyboardAvoider style={isTablet ? modalOverlayStyle : profileCardStyles.modalOverlay}>
        <View style={[profileCardStyles.modalContent, isTablet && modalSheetContainerStyle, { paddingBottom: 24 + navInset }]}>
          {/* Modal Header */}
          <View style={profileCardStyles.modalHeader}>
            <View>
              <Text style={profileCardStyles.modalTitle}>Edit Profile Ledger</Text>
              <Text style={profileCardStyles.modalSubtitle}>
                Update your verified pet parent details
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={profileCardStyles.modalCloseBtn}
              activeOpacity={0.7}
            >
              <X size={20} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={profileCardStyles.modalBody}
          >
            {/* Avatar Editor Section */}
            <View style={profileCardStyles.avatarEditSection}>
              <View style={profileCardStyles.avatarEditPreviewWrapper}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={profileCardStyles.avatarEditPreview}
                  />
                ) : (
                  <View
                    style={[
                      profileCardStyles.avatarCircle,
                      { width: 76, height: 76, borderRadius: 38 },
                    ]}
                  >
                    <Text style={[profileCardStyles.avatarInitial, { fontSize: 30 }]}>
                      {avatarInitial}
                    </Text>
                  </View>
                )}

                {isUploadingAvatar && (
                  <View style={profileCardStyles.avatarUploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>

              {/* Avatar Action Pills */}
              <View style={profileCardStyles.avatarActionRow}>
                <TouchableOpacity
                  style={profileCardStyles.avatarActionPill}
                  onPress={handlePickFromGallery}
                  disabled={isUploadingAvatar}
                  activeOpacity={0.7}
                >
                  <ImageIcon size={14} color={COLORS.forestGreen} />
                  <Text style={profileCardStyles.avatarActionText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={profileCardStyles.avatarActionPill}
                  onPress={handleTakePhoto}
                  disabled={isUploadingAvatar}
                  activeOpacity={0.7}
                >
                  <Camera size={14} color={COLORS.forestGreen} />
                  <Text style={profileCardStyles.avatarActionText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Feedback messages */}
            {formError && (
              <View style={profileCardStyles.alertErrorBox}>
                <AlertCircle size={15} color="#B91C1C" />
                <Text style={profileCardStyles.alertErrorText}>{formError}</Text>
              </View>
            )}

            {formSuccess && (
              <View style={profileCardStyles.alertSuccessBox}>
                <Check size={15} color={COLORS.forestGreen} />
                <Text style={profileCardStyles.alertSuccessText}>{formSuccess}</Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={profileCardStyles.fieldGroup}>
              <Text style={profileCardStyles.fieldLabel}>FIRST NAME</Text>
              <View style={profileCardStyles.inputContainer}>
                <UserIcon size={16} color={COLORS.textLight} />
                <TextInput
                  style={profileCardStyles.textInput}
                  placeholder="First Name"
                  placeholderTextColor={COLORS.textLight}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={profileCardStyles.fieldGroup}>
              <Text style={profileCardStyles.fieldLabel}>LAST NAME</Text>
              <View style={profileCardStyles.inputContainer}>
                <UserIcon size={16} color={COLORS.textLight} />
                <TextInput
                  style={profileCardStyles.textInput}
                  placeholder="Last Name"
                  placeholderTextColor={COLORS.textLight}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={profileCardStyles.fieldGroup}>
              <View style={profileCardStyles.phoneLabelRow}>
                <Text style={profileCardStyles.fieldLabel}>CONTACT PHONE NUMBER</Text>
                {user?.is_phone_verified && !isEditingPhone ? (
                  <View style={profileCardStyles.phoneVerifiedTag}>
                    <ShieldCheck size={11} color="#047857" />
                    <Text style={profileCardStyles.phoneVerifiedTagText}>
                      Phone Verified
                    </Text>
                  </View>
                ) : (
                  <Text style={profileCardStyles.phoneUnverifiedTagText}>
                    {isEditingPhone ? 'Modifying number...' : 'Unverified'}
                  </Text>
                )}
              </View>

              <View style={profileCardStyles.phoneInputRow}>
                <View style={{ flex: 1 }}>
                  <PhoneNumberInput
                    country={country}
                    onCountryChange={setCountry}
                    nationalNumber={phone}
                    onNationalNumberChange={setPhone}
                    disabled={!!(user?.is_phone_verified && !isEditingPhone)}
                    placeholder="9876543210"
                  />
                </View>

                {user?.is_phone_verified && !isEditingPhone ? (
                  <TouchableOpacity
                    style={profileCardStyles.changePhoneBtn}
                    onPress={() => setIsEditingPhone(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={profileCardStyles.changePhoneBtnText}>Change</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={profileCardStyles.phoneActionsRow}>
                    {isEditingPhone && (
                      <TouchableOpacity
                        style={profileCardStyles.cancelChangePhoneBtn}
                        onPress={() => {
                          setIsEditingPhone(false);
                          const parsedPhone = parsePhoneForState(user?.phone);
                          setCountry(parsedPhone.country);
                          setPhone(parsedPhone.digits);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={profileCardStyles.cancelChangePhoneBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[
                        profileCardStyles.verifyPhoneBtn,
                        !isValidForCountry(country, phone) && profileCardStyles.verifyPhoneBtnDisabled,
                      ]}
                      onPress={() => {
                        if (!isValidForCountry(country, phone)) {
                          Alert.alert(
                            'Phone Required',
                            `Please enter a valid phone number for ${getCountry(country).name} to verify.`
                          );
                          return;
                        }
                        onRequestPhoneVerification(country, phone);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={profileCardStyles.verifyPhoneBtnText}>Verify Phone</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {phone.length > 0 && !isValidForCountry(country, phone) ? (
                <Text style={profileCardStyles.fieldHelperWarning}>
                  Enter a valid phone number for {getCountry(country).name}.
                </Text>
              ) : (
                <Text style={profileCardStyles.fieldHelper}>
                  Used for delivery OTP, order updates, and veterinary consultations
                </Text>
              )}
            </View>

            <View style={profileCardStyles.fieldGroup}>
              <Text style={profileCardStyles.fieldLabel}>PRIMARY ACCOUNT EMAIL</Text>
              <View style={[profileCardStyles.inputContainer, profileCardStyles.inputDisabled]}>
                <Lock size={15} color={COLORS.textMuted} />
                <Text style={profileCardStyles.disabledEmailText}>{user?.email}</Text>
              </View>
              <Text style={profileCardStyles.fieldHelper}>
                Authentication email cannot be altered directly
              </Text>
            </View>

            {/* Save CTA */}
            <TouchableOpacity
              style={[
                profileCardStyles.saveButton,
                (isSaving || isUploadingAvatar) && profileCardStyles.buttonDisabled,
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
                  <Text style={profileCardStyles.saveButtonText}>Commit Profile Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ModalKeyboardAvoider>
    </Modal>
  );
});

export const profileCardStyles = StyleSheet.create({
  profileCard: {
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(208,158,107,0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 16 },
  avatarRing: {
    padding: 4,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: 'rgba(208,158,107,0.5)',
    marginBottom: 0,
  },
  avatarWrapper: { position: 'relative' },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2A2018',
    borderWidth: 2,
    borderColor: '#D09E6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#D09E6B',
    backgroundColor: '#2A2018',
  },
  avatarInitial: { fontSize: 34, color: '#D09E6B', fontFamily: FONT_HEADING_SCRIPT },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#D09E6B',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#14100C',
    elevation: 3,
  },
  userName: { flex: 1, fontSize: 26, lineHeight: 34, color: '#F9F6F0', fontFamily: FONT_HEADING_SCRIPT },
  detailList: {
    alignSelf: 'stretch',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(208,158,107,0.3)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(208,158,107,0.18)',
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: {
    width: 44,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(249,246,240,0.55)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailValue: { flex: 1, fontSize: 13.5, color: '#F9F6F0', textAlign: 'right' },
  detailValueMuted: { color: 'rgba(249,246,240,0.5)' },
  detailAction: { fontSize: 12.5, fontWeight: '800', color: '#D09E6B', letterSpacing: 0.3, textDecorationLine: 'underline' },
  userEmail: { fontSize: 13, color: 'rgba(249,246,240,0.7)', marginTop: 2 },
  guestPromptBox: {
    marginTop: 6,
    paddingHorizontal: 12,
  },
  guestPromptText: { fontSize: 12, color: 'rgba(249,246,240,0.75)', textAlign: 'center', lineHeight: 17 },
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
  verifyPhoneBtnDisabled: {
    opacity: 0.4,
  },
  verifyPhoneBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editProfileBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(208,158,107,0.12)',
    borderWidth: 1,
    borderColor: '#D09E6B',
  },
  editProfileBtnText: { fontSize: 13, fontWeight: '800', color: '#D09E6B', letterSpacing: 0.3 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statBox: { alignItems: 'center', flex: 1 },
  statIcon: { width: 32, height: 32, marginBottom: 2 },
  statDivider: { width: 1, height: 54, backgroundColor: COLORS.kraftBorder },
  statNumber: { fontSize: 20, color: COLORS.textCoffee, fontFamily: FONT_DISPLAY },
  statLabel: { fontSize: 10.5, color: COLORS.textMuted, marginTop: 1 },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuHeading: { fontSize: 24, color: COLORS.textCoffee, fontFamily: FONT_HEADING_SCRIPT, marginBottom: 8 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIconTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FBF7F0',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconImg: { width: 46, height: 46 },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  menuItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemTitle: { fontSize: 15, color: COLORS.textCoffee, fontFamily: FONT_DISPLAY },
  menuItemTitleDisabled: {
    color: COLORS.textLight,
  },
  menuSoonPill: {
    backgroundColor: COLORS.kraftBorder,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  menuSoonPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 0.4,
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
  menuUnreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#C25E48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuUnreadBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.kraftBorder,
    marginVertical: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF4EB',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(208,158,107,0.45)',
  },
  infoIcon: { width: 56, height: 56 },
  infoTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textCoffee },
  infoBody: { fontSize: 11, color: COLORS.textMuted, lineHeight: 16, marginTop: 2 },

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
  inputContainerIncomplete: {
    borderColor: '#D97706',
  },
  phoneDigitCount: {
    fontSize: 10,
    fontWeight: '800',
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
  fieldHelperWarning: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
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
