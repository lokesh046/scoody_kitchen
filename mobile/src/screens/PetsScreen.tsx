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
  RefreshControl,
  KeyboardAvoidingView,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  PawPrint,
  Plus,
  Scale,
  Flame,
  Sparkles,
  Heart,
  Check,
  X,
  Trash2,
  AlertCircle,
  Activity,
  Edit3,
  Camera,
  Image as ImageIcon,
  Stethoscope,
  Calendar as CalendarIcon,
  FileText,
  Clock,
  Award,
  Cake,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, Outfit_700Bold, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Quicksand_400Regular, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { COLORS } from '../theme/colors';
import { PetProfile } from '../types';
import {
  fetchMyPets,
  createPet,
  updatePet as apiUpdatePet,
  deletePet,
  fetchPetHealthRecords,
  HealthRecord,
} from '../api/pets';
import { uploadAvatarImage } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { usePetStore } from '../store/petStore';
import { tabPrefetchCache } from '../services/tabPrefetch';
import { BrandMedallion } from '../components/BrandLogo';
import PetVisionModal from '../components/PetVisionModal';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

// DESIGN.md's brand faces: Outfit for display/headings, Quicksand for body copy.
// TODO: DESIGN.md's Ledger Monospace Rule calls for IBM Plex Mono here; no
// package for it is installed yet (scoped separately), so this still falls
// back to the platform system monospace, same as before.
const LEDGER_MONO = Platform.OS === 'ios' ? 'Courier' : 'monospace';
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

const CompanionSelectorTab = memo(function CompanionSelectorTab({
  pet,
  isSelected,
  onSelect,
}: CompanionSelectorTabProps) {
  const handlePress = useCallback(() => {
    onSelect(pet.id);
  }, [onSelect, pet.id]);

  return (
    <TouchableOpacity
      style={[styles.petSelectorTab, isSelected && styles.petSelectorTabActive]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="tab"
      accessibilityLabel={`${pet.name}${isSelected ? ', selected' : ''}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.petSelectorThumbWrapper}>
        {pet.profile_image_url ? (
          <Image
            source={{ uri: pet.profile_image_url }}
            style={styles.petSelectorThumb}
          />
        ) : (
          <View style={[styles.petSelectorThumbFallback, isSelected && styles.petSelectorThumbActive]}>
            <Text style={[styles.petSelectorInitial, isSelected && { color: '#FFFFFF' }]}>
              {pet.name ? pet.name[0].toUpperCase() : 'P'}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.petSelectorName, isSelected && styles.petSelectorNameActive]}>
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

const CompanionLedgerCard = memo(function CompanionLedgerCard({
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
    <View style={styles.ledgerCard}>
      <View style={styles.cardInnerContent}>
        {/* Top Header Row */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatarAndTitle}>
            {/* Companion Avatar Frame */}
            <View style={styles.avatarFrame}>
              {pet.profile_image_url ? (
                <Image
                  source={{ uri: pet.profile_image_url }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackPaw}>🐾</Text>
                </View>
              )}

              {/* Instant Camera Badge */}
              {photoUploadEnabled && (
                <TouchableOpacity
                  style={styles.avatarCameraBadge}
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
            <View style={styles.nameBlock}>
              <Text style={styles.profileIdLabel}>PROFILE #{pet.id}</Text>
              <Text style={styles.petDisplayName}>{pet.name.toLowerCase()}</Text>
            </View>
          </View>

          {/* Trash Delete Action */}
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.trashBtn}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${pet.name}'s profile`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={16} color="#6B8E7B" />
          </TouchableOpacity>
        </View>

        {/* Key-Value Ledger List */}
        <View style={styles.ledgerList}>
          {/* Species */}
          <View style={styles.ledgerRow}>
            <View style={styles.ledgerKeyGroup}>
              <PawPrint size={14} color={ROW_ICON_COLOR} />
              <Text style={styles.ledgerKeyText}>SPECIES</Text>
            </View>
            <Text style={styles.ledgerValText}>
              {(pet.species || 'DOG').toUpperCase()}
            </Text>
          </View>

          {/* Breed */}
          <View style={styles.ledgerRow}>
            <View style={styles.ledgerKeyGroup}>
              <Award size={14} color={ROW_ICON_COLOR} />
              <Text style={styles.ledgerKeyText}>BREED</Text>
            </View>
            <Text style={[styles.ledgerValText, { maxWidth: '58%' }]} numberOfLines={1}>
              {(pet.breed || 'GOLDEN RETRIEVER').toUpperCase()}
            </Text>
          </View>

          {/* Gender */}
          <View style={styles.ledgerRow}>
            <View style={styles.ledgerKeyGroup}>
              <Heart size={14} color={ROW_ICON_COLOR} />
              <Text style={styles.ledgerKeyText}>GENDER</Text>
            </View>
            <Text style={styles.ledgerValText}>
              {(pet.gender || 'MALE').toUpperCase()}
            </Text>
          </View>

          {/* Weight */}
          <View style={styles.ledgerRow}>
            <View style={styles.ledgerKeyGroup}>
              <Scale size={14} color={ROW_ICON_COLOR} />
              <Text style={styles.ledgerKeyText}>WEIGHT</Text>
            </View>
            <Text style={styles.ledgerValText}>{weightDisplay}</Text>
          </View>

          {/* Birthday */}
          <View style={[styles.ledgerRow, styles.ledgerRowLast]}>
            <View style={styles.ledgerKeyGroup}>
              <Cake size={14} color={ROW_ICON_COLOR} />
              <Text style={styles.ledgerKeyText}>BIRTHDAY</Text>
            </View>
            <Text style={styles.ledgerValText}>{birthdayDisplay}</Text>
          </View>
        </View>

        {/* Bottom Action Divider & Edit Profile Button */}
        <View style={styles.cardFooterRow}>
          <TouchableOpacity
            style={styles.medicalFileBtn}
            onPress={handleEdit}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${pet.name}'s profile`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Edit3 size={13} color={COLORS.textCoffee} strokeWidth={2.2} />
            <Text style={styles.medicalFileBtnText}>EDIT PROFILE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

interface CompanionTargetGridProps {
  weight?: number | null;
}

const CompanionTargetGrid = memo(function CompanionTargetGrid({ weight }: CompanionTargetGridProps) {
  const calories = useMemo(() => calculateCalories(weight), [weight]);
  const protein = useMemo(() => Math.round((weight || 15) * 4.5), [weight]);

  return (
    <View style={styles.targetGrid}>
      <View style={styles.targetBox}>
        <Flame size={17} color={COLORS.brandGold} />
        <Text style={styles.targetValue}>{calories}</Text>
        <Text style={styles.targetLabel}>Daily kCal Target</Text>
      </View>
      <View style={styles.targetDivider} />
      <View style={styles.targetBox}>
        <Activity size={17} color={COLORS.forestGreen} />
        <Text style={styles.targetValue}>{protein}g</Text>
        <Text style={styles.targetLabel}>Daily Protein</Text>
      </View>
      <View style={styles.targetDivider} />
      <View style={styles.targetBox}>
        <Heart size={17} color="#C25E48" />
        <Text style={styles.targetValue}>500g</Text>
        <Text style={styles.targetLabel}>Portion Pouch</Text>
      </View>
    </View>
  );
});

interface HealthRecordCardProps {
  record: HealthRecord;
}

const HealthRecordCard = memo(function HealthRecordCard({ record }: HealthRecordCardProps) {
  const badge = useMemo(() => getRecordTypeBadge(record.record_type), [record.record_type]);
  const dateStr = useMemo(() => formatBirthday(record.created_at), [record.created_at]);

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordCardHeader}>
        <View style={[styles.recordTypePill, { backgroundColor: badge.bg }]}>
          <Text style={[styles.recordTypeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
        <View style={styles.recordDateRow}>
          <CalendarIcon size={12} color={COLORS.textLight} />
          <Text style={styles.recordDateText}>{dateStr}</Text>
        </View>
      </View>

      <Text style={styles.recordTitle}>{record.title}</Text>

      {record.doctor && (
        <Text style={styles.recordDoctor}>
          Specialization: {record.doctor.specialization}
        </Text>
      )}

      {record.diagnosis && (
        <View style={styles.recordDetailRow}>
          <Text style={styles.recordDetailLabel}>Diagnosis:</Text>
          <Text style={styles.recordDetailValue}>{record.diagnosis}</Text>
        </View>
      )}

      {record.treatment && (
        <View style={styles.recordDetailRow}>
          <Text style={styles.recordDetailLabel}>Treatment:</Text>
          <Text style={styles.recordDetailValue}>{record.treatment}</Text>
        </View>
      )}

      {record.medications && (
        <View style={styles.recordDetailRow}>
          <Text style={styles.recordDetailLabel}>Medications:</Text>
          <Text style={styles.recordDetailValue}>{record.medications}</Text>
        </View>
      )}

      {record.notes && (
        <View style={styles.recordNotesBox}>
          <Text style={styles.recordNotesText}>{record.notes}</Text>
        </View>
      )}

      {record.follow_up_date && (
        <View style={styles.followUpRow}>
          <Clock size={12} color={COLORS.forestGreen} />
          <Text style={styles.followUpText}>
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

const PetDossierModal = memo(function PetDossierModal({
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={isTablet ? modalOverlayStyle : styles.modalOverlay}
      >
        <View style={[styles.modalContent, isTablet && modalSheetContainerStyle]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {mode === 'add' ? 'Register Companion Dossier' : 'Edit Pet Profile'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {mode === 'add'
                  ? 'Calculate nutritional targets and synchronize clinical records'
                  : `Update ${initialPet?.name || 'companion'}'s biological details`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
            {/* Pet Photo Section */}
            <View style={styles.photoPickerSection}>
              <View style={styles.photoPreviewWrapper}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.photoPreviewImage} />
                ) : (
                  <View style={styles.photoPlaceholderCircle}>
                    <PawPrint size={32} color={COLORS.brandGold} fill={COLORS.brandGold} />
                  </View>
                )}

                {isUploadingPhoto && (
                  <View style={styles.photoUploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>

              {/* Photo Action Pills */}
              <View style={styles.photoActionRow}>
                {isPhotoUploadEnabled && (
                  <>
                    <TouchableOpacity
                      style={styles.photoActionPill}
                      onPress={handlePickPhoto}
                      disabled={isUploadingPhoto}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Choose photo from gallery"
                      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
                    >
                      <ImageIcon size={14} color={COLORS.forestGreen} />
                      <Text style={styles.photoActionText}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.photoActionPill}
                      onPress={handleTakePhoto}
                      disabled={isUploadingPhoto}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Take photo with camera"
                      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
                    >
                      <Camera size={14} color={COLORS.forestGreen} />
                      <Text style={styles.photoActionText}>Camera</Text>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.photoActionPill, styles.photoActionVisionPill]}
                  onPress={onOpenVision}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Scan pet with AI Vision"
                  hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
                >
                  <Sparkles size={14} color="#FFFFFF" />
                  <Text style={styles.photoActionVisionText}>AI Vision Scan</Text>
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={styles.modalErrorBox}>
                <AlertCircle size={15} color="#B91C1C" />
                <Text style={styles.modalErrorText}>{error}</Text>
              </View>
            )}

            <View style={styles.formDivider} />

            {/* Form Fields */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>COMPANION NAME *</Text>
              <View style={styles.inputContainer}>
                <PawPrint size={15} color={COLORS.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Spooky, Milo, Bruno"
                  placeholderTextColor={COLORS.textLight}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SPECIES</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Dog"
                  placeholderTextColor={COLORS.textLight}
                  value={species}
                  onChangeText={setSpecies}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>BREED</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Golden Retriever, Beagle"
                  placeholderTextColor={COLORS.textLight}
                  value={breed}
                  onChangeText={setBreed}
                />
              </View>
            </View>

            {/* Gender Selector Chips */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>GENDER</Text>
              <View style={styles.genderRow}>
                {['Male', 'Female'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderChip,
                      gender.toLowerCase() === g.toLowerCase() && styles.genderChipActive,
                    ]}
                    onPress={() => setGender(g)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityLabel={g}
                    accessibilityState={{ selected: gender.toLowerCase() === g.toLowerCase() }}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        gender.toLowerCase() === g.toLowerCase() && styles.genderChipTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>BODY WEIGHT (KG) *</Text>
              <View style={styles.inputContainer}>
                <Scale size={15} color={COLORS.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="33"
                  placeholderTextColor={COLORS.textLight}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                />
                <Text style={styles.unitText}>KG</Text>
              </View>
              <Text style={styles.fieldHelper}>
                Used directly to calculate daily kCal & protein quotas
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>DATE OF BIRTH (YYYY-MM-DD)</Text>
              <View style={styles.inputContainer}>
                <Cake size={15} color={COLORS.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="2026-03-05"
                  placeholderTextColor={COLORS.textLight}
                  value={dob}
                  onChangeText={setDob}
                />
              </View>
            </View>

            <View style={styles.formDivider} />

            {/* Submit CTA */}
            <TouchableOpacity
              style={[styles.submitButton, (saving || isUploadingPhoto) && styles.buttonDisabled]}
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
                  <Text style={styles.submitButtonText}>
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

const PetWelcomeCelebration = memo(function PetWelcomeCelebration({
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
      <TouchableOpacity style={styles.celebrationBackdrop} activeOpacity={1} onPress={handleDismiss}>
        <Animated.View style={[styles.celebrationBackdropFill, { opacity: backdropOpacity }]} />
        <Animated.View style={[styles.celebrationCard, { transform: [{ scale: cardScale }] }]}>
          <View style={styles.celebrationAvatarFrame}>
            {pet.profile_image_url ? (
              <Image source={{ uri: pet.profile_image_url }} style={styles.celebrationAvatarImg} />
            ) : (
              <Text style={styles.celebrationAvatarPaw}>🐾</Text>
            )}
            <Animated.View style={[styles.celebrationStamp, { transform: [{ scale: stampScale }] }]}>
              <Check size={16} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>
          </View>
          <Text style={styles.celebrationTitle}>{pet.name} is on the ledger!</Text>
          <Text style={styles.celebrationSubtitle}>
            Welcome to the Canine Ledger — nutrition targets and health records are ready to track.
          </Text>
          <TouchableOpacity
            style={styles.celebrationDoneBtn}
            onPress={handleDismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.celebrationDoneBtnText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
});

// --- Main Pets Screen ---

export default function PetsScreen({ navigation }: any) {
  // Loads the brand faces once; Text using FONT_DISPLAY/FONT_BODY renders in
  // the system font until this resolves, then re-renders automatically.
  useFonts({ Outfit_700Bold, Outfit_600SemiBold, Quicksand_400Regular, Quicksand_700Bold });
  const { user, isGuest } = useAuthStore();
  const { pets, setPets, addPet, updatePet: storeUpdatePet, removePet } = usePetStore();
  const { isTablet } = useResponsive();
  const isPhotoUploadEnabled = useFeatureFlag('pets_photo_upload', true);

  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  // If the app-boot prefetch already wrote pets into the shared store before
  // this screen mounted, skip the spinner entirely instead of hiding
  // already-available data behind one.
  const [loading, setLoading] = useState(() => pets.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Clinical Health Records State
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsErrorMsg, setRecordsErrorMsg] = useState('');

  // Add / Edit Pet Modal State
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [petToEdit, setPetToEdit] = useState<PetProfile | null>(null);
  const [visionPrefill, setVisionPrefill] = useState<{
    species?: string;
    breed?: string;
    imageUrl?: string;
  } | null>(null);
  // Bumped only on a genuinely new dossier session (see PetDossierModal's
  // sessionId prop) — returning from an AI Vision scan mid-session must not
  // bump this, or the form resets and silently discards what was typed.
  const [dossierSessionId, setDossierSessionId] = useState(0);
  // Drives the post-registration celebration in place of a plain Alert.
  const [celebratingPet, setCelebratingPet] = useState<PetProfile | null>(null);

  // AI Pet Vision Scanner Modal State
  const [isVisionModalVisible, setIsVisionModalVisible] = useState(false);
  // True only while the scanner was opened from inside an in-progress
  // add/edit dossier session, so we know to resume that same session
  // (preserving modalMode/petToEdit/typed fields) instead of starting fresh.
  const isResumingFromVisionRef = useRef(false);

  // Seeded from the app-boot prefetch (see services/tabPrefetch.ts) so this
  // screen's mount-time fetch recognizes already-fresh data (already
  // written into usePetStore by that prefetch) and skips a redundant,
  // immediate refetch right after mount.
  const petsLastFetchedRef = useRef(tabPrefetchCache.petsFetchedAt || 0);
  const loadPets = useCallback(
    async (force = false) => {
      if (!user && isGuest) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      // Skip refetching if we already have a recent copy — avoids a redundant
      // network round-trip every time this tab regains focus.
      if (!force && Date.now() - petsLastFetchedRef.current < 12000) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setErrorMsg('');
      try {
        const serverPets = await fetchMyPets();
        setPets(serverPets || []);
        petsLastFetchedRef.current = Date.now();
        if (serverPets && serverPets.length > 0) {
          setSelectedPetId((prev) => {
            if (!prev || !serverPets.some((p) => p.id === prev)) {
              return serverPets[0].id;
            }
            return prev;
          });
        }
      } catch (err: any) {
        console.log('Error fetching pets:', err);
        setErrorMsg('Could not fetch pets from the backend API.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, isGuest, setPets]
  );

  const loadHealthRecords = useCallback(async (petId: number) => {
    setLoadingRecords(true);
    setRecordsErrorMsg('');
    try {
      const data = await fetchPetHealthRecords(petId);
      setHealthRecords(data?.records || []);
    } catch (err) {
      console.log('Error fetching pet health records:', err);
      setHealthRecords([]);
      setRecordsErrorMsg("Couldn't load health records right now. Check your connection and try again.");
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPets();
  }, [loadPets]);

  // Sync pets & records when tab is focused
  useFocusEffect(
    useCallback(() => {
      if (user && !isGuest) {
        loadPets();
      }
    }, [user, isGuest, loadPets])
  );

  const currentPet = useMemo(
    () => pets.find((p) => p.id === selectedPetId) || pets[0] || null,
    [pets, selectedPetId]
  );

  useEffect(() => {
    if (currentPet?.id) {
      loadHealthRecords(currentPet.id);
    } else {
      setHealthRecords([]);
    }
  }, [currentPet?.id, loadHealthRecords]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPets(true);
    if (currentPet?.id) {
      loadHealthRecords(currentPet.id);
    }
  }, [loadPets, currentPet?.id, loadHealthRecords]);

  const openAddModal = useCallback(() => {
    setModalMode('add');
    setPetToEdit(null);
    setVisionPrefill(null);
    setDossierSessionId((id) => id + 1);
    setIsModalVisible(true);
  }, []);

  const openEditModal = useCallback((pet?: PetProfile) => {
    const target = pet || currentPet;
    if (!target) return;
    setModalMode('edit');
    setPetToEdit(target);
    setVisionPrefill(null);
    setDossierSessionId((id) => id + 1);
    setIsModalVisible(true);
  }, [currentPet]);

  const handleApplyVisionDetails = useCallback((details: {
    species: string;
    breed: string;
    imageUrl?: string;
    careInsights?: any;
  }) => {
    if (isResumingFromVisionRef.current) {
      // Scanned from inside an in-progress add/edit form — return to that
      // exact session (modalMode/petToEdit untouched) instead of starting fresh.
      isResumingFromVisionRef.current = false;
    } else {
      // Scanned standalone (e.g. from the empty state) — this always starts
      // a brand new Add session.
      setModalMode('add');
      setPetToEdit(null);
      setDossierSessionId((id) => id + 1);
    }
    setVisionPrefill({
      species: details.species,
      breed: details.breed,
      imageUrl: details.imageUrl,
    });
    setIsModalVisible(true);
  }, []);

  const saveDirectPhoto = useCallback(async (pet: PetProfile, uri: string) => {
    try {
      const uploadRes = await uploadAvatarImage(uri);
      const updated = await apiUpdatePet(pet.id, { profile_image_url: uploadRes.url });
      storeUpdatePet(pet.id, updated);
      Alert.alert('Photo Updated', `${pet.name}'s photo has been saved.`);
    } catch {
      Alert.alert('Upload Failed', 'Could not upload pet photo.');
    }
  }, [storeUpdatePet]);

  const handleDirectPhoto = useCallback((pet: PetProfile) => {
    Alert.alert('Update Pet Photo', `Choose a photo for ${pet.name}`, [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return;
            const res = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            });
            if (!res.canceled && res.assets[0]) {
              saveDirectPhoto(pet, res.assets[0].uri);
            }
          } catch (e) {
            console.log('Direct camera error:', e);
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            });
            if (!res.canceled && res.assets[0]) {
              saveDirectPhoto(pet, res.assets[0].uri);
            }
          } catch (e) {
            console.log('Direct gallery error:', e);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [saveDirectPhoto]);

  const handleSavePetData = useCallback(async (data: {
    name: string;
    species: string;
    breed?: string;
    gender: string;
    weight: number;
    date_of_birth?: string;
    profile_image_url?: string;
  }) => {
    if (modalMode === 'add') {
      const newPet = await createPet(data);
      addPet(newPet);
      setSelectedPetId(newPet.id);
      setIsModalVisible(false);
      setCelebratingPet(newPet);
    } else if (modalMode === 'edit' && petToEdit) {
      const updated = await apiUpdatePet(petToEdit.id, data);
      storeUpdatePet(petToEdit.id, updated);
      setIsModalVisible(false);
      Alert.alert('Pet Ledger Updated', `${updated.name}'s details were updated.`);
    }
  }, [modalMode, petToEdit, addPet, storeUpdatePet]);

  const handleDeletePet = useCallback((petId: number, petName: string) => {
    Alert.alert(
      'Remove Pet Profile',
      `Remove ${petName}'s profile? This will also delete their saved health records. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Profile',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePet(petId);
              removePet(petId);
              const remaining = pets.filter((p) => p.id !== petId);
              setSelectedPetId(remaining.length > 0 ? remaining[0].id : null);
              Alert.alert('Pet Removed', `${petName}'s profile has been removed.`);
            } catch {
              Alert.alert('Error', 'Failed to delete pet.');
            }
          },
        },
      ]
    );
  }, [pets, removePet]);

  const handleOpenVisionFromModal = useCallback(() => {
    isResumingFromVisionRef.current = true;
    setIsModalVisible(false);
    setTimeout(() => setIsVisionModalVisible(true), 250);
  }, []);

  // Cancelling the scanner (no result applied) should return the user to
  // their in-progress dossier form exactly as they left it, not strand them
  // with no modal open and no way back except a button that wipes the form.
  const handleCloseVisionModal = useCallback(() => {
    setIsVisionModalVisible(false);
    if (isResumingFromVisionRef.current) {
      isResumingFromVisionRef.current = false;
      setIsModalVisible(true);
    }
  }, []);

  // Stable references for PetDossierModal/PetWelcomeCelebration's onClose —
  // both are memo()'d specifically so typing/animating inside them doesn't
  // re-render the rest of this screen; an inline arrow here would hand them
  // a new prop identity every render and quietly defeat that memoization.
  const handleCloseDossierModal = useCallback(() => setIsModalVisible(false), []);
  const handleDismissCelebration = useCallback(() => setCelebratingPet(null), []);

  const handleOpenAIConsult = useCallback(() => {
    if (!currentPet) return;
    const weightVal = currentPet.weight || currentPet.weight_kg || 15;
    navigation.navigate('Chatbot', {
      initialQuery: `What is the best fresh food diet and transition plan for my dog ${currentPet.name} (${currentPet.breed || 'Dog'}, ${weightVal}kg)?`,
    });
  }, [currentPet, navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <BrandMedallion size="sm" />
          <View style={styles.headerTextCol}>
            <View style={styles.brandRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.brandLabel}>CANINE LEDGER</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Companion Registry
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addPetBtn}
          onPress={openAddModal}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Register a new companion"
        >
          <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.forestGreen]} />
        }
      >
        <ResponsiveContainer maxWidth={960} style={styles.sectionsColumn}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.forestGreen} />
            <Text style={styles.loadingText}>Fetching companion registry...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={28} color="#C25E48" />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => loadPets(true)}
              accessibilityRole="button"
              accessibilityLabel="Retry"
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : pets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <PawPrint size={36} color={COLORS.brandGold} fill={COLORS.brandGold} />
            </View>
            <Text style={styles.emptyTitle}>No Companions Registered</Text>
            <Text style={styles.emptySub}>
              Register your dog to monitor clinical health history, calculate daily metabolic targets, and tailor kitchen recipes.
            </Text>
            <TouchableOpacity
              style={styles.primaryAddBtn}
              onPress={openAddModal}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Register companion pet"
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.primaryAddBtnText}>Register Companion Pet 🐾</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryAddBtn, styles.visionEmptyBtn]}
              onPress={() => {
                isResumingFromVisionRef.current = false;
                setIsVisionModalVisible(true);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Scan with AI Pet Vision"
            >
              <Sparkles size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.primaryAddBtnText}>Scan with AI Pet Vision 📸</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* AI Pet Vision Scanner Banner Card */}
            <TouchableOpacity
              style={styles.visionBannerCard}
              onPress={() => {
                isResumingFromVisionRef.current = false;
                setIsVisionModalVisible(true);
              }}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Scan breed and nutrition blueprint with AI Pet Vision"
            >
              <View style={styles.visionBannerIconCol}>
                <Sparkles size={20} color={COLORS.brandGold} />
              </View>
              <View style={styles.visionBannerContent}>
                <View style={styles.visionBadgeRow}>
                  <Text style={styles.visionBadgeLabel}>AI PET VISION SCANNER</Text>
                  <View style={styles.visionOnnxTag}>
                    <Text style={styles.visionOnnxTagText}>8003 • ONNX</Text>
                  </View>
                </View>
                <Text style={styles.visionBannerTitle}>Scan Breed & Nutrition Blueprint</Text>
                <Text style={styles.visionBannerDesc}>
                  Snap a photo to analyze breed markers, superpower stats & tailored meals.
                </Text>
              </View>
              <View style={styles.visionScanArrow}>
                <Camera size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Horizontal Companion Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petSelectorRow}
            >
              {pets.map((p) => (
                <CompanionSelectorTab
                  key={p.id}
                  pet={p}
                  isSelected={p.id === currentPet?.id}
                  onSelect={setSelectedPetId}
                />
              ))}
            </ScrollView>

            {currentPet && (
              <>
                {/* Companion Ledger Card */}
                <CompanionLedgerCard
                  pet={currentPet}
                  onDelete={handleDeletePet}
                  onEdit={openEditModal}
                  onDirectPhoto={handleDirectPhoto}
                  photoUploadEnabled={isPhotoUploadEnabled}
                />

                {/* Nutritional Target Breakdown */}
                <CompanionTargetGrid
                  weight={currentPet.weight || currentPet.weight_kg}
                />

                {/* Scooby AI Canine Nutritionist Consultation Trigger */}
                <TouchableOpacity
                  style={styles.aiConsultBtn}
                  onPress={handleOpenAIConsult}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask Scooby AI Nutritionist about ${currentPet.name}`}
                >
                  <View style={styles.aiConsultInner}>
                    <View style={styles.aiIconBubble}>
                      <PawPrint size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.aiConsultTitleRow}>
                        <Text style={styles.aiConsultTitle}>Ask Scooby AI Nutritionist</Text>
                        <View style={styles.aiLiveBadge}>
                          <Text style={styles.aiLiveBadgeText}>AI EXPERT</Text>
                        </View>
                      </View>
                      <Text style={styles.aiConsultSubtitle}>
                        Personalized dietary transition & allergy advice for {currentPet.name}
                      </Text>
                    </View>
                    <Sparkles size={16} color={COLORS.brandGold} />
                  </View>
                </TouchableOpacity>

                {/* Clinical Health Records Timeline */}
                <View style={styles.recordsSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderLeft}>
                      <Stethoscope size={15} color={COLORS.forestGreen} />
                      <Text style={styles.sectionHeading}>CLINICAL HEALTH LEDGER</Text>
                    </View>
                    <View style={styles.recordsCountBadge}>
                      <Text style={styles.recordsCountText}>{healthRecords.length}</Text>
                    </View>
                  </View>

                  {loadingRecords ? (
                    <View style={styles.recordsLoadingBox}>
                      <ActivityIndicator size="small" color={COLORS.forestGreen} />
                      <Text style={styles.recordsLoadingText}>Fetching clinical records from ledger...</Text>
                    </View>
                  ) : recordsErrorMsg ? (
                    <View style={styles.emptyRecordsCard}>
                      <AlertCircle size={26} color="#C25E48" />
                      <Text style={styles.emptyRecordsTitle}>Couldn't Load Records</Text>
                      <Text style={styles.emptyRecordsSub}>{recordsErrorMsg}</Text>
                      <TouchableOpacity
                        style={styles.bookConsultBtn}
                        onPress={() => currentPet && loadHealthRecords(currentPet.id)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Retry loading health records"
                      >
                        <Text style={styles.bookConsultBtnText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : healthRecords.length === 0 ? (
                    <View style={styles.emptyRecordsCard}>
                      <FileText size={26} color={COLORS.brandGold} />
                      <Text style={styles.emptyRecordsTitle}>No Clinical Records Stamped</Text>
                      <Text style={styles.emptyRecordsSub}>
                        Veterinary consultation notes, diagnosis summaries, and vaccination logs from certified doctors will automatically synchronize into this ledger.
                      </Text>
                      <TouchableOpacity
                        style={styles.bookConsultBtn}
                        onPress={() => navigation?.navigate('Telemedicine')}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Book vet consultation"
                      >
                        <Stethoscope size={14} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.bookConsultBtnText}>Book Vet Consultation</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.recordsList}>
                      {healthRecords.map((record) => (
                        <HealthRecordCard key={record.id} record={record} />
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}
        </ResponsiveContainer>
      </ScrollView>

      {/* Add / Edit Pet Dossier Modal with Isolated State */}
      <PetDossierModal
        visible={isModalVisible}
        mode={modalMode}
        sessionId={dossierSessionId}
        initialPet={petToEdit}
        initialVisionDetails={visionPrefill}
        onClose={handleCloseDossierModal}
        onSave={handleSavePetData}
        onOpenVision={handleOpenVisionFromModal}
      />

      {/* AI Pet Vision Scanner Modal */}
      <PetVisionModal
        visible={isVisionModalVisible}
        onClose={handleCloseVisionModal}
        onApplyPetDetails={handleApplyVisionDetails}
      />

      {/* Post-Registration Celebration */}
      <PetWelcomeCelebration pet={celebratingPet} onDismiss={handleDismissCelebration} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  brandLabel: { fontSize: 10, fontWeight: '800', color: COLORS.brandGold, letterSpacing: 1, fontFamily: FONT_BODY_BOLD },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textCoffee, fontFamily: FONT_DISPLAY },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  addPetBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  scrollBody: { padding: 18, paddingBottom: 40 },
  // The gap belongs here, not on scrollBody — the ScrollView's only direct
  // child is ResponsiveContainer, so a gap on scrollBody has nothing to space
  // (Fragments are transparent to layout, so this still spaces every section
  // — vision banner, pet selector, ledger card, target grid, AI consult,
  // records — as if they were direct children).
  sectionsColumn: { gap: 20 },
  centerContainer: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontFamily: FONT_BODY },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    gap: 8,
  },
  errorText: { fontSize: 13, color: '#991B1B', textAlign: 'center', fontWeight: '600', fontFamily: FONT_BODY_BOLD },
  retryBtn: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginTop: 6,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12, fontFamily: FONT_BODY_BOLD },
  emptyContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 30,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FAF4EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.brandGold,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textCoffee, fontFamily: FONT_DISPLAY },
  emptySub: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18, fontFamily: FONT_BODY },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryAddBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', fontFamily: FONT_BODY_BOLD },

  // Companion Selector Chips
  petSelectorRow: { gap: 10, paddingBottom: 2 },
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
    resizeMode: 'cover',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9F5EC',
  },
  avatarFallbackPaw: {
    fontSize: 24,
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

  // Scooby AI Nutritionist Consultation Trigger Card
  aiConsultBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D2E3D8',
    padding: 14,
    shadowColor: COLORS.forestDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  aiConsultInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiConsultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  aiConsultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
  },
  aiLiveBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#C8E6C9',
  },
  aiLiveBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: COLORS.forestGreen,
    letterSpacing: 0.5,
    fontFamily: FONT_BODY_BOLD,
  },
  aiConsultSubtitle: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    lineHeight: 16,
    fontFamily: FONT_BODY,
  },

  // Clinical Records Section
  recordsSection: { gap: 12, marginTop: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.brandGold,
    letterSpacing: 0.8,
    fontFamily: FONT_BODY_BOLD,
  },
  recordsCountBadge: {
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  recordsCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: LEDGER_MONO,
  },
  recordsLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  recordsLoadingText: { fontSize: 12, color: COLORS.textMuted, fontFamily: FONT_BODY },
  emptyRecordsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    gap: 8,
  },
  emptyRecordsTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textCoffee, fontFamily: FONT_DISPLAY_SEMIBOLD },
  emptyRecordsSub: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', lineHeight: 16, fontFamily: FONT_BODY },
  bookConsultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 6,
  },
  bookConsultBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', fontFamily: FONT_BODY_BOLD },
  recordsList: { gap: 10 },
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

  /* AI Vision Scanner Integration Styles */
  visionBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8DCB9',
    shadowColor: COLORS.brandGold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  visionBannerIconCol: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FAF4EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFE3D3',
  },
  visionBannerContent: {
    flex: 1,
  },
  visionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  visionBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brandGold,
    letterSpacing: 0.5,
    fontFamily: FONT_BODY_BOLD,
  },
  visionOnnxTag: {
    backgroundColor: '#EAE1D5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  visionOnnxTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textCoffee,
    fontFamily: LEDGER_MONO,
  },
  visionBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textCoffee,
    fontFamily: FONT_DISPLAY_SEMIBOLD,
  },
  visionBannerDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 15,
    fontFamily: FONT_BODY,
  },
  visionScanArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visionEmptyBtn: {
    backgroundColor: COLORS.brandGold,
    marginTop: 10,
  },
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
  celebrationAvatarPaw: { fontSize: 36 },
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
});
