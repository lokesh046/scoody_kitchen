import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowRight, Activity, Sparkles, Heart, RefreshCw, ShoppingBag, Loader2 } from 'lucide-react';
import { Header } from '../../components/Header';
import { fetchProducts } from '../../api/products';
import { createPet } from '../../api/pets';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { BREED_DATA, type AkcGroup } from '../../constants/breedData';

import { useFeatureFlag, useFeatureFlagFallback } from '../../hooks/useFeatureFlag';
import { DRAFT_KEY, parseDraft, toKilograms, displayWeight, estimateCalories, recommendRecipe, progressForStep, type WeightUnit, type ActivityLevel, type Allergy } from './mealPlanner';

// Same 7 real AKC groups mobile's MealPlannerScreen shows, in the same
// order (Foundation Stock Service / Miscellaneous Class are excluded at
// data-generation time — see mobile/scripts/generate-breed-data.mjs).
const AKC_GROUPS: AkcGroup[] = [
  'Sporting Group',
  'Hound Group',
  'Working Group',
  'Terrier Group',
  'Toy Group',
  'Non-Sporting Group',
  'Herding Group',
];



// Ports mobile's ±15% tolerance verbatim, so the two platforms flag the
// same dogs as above/below typical range for the same inputs.
const WEIGHT_STATUS_TOLERANCE = 0.15;

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const addItem = useCartStore((state) => state.addItem);

  const isMealPlannerEnabled = useFeatureFlag('shop_meal_planner', true);
  const mealPlannerFallback = useFeatureFlagFallback('shop_meal_planner');

  const [draft] = useState(() => {
    try { return parseDraft(sessionStorage.getItem(DRAFT_KEY)); }
    catch { return parseDraft(null); }
  });
  const [step, setStep] = useState(draft.step);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [draftAvailable, setDraftAvailable] = useState(true);
  const [hasSavedPet, setHasSavedPet] = useState(false);
  const [dogName, setDogName] = useState(draft.dogName);
  const [gender, setGender] = useState<'male' | 'female' | ''>(draft.gender);
  const [breed, setBreed] = useState(draft.breed);
  const [ageYears, setAgeYears] = useState<number>(draft.ageYears);
  const [ageMonths, setAgeMonths] = useState<number>(draft.ageMonths);
  const [weight, setWeight] = useState<number | ''>(draft.weight);
  const [activity, setActivity] = useState<ActivityLevel | ''>(draft.activity);
  const [allergies, setAllergies] = useState<Allergy[]>(draft.allergies);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(draft.weightUnit);
  const weightKg = toKilograms(Number(weight), weightUnit);
  const changeWeightUnit = (unit: WeightUnit) => {
    if (unit === weightUnit) return;
    if (weight !== '') setWeight(displayWeight(weightKg, unit));
    setWeightUnit(unit);
  };

  // Breed group + search state. Most pet parents don't know their dog's AKC
  // group off the top of their head — requiring it to be picked correctly
  // before the breed search even matched anything left them stuck with an
  // empty dropdown and no way out. Typing a breed name now searches the full
  // dataset regardless of whichever group happens to be selected; picking a
  // group without typing anything still narrows browsing to that group, for
  // people who do know it (mirrors mobile's MealPlannerScreen fix).
  const [selectedGroup, setSelectedGroup] = useState<AkcGroup | ''>(AKC_GROUPS.includes(draft.selectedGroup as AkcGroup) ? draft.selectedGroup as AkcGroup : '');
  const [breedQuery, setBreedQuery] = useState(draft.breedQuery);
  const [showBreedDropdown, setShowBreedDropdown] = useState(false);

  useEffect(() => {
    try {
      if (hasSavedPet || (step === 0 && !dogName)) {
        sessionStorage.removeItem(DRAFT_KEY);
      } else {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, dogName, gender, breed, ageYears, ageMonths, weight, weightUnit, activity, allergies, selectedGroup, breedQuery }));
      }
      setDraftAvailable(true);
    } catch { setDraftAvailable(false); }
  }, [step, dogName, gender, breed, ageYears, ageMonths, weight, weightUnit, activity, allergies, selectedGroup, breedQuery, hasSavedPet]);

  const filteredBreeds = useMemo(() => {
    const query = breedQuery.trim().toLowerCase();
    if (query) {
      return BREED_DATA.filter((b) => b.name.toLowerCase().includes(query));
    }
    if (!selectedGroup) return [];
    return BREED_DATA.filter((b) => b.group === selectedGroup);
  }, [selectedGroup, breedQuery]);

  const selectedBreedData = useMemo(() => BREED_DATA.find((b) => b.name === breed) || null, [breed]);

  // Fetch products to match a recipe
  const { data: productsData, isPending: productsLoading, isError: productsError, refetch: retryProducts } = useQuery({
    queryKey: ['products', 'meal-planner', 100],
    queryFn: () => fetchProducts({ limit: 100 }),
  });

  // Pet creation mutation
  const createPetMutation = useMutation({
    mutationFn: createPet,
    onSuccess: () => {
      setHasSavedPet(true);
      setFeedback({ kind: 'success', text: `${dogName}'s profile has been saved. You can view it in Know Your Pet.` });
    },
    onError: (err: any) => {
      console.error(err);
      const detail = err.response?.data?.detail;
      setFeedback({ kind: 'error', text: typeof detail === 'string' ? detail : 'We couldn’t save the profile. Please try again.' });
    }
  });

  const handleSavePet = () => {
    if (hasSavedPet || createPetMutation.isPending) return;
    setFeedback(null);
    if (!user) {
      // Save onboarding answers in localStorage, redirect to login
      const onboardingData = {
        name: dogName,
        species: 'dog',
        breed,
        gender,
        weight: Number(weightKg.toFixed(3)),
        ageYears,
        ageMonths,
        activity,
        allergies
      };
      try {
        localStorage.setItem('pending_onboarding_pet', JSON.stringify({ ...onboardingData, weight_unit: 'kg' }));
      } catch {
        setFeedback({ kind: 'error', text: 'Your browser could not save these details. Allow site storage, then try signing in again.' });
        return;
      }
      navigate('/login?redirect=onboarding');
      return;
    }

    // Calculate approximate date of birth
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - ageYears);
    birthDate.setMonth(birthDate.getMonth() - ageMonths);
    const dateOfBirthStr = birthDate.toISOString().split('T')[0];

    createPetMutation.mutate({
      name: dogName,
      species: 'dog',
      breed: breed || 'Mixed Breed',
      gender: gender || 'unknown',
      date_of_birth: dateOfBirthStr,
      weight: Number(weightKg.toFixed(3)),
    });
  };

  const handleAddToCart = async (productId: number) => {
    if (isAddingToCart) return;
    setFeedback(null);
    setIsAddingToCart(true);
    try {
      await addItem(productId, 1);
      setFeedback({ kind: 'success', text: 'Recipe added to your cart.' });
    } catch (err) {
      console.error(err);
      setFeedback({ kind: 'error', text: 'We couldn’t add the recipe to your cart. Please try again.' });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const nextStep = () => { if (isStepValid()) { setFeedback(null); setStep((prev) => Math.min(4, prev + 1)); } };
  const prevStep = () => setStep((prev) => prev - 1);

  const isStepValid = () => {
    if (step === 1) return dogName.trim() !== '' && gender !== '';
    if (step === 2) return selectedGroup !== '' && selectedBreedData !== null && Number.isFinite(weightKg) && weightKg > 0 && ageYears + ageMonths > 0;
    if (step === 3) return activity !== '';
    return true;
  };

  const progressPercent = progressForStep(step);

  const recProduct = productsError ? null : recommendRecipe(productsData?.items || [], allergies, activity, weightKg);
  const calculatedCalories = estimateCalories(weightKg, activity);

  // Compares the user's dog (real weight they entered) against that breed's
  // precomputed default (typical weight for the breed, same activity
  // level) — both run through the identical RER/MER formula, so they're
  // directly comparable. ±15% tolerance: individual dogs of the same breed
  // vary naturally, so only a real gap should surface a message.
  const weightStatus: 'above' | 'below' | 'on-track' | null = (() => {
    if (!selectedBreedData || !activity || !calculatedCalories) return null;
    const breedDefault = selectedBreedData.defaultCalories[activity];
    if (!breedDefault) return null;
    const ratio = calculatedCalories / breedDefault;
    if (ratio > 1 + WEIGHT_STATUS_TOLERANCE) return 'above';
    if (ratio < 1 - WEIGHT_STATUS_TOLERANCE) return 'below';
    return 'on-track';
  })();

  if (!isMealPlannerEnabled) {
    return (
      <div className="min-h-screen bg-midnight flex flex-col font-body selection:bg-turmeric selection:text-[#362820] w-full text-left">
        <Header />
        <main className="flex-grow flex items-center justify-center py-16 px-4 md:px-8 bg-gradient-to-b from-midnight via-midnightCard to-midnight">
          <div className="max-w-md w-full bg-paperLight border border-cardboard p-8 text-center space-y-5 shadow-md rounded-[16px]">
            <div className="w-14 h-14 bg-paper border border-dashed border-cardboard rounded-[12px] flex items-center justify-center mx-auto">
              <Sparkles className="w-7 h-7 text-turmeric" />
            </div>
            <div className="space-y-2">
              <h2 className="font-script font-normal text-3xl tracking-normal text-ink">
                Diet Planner Unavailable
              </h2>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                {mealPlannerFallback === 'coming_soon'
                  ? 'Our custom canine meal planning tool is launching soon. Check back shortly!'
                  : 'The meal planning tool is temporarily undergoing maintenance.'}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/shop/app')}
                className="pet-profile-cta relative isolate overflow-hidden rounded-[4px] min-h-11 inline-flex items-center justify-center space-x-2 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-5 py-2.5 hover:bg-opacity-90 transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <span>Explore Recipes</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight flex flex-col font-body selection:bg-turmeric selection:text-[#362820] w-full text-left">
      <Header />

      <main className="flex-grow flex items-center justify-center py-10 sm:py-14 px-4 md:px-8 relative bg-gradient-to-b from-midnight via-midnightCard to-midnight">
        {/* Notebook blueprint grid decoration */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#D09E6B08_1px,transparent_1px),linear-gradient(to_bottom,#D09E6B08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="absolute left-6 md:left-12 top-0 bottom-0 border-l border-dashed border-turmeric opacity-15 hidden md:block pointer-events-none"></div>

        <div className="max-w-2xl w-full bg-paper border border-turmeric/30 rounded-[4px] p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.25)] relative z-10 space-y-6">
          {step > 0 && <p className="font-body text-xs text-ink/65" role="status">{draftAvailable ? (hasSavedPet ? 'Pet profile saved to your account.' : 'Your answers are saved in this tab while you complete the planner.') : 'Your browser cannot keep a draft. Keep this page open to preserve your answers.'}</p>}
          {/* Progress Indicator */}
          {step > 0 && step < 4 && (
            <div className="space-y-2 animate-fade-in-up">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-turmeric tracking-wider">
                <span>Step {step} of 3</span>
                <span>{Math.round(progressPercent)}% of steps</span>
              </div>
              <div role="progressbar" aria-label="Meal planner progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="w-full h-1 bg-cardboard bg-opacity-25 rounded-none overflow-hidden">
                <div 
                  className="h-full bg-turmeric transition-all duration-500 ease-out" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 0: Welcome Screen */}
          {step === 0 && (
            <div className="text-center py-6 space-y-6 animate-fade-in-up">
              <div className="w-16 h-16 bg-midnight border border-turmeric/40 rounded-[4px] flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-8 h-8 text-turmeric" />
              </div>
              <div className="space-y-2">
                <span className="font-mono text-[11px] uppercase font-bold text-turmeric tracking-widest block">Your pet’s meal planner</span>
                <h2 className="font-script font-normal text-4xl sm:text-5xl tracking-normal text-ink leading-snug">
                  Find their daily balance
                </h2>
                <p className="font-body text-sm text-ink opacity-80 max-w-md mx-auto leading-relaxed">
                  Tell us about your dog to see a daily calorie estimate and explore recipes that match your preferences.
                </p>
              </div>

              <div className="max-w-xs mx-auto border-t border-b border-cardboard border-dashed py-3 font-mono text-[9px] text-ink opacity-70 space-y-1">
                <div>⚡ Takes 90 seconds</div>
                <div>📊 Weight and activity-based estimates</div>
              </div>

              <button
                onClick={nextStep}
                className="pet-profile-cta relative isolate overflow-hidden rounded-[4px] min-h-11 inline-flex items-center justify-center space-x-2 bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase font-bold px-8 py-3.5 tracking-wider transition-colors hover-bounce cursor-pointer shadow-sm mx-auto"
              >
                <span>Get started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: Basic Identifiers */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[11px] uppercase font-bold text-turmeric tracking-wider block">Your pet / Step 1</span>
                <h3 className="font-display font-semibold text-xl text-ink">Tell us about your pup</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Pup's Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Scooby"
                    value={dogName}
                    onChange={(e) => setDogName(e.target.value)}
                    className="w-full min-h-11 rounded-[4px] px-3 py-2 border border-cardboard bg-paperLight font-body text-base sm:text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Gender</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`rounded-[4px] py-3.5 border font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                        gender === 'male' 
                          ? 'bg-turmeric border-turmeric text-ink shadow-xs scale-[0.98]'
                          : 'border-cardboard bg-paperLight hover:bg-paper text-ink opacity-75'
                      }`}
                    >
                      Male ♂
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`rounded-[4px] py-3.5 border font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                        gender === 'female' 
                          ? 'bg-turmeric border-turmeric text-ink shadow-xs scale-[0.98]'
                          : 'border-cardboard bg-paperLight hover:bg-paper text-ink opacity-75'
                      }`}
                    >
                      Female ♀
                    </button>
                  </div>
                </div>


              </div>

              <div className="flex justify-between items-center pt-4 border-t border-cardboard border-dashed">
                <button
                  onClick={prevStep}
                  className="inline-flex items-center space-x-1 font-mono text-[10px] uppercase font-bold text-ink opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="pet-profile-cta relative isolate overflow-hidden rounded-[4px] min-h-11 inline-flex items-center justify-center space-x-2 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-6 py-3 tracking-wider disabled:opacity-50 cursor-pointer shadow-xs hover-bounce"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Physical Diagnostics */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[11px] uppercase font-bold text-turmeric tracking-wider block">Your pet / Step 2</span>
                <h3 className="font-display font-semibold text-xl text-ink">Breed, age & weight</h3>
              </div>

              <div className="space-y-4 relative">
                {/* Breed search leads — most people know their dog's breed
                    name, not its AKC group. Picking a result below sets the
                    group automatically, so nobody has to guess it correctly
                    first just to find their own dog's breed. */}
                <div className="space-y-1.5 relative">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Breed</label>
                  <input
                    type="text"
                    required
                    placeholder="Search any breed (e.g. Golden Retriever)"
                    value={breedQuery}
                    onChange={(e) => {
                      setBreedQuery(e.target.value);
                      setShowBreedDropdown(true);
                      if (breed && e.target.value !== breed) setBreed('');
                    }}
                    onFocus={() => setShowBreedDropdown(true)}
                    className="w-full min-h-11 rounded-[4px] px-3 py-2 border border-cardboard bg-paperLight font-body text-base sm:text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                  {showBreedDropdown && filteredBreeds.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-paper border border-cardboard max-h-40 overflow-y-auto z-30 shadow-md">
                      {filteredBreeds.map((b) => (
                        <button
                          key={b.name}
                          type="button"
                          onClick={() => {
                            setBreed(b.name);
                            setBreedQuery(b.name);
                            setShowBreedDropdown(false);
                            setSelectedGroup(b.group);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-ink font-body hover:bg-paperLight transition-colors cursor-pointer border-b border-cardboard border-opacity-10 last:border-b-0 flex justify-between items-center gap-2"
                        >
                          <span>{b.name}</span>
                          <span className="text-[10px] opacity-60 font-mono shrink-0">
                            ~{displayWeight(b.typicalWeightKg, weightUnit)} {weightUnit}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showBreedDropdown && breedQuery.trim() !== '' && filteredBreeds.length === 0 && (
                    <p className="text-[10px] text-ink opacity-60 font-mono">
                      No breed matches "{breedQuery.trim()}" — check the spelling and try again.
                    </p>
                  )}
                  {breed !== '' && selectedBreedData && (
                    <p className="text-[10px] text-ink opacity-60 font-mono">
                      Selected: {breed} (typical adult weight ~{displayWeight(selectedBreedData.typicalWeightKg, weightUnit)} {weightUnit})
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Breed Group (AKC)</label>
                  <p className="text-[10px] text-ink opacity-60 font-body -mt-1 mb-1">
                    {breed ? 'Set automatically from the breed above.' : "Not sure? Just search your dog's breed above instead."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {AKC_GROUPS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setSelectedGroup(g);
                          setBreed('');
                          setBreedQuery('');
                          setShowBreedDropdown(false);
                        }}
                        className={`font-mono text-[9px] uppercase tracking-wider px-3 py-2 border font-bold cursor-pointer transition-colors ${
                          selectedGroup === g
                            ? 'bg-turmeric border-turmeric text-ink'
                            : 'border-cardboard bg-paper text-ink opacity-75 hover:opacity-100'
                        }`}
                      >
                        {g.replace(' Group', '')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age selector */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-ink block">Age (Years)</label>
                    <select
                      value={ageYears}
                      onChange={(e) => setAgeYears(Number(e.target.value))}
                      className="w-full min-h-11 rounded-[4px] px-3 py-2 border border-cardboard bg-paperLight font-body text-base sm:text-sm text-ink focus:outline-none focus:border-turmeric"
                    >
                      {Array.from({ length: 21 }).map((_, i) => (
                        <option key={i} value={i}>{i} yrs</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-ink block">Age (Months)</label>
                    <select
                      value={ageMonths}
                      onChange={(e) => setAgeMonths(Number(e.target.value))}
                      className="w-full min-h-11 rounded-[4px] px-3 py-2 border border-cardboard bg-paperLight font-body text-base sm:text-sm text-ink focus:outline-none focus:border-turmeric"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={i}>{i} months</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Weight Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="planner-weight" className="font-mono text-[10px] uppercase font-bold text-ink block">Weight ({weightUnit})</label>
                    <div className="flex gap-1" role="group" aria-label="Weight unit">
                      {(['kg', 'lbs'] as const).map((unit) => (
                        <button key={unit} type="button" aria-pressed={weightUnit === unit} onClick={() => changeWeightUnit(unit)} className={`min-h-11 min-w-11 rounded-[4px] border px-3 font-mono text-xs ${weightUnit === unit ? 'bg-turmeric border-turmeric text-ink' : 'bg-paperLight border-cardboard text-ink'}`}>{unit}</button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="planner-weight"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder={weightUnit === 'kg' ? 'e.g. 16' : 'e.g. 35'}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full min-h-11 rounded-[4px] px-3 py-2 border border-cardboard bg-paperLight font-body text-base sm:text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-cardboard border-dashed">
                <button
                  onClick={prevStep}
                  className="inline-flex items-center space-x-1 font-mono text-[10px] uppercase font-bold text-ink opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="pet-profile-cta relative isolate overflow-hidden rounded-[4px] min-h-11 inline-flex items-center justify-center space-x-2 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-6 py-3 tracking-wider disabled:opacity-50 cursor-pointer shadow-xs hover-bounce"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Lifestyle, Activity, Allergies */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[11px] uppercase font-bold text-turmeric tracking-wider block">Your pet / Step 3</span>
                <h3 className="font-display font-semibold text-xl text-ink">Lifestyle & Health</h3>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Activity level</label>
                  <div className="space-y-2">
                    {[
                      { id: 'sedentary', title: 'Sedentary', desc: 'Mainly couches, short block walks, relaxed lifestyle.' },
                      { id: 'active', title: 'Active', desc: 'Daily runs, regular fetches, playful and lively.' },
                      { id: 'very_active', title: 'Working / Sport Athlete', desc: 'Agility training, constant hikes, intense daily exercise.' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActivity(item.id as ActivityLevel)}
                        className={`w-full rounded-[4px] text-left p-4 border transition-all cursor-pointer ${
                          activity === item.id 
                            ? 'bg-turmeric border-turmeric text-ink shadow-xs scale-[0.99]'
                            : 'border-cardboard bg-paperLight hover:bg-paper text-ink'
                        }`}
                      >
                        <span className="font-mono text-[10px] uppercase font-bold block">{item.title}</span>
                        <span className="font-body text-[10px] text-ink opacity-80 mt-1 block">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Allergies & Sensitivities (Optional)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'beef', label: 'Beef Sensitive' },
                      { id: 'chicken', label: 'Chicken Sensitive' },
                      { id: 'grains', label: 'Grain Sensitive' },
                    ].map((all) => {
                      const isChecked = allergies.includes(all.id as Allergy);
                      return (
                        <button
                          key={all.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setAllergies(allergies.filter(x => x !== all.id));
                            } else {
                              setAllergies([...allergies, all.id as Allergy]);
                            }
                          }}
                          className={`min-h-11 rounded-[4px] py-2 px-3 border font-mono text-[9px] uppercase font-bold tracking-wide transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-turmeric border-turmeric text-ink shadow-xs'
                              : 'border-cardboard bg-paperLight hover:bg-paper text-ink opacity-75'
                          }`}
                        >
                          {all.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-cardboard border-dashed">
                <button
                  onClick={prevStep}
                  className="inline-flex items-center space-x-1 font-mono text-[10px] uppercase font-bold text-ink opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="pet-profile-cta relative isolate overflow-hidden rounded-[4px] min-h-11 inline-flex items-center justify-center space-x-2 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-6 py-3 tracking-wider disabled:opacity-50 cursor-pointer shadow-xs hover-bounce"
                >
                  <span>See my results</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Results & Recipe Match */}
          {step === 4 && (
            <div className="space-y-6 text-center animate-fade-in-up">
              <div className="border-b border-cardboard border-dashed pb-3 text-left">
                <span className="font-mono text-[11px] uppercase font-bold text-turmeric tracking-wider block">Your results</span>
                <h3 className="font-display font-semibold text-xl text-ink">Daily estimate & suggested recipe</h3>
              </div>

              {/* Thermal Printer Receipt Layout */}
              <div className="bg-paperLight p-6 border-4 border-double border-cardboard relative shadow-xs text-left max-w-md mx-auto">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-paper border-b border-dashed border-cardboard opacity-40"></div>
                
                <div className="space-y-4 pt-1">
                  <div className="flex justify-between items-center pb-2 border-b border-dashed border-cardboard">
                    <div>
                      <span className="font-mono text-xs uppercase font-bold text-turmeric block">// DAILY ESTIMATE</span>
                      <span className="font-mono text-xs uppercase tracking-wider text-ink opacity-75">
                        PET: {dogName || 'N/A'} ({weight} {weightUnit.toUpperCase()}, {breed})
                      </span>
                    </div>
                    <Activity className="w-6 h-6 text-turmeric shrink-0" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-mono text-ink">
                      <span>Resting Energy (RER):</span>
                      <span>{Math.round(70 * Math.pow(weightKg, 0.75))} kcal</span>
                    </div>
                    <div className="flex justify-between text-sm font-mono text-ink">
                      <span>Activity Multiplier:</span>
                      <span>
                        {activity === 'sedentary' ? '1.0x (Sedentary)' : activity === 'very_active' ? '1.8x (Athletic)' : '1.4x (Active)'}
                      </span>
                    </div>
                    {allergies.length > 0 && (
                      <div className="flex items-start justify-between text-xs font-mono text-paprika pt-1.5 border-t border-cardboard border-opacity-20 border-dashed">
                        <span>Exclusions:</span>
                        <span>{allergies.map(a => a.toUpperCase()).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-cardboard">
                    <span className="font-mono text-sm text-ink uppercase font-bold">ESTIMATED DAILY CALORIES:</span>
                    <span className="font-mono font-bold text-lg text-ink">{calculatedCalories} kCal / day</span>
                  </div>
                  {selectedBreedData && activity !== '' && (
                    <div className="flex justify-between text-sm font-mono text-ink opacity-75 pt-1.5">
                      <span>{breed} Default:</span>
                      <span>{selectedBreedData.defaultCalories[activity]} kcal</span>
                    </div>
                  )}
                </div>
              </div>

              {weightStatus && weightStatus !== 'on-track' && (
                <div className="border border-paprika bg-paprika/5 p-4 text-left space-y-2">
                  <h4 className="font-display font-bold text-sm text-ink">
                    {weightStatus === 'above' ? 'Above the breed comparison' : 'Below the breed comparison'}
                  </h4>
                  <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                    {weightStatus === 'above'
                      ? `${dogName || 'Your dog'}'s calorie need is higher than what's typical for a ${breed}. This isn't a diagnosis — individual dogs vary — but it may be worth monitoring portions or checking in with a vet.`
                      : `${dogName || 'Your dog'}'s calorie need is lower than what's typical for a ${breed}. This isn't a diagnosis — individual dogs vary — but it may be worth checking in with a vet if you're unsure.`}
                  </p>
                  <button
                    onClick={() => navigate('/consultations/app')}
                    className="font-mono text-[9px] uppercase font-bold text-paprika hover:underline cursor-pointer"
                  >
                    Talk to a Vet &rarr;
                  </button>
                </div>
              )}

              {weightStatus === 'on-track' && (
                <div className="border border-turmeric/40 bg-turmeric/10 p-3 text-center">
                  <span className="font-mono text-[10px] uppercase font-bold text-ink">
                    &#10003; Close to the breed comparison for a {breed}
                  </span>
                </div>
              )}

              <p className="text-left font-body text-sm leading-relaxed text-ink/75">
                This general estimate uses weight and activity. Age is saved to your pet’s profile but does not adjust these calories. Breed comparisons are reference values, not a body-condition assessment.
              </p>
              <p className="text-left font-body text-xs leading-relaxed text-ink/70">
                Recipe filters check catalogue names and descriptions, not a verified allergen list. Confirm the full ingredients before choosing food for a dog with allergies.
              </p>

              {/* Recommended Product Box */}
              {productsLoading ? (
                <p role="status" className="p-5 text-sm text-ink">Finding recipes…</p>
              ) : productsError ? (
                <div role="alert" className="border border-cardboard p-5 text-left text-sm text-ink">
                  We couldn’t load recipes. Your calorie estimate is still available.
                  <button type="button" onClick={() => retryProducts()} className="ml-2 underline font-semibold">Try again</button>
                </div>
              ) : recProduct ? (
                <div className="border border-cardboard bg-paperLight p-5 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-5 text-left">
                  <img
                    src={recProduct.image_url || 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&q=80&w=300'}
                    alt={recProduct.name}
                    className="w-24 h-24 object-cover border border-cardboard"
                  />
                  <div className="flex-grow space-y-1">
                    <span className="font-mono text-[8px] uppercase font-bold text-turmeric block">Suggested recipe</span>
                    <h4 className="font-display font-black text-sm text-ink uppercase tracking-tight">{recProduct.name}</h4>
                    <p className="font-body text-[10px] text-ink opacity-75 line-clamp-2 leading-relaxed">
                      {recProduct.description}
                    </p>
                    <div className="pt-2 flex items-center space-x-3">
                      <button
                        onClick={() => handleAddToCart(recProduct.id)}
                        disabled={isAddingToCart}
                        className="pet-profile-cta relative isolate overflow-hidden rounded-[4px] min-h-11 inline-flex items-center justify-center space-x-1 bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[9px] uppercase font-bold px-3 py-1.5 tracking-wider transition-colors cursor-pointer shadow-xs"
                      >
                        {isAddingToCart ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <ShoppingBag className="w-3 h-3" />
                        )}
                        <span>Add To Cart</span>
                      </button>
                      <button
                        onClick={() => navigate(`/product/${recProduct.id}`)}
                        className="font-mono text-[9px] text-turmeric font-bold hover:underline"
                      >
                        Explore Recipe Details &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-cardboard p-5 text-left text-ink opacity-70 text-xs">
                  No available recipes match your selected filters. Your exclusions have been kept.
                </div>
              )}

              {feedback && (
                <div role={feedback.kind === 'error' ? 'alert' : 'status'} className="border border-turmeric/40 bg-turmeric/10 p-4 text-left font-body text-sm text-ink">
                  {feedback.text}
                  {hasSavedPet && <button onClick={() => navigate('/pets/app')} className="ml-2 font-semibold underline">View pet profile</button>}
                </div>
              )}
              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-cardboard border-dashed">
                <button
                  onClick={handleSavePet}
                  disabled={createPetMutation.isPending || hasSavedPet}
                  className="w-full bg-paperLight hover:bg-paper text-ink border border-cardboard font-mono text-[10px] uppercase font-bold py-3.5 tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-xs hover-bounce flex items-center justify-center space-x-1.5"
                >
                  {createPetMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Heart className="w-3.5 h-3.5 text-paprika fill-paprika" />
                  )}
                  <span>{hasSavedPet ? 'Profile Saved' : user ? 'Save Pet to Profile' : 'Sign In to Save Pet'}</span>
                </button>

                <button
                  onClick={() => {
                    setHasSavedPet(false);
                    createPetMutation.reset();
                    setFeedback(null);
                    setAgeYears(2);
                    setAgeMonths(0);
                    setWeightUnit('kg');
                    setShowBreedDropdown(false);
                    setStep(0);
                    setDogName('');
                    setGender('');
                    setSelectedGroup('');
                    setBreed('');
                    setBreedQuery('');
                    setWeight('');
                    setActivity('');
                    setAllergies([]);
                  }}
                  className="w-full border border-cardboard border-dashed hover:bg-paperLight font-mono text-[10px] uppercase font-bold py-3.5 text-ink tracking-wider cursor-pointer shadow-xs hover-bounce"
                >
                  Start again
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
