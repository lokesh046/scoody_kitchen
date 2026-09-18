import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Activity,
  Heart,
  ShoppingBag,
  RefreshCw,
  Minus,
  Plus,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../theme/typography';
import { fetchProducts } from '../api/products';
import { createPet } from '../api/pets';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { Product } from '../types';
import { BREED_DATA, AkcGroup } from '../constants/breedData';

// Fixed display order for the 7 real AKC groups present in BREED_DATA
// (Foundation Stock Service / Miscellaneous Class are excluded at data-gen
// time — see scripts/generate-breed-data.mjs — since those are provisional
// recognition statuses, not real breed types a user would pick).
const AKC_GROUPS: AkcGroup[] = [
  'Sporting Group',
  'Hound Group',
  'Working Group',
  'Terrier Group',
  'Toy Group',
  'Non-Sporting Group',
  'Herding Group',
];

const ACTIVITY_LEVELS: { id: 'sedentary' | 'active' | 'very_active'; title: string; desc: string }[] = [
  { id: 'sedentary', title: 'Sedentary', desc: 'Mainly couches, short block walks, relaxed lifestyle.' },
  { id: 'active', title: 'Active', desc: 'Daily runs, regular fetches, playful and lively.' },
  { id: 'very_active', title: 'Working / Sport Athlete', desc: 'Agility training, constant hikes, intense daily exercise.' },
];

const ALLERGY_OPTIONS = [
  { id: 'beef', label: 'Beef Sensitive' },
  { id: 'chicken', label: 'Chicken Sensitive' },
  { id: 'grains', label: 'Grain Sensitive' },
];

// Web's small-dog recommendation branch checks weight < 18 lbs. This screen
// collects weight in kg (matching the rest of the mobile app, e.g.
// PetsScreen's weight_kg), so the same threshold is converted here
// (18 * 0.45359237) rather than silently changing the recommendation logic.
const SMALL_DOG_WEIGHT_KG_THRESHOLD = 8.16;

type Gender = 'male' | 'female' | '';
type ActivityLevel = 'sedentary' | 'active' | 'very_active' | '';

export default function MealPlannerScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const addItem = useCartStore((state) => state.addItem);

  const [step, setStep] = useState(0);
  const [dogName, setDogName] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [neutered, setNeutered] = useState<boolean | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<AkcGroup | ''>('');
  const [breed, setBreed] = useState('');
  const [breedSearchQuery, setBreedSearchQuery] = useState('');
  const [showBreedDropdown, setShowBreedDropdown] = useState(false);
  const [ageYears, setAgeYears] = useState(2);
  const [ageMonths, setAgeMonths] = useState(0);
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('');
  const [allergies, setAllergies] = useState<string[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isSavingPet, setIsSavingPet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProducts({ limit: 100 })
      .then((res) => {
        if (!cancelled) setProducts(res.items || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const weightNum = weight.trim() === '' ? 0 : Number(weight);

  const calculatedCalories = useMemo(() => {
    if (!weightNum) return 0;
    const rer = 70 * Math.pow(weightNum, 0.75);
    let factor = 1.4;
    if (activity === 'sedentary') factor = 1.0;
    if (activity === 'very_active') factor = 1.8;
    return Math.round(rer * factor);
  }, [weightNum, activity]);

  // Breeds visible in the search dropdown are scoped to the group picked
  // first, not the full 202-breed dataset — group is a way to find the
  // breed faster, not a filter the user can get stuck behind (see
  // filteredBreeds' search matching any breed name regardless of group
  // would defeat that scoping, so this intentionally stays group-first).
  const filteredBreeds = useMemo(() => {
    if (!selectedGroup) return [];
    const query = breedSearchQuery.trim().toLowerCase();
    return BREED_DATA.filter(
      (b) => b.group === selectedGroup && (query === '' || b.name.toLowerCase().includes(query))
    );
  }, [selectedGroup, breedSearchQuery]);

  const selectedBreedData = useMemo(
    () => BREED_DATA.find((b) => b.name === breed) || null,
    [breed]
  );

  // Compares the user's own dog (real weight they entered) against that
  // breed's precomputed default (typical weight for the breed, same
  // activity level) — both run through the identical RER/MER formula, so
  // they're directly comparable. ±15% is a deliberate tolerance band:
  // individual dogs of the same breed vary naturally, so only a real gap
  // should surface a message, not every dog that's a few percent off.
  const WEIGHT_STATUS_TOLERANCE = 0.15;
  const weightStatus = useMemo((): 'above' | 'below' | 'on-track' | null => {
    if (!selectedBreedData || !activity || !calculatedCalories) return null;
    const breedDefault = selectedBreedData.defaultCalories[activity as 'sedentary' | 'active' | 'very_active'];
    if (!breedDefault) return null;
    const ratio = calculatedCalories / breedDefault;
    if (ratio > 1 + WEIGHT_STATUS_TOLERANCE) return 'above';
    if (ratio < 1 - WEIGHT_STATUS_TOLERANCE) return 'below';
    return 'on-track';
  }, [selectedBreedData, activity, calculatedCalories]);

  // Ports web's getRecommendedProduct() logic verbatim (same allergy
  // exclusion keywords, same activity/weight branches) so the two platforms
  // recommend identically for the same inputs.
  const recommendedProduct = useMemo(() => {
    if (products.length === 0) return null;
    const safeProducts = products.filter((p) => {
      const name = p.name.toLowerCase();
      const desc = (p.description || '').toLowerCase();
      if (allergies.includes('grains') && (name.includes('rice') || desc.includes('rice') || name.includes('grain'))) return false;
      if (allergies.includes('beef') && (name.includes('beef') || desc.includes('beef'))) return false;
      if (allergies.includes('chicken') && (name.includes('chicken') || desc.includes('chicken'))) return false;
      return true;
    });
    const activeList = safeProducts.length > 0 ? safeProducts : products;

    if (activity === 'very_active') {
      return activeList.find((p) => p.name.toLowerCase().includes('beef') || p.name.toLowerCase().includes('active')) || activeList[0];
    }
    if (weightNum > 0 && weightNum < SMALL_DOG_WEIGHT_KG_THRESHOLD) {
      return activeList.find((p) => p.name.toLowerCase().includes('salmon') || p.name.toLowerCase().includes('fish') || p.name.toLowerCase().includes('delicate')) || activeList[0];
    }
    return activeList.find((p) => p.name.toLowerCase().includes('chicken') || p.name.toLowerCase().includes('turkey')) || activeList[0];
  }, [products, allergies, activity, weightNum]);

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const isStepValid = () => {
    if (step === 1) return dogName.trim() !== '' && gender !== '' && neutered !== null;
    if (step === 2) return selectedGroup !== '' && breed.trim() !== '' && weightNum > 0;
    if (step === 3) return activity !== '';
    return true;
  };

  const handleAddToCart = async () => {
    if (!recommendedProduct) return;
    setIsAddingToCart(true);
    try {
      await addItem(recommendedProduct.id, 1);
      Alert.alert('Added to Bowl', `${recommendedProduct.name} has been added to your cart.`);
    } catch {
      Alert.alert('Error', 'Failed to add recipe to cart.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleSavePet = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to save this profile to your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Profile') },
        ]
      );
      return;
    }
    setIsSavingPet(true);
    try {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - ageYears);
      birthDate.setMonth(birthDate.getMonth() - ageMonths);
      await createPet({
        name: dogName,
        species: 'dog',
        breed: breed || 'Mixed Breed',
        gender: gender || undefined,
        date_of_birth: birthDate.toISOString().split('T')[0],
        weight: weightNum,
      });
      Alert.alert('Saved', `${dogName}'s profile has been saved to your account.`, [
        { text: 'View Pets', onPress: () => navigation.navigate('MainTabs', { screen: 'Pets' }) },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to save pet profile.');
    } finally {
      setIsSavingPet(false);
    }
  };

  const handleViewRecipe = () => {
    if (!recommendedProduct) return;
    try {
      navigation.navigate('MainTabs', { screen: 'Shop', params: { productId: recommendedProduct.id } });
    } catch {
      navigation.navigate('Shop', { productId: recommendedProduct.id });
    }
  };

  const handleTalkToVet = () => {
    try {
      navigation.navigate('MainTabs', { screen: 'Consult' });
    } catch {
      navigation.navigate('Consult');
    }
  };

  const resetWizard = () => {
    setStep(0);
    setDogName('');
    setGender('');
    setNeutered(null);
    setSelectedGroup('');
    setBreed('');
    setBreedSearchQuery('');
    setShowBreedDropdown(false);
    setAgeYears(2);
    setAgeMonths(0);
    setWeight('');
    setActivity('');
    setAllergies([]);
  };

  const totalSteps = 3;
  const progressPercent = step >= 1 && step <= 3 ? (step / totalSteps) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={COLORS.textCoffee} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meal Planner</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={styles.flexFill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step >= 1 && step <= 3 && (
            <View style={styles.progressWrap}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Diet Profile Step {step} of {totalSteps}</Text>
                <Text style={styles.progressLabel}>{Math.round(progressPercent)}% Done</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
          )}

          {step === 0 && (
            <View style={styles.welcomeWrap}>
              <View style={styles.welcomeIconCircle}>
                <Sparkles size={32} color={COLORS.brandGold} />
              </View>
              <Text style={styles.welcomeEyebrow}>Scooby's Kitchen Nutritionist</Text>
              <Text style={styles.welcomeTitle}>Tailor the Perfect Recipe</Text>
              <Text style={styles.welcomeSub}>
                Enter your dog's diagnostics to calculate customized daily caloric demands and discover the optimal nutritional formula suited to their body condition.
              </Text>
              <View style={styles.welcomeFacts}>
                <Text style={styles.welcomeFactText}>⚡ Takes 90 seconds</Text>
                <Text style={styles.welcomeFactText}>📊 Scientific RER & MER metrics</Text>
              </View>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={nextStep}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Begin profile assessment"
              >
                <Text style={styles.primaryBtnText}>Begin Profile Assessment</Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepWrap}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepEyebrow}>Diagnostics / Part 1</Text>
                <Text style={styles.stepTitle}>Tell us about your pup</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Pup's Name</Text>
                <TextInput
                  value={dogName}
                  onChangeText={setDogName}
                  placeholder="e.g. Scooby"
                  placeholderTextColor={COLORS.textLight}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.choiceRow}>
                  <TouchableOpacity
                    style={[styles.choiceBtn, gender === 'male' && styles.choiceBtnActive]}
                    onPress={() => setGender('male')}
                    accessibilityRole="button"
                    accessibilityLabel="Male"
                    accessibilityState={{ selected: gender === 'male' }}
                  >
                    <Text style={[styles.choiceBtnText, gender === 'male' && styles.choiceBtnTextActive]}>Male ♂</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choiceBtn, gender === 'female' && styles.choiceBtnActive]}
                    onPress={() => setGender('female')}
                    accessibilityRole="button"
                    accessibilityLabel="Female"
                    accessibilityState={{ selected: gender === 'female' }}
                  >
                    <Text style={[styles.choiceBtnText, gender === 'female' && styles.choiceBtnTextActive]}>Female ♀</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Is Spayed / Neutered?</Text>
                <View style={styles.choiceRow}>
                  <TouchableOpacity
                    style={[styles.choiceBtn, neutered === true && styles.choiceBtnActive]}
                    onPress={() => setNeutered(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Yes, spayed or neutered"
                    accessibilityState={{ selected: neutered === true }}
                  >
                    <Text style={[styles.choiceBtnText, neutered === true && styles.choiceBtnTextActive]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choiceBtn, neutered === false && styles.choiceBtnActive]}
                    onPress={() => setNeutered(false)}
                    accessibilityRole="button"
                    accessibilityLabel="No, not spayed or neutered"
                    accessibilityState={{ selected: neutered === false }}
                  >
                    <Text style={[styles.choiceBtnText, neutered === false && styles.choiceBtnTextActive]}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={prevStep} style={styles.backLinkBtn} accessibilityRole="button" accessibilityLabel="Back">
                  <ArrowLeft size={15} color={COLORS.textCoffee} />
                  <Text style={styles.backLinkText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtnSmall, !isStepValid() && styles.btnDisabled]}
                  onPress={nextStep}
                  disabled={!isStepValid()}
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                  accessibilityState={{ disabled: !isStepValid() }}
                >
                  <Text style={styles.primaryBtnSmallText}>Continue</Text>
                  <ArrowRight size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepWrap}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepEyebrow}>Diagnostics / Part 2</Text>
                <Text style={styles.stepTitle}>Dog stats index</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Breed Group (AKC)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.breedChipsRow}
                  contentContainerStyle={styles.breedChipsContent}
                >
                  {AKC_GROUPS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.breedChip, selectedGroup === g && styles.breedChipActive]}
                      onPress={() => {
                        setSelectedGroup(g);
                        setBreed('');
                        setBreedSearchQuery('');
                        setShowBreedDropdown(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${g.replace(' Group', '')} group`}
                      accessibilityState={{ selected: selectedGroup === g }}
                    >
                      <Text style={[styles.breedChipText, selectedGroup === g && styles.breedChipTextActive]}>
                        {g.replace(' Group', '')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {selectedGroup !== '' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Breed</Text>
                  <TextInput
                    value={breedSearchQuery}
                    onChangeText={(t) => {
                      setBreedSearchQuery(t);
                      setShowBreedDropdown(true);
                      if (breed && t !== breed) setBreed('');
                    }}
                    onFocus={() => setShowBreedDropdown(true)}
                    placeholder={`Search ${selectedGroup.replace(' Group', '')} breeds (e.g. Golden Retriever)`}
                    placeholderTextColor={COLORS.textLight}
                    style={styles.input}
                  />
                  {showBreedDropdown && filteredBreeds.length > 0 && (
                    <View style={styles.breedDropdown}>
                      <ScrollView
                        style={styles.breedDropdownScroll}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                      >
                        {filteredBreeds.map((b) => (
                          <TouchableOpacity
                            key={b.name}
                            style={styles.breedDropdownItem}
                            onPress={() => {
                              setBreed(b.name);
                              setBreedSearchQuery(b.name);
                              setShowBreedDropdown(false);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Select breed ${b.name}`}
                          >
                            <Text style={styles.breedDropdownItemText}>{b.name}</Text>
                            <Text style={styles.breedDropdownItemMeta}>~{b.typicalWeightKg}kg</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {breed !== '' && (
                    <Text style={styles.breedSelectedNote}>
                      Selected: {breed} (typical adult weight ~{selectedBreedData?.typicalWeightKg}kg)
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.ageRow}>
                <View style={styles.stepperFieldGroup}>
                  <Text style={styles.fieldLabel}>Age (Years)</Text>
                  <View style={styles.stepperControl}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setAgeYears((y) => Math.max(0, y - 1))}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease years"
                    >
                      <Minus size={14} color={COLORS.textCoffee} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{ageYears} yrs</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setAgeYears((y) => Math.min(20, y + 1))}
                      accessibilityRole="button"
                      accessibilityLabel="Increase years"
                    >
                      <Plus size={14} color={COLORS.textCoffee} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.stepperFieldGroup}>
                  <Text style={styles.fieldLabel}>Age (Months)</Text>
                  <View style={styles.stepperControl}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setAgeMonths((m) => (m - 1 + 12) % 12)}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease months"
                    >
                      <Minus size={14} color={COLORS.textCoffee} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{ageMonths} mo</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => setAgeMonths((m) => (m + 1) % 12)}
                      accessibilityRole="button"
                      accessibilityLabel="Increase months"
                    >
                      <Plus size={14} color={COLORS.textCoffee} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Weight (kg)</Text>
                <TextInput
                  value={weight}
                  onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 16"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={prevStep} style={styles.backLinkBtn} accessibilityRole="button" accessibilityLabel="Back">
                  <ArrowLeft size={15} color={COLORS.textCoffee} />
                  <Text style={styles.backLinkText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtnSmall, !isStepValid() && styles.btnDisabled]}
                  onPress={nextStep}
                  disabled={!isStepValid()}
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                  accessibilityState={{ disabled: !isStepValid() }}
                >
                  <Text style={styles.primaryBtnSmallText}>Continue</Text>
                  <ArrowRight size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepWrap}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepEyebrow}>Diagnostics / Part 3</Text>
                <Text style={styles.stepTitle}>Lifestyle & Health</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Energy Output Level</Text>
                <View style={{ gap: 8 }}>
                  {ACTIVITY_LEVELS.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.activityCard, activity === item.id && styles.activityCardActive]}
                      onPress={() => setActivity(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}: ${item.desc}`}
                      accessibilityState={{ selected: activity === item.id }}
                    >
                      <Text style={styles.activityCardTitle}>{item.title}</Text>
                      <Text style={styles.activityCardDesc}>{item.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Allergies & Sensitivities (Optional)</Text>
                <View style={styles.allergyGrid}>
                  {ALLERGY_OPTIONS.map((a) => {
                    const isChecked = allergies.includes(a.id);
                    return (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.allergyChip, isChecked && styles.allergyChipActive]}
                        onPress={() =>
                          setAllergies((prev) => (isChecked ? prev.filter((x) => x !== a.id) : [...prev, a.id]))
                        }
                        accessibilityRole="button"
                        accessibilityLabel={a.label}
                        accessibilityState={{ selected: isChecked }}
                      >
                        <Text style={[styles.allergyChipText, isChecked && styles.allergyChipTextActive]}>{a.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={prevStep} style={styles.backLinkBtn} accessibilityRole="button" accessibilityLabel="Back">
                  <ArrowLeft size={15} color={COLORS.textCoffee} />
                  <Text style={styles.backLinkText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtnSmall, !isStepValid() && styles.btnDisabled]}
                  onPress={nextStep}
                  disabled={!isStepValid()}
                  accessibilityRole="button"
                  accessibilityLabel="Analyze diagnostics"
                  accessibilityState={{ disabled: !isStepValid() }}
                >
                  <Text style={styles.primaryBtnSmallText}>Analyze Diagnostics</Text>
                  <ArrowRight size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepWrap}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepEyebrow}>Diagnostics Output</Text>
                <Text style={styles.stepTitle}>Personalized Meal Formulation</Text>
              </View>

              <View style={styles.receiptCard}>
                <View style={styles.receiptHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptEyebrow}>// CALCULATOR OUTPUT</Text>
                    <Text style={styles.receiptSub}>
                      SUBJECT: {dogName || 'N/A'} ({weightNum || '—'} KG, {breed || 'Mixed Breed'})
                    </Text>
                  </View>
                  <Activity size={20} color={COLORS.brandGold} />
                </View>

                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Resting Energy (RER):</Text>
                  <Text style={styles.receiptValue}>{Math.round(70 * Math.pow(weightNum || 0, 0.75))} kcal</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Activity Multiplier:</Text>
                  <Text style={styles.receiptValue}>
                    {activity === 'sedentary' ? '1.0x (Sedentary)' : activity === 'very_active' ? '1.8x (Athletic)' : '1.4x (Active)'}
                  </Text>
                </View>
                {allergies.length > 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptExclusionLabel}>Exclusions:</Text>
                    <Text style={styles.receiptExclusionValue}>{allergies.map((a) => a.toUpperCase()).join(', ')}</Text>
                  </View>
                )}
                <View style={styles.receiptDivider} />
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptTotalLabel}>DAILY CALORIE DEMAND:</Text>
                  <Text style={styles.receiptTotalValue}>{calculatedCalories} kCal / day</Text>
                </View>
                {selectedBreedData && activity !== '' && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{breed} Default:</Text>
                    <Text style={styles.receiptValue}>
                      {selectedBreedData.defaultCalories[activity as 'sedentary' | 'active' | 'very_active']} kcal
                    </Text>
                  </View>
                )}
              </View>

              {weightStatus && weightStatus !== 'on-track' && (
                <View style={styles.weightAlertCard}>
                  <Text style={styles.weightAlertTitle}>
                    {weightStatus === 'above' ? 'Running Above Typical Range' : 'Running Below Typical Range'}
                  </Text>
                  <Text style={styles.weightAlertText}>
                    {weightStatus === 'above'
                      ? `${dogName || 'Your dog'}'s calorie need is higher than what's typical for a ${breed}. This isn't a diagnosis — individual dogs vary — but it may be worth monitoring portions or checking in with a vet.`
                      : `${dogName || 'Your dog'}'s calorie need is lower than what's typical for a ${breed}. This isn't a diagnosis — individual dogs vary — but it may be worth checking in with a vet if you're unsure.`}
                  </Text>
                  <TouchableOpacity
                    style={styles.talkToVetBtn}
                    onPress={handleTalkToVet}
                    accessibilityRole="button"
                    accessibilityLabel="Talk to a vet"
                  >
                    <Text style={styles.talkToVetBtnText}>Talk to a Vet</Text>
                  </TouchableOpacity>
                </View>
              )}

              {weightStatus === 'on-track' && (
                <View style={styles.onTrackBadge}>
                  <Text style={styles.onTrackBadgeText}>
                    ✓ Right on track for a {breed}
                  </Text>
                </View>
              )}

              {loadingProducts ? (
                <View style={styles.recProductLoading}>
                  <ActivityIndicator size="small" color={COLORS.forestGreen} />
                </View>
              ) : recommendedProduct ? (
                <View style={styles.recProductCard}>
                  <Image
                    source={{
                      uri:
                        recommendedProduct.image_url ||
                        'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&q=80&w=300',
                    }}
                    style={styles.recProductImage}
                  />
                  <View style={styles.recProductInfo}>
                    <Text style={styles.recProductEyebrow}>Recommended Blend</Text>
                    <Text style={styles.recProductName}>{recommendedProduct.name}</Text>
                    {!!recommendedProduct.description && (
                      <Text style={styles.recProductDesc} numberOfLines={2}>
                        {recommendedProduct.description}
                      </Text>
                    )}
                    <View style={styles.recProductActions}>
                      <TouchableOpacity
                        style={styles.addToBowlBtn}
                        onPress={handleAddToCart}
                        disabled={isAddingToCart}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${recommendedProduct.name} to bowl`}
                        accessibilityState={{ disabled: isAddingToCart, busy: isAddingToCart }}
                      >
                        {isAddingToCart ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <ShoppingBag size={13} color="#FFFFFF" />
                        )}
                        <Text style={styles.addToBowlBtnText}>Add To Bowl</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleViewRecipe} accessibilityRole="button" accessibilityLabel="Explore recipe details">
                        <Text style={styles.viewRecipeLink}>Explore Recipe Details →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.noMatchBox}>
                  <Text style={styles.noMatchText}>No recipes currently match the selected allergy filters.</Text>
                </View>
              )}

              <View style={styles.resultActionsRow}>
                <TouchableOpacity
                  style={[styles.saveProfileBtn, isSavingPet && styles.btnDisabled]}
                  onPress={handleSavePet}
                  disabled={isSavingPet}
                  accessibilityRole="button"
                  accessibilityLabel={user ? 'Save pet to profile' : 'Sign in to save pet'}
                  accessibilityState={{ disabled: isSavingPet, busy: isSavingPet }}
                >
                  {isSavingPet ? (
                    <ActivityIndicator size="small" color={COLORS.forestGreen} />
                  ) : (
                    <Heart size={14} color={COLORS.ctaBrown} fill={COLORS.ctaBrown} />
                  )}
                  <Text style={styles.saveProfileBtnText}>{user ? 'Save Pet to Profile' : 'Sign In to Save Pet'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.startOverBtn}
                  onPress={resetWizard}
                  accessibilityRole="button"
                  accessibilityLabel="Start new assessment"
                >
                  <RefreshCw size={14} color={COLORS.textCoffee} />
                  <Text style={styles.startOverBtnText}>Start New Assessment</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  flexFill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.canvas,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.cardAlt,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },

  /* Progress */
  progressWrap: { gap: 6 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageIcon,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.kraftBorder,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.brandGold,
  },

  /* Welcome */
  welcomeWrap: { alignItems: 'center', gap: 14, paddingVertical: 12 },
  welcomeIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeEyebrow: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageIcon,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  welcomeTitle: {
    fontSize: 24,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
    textAlign: 'center',
  },
  welcomeSub: {
    fontSize: 13,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  welcomeFacts: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
    paddingVertical: 10,
    gap: 4,
    alignItems: 'center',
  },
  welcomeFactText: {
    fontSize: 11,
    fontFamily: LEDGER_MONO,
    color: COLORS.textMuted,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 13,
    fontFamily: FONT_BODY_BOLD,
    color: '#FFFFFF',
  },

  /* Steps */
  stepWrap: { gap: 18 },
  stepHeader: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
    paddingBottom: 10,
    gap: 2,
  },
  stepEyebrow: {
    fontSize: 10,
    fontFamily: LEDGER_MONO,
    color: COLORS.sageIcon,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepTitle: {
    fontSize: 17,
    fontFamily: FONT_DISPLAY,
    color: COLORS.textCoffee,
  },

  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textCoffee,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: COLORS.canvas,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textCoffee,
  },

  choiceRow: { flexDirection: 'row', gap: 10 },
  choiceBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  choiceBtnActive: {
    backgroundColor: COLORS.brandGold,
    borderColor: COLORS.brandGold,
  },
  choiceBtnText: {
    fontSize: 12,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textCoffee,
  },
  choiceBtnTextActive: { color: '#FFFFFF' },

  breedChipsRow: { marginTop: 2 },
  breedChipsContent: { gap: 8, paddingVertical: 2 },
  breedChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
  },
  breedChipActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  breedChipText: { fontSize: 11, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  breedChipTextActive: { color: '#FFFFFF', fontFamily: FONT_BODY_BOLD },

  breedDropdown: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
  breedDropdownScroll: { maxHeight: 190 },
  breedDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
  },
  breedDropdownItemText: { fontSize: 12.5, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  breedDropdownItemMeta: { fontSize: 10, fontFamily: LEDGER_MONO, color: COLORS.textMuted },
  breedSelectedNote: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: COLORS.forestGreen,
    marginTop: 4,
  },

  ageRow: { flexDirection: 'row', gap: 12 },
  stepperFieldGroup: { flex: 1, gap: 6 },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.canvas,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 12,
    fontFamily: LEDGER_MONO,
    color: COLORS.textCoffee,
  },

  activityCard: {
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    gap: 3,
  },
  activityCardActive: {
    backgroundColor: COLORS.brandGold,
    borderColor: COLORS.brandGold,
  },
  activityCardTitle: {
    fontSize: 12,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textCoffee,
    textTransform: 'uppercase',
  },
  activityCardDesc: {
    fontSize: 11,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
  },

  allergyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergyChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
  },
  allergyChipActive: {
    backgroundColor: COLORS.ctaBrown,
    borderColor: COLORS.ctaBrown,
  },
  allergyChipText: {
    fontSize: 10.5,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textCoffee,
    textTransform: 'uppercase',
  },
  allergyChipTextActive: { color: '#FFFFFF' },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
    paddingTop: 14,
  },
  backLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  backLinkText: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  primaryBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  primaryBtnSmallText: { fontSize: 12.5, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },

  /* Results receipt */
  receiptCard: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.kraftBorder,
    borderRadius: 4,
    padding: 16,
    gap: 8,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    borderStyle: 'dashed',
  },
  receiptEyebrow: { fontSize: 10, fontFamily: LEDGER_MONO, color: COLORS.brandGold, textTransform: 'uppercase' },
  receiptSub: { fontSize: 9.5, fontFamily: LEDGER_MONO, color: COLORS.textMuted, marginTop: 2 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptLabel: { fontSize: 11, fontFamily: LEDGER_MONO, color: COLORS.textCoffee },
  receiptValue: { fontSize: 11, fontFamily: LEDGER_MONO, color: COLORS.textCoffee },
  receiptExclusionLabel: { fontSize: 10, fontFamily: LEDGER_MONO, color: COLORS.ctaBrown },
  receiptExclusionValue: { fontSize: 10, fontFamily: LEDGER_MONO, color: COLORS.ctaBrown, flexShrink: 1, textAlign: 'right' },
  receiptDivider: { height: 2, backgroundColor: COLORS.kraftBorder, marginVertical: 2 },
  receiptTotalLabel: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee, textTransform: 'uppercase' },
  receiptTotalValue: { fontSize: 15, fontFamily: LEDGER_MONO, fontWeight: '700', color: COLORS.textCoffee },

  weightAlertCard: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: COLORS.brandGold,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  weightAlertTitle: {
    fontSize: 12.5,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.ctaBrown,
    textTransform: 'uppercase',
  },
  weightAlertText: {
    fontSize: 12,
    fontFamily: FONT_BODY,
    color: COLORS.textCoffee,
    lineHeight: 17,
  },
  talkToVetBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 2,
  },
  talkToVetBtnText: { fontSize: 11.5, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },

  onTrackBadge: {
    backgroundColor: '#EDF5F0',
    borderWidth: 1,
    borderColor: COLORS.forestGreen,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  onTrackBadgeText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.forestGreen },

  recProductLoading: { paddingVertical: 24, alignItems: 'center' },
  recProductCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  recProductImage: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: COLORS.cardAlt,
  },
  recProductInfo: { flex: 1, gap: 3 },
  recProductEyebrow: { fontSize: 9, fontFamily: LEDGER_MONO, color: COLORS.sageIcon, textTransform: 'uppercase' },
  recProductName: { fontSize: 14, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee },
  recProductDesc: { fontSize: 11, fontFamily: FONT_BODY, color: COLORS.textMuted, lineHeight: 15 },
  recProductActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  addToBowlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.ctaBrown,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addToBowlBtnText: { fontSize: 10.5, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF', textTransform: 'uppercase' },
  viewRecipeLink: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.sageIcon },

  noMatchBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    padding: 16,
  },
  noMatchText: { fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textMuted },

  resultActionsRow: { gap: 10 },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    paddingVertical: 13,
  },
  saveProfileBtnText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee, textTransform: 'uppercase' },
  startOverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    paddingVertical: 13,
  },
  startOverBtnText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee, textTransform: 'uppercase' },
});
