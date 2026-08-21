import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchMyPets, createPet, deletePet,
  fetchPetById, updatePet, fetchPetHealthRecords, fetchPetHealthRecordDetail,
  updateHealthRecord
} from '../../api/pets';
import type { HealthRecordResponse } from '../../api/pets';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser } from '../../api/auth';
import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { 
  ArrowLeft, ShoppingCart, LogOut, User, PawPrint, 
  Trash2, Plus, Scale, Loader2, AlertCircle,
  Dna, Heart, Award, Cake, Tag, Save, FileText, XCircle, Activity
} from 'lucide-react';

const mapRecordType = (type: string | undefined | null): string => {
  if (!type) return 'general';
  const norm = type.toLowerCase().trim();
  if (norm === 'general') return 'general';
  if (norm === 'diagnostic' || norm === 'diagnosis') return 'diagnosis';
  if (norm === 'surgery') return 'surgery';
  if (norm === 'vaccination') return 'vaccination';
  if (norm === 'treatment') return 'treatment';
  if (norm === 'symptom') return 'symptom';
  if (norm === 'medication') return 'medication';
  if (norm === 'lab_result') return 'lab_result';
  if (norm === 'allergy') return 'allergy';
  if (norm === 'follow_up') return 'follow_up';
  return 'general';
};

export const PetsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const { items: cartItems, clear: clearCart } = useCartStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Form State
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detailed Pet Profile Modal/Edit States
  const [inspectingPetId, setInspectingPetId] = useState<number | null>(null);
  const [inspectingPet, setInspectingPet] = useState<any | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecordResponse[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'health'>('profile');

  // Inline edit state
  const [editName, setEditName] = useState('');
  const [editBreed, setEditBreed] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editSpecies, setEditSpecies] = useState('');
  const [isUpdatingPet, setIsUpdatingPet] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Selected single health record modal state
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecordResponse | null>(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);

  // Edit Health Record States
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [recordEditTitle, setRecordEditTitle] = useState('');
  const [recordEditType, setRecordEditType] = useState('general');
  const [recordEditSymptoms, setRecordEditSymptoms] = useState('');
  const [recordEditClinicalFindings, setRecordEditClinicalFindings] = useState('');
  const [recordEditDiagnosis, setRecordEditDiagnosis] = useState('');
  const [recordEditTreatment, setRecordEditTreatment] = useState('');
  const [recordEditMedications, setRecordEditMedications] = useState('');
  const [recordEditFollowUpDate, setRecordEditFollowUpDate] = useState('');
  const [recordEditNotes, setRecordEditNotes] = useState('');
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  const startEditingRecord = () => {
    if (!selectedRecord) return;
    setRecordEditTitle(selectedRecord.title);
    setRecordEditType(mapRecordType(selectedRecord.record_type));
    setRecordEditSymptoms(selectedRecord.symptoms || '');
    setRecordEditClinicalFindings(selectedRecord.clinical_findings || '');
    setRecordEditDiagnosis(selectedRecord.diagnosis || '');
    setRecordEditTreatment(selectedRecord.treatment || '');
    setRecordEditMedications(selectedRecord.medications || '');
    setRecordEditFollowUpDate(selectedRecord.follow_up_date || '');
    setRecordEditNotes(selectedRecord.notes || '');
    setIsEditingRecord(true);
  };

  const handleUpdateRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId || !inspectingPetId) return;
    setIsSavingRecord(true);
    try {
      const payload = {
        title: recordEditTitle,
        record_type: mapRecordType(recordEditType),
        symptoms: recordEditSymptoms || null,
        clinical_findings: recordEditClinicalFindings || null,
        diagnosis: recordEditDiagnosis || null,
        treatment: recordEditTreatment || null,
        medications: recordEditMedications || null,
        follow_up_date: recordEditFollowUpDate || null,
        notes: recordEditNotes || null,
      };
      
      const updated = await updateHealthRecord(selectedRecordId, payload);
      setSelectedRecord(updated);
      setIsEditingRecord(false);
      alert('Medical log entry updated successfully!');
      
      const recordsData = await fetchPetHealthRecords(inspectingPetId);
      setHealthRecords(recordsData.records || []);
    } catch (err: any) {
      alert(`Failed to update medical log: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsSavingRecord(false);
    }
  };

  // Queries
  const { data: pets, isLoading, error } = useQuery({
    queryKey: ['pets'],
    queryFn: fetchMyPets,
  });

  // Create Pet Mutation
  const createMutation = useMutation({
    mutationFn: (petData: any) => createPet(petData),
    onSuccess: () => {
      // Invalidate pets cache to reload history
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      // Reset Form fields
      setName('');
      setBreed('');
      setDob('');
      setWeight('');
      setFormError('');
    },
    onError: (err: any) => {
      console.error('Failed to create pet:', err);
      setFormError(err.response?.data?.detail || 'Failed to register pet profile.');
    }
  });

  // Delete Pet Mutation
  const deleteMutation = useMutation({
    mutationFn: (petId: number) => deletePet(petId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pets'] });
    },
    onError: (err) => {
      console.error('Failed to delete pet:', err);
    }
  });

  // Load pet details and history records
  useEffect(() => {
    if (!inspectingPetId) {
      setInspectingPet(null);
      setHealthRecords([]);
      return;
    }

    const loadPetDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const [petData, recordsData] = await Promise.all([
          fetchPetById(inspectingPetId),
          fetchPetHealthRecords(inspectingPetId)
        ]);
        setInspectingPet(petData);
        setHealthRecords(recordsData.records || []);
        
        // Initialize edit states
        setEditName(petData.name);
        setEditBreed(petData.breed || '');
        setEditGender(petData.gender || 'Male');
        setEditDob(petData.date_of_birth || '');
        setEditWeight(petData.weight ? petData.weight.toString() : '');
        setEditSpecies(petData.species);
      } catch (err) {
        console.error('Failed to load pet profile detail ledger:', err);
        alert('Failed to load pet details.');
        setInspectingPetId(null);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    loadPetDetails();
  }, [inspectingPetId]);

  // Load single health record details
  useEffect(() => {
    if (!selectedRecordId || !inspectingPetId) {
      setSelectedRecord(null);
      return;
    }

    const loadRecordDetail = async () => {
      setIsLoadingRecord(true);
      try {
        const data = await fetchPetHealthRecordDetail(inspectingPetId, selectedRecordId);
        setSelectedRecord(data);
      } catch (err) {
        console.error('Failed to load health record detail:', err);
        alert('Failed to load health record detail.');
        setSelectedRecordId(null);
      } finally {
        setIsLoadingRecord(false);
      }
    };

    loadRecordDetail();
  }, [selectedRecordId, inspectingPetId]);

  // Save/Update Pet profile
  const handleUpdatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingPetId) return;

    setIsUpdatingPet(true);
    setUpdateError('');

    const petPayload = {
      name: editName,
      breed: editBreed.trim() || null,
      gender: editGender || null,
      date_of_birth: editDob || null,
      weight: editWeight ? parseFloat(editWeight) : null,
      species: editSpecies
    };

    try {
      const updated = await updatePet(inspectingPetId, petPayload);
      setInspectingPet(updated);
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      alert('Pet profile updated successfully!');
    } catch (err: any) {
      console.error('Update pet failed:', err);
      setUpdateError(err.response?.data?.detail || 'Failed to update pet profile.');
    } finally {
      setIsUpdatingPet(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      clearAuth();
      clearCart();
      navigate('/login');
    }
  };

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter a valid pet name.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const petPayload = {
      name,
      species,
      breed: breed.trim() || null,
      gender: gender || null,
      date_of_birth: dob || null,
      weight: weight ? parseFloat(weight) : null,
    };

    createMutation.mutate(petPayload, {
      onSettled: () => {
        setIsSubmitting(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <header className="w-full border-b border-cardboard border-opacity-25 bg-ink bg-opacity-95 backdrop-blur-md sticky top-0 z-30 shadow-sm text-paper">
        <div className="w-full px-4 md:px-8 py-4 flex justify-between items-center md:grid md:grid-cols-12">
          
          {/* Left Corner: Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer md:col-span-3 justify-start select-none" onClick={() => navigate('/')}>
            <PawPrint className="text-turmeric w-6 h-6 animate-pulse" />
            <div>
              <h1 className="font-display font-bold text-2xl tracking-tight text-paper">
                Scooby's Kitchen
              </h1>
              <p className="font-mono text-[9px] uppercase tracking-wider text-turmeric opacity-85">
                Notebook Ledger v1.0
              </p>
            </div>
          </div>

          {/* Center: Navigation Menu */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6 font-body text-xs font-bold uppercase tracking-wider text-paper md:col-span-6 justify-center">
            <button onClick={() => navigate('/shop')} className="hover:text-turmeric transition-colors pb-1">Shop Recipes</button>
            <button onClick={() => navigate('/pets')} className="hover:text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">Pets Ledger</button>
            <button onClick={() => navigate('/consultations')} className="hover:text-turmeric transition-colors pb-1">Vet Consults</button>
            <button onClick={() => navigate('/orders')} className="hover:text-turmeric transition-colors pb-1">My Orders</button>
            <button onClick={() => navigate('/assistant')} className="hover:text-turmeric transition-colors pb-1">AI Assistant 🐾</button>
            <button onClick={() => navigate('/profile')} className="hover:text-turmeric transition-colors pb-1">My Profile</button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Admin Panel 🛠️</button>
            )}
            {(user?.role === 'doctor' || user?.role === 'admin') && (
              <button onClick={() => navigate('/doctor')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Doctor Panel 🩺</button>
            )}
          </nav>

          {/* Right Corner: Actions */}
          <div className="flex items-center space-x-4 md:col-span-3 justify-end">
            {user && (
              <span className="font-mono text-[10px] uppercase font-bold text-turmeric">
                {user.first_name || 'User'}
              </span>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 relative text-paper"
            >
              <ShoppingCart className="w-4 h-4" />
              {totalCartQuantity > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-paprika text-paperLight font-mono text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
                  {totalCartQuantity}
                </span>
              )}
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paperLight hover:bg-opacity-10 text-paper flex items-center space-x-1.5 font-body text-[10px] font-bold uppercase"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Centered Main Content Wrapper */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">

      {/* Back Link */}
      <div className="mb-8 text-left">
        <button
          onClick={() => navigate('/shop')}
          className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to Product Ledger</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">
        {/* Left Column - Add Pet Form */}
        <div className="lg:col-span-4">
          <div className="bg-paperLight border border-cardboard p-8 rounded-2xl shadow-md space-y-6 relative overflow-hidden">
            {/* Page Tab */}
            <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
              REGISTRY FORM
            </div>

            <div className="space-y-1">
              <Eyebrow label="STEP 1 OF 1 — ADD COMPANION" />
              <h3 className="font-display font-bold text-xl text-ink">
                Pet Sourcing Registry
              </h3>
              <p className="font-body text-xs text-ink opacity-75 leading-relaxed">
                Add pet variables to calculate correct food nutrition percentages.
              </p>
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            <form onSubmit={handleAddPet} className="space-y-4">
              {/* Pet Name */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-turmeric animate-pulse" />
                  <span>Pet Name:</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Scooby"
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Species & Gender */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="species" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                    <Dna className="w-3.5 h-3.5 text-turmeric animate-spin" style={{ animationDuration: '6s' }} />
                    <span>Species:</span>
                  </label>
                  <select
                    id="species"
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                  >
                    <option value="Dog">Dog 🐶</option>
                    <option value="Cat">Cat 🐱</option>
                    <option value="Bird">Bird 🦜</option>
                    <option value="Rabbit">Rabbit 🐰</option>
                    <option value="Other">Other 🐾</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="gender" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                    <Heart className="w-3.5 h-3.5 text-paprika animate-pulse" />
                    <span>Gender:</span>
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>

              {/* Breed */}
              <div className="space-y-1.5">
                <label htmlFor="breed" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                  <Award className="w-3.5 h-3.5 text-turmeric hover:rotate-12 transition-transform duration-300" />
                  <span>Breed Name:</span>
                </label>
                <input
                  type="text"
                  id="breed"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder="e.g. Golden Retriever (optional)"
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  disabled={isSubmitting}
                />
              </div>

              {/* DOB & Weight */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="dob" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                    <Cake className="w-3.5 h-3.5 text-paprika animate-bounce" style={{ animationDuration: '2s' }} />
                    <span>Birthday:</span>
                  </label>
                  <input
                    type="date"
                    id="dob"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="weight" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center space-x-1.5">
                    <Scale className="w-3.5 h-3.5 text-herb hover:-rotate-12 transition-transform duration-300" />
                    <span>Weight (kg):</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    id="weight"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 12.5"
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                    min="0.1"
                  />
                </div>
              </div>

              {formError && (
                <div className="border border-paprika border-opacity-35 bg-red-50 p-3 rounded-sm flex items-start space-x-2 text-paprika font-body text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Register Pet Profile 🐾</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column - Pet List Dashboard */}
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-1">
            <Eyebrow label="VETERINARY REGISTERED PET PROFILE" />
            <h2 className="font-display font-bold text-3xl text-ink">
              Your Sourced Pets
            </h2>
            <p className="font-body text-xs text-ink opacity-70">
              Browse pet profiles, adjust weights, and check active veterinarian records.
            </p>
          </div>

          <hr className="border-t border-dashed border-cardboard" />

          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                Reading profiles...
              </p>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto border border-paprika bg-paperLight p-8 rounded-sm text-center shadow-md">
              <AlertCircle className="w-12 h-12 text-paprika mx-auto mb-4" />
              <h4 className="font-display font-bold text-lg text-ink mb-2">Failed to Load Profiles</h4>
              <p className="font-body text-xs text-ink opacity-80">
                Please check your internet connection or login status.
              </p>
            </div>
          ) : !pets || pets.length === 0 ? (
            <div className="border border-cardboard bg-paperLight border-dashed p-10 rounded-sm text-center">
              <PawPrint className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
              <h4 className="font-display font-bold text-lg text-ink mb-1">No Registered Pets</h4>
              <p className="font-body text-xs text-ink opacity-70 max-w-xs mx-auto">
                Your profile is blank. Fill in the registry on the left to add your companion dog or cat!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pets.map((pet) => (
                <div 
                  key={pet.id} 
                  className="bg-paperLight border border-cardboard p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
                >
                  {/* Ledger Spine binding card motif */}
                  <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>

                  <div className="space-y-4 pl-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-[10px] uppercase font-bold text-herb block">PET PROFILE #{pet.id}</span>
                        <h4 className="font-display font-bold text-2xl text-ink">🐾 {pet.name}</h4>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(pet.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 text-paprika opacity-70 hover:opacity-100 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2.5 font-mono text-xs uppercase text-ink pr-4">
                      {/* Dotted parameters breakdown */}
                      <div className="flex justify-between items-center dotted-divider pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <PawPrint className="w-4 h-4 text-turmeric mr-2 animate-pulse" />
                          <span>SPECIES</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink">{pet.species}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Award className="w-4 h-4 text-turmeric mr-2 hover:rotate-12 transition-transform duration-300" />
                          <span>BREED</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink truncate max-w-[150px]">{pet.breed || 'MIXED'}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Heart className="w-4 h-4 text-paprika mr-2 animate-pulse" />
                          <span>GENDER</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink">{pet.gender || 'UNKNOWN'}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Scale className="w-4 h-4 text-herb mr-2 hover:-rotate-12 transition-transform duration-300" />
                          <span>WEIGHT</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink">{pet.weight ? `${pet.weight} KG` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center pb-0.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Cake className="w-4 h-4 text-paprika mr-2 animate-bounce" style={{ animationDuration: '2.5s' }} />
                          <span>BIRTHDAY</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink">{pet.date_of_birth ? new Date(pet.date_of_birth).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                    <div className="pt-4 mt-2 border-t border-dashed border-cardboard flex justify-end">
                      <button
                        type="button"
                        onClick={() => setInspectingPetId(pet.id)}
                        className="text-turmeric hover:underline font-mono text-[10px] uppercase font-bold flex items-center space-x-1.5 border-0 bg-transparent cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Ledger & Health Records</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
    <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Inspect Pet & Medical Logs Modal */}
      {inspectingPetId && (
        <div className="fixed inset-0 bg-ink bg-opacity-45 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-paperLight border border-cardboard p-8 rounded-sm shadow-xl space-y-6 relative max-h-[90vh] overflow-y-auto text-left">
            {/* Torn top edge card styling */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-paper flex overflow-hidden">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="w-4 h-4 bg-paperLight rounded-full -translate-y-2 border border-cardboard shrink-0 animate-pulse"></div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setInspectingPetId(null)}
              className="absolute top-4 right-4 text-ink opacity-70 hover:opacity-100 border-0 bg-transparent cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            {isLoadingDetails ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
                <span className="font-mono text-[10px] uppercase text-herb font-bold">Reading clinical profile...</span>
              </div>
            ) : inspectingPet ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-cardboard pb-3 gap-4">
                  <div>
                    <span className="font-mono text-[8px] uppercase font-bold text-herb block">
                      Companion Ledger ID #{inspectingPet.id}
                    </span>
                    <h3 className="font-display font-bold text-2xl text-ink">
                      🐾 {inspectingPet.name}
                    </h3>
                  </div>
                  {/* Tabs */}
                  <div className="flex space-x-2 font-mono text-[10px] uppercase">
                    <button
                      type="button"
                      onClick={() => setActiveTab('profile')}
                      className={`px-3 py-1.5 border font-bold cursor-pointer ${activeTab === 'profile' ? 'bg-turmeric text-paper border-turmeric' : 'border-cardboard hover:bg-paper text-ink bg-transparent'}`}
                    >
                      Update Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('health')}
                      className={`px-3 py-1.5 border font-bold cursor-pointer ${activeTab === 'health' ? 'bg-turmeric text-paper border-turmeric' : 'border-cardboard hover:bg-paper text-ink bg-transparent'}`}
                    >
                      Medical Logs ({healthRecords.length})
                    </button>
                  </div>
                </div>

                {activeTab === 'profile' ? (
                  <form onSubmit={handleUpdatePet} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb block">Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                          required
                        />
                      </div>
                      {/* Breed */}
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb block">Breed</label>
                        <input
                          type="text"
                          value={editBreed}
                          onChange={(e) => setEditBreed(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {/* Species */}
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb block">Species</label>
                        <select
                          value={editSpecies}
                          onChange={(e) => setEditSpecies(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        >
                          <option value="Dog">Dog</option>
                          <option value="Cat">Cat</option>
                          <option value="Bird">Bird</option>
                          <option value="Rabbit">Rabbit</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      {/* Gender */}
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb block">Gender</label>
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                      {/* Weight */}
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb block">Weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        />
                      </div>
                    </div>

                    {/* Birthday */}
                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb block">Birthday</label>
                      <input
                        type="date"
                        value={editDob}
                        onChange={(e) => setEditDob(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>

                    {updateError && (
                      <p className="text-xs text-paprika font-bold">{updateError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isUpdatingPet}
                      className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-mono text-xs uppercase py-3 rounded-sm font-bold tracking-wide flex items-center justify-center space-x-1.5 cursor-pointer border-0"
                    >
                      {isUpdatingPet ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Profile Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Medical History & Logs */
                  <div className="space-y-4">
                    <span className="font-mono text-[9px] uppercase font-bold text-herb block">📋 Patient Case Records</span>
                    {healthRecords.length === 0 ? (
                      <div className="border border-cardboard border-dashed p-8 text-center bg-paper bg-opacity-40 rounded-sm">
                        <Activity className="w-8 h-8 text-cardboard mx-auto mb-2 stroke-1" />
                        <p className="font-body text-xs text-ink opacity-70">
                          No diagnostic checks or prescriptions recorded for {inspectingPet.name} yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                        {healthRecords.map((rec) => (
                          <div
                            key={rec.id}
                            onClick={() => setSelectedRecordId(rec.id)}
                            className="border border-cardboard p-4 bg-paper bg-opacity-40 hover:bg-paper cursor-pointer rounded-sm flex justify-between items-center transition-colors"
                          >
                            <div className="space-y-1">
                              <span className="font-mono text-[8px] uppercase font-bold text-herb tracking-wide block">
                                RECORD Type: {rec.record_type} | ID #{rec.id}
                              </span>
                              <h4 className="font-display font-bold text-sm text-ink">{rec.title}</h4>
                              <p className="text-[10px] text-ink opacity-65 font-mono">
                                Logged on {new Date(rec.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="text-turmeric hover:text-opacity-80 font-mono text-[9px] uppercase font-bold flex items-center space-x-1 border-none bg-transparent cursor-pointer"
                            >
                              <span>View details</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-paprika">Failed to load pet details.</p>
            )}
          </div>
        </div>
      )}

      {/* Selected Health Record Detail Overlay Modal */}
      {selectedRecordId && (
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-paperLight border border-cardboard p-8 rounded-sm shadow-2xl space-y-6 relative max-h-[85vh] overflow-y-auto text-left">
            {/* Torn top edge card styling */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-paper flex overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="w-4 h-4 bg-paperLight rounded-full -translate-y-2 border border-cardboard shrink-0"></div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => { setSelectedRecordId(null); setIsEditingRecord(false); }}
              className="absolute top-4 right-4 text-ink opacity-70 hover:opacity-100 border-0 bg-transparent cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            {selectedRecord && user?.role === 'doctor' && !isEditingRecord && (
              <button
                type="button"
                onClick={startEditingRecord}
                className="absolute top-4 right-12 text-herb hover:text-opacity-80 font-mono text-[10px] uppercase font-bold border border-herb px-2.5 py-1 rounded-sm bg-white"
              >
                ✏️ Edit Log
              </button>
            )}

            {isLoadingRecord ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
                <span className="font-mono text-[10px] uppercase text-herb font-bold">Unfolding case file...</span>
              </div>
            ) : selectedRecord ? (
              isEditingRecord ? (
                <form onSubmit={handleUpdateRecordSubmit} className="space-y-4 font-body text-xs text-ink">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb block">Log Entry Title:</label>
                    <input
                      type="text"
                      required
                      value={recordEditTitle}
                      onChange={(e) => setRecordEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb block">Record Type:</label>
                    <select
                      value={recordEditType}
                      onChange={(e) => setRecordEditType(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                    >
                      <option value="general">General Log</option>
                      <option value="diagnosis">Diagnostic Log</option>
                      <option value="surgery">Surgery Log</option>
                      <option value="vaccination">Vaccination Log</option>
                      <option value="treatment">Treatment Log</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb block">Symptoms:</label>
                    <textarea
                      rows={2}
                      value={recordEditSymptoms}
                      onChange={(e) => setRecordEditSymptoms(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb block">Clinical Findings:</label>
                    <textarea
                      rows={2}
                      value={recordEditClinicalFindings}
                      onChange={(e) => setRecordEditClinicalFindings(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb block">Diagnosis conclusion:</label>
                    <textarea
                      rows={2}
                      value={recordEditDiagnosis}
                      onChange={(e) => setRecordEditDiagnosis(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb block">Prescribed Treatment:</label>
                    <textarea
                      rows={2}
                      value={recordEditTreatment}
                      onChange={(e) => setRecordEditTreatment(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb block">Medications:</label>
                      <input
                        type="text"
                        value={recordEditMedications}
                        onChange={(e) => setRecordEditMedications(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb block">Follow-up Date:</label>
                      <input
                        type="date"
                        value={recordEditFollowUpDate}
                        onChange={(e) => setRecordEditFollowUpDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb block">Notes:</label>
                    <textarea
                      rows={2}
                      value={recordEditNotes}
                      onChange={(e) => setRecordEditNotes(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="flex space-x-2 pt-2 border-t border-cardboard border-dashed">
                    <button
                      type="button"
                      onClick={() => setIsEditingRecord(false)}
                      className="flex-1 border border-cardboard hover:bg-paper text-ink font-mono text-xs uppercase py-2 font-bold rounded-sm text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingRecord}
                      className="flex-1 bg-paprika text-paperLight font-mono text-xs uppercase py-2 font-bold rounded-sm text-center hover:opacity-95 disabled:opacity-50 flex items-center justify-center space-x-1.5"
                    >
                      {isSavingRecord ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="font-mono text-[8px] uppercase font-bold text-herb block">
                      Medical History File ID #{selectedRecord.id}
                    </span>
                    <h3 className="font-display font-bold text-xl text-ink">
                      {selectedRecord.title}
                    </h3>
                    <span className="font-mono text-[9px] text-turmeric uppercase font-bold block">
                      Type: {selectedRecord.record_type}
                    </span>
                  </div>

                  <hr className="border-t border-dashed border-cardboard" />

                  <div className="space-y-4 font-body text-xs text-ink">
                    {selectedRecord.symptoms && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[8px] uppercase text-herb font-bold block">Symptoms Reported</span>
                        <p className="opacity-90">{selectedRecord.symptoms}</p>
                      </div>
                    )}

                    {selectedRecord.clinical_findings && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[8px] uppercase text-herb font-bold block">Clinical Findings</span>
                        <p className="opacity-90">{selectedRecord.clinical_findings}</p>
                      </div>
                    )}

                    {selectedRecord.diagnosis && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[8px] uppercase text-turmeric font-bold block">Diagnosis</span>
                        <p className="opacity-90 font-bold">{selectedRecord.diagnosis}</p>
                      </div>
                    )}

                    {selectedRecord.treatment && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[8px] uppercase text-herb font-bold block">Treatment & Procedures</span>
                        <p className="opacity-90">{selectedRecord.treatment}</p>
                      </div>
                    )}

                    {selectedRecord.medications && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[8px] uppercase text-paprika font-bold block">Medications Prescribed</span>
                        <p className="opacity-90 font-mono font-bold text-paprika">{selectedRecord.medications}</p>
                      </div>
                    )}

                    {selectedRecord.follow_up_date && (
                      <div className="bg-paper p-3 rounded-sm border border-cardboard border-opacity-70 font-mono text-[10px]">
                        <span className="text-[8px] uppercase text-herb font-bold block">Follow-up Date Plan</span>
                        <span className="font-bold">{new Date(selectedRecord.follow_up_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {selectedRecord.notes && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[8px] uppercase text-herb font-bold block">Special Doctor Notes</span>
                        <p className="opacity-80 italic">{selectedRecord.notes}</p>
                      </div>
                    )}

                    {selectedRecord.doctor && (
                      <div className="font-mono text-[9px] text-ink opacity-70 text-right">
                        Logged by specialist (ID #{selectedRecord.doctor_id} - {selectedRecord.doctor.specialization})
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRecordId(null)}
                      className="w-full border border-cardboard hover:bg-paper text-ink font-mono text-xs uppercase py-2.5 font-bold rounded-sm tracking-wide text-center cursor-pointer"
                    >
                      Back to Case Ledger
                    </button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-xs text-paprika">Failed to load medical history details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
