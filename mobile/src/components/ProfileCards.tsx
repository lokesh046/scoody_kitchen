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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ShieldCheck,
  Package,
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
  Headset,
  Newspaper,
  FileText,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { COLORS } from '../theme/colors';
import { UserProfile } from '../store/authStore';
import { updateUserProfile, uploadAvatarImage } from '../api/auth';
import { useResponsive } from '../hooks/useResponsive';
import { PhoneNumberInput } from './PhoneNumberInput';
import { DEFAULT_COUNTRY_ISO2 } from '../constants/countries';
import { toE164, isValidForCountry, getCountry } from '../utils/phone';

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
    <View style={profileCardStyles.profileCard}>
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
            accessibilityLabel="Change avatar picture"
          >
            <Camera size={13} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={profileCardStyles.userName}>
        {user
          ? `${user.first_name || 'Pet Parent'} ${user.last_name || ''}`.trim()
          : 'Guest Explorer'}
      </Text>
      <Text style={profileCardStyles.userEmail}>
        {user ? user.email : 'Browsing without account'}
      </Text>

      {user ? (
        user.phone ? (
          <View style={profileCardStyles.userPhoneRow}>
            <Phone size={12} color={COLORS.textMuted} />
            <Text style={profileCardStyles.userPhoneText}>{user.phone}</Text>
            {user.is_phone_verified ? (
              <View style={profileCardStyles.verifiedMiniPill}>
                <Check size={10} color="#047857" />
                <Text style={profileCardStyles.verifiedMiniPillText}>Verified</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={profileCardStyles.unverifiedMiniPill}
                onPress={() => {
                  const parsedPhone = parsePhoneForState(user.phone);
                  onVerifyPhonePress(parsedPhone.country, parsedPhone.digits);
                }}
                activeOpacity={0.8}
              >
                <Text style={profileCardStyles.unverifiedMiniPillText}>Verify Phone</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={profileCardStyles.addPhonePrompt}
            onPress={onEditPress}
            activeOpacity={0.8}
          >
            <Phone size={12} color="#C2410C" />
            <Text style={profileCardStyles.addPhonePromptText}>+ Add & Verify Phone</Text>
          </TouchableOpacity>
        )
      ) : (
        <View style={profileCardStyles.guestPromptBox}>
          <Text style={profileCardStyles.guestPromptText}>
            Sign in to track live orders, register pets, and book consultations.
          </Text>
        </View>
      )}

      {/* Badges Matrix */}
      <View style={profileCardStyles.badgeRow}>
        <View style={[profileCardStyles.roleBadge, { backgroundColor: '#EDF5F0' }]}>
          <ShieldCheck size={12} color={COLORS.forestGreen} />
          <Text style={[profileCardStyles.roleText, { color: COLORS.forestGreen }]}>
            {user ? `ROLE: ${user.role.toUpperCase()}` : 'GUEST MODE'}
          </Text>
        </View>

        {user?.is_email_verified && (
          <View style={[profileCardStyles.roleBadge, { backgroundColor: '#FAF4EB' }]}>
            <FileCheck2 size={12} color={COLORS.brandGold} />
            <Text style={[profileCardStyles.roleText, { color: COLORS.brandGold }]}>
              Verified Email
            </Text>
          </View>
        )}

        {user?.is_phone_verified && (
          <View style={[profileCardStyles.roleBadge, { backgroundColor: '#EBF3FB' }]}>
            <Phone size={12} color="#2563EB" />
            <Text style={[profileCardStyles.roleText, { color: '#2563EB' }]}>
              Phone Verified
            </Text>
          </View>
        )}
      </View>

      {/* Action CTA: Edit Profile or Sign In */}
      {user ? (
        <TouchableOpacity
          style={profileCardStyles.editProfileBtn}
          onPress={onEditPress}
          activeOpacity={0.8}
        >
          <Edit3 size={14} color={COLORS.forestGreen} strokeWidth={2.2} />
          <Text style={profileCardStyles.editProfileBtnText}>Edit Profile Ledger</Text>
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
    </View>
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
        <Text style={profileCardStyles.statNumber}>{petsCount}</Text>
        <Text style={profileCardStyles.statLabel}>Registered Pets</Text>
      </View>
      <View style={profileCardStyles.statDivider} />
      <View style={profileCardStyles.statBox}>
        <Text style={profileCardStyles.statNumber}>{ordersCount}</Text>
        <Text style={profileCardStyles.statLabel}>Fresh Orders</Text>
      </View>
      <View style={profileCardStyles.statDivider} />
      <View style={profileCardStyles.statBox}>
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
          <View style={[profileCardStyles.menuIconCircle, { backgroundColor: '#FAF5EE' }]}>
            <Package size={18} color={COLORS.brandGold} />
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
          <View style={[profileCardStyles.menuIconCircle, { backgroundColor: '#EDF5F0' }]}>
            <PawPrint size={18} color={COLORS.forestGreen} />
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
              <View style={[profileCardStyles.menuIconCircle, { backgroundColor: isConsultationsEnabled ? '#EBF3FB' : COLORS.kraftBorder }]}>
                <Stethoscope size={18} color={isConsultationsEnabled ? '#2563EB' : COLORS.textLight} />
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
          <View style={[profileCardStyles.menuIconCircle, { backgroundColor: '#FBEFEA' }]}>
            <Headset size={18} color="#C25E48" />
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
          <View style={[profileCardStyles.menuIconCircle, { backgroundColor: '#EDF5F0' }]}>
            <Newspaper size={18} color={COLORS.forestGreen} />
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
          <View style={[profileCardStyles.menuIconCircle, { backgroundColor: '#F1F1F1' }]}>
            <Lock size={18} color={COLORS.textMuted} />
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
          <View style={[profileCardStyles.menuIconCircle, { backgroundColor: '#F1F1F1' }]}>
            <FileText size={18} color={COLORS.textMuted} />
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
      <PawPrint size={20} color={COLORS.brandGold} fill={COLORS.brandGold} />
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
        style={isTablet ? modalOverlayStyle : profileCardStyles.modalOverlay}
      >
        <View style={[profileCardStyles.modalContent, isTablet && modalSheetContainerStyle]}>
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
      </KeyboardAvoidingView>
    </Modal>
  );
});

export const profileCardStyles = StyleSheet.create({
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
  verifyPhoneBtnDisabled: {
    opacity: 0.4,
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
  menuItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
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
    gap: 12,
    backgroundColor: '#FAF4EB',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
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
