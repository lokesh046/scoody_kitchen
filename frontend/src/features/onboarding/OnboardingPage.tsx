import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowRight, Activity, Sparkles, Heart, RefreshCw, ShoppingBag, Loader2 } from 'lucide-react';
import { Header } from '../../components/Header';
import { fetchProducts } from '../../api/products';
import { createPet } from '../../api/pets';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const addItem = useCartStore((state) => state.addItem);

  const [step, setStep] = useState(0);
  const [dogName, setDogName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [neutered, setNeutered] = useState<boolean | null>(null);
  const [breed, setBreed] = useState('');
  const [ageYears, setAgeYears] = useState<number>(2);
  const [ageMonths, setAgeMonths] = useState<number>(0);
  const [weight, setWeight] = useState<number | ''>('');
  const [activity, setActivity] = useState<'sedentary' | 'active' | 'very_active' | ''>('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Custom breed query state
  const [breedQuery, setBreedQuery] = useState('');
  const [showBreedDropdown, setShowBreedDropdown] = useState(false);

  const popularBreeds = [
    'Golden Retriever', 'Labrador Retriever', 'German Shepherd', 
    'French Bulldog', 'Beagle', 'Poodle', 'Indie Breed', 
    'Rottweiler', 'Boxer', 'Siberian Husky', 'Chihuahua', 'Mixed Breed'
  ];

  const filteredBreeds = breedQuery.trim() === ''
    ? popularBreeds
    : popularBreeds.filter(b => b.toLowerCase().includes(breedQuery.toLowerCase()));

  // Fetch products to match a recipe
  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetchProducts({ limit: 100 }),
  });

  // Pet creation mutation
  const createPetMutation = useMutation({
    mutationFn: createPet,
    onSuccess: () => {
      alert(`Success! ${dogName}'s profile has been saved to your account.`);
      navigate('/pets');
    },
    onError: (err: any) => {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to save pet profile.');
    }
  });

  // Calculate RER & MER calorie math
  const calculateCalories = () => {
    if (!weight) return 0;
    // convert lbs to kg: 1 lb = 0.45359237 kg
    const weightInKg = Number(weight) * 0.45359237;
    // RER = 70 * (weight in kg)^0.75
    const rer = 70 * Math.pow(weightInKg, 0.75);
    
    let factor = 1.4; // active standard
    if (activity === 'sedentary') factor = 1.0;
    if (activity === 'very_active') factor = 1.8;
    
    return Math.round(rer * factor);
  };

  // Match best recipe from catalog
  const getRecommendedProduct = () => {
    if (!productsData?.items || productsData.items.length === 0) return null;
    const items = productsData.items;
    
    // Check allergy exclusions first
    const safeProducts = items.filter(p => {
      const name = p.name.toLowerCase();
      const desc = (p.description || '').toLowerCase();
      
      if (allergies.includes('grains') && (name.includes('rice') || desc.includes('rice') || name.includes('grain'))) {
        return false;
      }
      if (allergies.includes('beef') && (name.includes('beef') || desc.includes('beef'))) return false;
      if (allergies.includes('chicken') && (name.includes('chicken') || desc.includes('chicken'))) return false;
      return true;
    });

    const activeList = safeProducts.length > 0 ? safeProducts : items;

    if (activity === 'very_active') {
      return activeList.find(p => p.name.toLowerCase().includes('beef') || p.name.toLowerCase().includes('active')) || activeList[0];
    } else if (Number(weight) < 18) {
      return activeList.find(p => p.name.toLowerCase().includes('salmon') || p.name.toLowerCase().includes('fish') || p.name.toLowerCase().includes('delicate')) || activeList[0];
    } else {
      return activeList.find(p => p.name.toLowerCase().includes('chicken') || p.name.toLowerCase().includes('turkey')) || activeList[0];
    }
  };

  const handleSavePet = () => {
    if (!user) {
      // Save onboarding answers in localStorage, redirect to login
      const onboardingData = {
        name: dogName,
        species: 'dog',
        breed,
        gender,
        weight: Number(weight),
        ageYears,
        ageMonths,
        activity,
        allergies
      };
      localStorage.setItem('pending_onboarding_pet', JSON.stringify(onboardingData));
      alert('Please log in or sign up to save your pet profile. We have saved your progress!');
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
      weight: Number(weight),
    });
  };

  const handleAddToCart = async (productId: number) => {
    setIsAddingToCart(true);
    try {
      await addItem(productId, 1);
      alert('Recipe successfully added to your cart!');
    } catch (err) {
      console.error(err);
      alert('Failed to add recipe to cart.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const isStepValid = () => {
    if (step === 1) return dogName.trim() !== '' && gender !== '' && neutered !== null;
    if (step === 2) return breed.trim() !== '' && weight !== '' && Number(weight) > 0;
    if (step === 3) return activity !== '';
    return true;
  };

  const totalSteps = 4;
  const progressPercent = (step / totalSteps) * 100;

  const recProduct = getRecommendedProduct();
  const calculatedCalories = calculateCalories();

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full text-left">
      <Header />

      <main className="flex-grow flex items-center justify-center py-10 px-4 md:px-8 relative bg-paper">
        {/* Notebook blueprint grid decoration */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="absolute left-6 md:left-12 top-0 bottom-0 border-l border-dashed border-cardboard opacity-20 hidden md:block pointer-events-none"></div>

        <div className="max-w-2xl w-full bg-paperLight border border-cardboard p-6 md:p-10 shadow-md relative z-10 space-y-6">
          {/* Progress Indicator */}
          {step > 0 && step < 4 && (
            <div className="space-y-2 animate-fade-in-up">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-herb tracking-wider">
                <span>Diet Profile Step {step} of 3</span>
                <span>{Math.round(progressPercent)}% Done</span>
              </div>
              <div className="w-full h-1 bg-cardboard bg-opacity-25 rounded-none overflow-hidden">
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
              <div className="w-16 h-16 bg-paper border border-dashed border-cardboard rounded-none flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-8 h-8 text-turmeric" />
              </div>
              <div className="space-y-2">
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Scooby's Kitchen Nutritionist</span>
                <h2 className="font-display font-black text-3xl uppercase tracking-tight text-ink leading-none">
                  Tailor the Perfect Recipe
                </h2>
                <p className="font-body text-xs text-ink opacity-85 max-w-md mx-auto leading-relaxed">
                  Enter your dog's diagnostics to calculate customized daily caloric demands and discover the optimal nutritional formula suited to their body condition.
                </p>
              </div>

              <div className="max-w-xs mx-auto border-t border-b border-cardboard border-dashed py-3 font-mono text-[9px] text-ink opacity-70 space-y-1">
                <div>⚡ Takes 90 seconds</div>
                <div>📊 Scientific RER & MER metrics</div>
              </div>

              <button
                onClick={nextStep}
                className="inline-flex items-center space-x-2 bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase font-bold px-8 py-3.5 tracking-wider transition-colors hover-bounce cursor-pointer shadow-sm mx-auto"
              >
                <span>Begin Profile Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: Basic Identifiers */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Diagnostics / Part 1</span>
                <h3 className="font-display font-bold text-lg text-ink">Tell us about your pup</h3>
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
                    className="w-full px-3 py-2 border border-cardboard bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Gender</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`py-3.5 border font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                        gender === 'male' 
                          ? 'bg-turmeric border-cardboard text-ink shadow-xs scale-[0.98]'
                          : 'border-cardboard bg-paper hover:bg-paperLight text-ink opacity-75'
                      }`}
                    >
                      Male ♂
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`py-3.5 border font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                        gender === 'female' 
                          ? 'bg-turmeric border-cardboard text-ink shadow-xs scale-[0.98]'
                          : 'border-cardboard bg-paper hover:bg-paperLight text-ink opacity-75'
                      }`}
                    >
                      Female ♀
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Is Spayed / Neutered?</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setNeutered(true)}
                      className={`py-3.5 border font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                        neutered === true
                          ? 'bg-turmeric border-cardboard text-ink shadow-xs scale-[0.98]'
                          : 'border-cardboard bg-paper hover:bg-paperLight text-ink opacity-75'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setNeutered(false)}
                      className={`py-3.5 border font-mono text-[10px] uppercase font-bold transition-all cursor-pointer ${
                        neutered === false
                          ? 'bg-turmeric border-cardboard text-ink shadow-xs scale-[0.98]'
                          : 'border-cardboard bg-paper hover:bg-paperLight text-ink opacity-75'
                      }`}
                    >
                      No
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
                  className="inline-flex items-center space-x-2 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-6 py-3 tracking-wider disabled:opacity-50 cursor-pointer shadow-xs hover-bounce"
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
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Diagnostics / Part 2</span>
                <h3 className="font-display font-bold text-lg text-ink">Dog stats index</h3>
              </div>

              <div className="space-y-4 relative">
                {/* Breed input */}
                <div className="space-y-1.5 relative">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Breed</label>
                  <input
                    type="text"
                    required
                    placeholder="Search or type breed (e.g. Golden Retriever)"
                    value={breedQuery}
                    onChange={(e) => {
                      setBreedQuery(e.target.value);
                      setBreed(e.target.value);
                      setShowBreedDropdown(true);
                    }}
                    onFocus={() => setShowBreedDropdown(true)}
                    className="w-full px-3 py-2 border border-cardboard bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  />
                  {showBreedDropdown && filteredBreeds.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-paper border border-cardboard max-h-40 overflow-y-auto z-30 shadow-md">
                      {filteredBreeds.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setBreed(b);
                            setBreedQuery(b);
                            setShowBreedDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-ink font-body hover:bg-paperLight transition-colors cursor-pointer border-b border-cardboard border-opacity-10 last:border-b-0"
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Age selector */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-ink block">Age (Years)</label>
                    <select
                      value={ageYears}
                      onChange={(e) => setAgeYears(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-cardboard bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric"
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
                      className="w-full px-3 py-2 border border-cardboard bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={i}>{i} months</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Weight Input */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Weight (lbs)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 35"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-cardboard bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
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
                  className="inline-flex items-center space-x-2 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-6 py-3 tracking-wider disabled:opacity-50 cursor-pointer shadow-xs hover-bounce"
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
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Diagnostics / Part 3</span>
                <h3 className="font-display font-bold text-lg text-ink">Lifestyle & Health</h3>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase font-bold text-ink block">Energy Output Level</label>
                  <div className="space-y-2">
                    {[
                      { id: 'sedentary', title: 'Sedentary', desc: 'Mainly couches, short block walks, relaxed lifestyle.' },
                      { id: 'active', title: 'Active', desc: 'Daily runs, regular fetches, playful and lively.' },
                      { id: 'very_active', title: 'Working / Sport Athlete', desc: 'Agility training, constant hikes, intense daily exercise.' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActivity(item.id as any)}
                        className={`w-full text-left p-4 border transition-all cursor-pointer ${
                          activity === item.id 
                            ? 'bg-turmeric border-cardboard text-ink shadow-xs scale-[0.99]'
                            : 'border-cardboard bg-paper hover:bg-paperLight text-ink'
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
                      const isChecked = allergies.includes(all.id);
                      return (
                        <button
                          key={all.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setAllergies(allergies.filter(x => x !== all.id));
                            } else {
                              setAllergies([...allergies, all.id]);
                            }
                          }}
                          className={`py-2 px-3 border font-mono text-[9px] uppercase font-bold tracking-wide transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-paprika border-cardboard text-paper shadow-xs'
                              : 'border-cardboard bg-paper hover:bg-paperLight text-ink opacity-75'
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
                  className="inline-flex items-center space-x-2 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-6 py-3 tracking-wider disabled:opacity-50 cursor-pointer shadow-xs hover-bounce"
                >
                  <span>Analyze Diagnostics</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Results & Recipe Match */}
          {step === 4 && (
            <div className="space-y-6 text-center animate-fade-in-up">
              <div className="border-b border-cardboard border-dashed pb-3 text-left">
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Diagnostics Output</span>
                <h3 className="font-display font-bold text-lg text-ink">Personalized Meal Formulation</h3>
              </div>

              {/* Thermal Printer Receipt Layout */}
              <div className="bg-paper p-6 border-4 border-double border-cardboard relative shadow-xs text-left max-w-md mx-auto">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-paper border-b border-dashed border-cardboard opacity-40"></div>
                
                <div className="space-y-4 pt-1">
                  <div className="flex justify-between items-center pb-2 border-b border-dashed border-cardboard">
                    <div>
                      <span className="font-mono text-[9px] uppercase font-bold text-turmeric block">// CALCULATOR OUTPUT</span>
                      <span className="font-mono text-[8px] uppercase tracking-wider text-ink opacity-75">
                        SUBJECT: {dogName || 'N/A'} ({weight} LBS, {breed})
                      </span>
                    </div>
                    <Activity className="w-5 h-5 text-turmeric shrink-0" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-ink">
                      <span>Resting Energy (RER):</span>
                      <span>{Math.round(70 * Math.pow((Number(weight) * 0.45359237), 0.75))} kcal</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-ink">
                      <span>Activity Multiplier:</span>
                      <span>
                        {activity === 'sedentary' ? '1.0x (Sedentary)' : activity === 'very_active' ? '1.8x (Athletic)' : '1.4x (Active)'}
                      </span>
                    </div>
                    {allergies.length > 0 && (
                      <div className="flex items-start justify-between text-[9px] font-mono text-paprika pt-1 border-t border-cardboard border-opacity-20 border-dashed">
                        <span>Exclusions:</span>
                        <span>{allergies.map(a => a.toUpperCase()).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-cardboard">
                    <span className="font-mono text-[10px] text-ink uppercase font-bold">DAILY CALORIE DEMAND:</span>
                    <span className="font-mono font-bold text-base text-ink">{calculatedCalories} kCal / day</span>
                  </div>
                </div>
              </div>

              {/* Recommended Product Box */}
              {recProduct ? (
                <div className="border border-cardboard bg-paperLight p-5 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-5 text-left">
                  <img
                    src={recProduct.image_url || 'https://images.unsplash.com/photo-1589924691106-07a3c22a12e7?auto=format&fit=crop&q=80&w=300'}
                    alt={recProduct.name}
                    className="w-24 h-24 object-cover border border-cardboard"
                  />
                  <div className="flex-grow space-y-1">
                    <span className="font-mono text-[8px] uppercase font-bold text-herb block">Recommended Blend</span>
                    <h4 className="font-display font-black text-sm text-ink uppercase tracking-tight">{recProduct.name}</h4>
                    <p className="font-body text-[10px] text-ink opacity-75 line-clamp-2 leading-relaxed">
                      {recProduct.description}
                    </p>
                    <div className="pt-2 flex items-center space-x-3">
                      <button
                        onClick={() => handleAddToCart(recProduct.id)}
                        disabled={isAddingToCart}
                        className="inline-flex items-center space-x-1 bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[9px] uppercase font-bold px-3 py-1.5 tracking-wider transition-colors cursor-pointer shadow-xs"
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
                        className="font-mono text-[9px] text-herb font-bold hover:underline"
                      >
                        Explore Recipe Details &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-cardboard p-5 text-left text-ink opacity-70 text-xs">
                  No recipes currently match the selected allergy filters.
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-cardboard border-dashed">
                <button
                  onClick={handleSavePet}
                  disabled={createPetMutation.isPending}
                  className="w-full bg-paper hover:bg-paperLight text-ink border border-cardboard font-mono text-[10px] uppercase font-bold py-3.5 tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-xs hover-bounce flex items-center justify-center space-x-1.5"
                >
                  {createPetMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Heart className="w-3.5 h-3.5 text-paprika fill-paprika" />
                  )}
                  <span>{user ? 'Save Pet to Profile' : 'Sign Up to Save Pet'}</span>
                </button>

                <button
                  onClick={() => {
                    setStep(0);
                    setDogName('');
                    setGender('');
                    setNeutered(null);
                    setBreed('');
                    setBreedQuery('');
                    setWeight('');
                    setActivity('');
                    setAllergies([]);
                  }}
                  className="w-full border border-cardboard border-dashed hover:bg-paperLight font-mono text-[10px] uppercase font-bold py-3.5 text-ink tracking-wider cursor-pointer shadow-xs hover-bounce"
                >
                  Start New Assessment
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
