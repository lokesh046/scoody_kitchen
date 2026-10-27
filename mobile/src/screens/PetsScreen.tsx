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
} from 'react-native';
import { Image } from 'expo-image';
import AIDogIcon from '../components/AIDogIcon';
import SafeAreaView from '../components/FeatureSafeArea';
import { useFocusEffect } from '@react-navigation/native';
import {
  PawPrint,
  Plus,
  Sparkles,
  Check,
  AlertCircle,
  Camera,
  Stethoscope,
  FileText,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, Outfit_700Bold, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Quicksand_400Regular, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { COLORS } from '../theme/colors';
import { LEDGER_MONO, FONT_HEADING_SCRIPT } from '../theme/typography';
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
import { ScreenHeader, headerActionStyle, HEADER_GOLD } from '../components/ScreenHeader';
import PetVisionModal from '../components/PetVisionModal';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import {
  CompanionSelectorTab,
  CompanionLedgerCard,
  CompanionTargetGrid,
  HealthRecordCard,
  PetDossierModal,
  PetWelcomeCelebration,
  DeletePetConfirmModal,
} from '../components/PetCards';

// DESIGN.md's brand faces: Outfit for display/headings, Quicksand for body copy.
// Ledger Monospace Rule now uses the shared Courier Prime token (see
// theme/typography.ts) instead of falling back to the platform system
// monospace, matching every other screen and the web frontend.
const FONT_DISPLAY = 'Outfit_700Bold';
const FONT_DISPLAY_SEMIBOLD = 'Outfit_600SemiBold';
const FONT_BODY = 'Quicksand_400Regular';
const FONT_BODY_BOLD = 'Quicksand_700Bold';
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
  // Drives the branded, type-to-confirm destructive sheet in place of a
  // plain Alert.alert for the one irreversible action on this screen.
  const [pendingDeletePet, setPendingDeletePet] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingPet, setIsDeletingPet] = useState(false);

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
    setPendingDeletePet({ id: petId, name: petName });
  }, []);

  const handleCancelDeletePet = useCallback(() => {
    if (isDeletingPet) return; // don't let a background dismiss abandon an in-flight delete
    setPendingDeletePet(null);
  }, [isDeletingPet]);

  const handleConfirmDeletePet = useCallback(async () => {
    if (!pendingDeletePet) return;
    const { id: petId, name: petName } = pendingDeletePet;
    setIsDeletingPet(true);
    try {
      await deletePet(petId);
      removePet(petId);
      const remaining = pets.filter((p) => p.id !== petId);
      setSelectedPetId(remaining.length > 0 ? remaining[0].id : null);
      setPendingDeletePet(null);
      Alert.alert('Pet Removed', `${petName}'s profile has been removed.`);
    } catch {
      Alert.alert('Error', 'Failed to delete pet.');
    } finally {
      setIsDeletingPet(false);
    }
  }, [pendingDeletePet, pets, removePet]);

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
      {/* Compact toolbar; the pet roster scrolls with the page. */}
      <ScreenHeader
        title="My pets"
        rightContent={
          <TouchableOpacity
            style={[styles.addPetBtn, headerActionStyle]}
            onPress={openAddModal}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Register a new companion"
          >
            <Plus size={20} color={HEADER_GOLD} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.forestGreen]} />
        }
      >
        <ResponsiveContainer maxWidth={960} style={styles.sectionsColumn}>
        {
          pets.length > 0 && (
            <View style={styles.rosterRow}>
              <View style={styles.rosterStack}>
                {pets.slice(0, 3).map((p, idx) => (
                  <View
                    key={p.id}
                    style={[
                      styles.rosterAvatarWrap,
                      { marginLeft: idx === 0 ? 0 : -10, zIndex: 3 - idx },
                    ]}
                  >
                    {p.profile_image_url ? (
                      <Image
                        source={{ uri: p.profile_image_url }}
                        style={styles.rosterAvatarImg}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.rosterAvatarFallback}>
                        <PawPrint size={10} color={COLORS.brandGold} />
                      </View>
                    )}
                  </View>
                ))}
              </View>
              <Text style={styles.rosterCountText}>{pets.length} Registered</Text>
            </View>
          )
        }

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
              <Text style={styles.primaryAddBtnText}>Register Companion Pet</Text>
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
              <Text style={styles.primaryAddBtnText}>Scan with AI Pet Vision</Text>
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
              <Image source={require('../../assets/toolkit/scan-diagnose.webp')} style={styles.visionBannerIcon} contentFit="contain" />
              <View style={styles.visionBannerContent}>
                <Text style={styles.visionBannerTitle}>Scan Breed & Nutrition Blueprint</Text>
                <Text style={styles.visionBannerDesc}>
                  Snap a photo to identify the breed and build the nutrition targets below.
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
                  accessibilityLabel={`Ask Hearth & One AI Nutritionist about ${currentPet.name}`}
                >
                  <View style={styles.aiConsultInner}>
                    <AIDogIcon size={46} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.aiConsultTitleRow}>
                        <Text style={styles.aiConsultTitle}>Ask Hearth & One AI Nutritionist</Text>
                        <View style={styles.aiLiveBadge}>
                          <Text style={styles.aiLiveBadgeText}>AI EXPERT</Text>
                        </View>
                      </View>
                      <Text style={styles.aiConsultSubtitle}>
                        Personalized dietary transition & allergy advice for {currentPet.name}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Clinical Health Records Timeline */}
                <View style={styles.recordsSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderLeft}>
                      <Image source={require('../../assets/pet/health-records.webp')} style={styles.sectionHeadingIcon} contentFit="contain" />
                      <Text style={styles.sectionHeading}>Clinical Health Ledger</Text>
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

      <DeletePetConfirmModal
        visible={!!pendingDeletePet}
        petName={pendingDeletePet?.name ?? ''}
        isDeleting={isDeletingPet}
        onCancel={handleCancelDeletePet}
        onConfirm={handleConfirmDeletePet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  // A real avatar cluster of the registered companions, not a decorative
  // count pill — the roster's own faces are the header's identity here.
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  rosterStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rosterAvatarWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FAF7F2',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  rosterAvatarImg: { width: '100%', height: '100%' },
  rosterAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF0DE',
  },
  rosterCountText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: LEDGER_MONO,
    color: COLORS.textMuted,
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
    fontSize: 20,
    color: COLORS.textCoffee,
    fontFamily: FONT_HEADING_SCRIPT,
  },
  sectionHeadingIcon: { width: 26, height: 26 },
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

  /* AI Vision Scanner Integration Styles */
  visionBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8DCB9',
    shadowColor: COLORS.brandGold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  visionBannerIcon: { width: 52, height: 52 },
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
});
