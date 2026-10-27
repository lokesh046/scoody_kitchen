import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { FlameIcon, DrumstickIcon, PouchIcon } from './PetStatIcons';
import {
  PawPrint,
  Scale,
  Sparkles,
  Check,
  X,
  Trash2,
  AlertCircle,
  Edit3,
  Camera,
  Image as ImageIcon,
  Calendar as CalendarIcon,
  Clock,
  Award,
  Cake,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../theme/colors';
import { LEDGER_MONO } from '../theme/typography';
import { PetProfile } from '../types';
import { HealthRecord } from '../api/pets';
import { uploadAvatarImage } from '../api/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../hooks/useResponsive';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

// DESIGN.md's brand faces: Outfit for display/headings, Quicksand for body
// copy. Duplicated from PetsScreen.tsx (which also needs these same string
// constants for its own styles) rather than imported, since they're plain
// one-line string literals — not worth an import for.
const FONT_DISPLAY = 'Outfit_700Bold';
const FONT_DISPLAY_SEMIBOLD = 'Outfit_600SemiBold';
const FONT_BODY = 'Quicksand_400Regular';
const FONT_BODY_BOLD = 'Quicksand_700Bold';
// Single muted slate tone for ledger-row icons — replaces the old per-row
// color coding so the data rows read as calm and consistent, not decorated.
// #5B6B7A over white is 5.48:1, clearing the 4.5:1 AA text floor
// (the lighter #8B99A8 this was drafted from only hit 2.91:1).
const ROW_ICON_COLOR = '#5B6B7A';

// --- Pure Helper Functions Hoisted Outside Component ---

const calculateCalories = (weight?: number | null): number => {
  const w = weight || 15;
  const rer = 70 * Math.pow(w, 0.75);
  return Math.round(rer * 1.6);
};

const formatBirthday = (dateStr?: string | null): string => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const getRecordTypeBadge = (type: string) => {
  const upper = (type || 'GENERAL').toUpperCase();
  if (upper === 'VACCINATION') {
    return { bg: '#EDF5F0', color: COLORS.forestGreen, label: 'VACCINATION' };
  }
  if (upper === 'CONSULTATION') {
    return { bg: '#EBF3FB', color: '#2563EB', label: 'CONSULTATION' };
  }
  if (upper === 'PRESCRIPTION') {
    return { bg: '#FAF4EB', color: COLORS.brandGold, label: 'PRESCRIPTION' };
  }
  return { bg: '#F3EFE6', color: COLORS.textCoffee, label: upper };
};

// --- Memoized Child Components ---

interface CompanionSelectorTabProps {
  pet: PetProfile;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export const CompanionSelectorTab = memo(function CompanionSelectorTab({
  pet,
  isSelected,
  onSelect,
}: CompanionSelectorTabProps) {
  const handlePress = useCallback(() => {
    onSelect(pet.id);
  }, [onSelect, pet.id]);

  return (
    <TouchableOpacity
      style={[petCardStyles.petSelectorTab, isSelected && petCardStyles.petSelectorTabActive]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="tab"
      accessibilityLabel={`${pet.name}${isSelected ? ', selected' : ''}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={petCardStyles.petSelectorThumbWrapper}>
        {pet.profile_image_url ? (
          <Image
            source={{ uri: pet.profile_image_url }}
            style={petCardStyles.petSelectorThumb}
          />
        ) : (
          <View style={[petCardStyles.petSelectorThumbFallback, isSelected && petCardStyles.petSelectorThumbActive]}>
            <Text style={[petCardStyles.petSelectorInitial, isSelected && { color: '#FFFFFF' }]}>
              {pet.name ? pet.name[0].toUpperCase() : 'P'}
            </Text>
          </View>
        )}
      </View>
      <Text style={[petCardStyles.petSelectorName, isSelected && petCardStyles.petSelectorNameActive]}>
        {pet.name}
      </Text>
    </TouchableOpacity>
  );
});

interface CompanionLedgerCardProps {
  pet: PetProfile;
  onDelete: (petId: number, petName: string) => void;
  onEdit: (pet: PetProfile) => void;
  onDirectPhoto: (pet: PetProfile) => void;
  photoUploadEnabled: boolean;
}

export const CompanionLedgerCard = memo(function CompanionLedgerCard({
  pet,
  onDelete,
  onEdit,
  onDirectPhoto,
  photoUploadEnabled,
}: CompanionLedgerCardProps) {
  const handleDelete = useCallback(() => {
    onDelete(pet.id, pet.name);
  }, [onDelete, pet.id, pet.name]);

  const handleEdit = useCallback(() => {
    onEdit(pet);
  }, [onEdit, pet]);

  const handlePhoto = useCallback(() => {
    onDirectPhoto(pet);
  }, [onDirectPhoto, pet]);

  const weightDisplay = pet.weight
    ? `${pet.weight} KG`
    : pet.weight_kg
    ? `${pet.weight_kg} KG`
    : 'N/A';

  const birthdayDisplay = useMemo(() => formatBirthday(pet.date_of_birth), [pet.date_of_birth]);

  return (
    <View style={petCardStyles.ledgerCard}>
      <View style={petCardStyles.cardInnerContent}>
        {/* Top Header Row */}
        <View style={petCardStyles.cardHeaderRow}>
          <View style={petCardStyles.avatarAndTitle}>
            {/* Companion Avatar Frame */}
            <View style={petCardStyles.avatarFrame}>
              {pet.profile_image_url ? (
                <Image
                  source={{ uri: pet.profile_image_url }}
                  style={petCardStyles.avatarImg}
                  contentFit="cover"
                />
              ) : (
                <View style={petCardStyles.avatarFallback}>
                  <PawPrint size={20} color={COLORS.brandGold} fill={COLORS.brandGold} />
                </View>
              )}

              {/* Instant Camera Badge */}
              {photoUploadEnabled && (
                <TouchableOpacity
                  style={petCardStyles.avatarCameraBadge}
                  onPress={handlePhoto}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Change ${pet.name}'s photo`}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Camera size={11} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>
              )}
            </View>

            {/* Title Block */}
            <View style={petCardStyles.nameBlock}>
              <Text style={petCardStyles.profileIdLabel}>PROFILE #{pet.id}</Text>
              <Text style={petCardStyles.petDisplayName}>{pet.name.toLowerCase()}</Text>
            </View>
          </View>

          {/* Trash Delete Action */}
          <TouchableOpacity
            onPress={handleDelete}
            style={petCardStyles.trashBtn}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${pet.name}'s profile`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={16} color="#6B8E7B" />
          </TouchableOpacity>
        </View>

        {/* Key-Value Ledger List */}
        <View style={petCardStyles.ledgerList}>
          {/* Species */}
          <View style={petCardStyles.ledgerRow}>
            <View style={petCardStyles.ledgerKeyGroup}>
              <Image source={require('../../assets/pet/species.webp')} style={petCardStyles.rowIcon} contentFit="contain" />
              <Text style={petCardStyles.ledgerKeyText}>SPECIES</Text>
            </View>
            <Text style={petCardStyles.ledgerValText}>
              {(pet.species || 'DOG').toUpperCase()}
            </Text>
          </View>

          {/* Breed */}
          <View style={petCardStyles.ledgerRow}>
            <View style={petCardStyles.ledgerKeyGroup}>
              <Image source={require('../../assets/pet/breed.webp')} style={petCardStyles.rowIcon} contentFit="contain" />
              <Text style={petCardStyles.ledgerKeyText}>BREED</Text>
            </View>
            <Text style={[petCardStyles.ledgerValText, { maxWidth: '58%' }]} numberOfLines={1}>
              {/* Was falling back to a fabricated breed ("GOLDEN RETRIEVER")
                  when the field was actually empty — a real correctness bug
                  on a "100% transparent" product. Matches weight/birthday's
                  existing empty-value convention below. */}
              {pet.breed ? pet.breed.toUpperCase() : 'NOT SPECIFIED'}
            </Text>
          </View>

          {/* Gender */}
          <View style={petCardStyles.ledgerRow}>
            <View style={petCardStyles.ledgerKeyGroup}>
              <Image source={require('../../assets/pet/gender.webp')} style={petCardStyles.rowIcon} contentFit="contain" />
              <Text style={petCardStyles.ledgerKeyText}>GENDER</Text>
            </View>
            <Text style={petCardStyles.ledgerValText}>
              {/* Same fabricated-default bug as breed above — a pet with no
                  recorded gender was silently shown as "MALE". */}
              {pet.gender ? pet.gender.toUpperCase() : 'NOT SPECIFIED'}
            </Text>
          </View>

          {/* Weight */}
          <View style={petCardStyles.ledgerRow}>
            <View style={petCardStyles.ledgerKeyGroup}>
              <Image source={require('../../assets/pet/weight.webp')} style={petCardStyles.rowIcon} contentFit="contain" />
              <Text style={petCardStyles.ledgerKeyText}>WEIGHT</Text>
            </View>
            <Text style={petCardStyles.ledgerValText}>{weightDisplay}</Text>
          </View>

          {/* Birthday */}
          <View style={[petCardStyles.ledgerRow, petCardStyles.ledgerRowLast]}>
            <View style={petCardStyles.ledgerKeyGroup}>
              <Image source={require('../../assets/pet/date-of-birth.webp')} style={petCardStyles.rowIcon} contentFit="contain" />
              <Text style={petCardStyles.ledgerKeyText}>BIRTHDAY</Text>
            </View>
            <Text style={petCardStyles.ledgerValText}>{birthdayDisplay}</Text>
          </View>
        </View>

        {/* Bottom Action Divider & Edit Profile Button */}
        <View style={petCardStyles.cardFooterRow}>
          <TouchableOpacity
            style={petCardStyles.medicalFileBtn}
            onPress={handleEdit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${pet.name}'s profile`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Edit3 size={13} color={COLORS.textCoffee} strokeWidth={2.2} />
            <Text style={petCardStyles.medicalFileBtnText}>EDIT PROFILE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

interface CompanionTargetGridProps {
  weight?: number | null;
}

export const CompanionTargetGrid = memo(function CompanionTargetGrid({ weight }: CompanionTargetGridProps) {
  const calories = useMemo(() => calculateCalories(weight), [weight]);
  const protein = useMemo(() => Math.round((weight || 15) * 4.5), [weight]);

  return (
    <View style={petCardStyles.targetGrid}>
      <View style={petCardStyles.targetBox}>
        <FlameIcon size={36} />
        <Text style={petCardStyles.targetValue}>{calories}</Text>
        <Text style={petCardStyles.targetLabel}>Daily kCal Target</Text>
      </View>
      <View style={petCardStyles.targetDivider} />
      <View style={petCardStyles.targetBox}>
        <DrumstickIcon size={36} />
        <Text style={petCardStyles.targetValue}>{protein}g</Text>
        <Text style={petCardStyles.targetLabel}>Daily Protein</Text>
      </View>
      <View style={petCardStyles.targetDivider} />
      <View style={petCardStyles.targetBox}>
        <PouchIcon size={36} />
        <Text style={petCardStyles.targetValue}>500g</Text>
        <Text style={petCardStyles.targetLabel}>Portion Pouch</Text>
      </View>
    </View>
  );
});

interface HealthRecordCardProps {
  record: HealthRecord;
}

export const HealthRecordCard = memo(function HealthRecordCard({ record }: HealthRecordCardProps) {
  const badge = useMemo(() => getRecordTypeBadge(record.record_type), [record.record_type]);
  const dateStr = useMemo(() => formatBirthday(record.created_at), [record.created_at]);

  return (
    <View style={petCardStyles.recordCard}>
      <View style={petCardStyles.recordCardHeader}>
        <View style={[petCardStyles.recordTypePill, { backgroundColor: badge.bg }]}>
          <Text style={[petCardStyles.recordTypeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
        <View style={petCardStyles.recordDateRow}>
          <CalendarIcon size={12} color={COLORS.textLight} />
          <Text style={petCardStyles.recordDateText}>{dateStr}</Text>
        </View>
      </View>

      <Text style={petCardStyles.recordTitle}>{record.title}</Text>

      {record.doctor && (
        <Text style={petCardStyles.recordDoctor}>
          Specialization: {record.doctor.specialization}
        </Text>
      )}

      {record.diagnosis && (
        <View style={petCardStyles.recordDetailRow}>
          <Text style={petCardStyles.recordDetailLabel}>Diagnosis:</Text>
          <Text style={petCardStyles.recordDetailValue}>{record.diagnosis}</Text>
        </View>
      )}

      {record.treatment && (
        <View style={petCardStyles.recordDetailRow}>
          <Text style={petCardStyles.recordDetailLabel}>Treatment:</Text>
          <Text style={petCardStyles.recordDetailValue}>{record.treatment}</Text>
        </View>
      )}

      {record.medications && (
        <View style={petCardStyles.recordDetailRow}>
          <Text style={petCardStyles.recordDetailLabel}>Medications:</Text>
          <Text style={petCardStyles.recordDetailValue}>{record.medications}</Text>
        </View>
      )}

      {record.notes && (
        <View style={petCardStyles.recordNotesBox}>
          <Text style={petCardStyles.recordNotesText}>{record.notes}</Text>
        </View>
      )}

      {record.follow_up_date && (
        <View style={petCardStyles.followUpRow}>
          <Clock size={12} color={COLORS.forestGreen} />
          <Text style={petCardStyles.followUpText}>
            Follow-up: {record.follow_up_date}
          </Text>
        </View>
      )}
    </View>
  );
});

// --- Isolated Add/Edit Pet Dossier Modal Component ---
// Manages internal typing state so main PetsScreen never re-renders during input!

interface PetDossierModalProps {
  visible: boolean;
  mode: 'add' | 'edit';
  // Bumped by the parent only when a genuinely new dossier session should
  // start (opening Add fresh, or picking a different pet to edit). Returning
  // from the AI Vision scanner mid-session does NOT bump this, so the form
  // reset below never re-fires and wipes what the user already typed.
  sessionId: number;
  initialPet?: PetProfile | null;
  initialVisionDetails?: { species?: string; breed?: string; imageUrl?: string } | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    species: string;
    breed?: string;
    gender: string;
    weight: number;
    date_of_birth?: string;
    profile_image_url?: string;
  }) => Promise<void>;
  onOpenVision: () => void;
}

export const PetDossierModal = memo(function PetDossierModal({
  visible,
  mode,
  sessionId,
  initialPet,
  initialVisionDetails,
  onClose,
  onSave,
  onOpenVision,
}: PetDossierModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  // Scrolls whichever field has focus above the keyboard (Android does not do this
  // inside a Modal). Field groups report their offset within the scroll content.
  const formScrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});
  const focusedField = useRef<string | null>(null);
  const scrollToField = (key: string | null) => {
    if (!key) return;
    const y = fieldY.current[key];
    if (y === undefined) return;
    formScrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
  };
  const onFieldFocus = (key: string) => {
    focusedField.current = key;
    setTimeout(() => scrollToField(key), 60);
  };
  useEffect(() => {
    if (keyboardHeight > 0) setTimeout(() => scrollToField(focusedField.current), 80);
  }, [keyboardHeight]);
  const isPhotoUploadEnabled = useFeatureFlag('pets_photo_upload', true);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [weight, setWeight] = useState('15');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form ONLY when a genuinely new dossier session starts (fresh
  // Add, or switching which pet is being edited) — never merely because the
  // modal's visible prop flipped, since that also happens when returning
  // from a mid-session AI Vision scan and must NOT wipe what's typed.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (mode === 'edit' && initialPet) {
      setName(initialPet.name || '');
      setSpecies(initialPet.species || 'Dog');
      setBreed(initialPet.breed || '');
      setWeight(
        initialPet.weight
          ? String(initialPet.weight)
          : initialPet.weight_kg
          ? String(initialPet.weight_kg)
          : '15'
      );
      setGender(initialPet.gender || 'Male');
      setDob(initialPet.date_of_birth ? initialPet.date_of_birth.split('T')[0] : '');
      setImageUri(initialPet.profile_image_url || null);
    } else {
      // Add mode
      setName('');
      setSpecies(initialVisionDetails?.species || 'Dog');
      setBreed(initialVisionDetails?.breed || '');
      setWeight('15');
      setGender('Male');
      setDob('');
      setImageUri(initialVisionDetails?.imageUrl || null);
    }
    // sessionId is the deliberate trigger; mode/initialPet/initialVisionDetails
    // are read at that same moment (the parent sets them together) but must
    // not re-trigger this reset on their own — that's what the merge effect
    // below is for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Merge in an AI Vision Scan result without disturbing anything else the
  // user already typed in this session (name, weight, gender, birthday).
  const lastAppliedVisionRef = useRef(initialVisionDetails);
  useEffect(() => {
    if (!visible || !initialVisionDetails) return;
    if (initialVisionDetails === lastAppliedVisionRef.current) return;
    lastAppliedVisionRef.current = initialVisionDetails;
    setSpecies(initialVisionDetails.species || 'Dog');
    setBreed(initialVisionDetails.breed || '');
    if (initialVisionDetails.imageUrl) setImageUri(initialVisionDetails.imageUrl);
  }, [visible, initialVisionDetails]);

  const uploadPhoto = async (localUri: string) => {
    setIsUploadingPhoto(true);
    setError(null);
    try {
      const res = await uploadAvatarImage(localUri);
      setImageUri(res.url);
    } catch (err) {
      console.log('Pet photo upload error:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (err) {
      console.log('Gallery picker error:', err);
      setError('Could not access image library.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera Permission', 'Camera permission is required to take a pet photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (err) {
      console.log('Camera error:', err);
      setError('Could not access camera.');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Please enter your pet's name.");
      return;
    }
    const parsedWeight = parseFloat(weight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setError('Please enter a valid weight in kg (e.g. 15).');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        species: species.trim() || 'Dog',
        breed: breed.trim() || undefined,
        gender,
        weight: parsedWeight,
        date_of_birth: dob.trim() || undefined,
        profile_image_url: imageUri || undefined,
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to save pet to backend.';
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* iOS lifts the sheet with KeyboardAvoidingView. On Android the modal window is
          not resized for the keyboard and the 'height' mode jumped and flickered, so the
          overlay is padded by the measured keyboard height instead. */}
      <KeyboardAvoidingView
        enabled={Platform.OS === 'ios'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          isTablet ? modalOverlayStyle : petCardStyles.modalOverlay,
          Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
      >
        <View
          style={[
            petCardStyles.modalContent,
            isTablet && modalSheetContainerStyle,
            // Edge-to-edge: keep the Save button clear of the system navigation bar.
            Platform.OS === 'android' && { paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 16) + 12 },
          ]}
        >
          {/* Modal Header */}
          <View style={petCardStyles.modalHeader}>
            <View>
              <Text style={petCardStyles.modalTitle}>
                {mode === 'add' ? 'Register Companion Dossier' : 'Edit Pet Profile'}
              </Text>
              <Text style={petCardStyles.modalSubtitle}>
                {mode === 'add'
                  ? 'Calculate nutritional targets and synchronize clinical records'
                  : `Update ${initialPet?.name || 'companion'}'s biological details`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={petCardStyles.modalCloseBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={formScrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={petCardStyles.modalBody}
          >
            {/* Pet Photo Section */}
            <View style={petCardStyles.photoPickerSection}>
              <View style={petCardStyles.photoPreviewWrapper}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={petCardStyles.photoPreviewImage} />
                ) : (
                  <View style={petCardStyles.photoPlaceholderCircle}>
                    <PawPrint size={32} color={COLORS.brandGold} fill={COLORS.brandGold} />
                  </View>
                )}

                {isUploadingPhoto && (
                  <View style={petCardStyles.photoUploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>

              {/* Photo Action Pills */}
              <View style={petCardStyles.photoActionRow}>
                {isPhotoUploadEnabled && (
                  <>
                    <TouchableOpacity
                      style={petCardStyles.photoActionPill}
                      onPress={handlePickPhoto}
                      disabled={isUploadingPhoto}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Choose photo from gallery"
                      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
                    >
                      <ImageIcon size={14} color={COLORS.forestGreen} />
                      <Text style={petCardStyles.photoActionText}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={petCardStyles.photoActionPill}
                      onPress={handleTakePhoto}
                      disabled={isUploadingPhoto}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Take photo with camera"
                      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
                    >
                      <Camera size={14} color={COLORS.forestGreen} />
                      <Text style={petCardStyles.photoActionText}>Camera</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={[petCardStyles.photoActionPill, petCardStyles.photoActionVisionPill]}
                  onPress={onOpenVision}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Scan pet with AI Vision"
                  hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
                >
                  <Sparkles size={14} color="#FFFFFF" />
                  <Text style={petCardStyles.photoActionVisionText}>AI Vision Scan</Text>
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={petCardStyles.modalErrorBox}>
                <AlertCircle size={15} color="#B91C1C" />
                <Text style={petCardStyles.modalErrorText}>{error}</Text>
              </View>
            )}

            <View style={petCardStyles.formDivider} />

            {/* Form Fields */}
            <View style={petCardStyles.fieldGroup} onLayout={(e) => { fieldY.current.name = e.nativeEvent.layout.y; }}>
              <Text style={petCardStyles.fieldLabel}>COMPANION NAME *</Text>
              <View style={petCardStyles.inputContainer}>
                <PawPrint size={15} color={COLORS.textLight} />
                <TextInput
                  onFocus={() => onFieldFocus('name')}
                  style={petCardStyles.textInput}
                  placeholder="e.g. Spooky, Milo, Puma"
                  placeholderTextColor={COLORS.textLight}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={petCardStyles.fieldGroup} onLayout={(e) => { fieldY.current.species = e.nativeEvent.layout.y; }}>
              <Text style={petCardStyles.fieldLabel}>SPECIES</Text>
              <View style={petCardStyles.inputContainer}>
                <TextInput
                  onFocus={() => onFieldFocus('species')}
                  style={petCardStyles.textInput}
                  placeholder="Dog"
                  placeholderTextColor={COLORS.textLight}
                  value={species}
                  onChangeText={setSpecies}
                />
              </View>
            </View>

            <View style={petCardStyles.fieldGroup} onLayout={(e) => { fieldY.current.breed = e.nativeEvent.layout.y; }}>
              <Text style={petCardStyles.fieldLabel}>BREED</Text>
              <View style={petCardStyles.inputContainer}>
                <TextInput
                  onFocus={() => onFieldFocus('breed')}
                  style={petCardStyles.textInput}
                  placeholder="e.g. Golden Retriever, Beagle"
                  placeholderTextColor={COLORS.textLight}
                  value={breed}
                  onChangeText={setBreed}
                />
              </View>
            </View>

            {/* Gender Selector Chips */}
            <View style={petCardStyles.fieldGroup}>
              <Text style={petCardStyles.fieldLabel}>GENDER</Text>
              <View style={petCardStyles.genderRow}>
                {['Male', 'Female'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      petCardStyles.genderChip,
                      gender.toLowerCase() === g.toLowerCase() && petCardStyles.genderChipActive,
                    ]}
                    onPress={() => setGender(g)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityLabel={g}
                    accessibilityState={{ selected: gender.toLowerCase() === g.toLowerCase() }}
                  >
                    <Text
                      style={[
                        petCardStyles.genderChipText,
                        gender.toLowerCase() === g.toLowerCase() && petCardStyles.genderChipTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={petCardStyles.fieldGroup} onLayout={(e) => { fieldY.current.weight = e.nativeEvent.layout.y; }}>
              <Text style={petCardStyles.fieldLabel}>BODY WEIGHT (KG) *</Text>
              <View style={petCardStyles.inputContainer}>
                <Scale size={15} color={COLORS.textLight} />
                <TextInput
                  onFocus={() => onFieldFocus('weight')}
                  style={petCardStyles.textInput}
                  placeholder="33"
                  placeholderTextColor={COLORS.textLight}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                />
                <Text style={petCardStyles.unitText}>KG</Text>
              </View>
              <Text style={petCardStyles.fieldHelper}>
                Used directly to calculate daily kCal & protein quotas
              </Text>
            </View>

            <View style={petCardStyles.fieldGroup} onLayout={(e) => { fieldY.current.dob = e.nativeEvent.layout.y; }}>
              <Text style={petCardStyles.fieldLabel}>DATE OF BIRTH (YYYY-MM-DD)</Text>
              <View style={petCardStyles.inputContainer}>
                <Cake size={15} color={COLORS.textLight} />
                <TextInput
                  onFocus={() => onFieldFocus('dob')}
                  style={petCardStyles.textInput}
                  placeholder="2026-03-05"
                  placeholderTextColor={COLORS.textLight}
                  value={dob}
                  onChangeText={setDob}
                />
              </View>
            </View>

            <View style={petCardStyles.formDivider} />

            {/* Submit CTA */}
            <TouchableOpacity
              style={[petCardStyles.submitButton, (saving || isUploadingPhoto) && petCardStyles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={saving || isUploadingPhoto}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                saving
                  ? 'Saving…'
                  : mode === 'add'
                  ? 'Confirm companion registration'
                  : 'Save companion ledger'
              }
              accessibilityState={{ disabled: saving || isUploadingPhoto, busy: saving }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={petCardStyles.submitButtonText}>
                    {mode === 'add'
                      ? 'Confirm Companion Registration'
                      : 'Save Companion Ledger'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// --- Post-Registration Celebration ---
// Replaces the plain native Alert after adding a companion with an authored
// moment grounded in this product's own ledger world: the pet's photo gets a
// forest-green "stamp" of confirmation, like a fresh page entered into the
// Canine Ledger, rather than a generic OS success dialog.

interface PetWelcomeCelebrationProps {
  pet: PetProfile | null;
  onDismiss: () => void;
}

const CELEBRATION_AUTO_DISMISS_MS = 2600;

export const PetWelcomeCelebration = memo(function PetWelcomeCelebration({
  pet,
  onDismiss,
}: PetWelcomeCelebrationProps) {
  const [rendered, setRendered] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const stampScale = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setRendered(false);
      cardScale.setValue(0.85);
      stampScale.setValue(0);
      onDismiss();
    });
  }, [onDismiss, backdropOpacity, cardScale, stampScale]);

  useEffect(() => {
    if (!pet) return;
    setRendered(true);

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        backdropOpacity.setValue(1);
        cardScale.setValue(1);
        stampScale.setValue(1);
        return;
      }
      Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      Animated.spring(cardScale, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(stampScale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      ]).start();
    });

    dismissTimerRef.current = setTimeout(handleDismiss, CELEBRATION_AUTO_DISMISS_MS);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet]);

  if (!rendered || !pet) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleDismiss}>
      <TouchableOpacity style={petCardStyles.celebrationBackdrop} activeOpacity={1} onPress={handleDismiss}>
        <Animated.View style={[petCardStyles.celebrationBackdropFill, { opacity: backdropOpacity }]} />
        <Animated.View style={[petCardStyles.celebrationCard, { transform: [{ scale: cardScale }] }]}>
          <View style={petCardStyles.celebrationAvatarFrame}>
            {pet.profile_image_url ? (
              <Image source={{ uri: pet.profile_image_url }} style={petCardStyles.celebrationAvatarImg} />
            ) : (
              <PawPrint size={32} color={COLORS.brandGold} fill={COLORS.brandGold} />
            )}
            <Animated.View style={[petCardStyles.celebrationStamp, { transform: [{ scale: stampScale }] }]}>
              <Check size={16} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>
          </View>
          <Text style={petCardStyles.celebrationTitle}>{pet.name} is on the ledger!</Text>
          <Text style={petCardStyles.celebrationSubtitle}>
            Welcome to the Canine Ledger — nutrition targets and health records are ready to track.
          </Text>
          <TouchableOpacity
            style={petCardStyles.celebrationDoneBtn}
            onPress={handleDismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={petCardStyles.celebrationDoneBtnText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
});

interface DeletePetConfirmModalProps {
  visible: boolean;
  petName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// The highest-stakes action on this screen — deleting a pet also destroys
// all of its saved health records, per the copy below — previously got the
// same bare OS Alert.alert as any trivial confirm, while the positive
// add-a-pet path got a bespoke celebration (see PetWelcomeCelebration
// above). Requiring the pet's name to be typed is deliberate friction sized
// to match the stakes: irreversible loss of medical history, not something
// a reflexive tap should be able to trigger.
export const DeletePetConfirmModal = memo(function DeletePetConfirmModal({
  visible,
  petName,
  isDeleting,
  onCancel,
  onConfirm,
}: DeletePetConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!visible) setConfirmText('');
  }, [visible]);

  const isMatch = confirmText.trim().toLowerCase() === petName.trim().toLowerCase();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={petCardStyles.deleteModalOverlay}>
        <View style={petCardStyles.deleteModalCard}>
          <View style={petCardStyles.deleteModalIconCircle}>
            <Trash2 size={22} color={COLORS.accentRed} />
          </View>

          <Text style={petCardStyles.deleteModalTitle}>Remove {petName}'s Profile?</Text>
          <Text style={petCardStyles.deleteModalSubtitle}>
            This will permanently delete {petName}'s saved health records, vaccination history, and nutrition targets. This can't be undone.
          </Text>

          <View style={petCardStyles.deleteModalFieldGroup}>
            <Text style={petCardStyles.deleteModalFieldLabel}>TYPE "{petName.toUpperCase()}" TO CONFIRM</Text>
            <View style={petCardStyles.deleteModalInputContainer}>
              <TextInput
                style={petCardStyles.deleteModalInput}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={petName}
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isDeleting}
                accessibilityLabel={`Type ${petName} to confirm deletion`}
              />
            </View>
          </View>

          <View style={petCardStyles.deleteModalBtnRow}>
            <TouchableOpacity
              style={petCardStyles.deleteModalCancelBtn}
              onPress={onCancel}
              activeOpacity={0.7}
              disabled={isDeleting}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={petCardStyles.deleteModalCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                petCardStyles.deleteModalConfirmBtn,
                (!isMatch || isDeleting) && petCardStyles.deleteModalConfirmBtnDisabled,
              ]}
              onPress={onConfirm}
              activeOpacity={0.85}
              disabled={!isMatch || isDeleting}
              accessibilityRole="button"
              accessibilityLabel={`Confirm removing ${petName}'s profile`}
              accessibilityState={{ disabled: !isMatch || isDeleting }}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Trash2 size={15} color="#FFFFFF" />
                  <Text style={petCardStyles.deleteModalConfirmText}>Remove Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

export const petCardStyles = StyleSheet.create({
  petSelectorTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  petSelectorTabActive: {
    backgroundColor: COLORS.textCoffee,
    borderColor: COLORS.brandGold,
  },
  petSelectorThumbWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
  },
  petSelectorThumb: { width: '100%', height: '100%' },
  petSelectorThumbFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FAF4EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.brandGold,
  },
  petSelectorThumbActive: {
    backgroundColor: COLORS.brandGold,
    borderColor: '#FFFFFF',
  },
  petSelectorInitial: { fontSize: 12, fontWeight: '800', color: COLORS.brandGold, fontFamily: FONT_BODY_BOLD },
  petSelectorName: { fontSize: 13, fontWeight: '800', color: COLORS.textCoffee, fontFamily: FONT_BODY_BOLD },
  petSelectorNameActive: { color: '#FFFFFF' },

  // EXACT CARD STYLES AS USER SCREENSHOT
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8DEC8',
    paddingVertical: 18,
    paddingHorizontal: 18,
    position: 'relative',
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardInnerContent: {
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarFrame: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E8DEC8',
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9F5EC',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.forestGreen,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  nameBlock: {
    gap: 2,
  },
  profileIdLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4C7C59',
    fontFamily: LEDGER_MONO,
    letterSpacing: 0.8,
  },
  petDisplayName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textCoffee,
    letterSpacing: -0.3,
    fontFamily: FONT_DISPLAY,
  },
  trashBtn: {
    padding: 6,
    opacity: 0.7,
  },

  // Structured Key-Value Ledger
  ledgerList: {
    gap: 1,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE3D2',
    borderStyle: 'dashed',
  },
  ledgerRowLast: {
    borderBottomWidth: 0,
  },
  ledgerKeyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ledgerKeyText: {
    fontSize: 11,
    fontWeight: '600',
    color: ROW_ICON_COLOR,
    letterSpacing: 0.8,
    fontFamily: LEDGER_MONO,
  },
  ledgerValText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textCoffee,
    letterSpacing: 0.4,
    fontFamily: LEDGER_MONO,
  },

  // Footer & Medical File Action
  cardFooterRow: {
    borderTopWidth: 1,
    borderTopColor: '#EDE3D2',
    borderStyle: 'dashed',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  medicalFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E2D5BE',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  medicalFileBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textCoffee,
    letterSpacing: 0.8,
    fontFamily: LEDGER_MONO,
  },

  // Target Grid
  targetGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: COLORS.textCoffee,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  targetBox: { alignItems: 'center', flex: 1, gap: 3 },
  targetDivider: { width: 1, height: 26, backgroundColor: '#EFE6D7' },
  targetValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: LEDGER_MONO,
  },
  targetLabel: { fontSize: 10, color: COLORS.textMuted, fontFamily: FONT_BODY },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 8,
  },
  recordCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recordTypeText: { fontSize: 9, fontWeight: '800', fontFamily: FONT_BODY_BOLD },
  recordDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recordDateText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontFamily: LEDGER_MONO,
  },
  recordTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textCoffee, fontFamily: FONT_DISPLAY_SEMIBOLD },
  recordDoctor: { fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic', fontFamily: FONT_BODY },
  recordDetailRow: { flexDirection: 'row', gap: 6 },
  recordDetailLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textCoffee, fontFamily: FONT_BODY_BOLD },
  recordDetailValue: { fontSize: 11, color: COLORS.textMuted, flex: 1, fontFamily: FONT_BODY },
  recordNotesBox: {
    backgroundColor: '#FAF5EE',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  recordNotesText: { fontSize: 11, color: COLORS.textMuted, lineHeight: 15, fontFamily: FONT_BODY },
  followUpRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  followUpText: { fontSize: 11, fontWeight: '700', color: COLORS.forestGreen, fontFamily: FONT_BODY_BOLD },

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
  modalTitle: { fontSize: 19, fontWeight: '800', color: COLORS.textCoffee, fontFamily: FONT_DISPLAY },
  modalSubtitle: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontFamily: FONT_BODY },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingTop: 14, paddingBottom: 20, gap: 11 },
  photoPickerSection: { alignItems: 'center', paddingVertical: 6, gap: 10 },
  photoPreviewWrapper: { position: 'relative' },
  photoPreviewImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: COLORS.brandGold,
  },
  photoPlaceholderCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FAF4EB',
    borderWidth: 2,
    borderColor: COLORS.brandGold,
  },
  photoUploadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionRow: { flexDirection: 'row', gap: 12 },
  photoActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C6E2D1',
  },
  photoActionText: { fontSize: 11, fontWeight: '700', color: COLORS.forestGreen, fontFamily: FONT_BODY_BOLD },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 10,
  },
  modalErrorText: { fontSize: 11, color: '#991B1B', flex: 1, fontWeight: '600', fontFamily: FONT_BODY_BOLD },
  fieldGroup: { gap: 5 },
  // Same bold, mono, forest-green voice as the ledger card's own key labels
  // (SPECIES / BREED / GENDER…) — this form fills in that exact ledger.
  rowIcon: { width: 22, height: 22 },
  fieldLabel: { fontSize: 10.5, fontWeight: '800', color: COLORS.forestGreen, letterSpacing: 1, fontFamily: LEDGER_MONO },
  formDivider: {
    borderTopWidth: 1,
    borderTopColor: '#EDE3D2',
    borderStyle: 'dashed',
    marginVertical: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  textInput: { flex: 1, fontSize: 13, color: COLORS.textCoffee, fontWeight: '600', height: '100%', fontFamily: FONT_BODY_BOLD },
  unitText: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, fontFamily: FONT_BODY_BOLD },
  fieldHelper: { fontSize: 10, color: COLORS.textLight, marginTop: 2, paddingLeft: 2, fontFamily: FONT_BODY },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  genderChipActive: {
    backgroundColor: COLORS.textCoffee,
    borderColor: COLORS.brandGold,
  },
  genderChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textCoffee, fontFamily: FONT_BODY_BOLD },
  genderChipTextActive: { color: '#FFFFFF' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 10,
    paddingVertical: 15,
    marginTop: 8,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: { fontSize: 15.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2, fontFamily: FONT_BODY_BOLD },
  buttonDisabled: { opacity: 0.6 },
  photoActionVisionPill: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  photoActionVisionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FONT_BODY_BOLD,
  },

  /* Post-Registration Celebration */
  celebrationBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  celebrationBackdropFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(44, 24, 16, 0.55)',
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  celebrationAvatarFrame: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FAF4EB',
    borderWidth: 2,
    borderColor: COLORS.brandGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  celebrationAvatarImg: { width: '100%', height: '100%', borderRadius: 42 },
  celebrationStamp: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.successGreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  celebrationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textCoffee,
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
  },
  celebrationSubtitle: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
    fontFamily: FONT_BODY,
  },
  celebrationDoneBtn: {
    marginTop: 16,
    width: '100%',
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationDoneBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', fontFamily: FONT_BODY_BOLD },

  /* Delete Pet Confirmation — same overlay/card conventions as the
     celebration modal above, so the screen's one destructive action reads
     as deliberately designed rather than a bare system alert. */
  deleteModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: 'rgba(44, 24, 16, 0.55)',
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  deleteModalIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accentRedTintBg,
    borderWidth: 1,
    borderColor: COLORS.accentRedTintBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textCoffee,
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
  },
  deleteModalSubtitle: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
    fontFamily: FONT_BODY,
  },
  deleteModalFieldGroup: { width: '100%', gap: 5, marginTop: 16 },
  deleteModalFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    fontFamily: LEDGER_MONO,
  },
  deleteModalInputContainer: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  deleteModalInput: {
    fontSize: 13,
    color: COLORS.textCoffee,
    fontWeight: '600',
    fontFamily: FONT_BODY_BOLD,
  },
  deleteModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 18,
  },
  deleteModalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelText: { fontSize: 13.5, fontWeight: '800', color: COLORS.textCoffee, fontFamily: FONT_BODY_BOLD },
  deleteModalConfirmBtn: {
    flex: 1.3,
    height: 46,
    borderRadius: 10,
    backgroundColor: COLORS.accentRed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  // Greyed out rather than hidden — a power user (Alex) should see the
  // control exists and understand exactly why it's inert, not wonder where
  // the delete action went.
  deleteModalConfirmBtnDisabled: {
    backgroundColor: COLORS.kraftBorder,
  },
  deleteModalConfirmText: { fontSize: 13.5, fontWeight: '800', color: '#FFFFFF', fontFamily: FONT_BODY_BOLD },
});
