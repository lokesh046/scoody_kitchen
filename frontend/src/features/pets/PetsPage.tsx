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
import { uploadAvatarImage } from '../../api/auth';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { 
  ArrowLeft, PawPrint, 
  Trash2, Scale, Loader2, AlertCircle,
  Heart, Award, Cake, Save, FileText, XCircle, Activity
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
  const { user } = useAuthStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [activeSection, setActiveSection] = useState<'ledger' | 'register'>('ledger');
  const [registrationStep, setRegistrationStep] = useState<number>(1);

  // Form State
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');

  // Pet Profile Image states
  const [petImageUrl, setPetImageUrl] = useState('');
  const [isUploadingRegImage, setIsUploadingRegImage] = useState(false);
  const [editPetImageUrl, setEditPetImageUrl] = useState('');
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const regFileInputRef = React.useRef<HTMLInputElement>(null);
  const editFileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delight overlay states
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [lastCreatedPet, setLastCreatedPet] = useState<{ name: string; imageUrl?: string | null } | null>(null);

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
    onSuccess: (_, variables) => {
      // Invalidate pets cache to reload history
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      
      // Trigger success delight overlay
      setLastCreatedPet({ name: variables.name, imageUrl: variables.profile_image_url });
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
        // Direct view back to profiles ledger tab
        setActiveSection('ledger');
      }, 3500);

      // Reset Form fields and stepper index
      setName('');
      setBreed('');
      setDob('');
      setWeight('');
      setPetImageUrl('');
      setFormError('');
      setRegistrationStep(1);
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
        setEditPetImageUrl(petData.profile_image_url || '');
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
      species: editSpecies,
      profile_image_url: editPetImageUrl || null
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
      profile_image_url: petImageUrl || null
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
      <Header activeTab="pets" onCartToggle={() => setIsCartOpen(true)} />

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

      {/* Binder Tab Navigation Bar */}
      <div className="flex border-b border-cardboard border-opacity-40 mb-8 font-mono text-xs uppercase tracking-wider font-bold">
        <button
          type="button"
          onClick={() => setActiveSection('ledger')}
          className={`px-6 py-3 border-t-2 border-x transition-colors cursor-pointer ${
            activeSection === 'ledger'
              ? 'bg-paperLight border-t-turmeric border-x-cardboard text-ink'
              : 'bg-transparent border-t-transparent border-x-transparent text-ink opacity-60 hover:opacity-100'
          }`}
        >
          📓 Profile Ledger ({pets?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('register')}
          className={`px-6 py-3 border-t-2 border-x transition-colors cursor-pointer ${
            activeSection === 'register'
              ? 'bg-paperLight border-t-turmeric border-x-cardboard text-ink'
              : 'bg-transparent border-t-transparent border-x-transparent text-ink opacity-60 hover:opacity-100'
          }`}
        >
          🐾 Register Companion
        </button>
      </div>

      {/* PROFILE LEDGER SECTION */}
      {activeSection === 'ledger' && (
        <div className="max-w-5xl mx-auto space-y-6 text-left animate-fade-in">
          <div className="space-y-1.5">
            <h2 className="font-display font-bold text-3xl text-ink">
              Your Sourced Pets
            </h2>
            <p className="font-body text-sm text-ink opacity-70">
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
            <div className="max-w-md mx-auto border border-turmeric bg-paperLight p-8 rounded-sm text-center shadow-md">
              <AlertCircle className="w-12 h-12 text-paprika mx-auto mb-4" />
              <h4 className="font-display font-bold text-lg text-ink mb-2">Failed to Load Profiles</h4>
              <p className="font-body text-sm text-ink opacity-80">
                Please check your internet connection or login status.
              </p>
            </div>
          ) : !pets || pets.length === 0 ? (
            <div className="border border-cardboard bg-paperLight border-dashed p-16 rounded-sm text-center">
              <PawPrint className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
              <h4 className="font-display font-bold text-lg text-ink mb-1">No Registered Pets</h4>
              <p className="font-body text-sm text-ink opacity-70 max-w-xs mx-auto mb-6">
                Your profile is blank. Register your first pet companion inside the ledger to get started!
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('register')}
                className="bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase font-bold py-2.5 px-6 rounded-sm tracking-wide transition-colors cursor-pointer"
              >
                Register Companion Pet 🐾
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pets.map((pet, index) => (
                <div 
                  key={pet.id} 
                  className="bg-paperLight border border-cardboard p-6 md:p-7 pl-8 md:pl-10 rounded-sm shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between hover-paper-lift animate-fade-in-up"
                  style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'both' }}
                >
                  {/* Ledger Spine binding card motif */}
                  <div className="absolute top-0 bottom-0 left-3 border-l border-dashed border-cardboard opacity-35"></div>

                  <div className="space-y-4 pl-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3 text-left">
                        {/* Polaroid Polaroid frame layout */}
                        <div className="relative w-14 h-14 bg-white p-1 border border-cardboard shadow-xs rotate-[-2deg] hover:rotate-[0deg] transition-transform duration-300 shrink-0">
                          {pet.profile_image_url ? (
                            <img 
                              src={pet.profile_image_url} 
                              alt={pet.name} 
                              className="w-full h-full object-cover polaroid-img"
                            />
                          ) : (
                            <div className="w-full h-full bg-paper flex items-center justify-center">
                              <span className="text-xl">🐾</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="font-mono text-[10px] uppercase font-bold text-paprika block">PET PROFILE #{pet.id}</span>
                          <h4 className="font-display font-bold text-xl text-ink">{pet.name}</h4>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to retire ${pet.name}'s registry files?`)) {
                            deleteMutation.mutate(pet.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-1 text-paprika opacity-70 hover:opacity-100 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5 font-mono text-xs uppercase text-ink pr-4">
                      {/* Dotted parameters breakdown */}
                      <div className="flex justify-between items-center dotted-divider py-1.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <PawPrint className="w-4 h-4 text-turmeric mr-2 animate-pulse" />
                          <span>SPECIES</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink">{pet.species}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider py-1.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Award className="w-4 h-4 text-turmeric mr-2 hover:rotate-12 transition-transform duration-300" />
                          <span>BREED</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink truncate max-w-[150px]">{pet.breed || 'MIXED'}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider py-1.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Heart className="w-4 h-4 text-paprika mr-2 animate-pulse" />
                          <span>GENDER</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink">{pet.gender || 'UNKNOWN'}</span>
                      </div>
                      <div className="flex justify-between items-center dotted-divider py-1.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Scale className="w-4 h-4 text-herb mr-2 hover:-rotate-12 transition-transform duration-300" />
                          <span>WEIGHT</span>
                        </span>
                        <span className="bg-paperLight pl-1 font-bold text-ink">{pet.weight ? `${pet.weight} KG` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5">
                        <span className="bg-paperLight pr-1 text-herb font-bold flex items-center">
                          <Cake className="w-4 h-4 text-paprika mr-2 animate-float-medium" />
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
      )}

      {/* REGISTRATION STEPPER SECTION */}
      {activeSection === 'register' && (
        <div className="max-w-xl mx-auto space-y-6 text-left animate-fade-in">
          {/* Stepper Progress Bar */}
          <div className="flex justify-between items-center bg-paperLight border border-cardboard p-4 rounded-sm font-mono text-[9px] text-ink shadow-xs">
            <span className={registrationStep >= 1 ? "font-bold text-herb" : "opacity-50"}>
              1. IDENTITY
            </span>
            <span className="text-cardboard opacity-60">➔</span>
            <span className={registrationStep >= 2 ? "font-bold text-herb" : "opacity-50"}>
              2. PEDIGREE
            </span>
            <span className="text-cardboard opacity-60">➔</span>
            <span className={registrationStep >= 3 ? "font-bold text-herb" : "opacity-50"}>
              3. AVATAR PHOTO
            </span>
          </div>

          <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
            {/* Step Stamp Indicator Tag */}
            <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
              STEP {registrationStep} OF 3
            </div>

            {/* Form Validation Errors */}
            {formError && (
              <div className="text-[10px] text-paprika bg-red-50 border border-turmeric border-opacity-20 p-2.5 rounded-sm font-body">
                {formError}
              </div>
            )}

            {/* STEP 1: Companion Identity */}
            {registrationStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl text-ink">Companion Identity</h3>
                  <p className="font-body text-sm text-ink opacity-70">
                    Input your pet's name, choose their species category, and select their gender:
                  </p>
                </div>
                
                <hr className="border-t border-dashed border-cardboard" />

                <div className="space-y-1.5 text-left">
                  <label htmlFor="name" className="font-mono text-[10px] uppercase font-bold text-paprika block">
                    Pet Name (required):
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Scooby"
                    className="w-full px-3 py-2.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink placeholder-cardboard focus:outline-none focus:border-turmeric transition-colors"
                    required
                  />
                </div>

                <div className="space-y-2 text-left">
                  <span className="font-mono text-[10px] uppercase font-bold text-paprika block mb-1">
                    Select Species:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'Dog', label: 'Dog 🐶' },
                      { id: 'Cat', label: 'Cat 🐱' },
                      { id: 'Bird', label: 'Bird 🦜' },
                      { id: 'Rabbit', label: 'Rabbit 🐰' },
                    ].map((sp) => {
                      const isSelected = species === sp.id;
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => setSpecies(sp.id)}
                          className={`py-2 px-1 border text-center font-mono text-[10px] rounded-sm transition-all hover:border-turmeric cursor-pointer ${
                            isSelected ? 'bg-paper border-turmeric ring-1 ring-turmeric font-bold' : 'bg-paperLight border-cardboard text-ink opacity-80'
                          }`}
                        >
                          {sp.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <span className="font-mono text-[10px] uppercase font-bold text-paprika block mb-1">
                    Select Gender:
                  </span>
                  <div className="flex space-x-2">
                    {[
                      { id: 'Male', label: 'Male ♂' },
                      { id: 'Female', label: 'Female ♀' },
                      { id: 'Unknown', label: 'Unknown 🐾' },
                    ].map((gd) => {
                      const isSelected = gender === gd.id;
                      return (
                        <button
                          key={gd.id}
                          type="button"
                          onClick={() => setGender(gd.id)}
                          className={`w-1/3 py-2 border text-center font-mono text-[10px] rounded-sm transition-all hover:border-turmeric cursor-pointer ${
                            isSelected ? 'bg-paper border-turmeric ring-1 ring-turmeric font-bold' : 'bg-paperLight border-cardboard text-ink opacity-80'
                          }`}
                        >
                          {gd.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Pedigree & Measurements */}
            {registrationStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl text-ink">Pedigree & Size</h3>
                  <p className="font-body text-sm text-ink opacity-70">
                    Provide the companion's breed and weight variables to calculate correct food nutrition percentages:
                  </p>
                </div>

                <hr className="border-t border-dashed border-cardboard" />

                <div className="space-y-1.5 text-left">
                  <label htmlFor="breed" className="font-mono text-[10px] uppercase font-bold text-paprika block">
                    Breed Name (optional):
                  </label>
                  <input
                    type="text"
                    id="breed"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="e.g. Golden Retriever"
                    className="w-full px-3 py-2.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink placeholder-cardboard focus:outline-none focus:border-turmeric transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1.5">
                    <label htmlFor="dob" className="font-mono text-[10px] uppercase font-bold text-paprika block">
                      Birthday (optional):
                    </label>
                    <input
                      type="date"
                      id="dob"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3 py-2.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="weight" className="font-mono text-[10px] uppercase font-bold text-paprika block">
                      Weight (kg):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      id="weight"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 12.5"
                      className="w-full px-3 py-2.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink placeholder-cardboard focus:outline-none focus:border-turmeric transition-colors"
                      min="0.1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Image Upload & Submit */}
            {registrationStep === 3 && (
              <form onSubmit={handleAddPet} className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-xl text-ink">Profile Avatar Photo</h3>
                  <p className="font-body text-sm text-ink opacity-70">
                    Upload an avatar image to render on your pet's physical ledger polaroids:
                  </p>
                </div>

                <hr className="border-t border-dashed border-cardboard" />

                {/* Profile Photo Upload section */}
                <div className="flex flex-col items-center space-y-3 border border-cardboard border-dashed p-6 rounded-sm bg-paper bg-opacity-50">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={regFileInputRef}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingRegImage(true);
                      try {
                        const res = await uploadAvatarImage(file);
                        setPetImageUrl(res.url);
                      } catch (err: any) {
                        alert(`Image upload failed: ${err?.response?.data?.detail || err.message}`);
                      } finally {
                        setIsUploadingRegImage(false);
                      }
                    }}
                    className="hidden" 
                  />
                  
                  {/* Polaroid preview clip */}
                  <div className="w-32 h-32 bg-white p-2 border border-cardboard shadow-md rotate-[2deg] flex items-center justify-center relative shrink-0">
                    {petImageUrl ? (
                      <img 
                        src={petImageUrl} 
                        alt="New Pet Preview" 
                        className="w-full h-full object-cover polaroid-img"
                      />
                    ) : (
                      <PawPrint className="w-10 h-10 text-cardboard opacity-55 animate-pulse" />
                    )}
                    {isUploadingRegImage && (
                      <div className="absolute inset-0 bg-ink bg-opacity-50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-turmeric animate-spin" />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isUploadingRegImage || isSubmitting}
                    onClick={() => regFileInputRef.current?.click()}
                    className="font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:underline bg-paper border border-cardboard px-3 py-1.5 rounded-sm cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingRegImage ? 'Uploading...' : petImageUrl ? 'Change Photo' : 'Upload Companion Image'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingRegImage}
                  className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase py-3 font-bold rounded-sm tracking-wide transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Ledgering Companion...</span>
                    </>
                  ) : (
                    <span>Register Companion Profile 🐾</span>
                  )}
                </button>
              </form>
            )}

            {/* Stepper Navigation buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-cardboard mt-6">
              {registrationStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setRegistrationStep(registrationStep - 1)}
                  className="border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase py-2 px-4 font-bold rounded-sm cursor-pointer"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              {registrationStep < 3 && (
                <button
                  type="button"
                  disabled={registrationStep === 1 && !name.trim()}
                  onClick={() => setRegistrationStep(registrationStep + 1)}
                  className="bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[9px] uppercase py-2 px-4 font-bold rounded-sm cursor-pointer disabled:opacity-50"
                >
                  Next Step
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
    <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Inspect Pet & Medical Logs Modal */}
      {inspectingPetId && (
        <div className="fixed inset-0 bg-ink bg-opacity-45 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-backdrop-in">
          <div className="w-full max-w-2xl bg-paperLight border border-cardboard p-8 rounded-sm shadow-xl space-y-6 relative max-h-[90vh] overflow-y-auto text-left animate-modal-in">
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
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-2xl text-ink flex items-center gap-2">
                      🐾 {inspectingPet.name}
                      <span className="font-mono text-[9px] uppercase font-normal text-herb bg-paper border border-cardboard px-2 py-0.5 rounded-sm">
                        ID #{inspectingPet.id}
                      </span>
                    </h3>
                  </div>
                  {/* Tabs */}
                  <div className="relative flex p-1 bg-paper border border-cardboard rounded-sm font-mono text-[9px] uppercase w-64 select-none">
                    <button
                      type="button"
                      onClick={() => setActiveTab('profile')}
                      className={`flex-1 relative z-10 py-1 font-bold text-center transition-colors duration-300 ${activeTab === 'profile' ? 'text-paper' : 'text-ink'}`}
                    >
                      Update Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('health')}
                      className={`flex-1 relative z-10 py-1 font-bold text-center transition-colors duration-300 ${activeTab === 'health' ? 'text-paper' : 'text-ink'}`}
                    >
                      Medical Logs ({healthRecords.length})
                    </button>
                    <div 
                      className="absolute top-1 bottom-1 bg-turmeric rounded-xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{
                        left: activeTab === 'profile' ? '4px' : 'calc(50% + 2px)',
                        width: 'calc(50% - 6px)',
                      }}
                    />
                  </div>
                </div>

                {activeTab === 'profile' ? (
                  <form onSubmit={handleUpdatePet} className="space-y-4">
                    {/* Edit Pet Profile Photo Upload section */}
                    <div className="flex flex-col items-center space-y-2 border border-cardboard border-dashed p-4 rounded-sm bg-paper bg-opacity-50">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold">CHANGE PET PROFILE IMAGE</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        ref={editFileInputRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingEditImage(true);
                          try {
                            const res = await uploadAvatarImage(file);
                            setEditPetImageUrl(res.url);
                          } catch (err: any) {
                            alert(`Image upload failed: ${err?.response?.data?.detail || err.message}`);
                          } finally {
                            setIsUploadingEditImage(false);
                          }
                        }}
                        className="hidden" 
                      />
                      
                      {/* Polaroid preview clip */}
                      <div className="w-24 h-24 bg-white p-1.5 border border-cardboard shadow-xs rotate-[2deg] flex items-center justify-center relative shrink-0">
                        {editPetImageUrl ? (
                          <img 
                            src={editPetImageUrl} 
                            alt="Edit Pet Preview" 
                            className="w-full h-full object-cover polaroid-img"
                          />
                        ) : (
                          <PawPrint className="w-8 h-8 text-cardboard opacity-55 animate-pulse" />
                        )}
                        {isUploadingEditImage && (
                          <div className="absolute inset-0 bg-ink bg-opacity-50 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-turmeric animate-spin" />
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isUploadingEditImage || isUpdatingPet}
                        onClick={() => editFileInputRef.current?.click()}
                        className="font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:underline bg-paper border border-cardboard px-2.5 py-1 rounded-sm cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingEditImage ? 'Uploading...' : editPetImageUrl ? 'Change Photo' : 'Upload Photo'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                          required
                        />
                      </div>
                      {/* Breed */}
                      <div className="space-y-1">
                        <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Breed</label>
                        <input
                          type="text"
                          value={editBreed}
                          onChange={(e) => setEditBreed(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {/* Species */}
                      <div className="space-y-1">
                        <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Species</label>
                        <select
                          value={editSpecies}
                          onChange={(e) => setEditSpecies(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
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
                        <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Gender</label>
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                      {/* Weight */}
                      <div className="space-y-1">
                        <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        />
                      </div>
                    </div>

                    {/* Birthday */}
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Birthday</label>
                      <input
                        type="date"
                        value={editDob}
                        onChange={(e) => setEditDob(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>

                    {updateError && (
                      <p className="text-xs text-paprika font-bold">{updateError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isUpdatingPet}
                      className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-mono text-xs uppercase py-3 rounded-sm font-bold tracking-wide flex items-center justify-center space-x-1.5 cursor-pointer border-0"
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
                    <span className="font-mono text-[10px] uppercase font-bold text-paprika block">📋 Patient Case Records</span>
                    {healthRecords.length === 0 ? (
                      <div className="border border-cardboard border-dashed p-8 text-center bg-paper bg-opacity-40 rounded-sm">
                        <Activity className="w-8 h-8 text-cardboard mx-auto mb-2 stroke-1" />
                        <p className="font-body text-sm text-ink opacity-70">
                          No diagnostic checks or prescriptions recorded for {inspectingPet.name} yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                        {healthRecords.map((rec, index) => (
                          <div
                            key={rec.id}
                            onClick={() => setSelectedRecordId(rec.id)}
                            className="border border-cardboard p-4 bg-paper bg-opacity-40 hover:bg-paper cursor-pointer rounded-sm flex justify-between items-center transition-colors animate-fade-in-up hover-paper-lift"
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
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
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-backdrop-in">
          <div className="w-full max-w-lg bg-paperLight border border-cardboard p-8 rounded-sm shadow-2xl space-y-6 relative max-h-[85vh] overflow-y-auto text-left animate-modal-in">
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
                <form onSubmit={handleUpdateRecordSubmit} className="space-y-4 font-body text-sm text-ink">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Log Entry Title:</label>
                    <input
                      type="text"
                      required
                      value={recordEditTitle}
                      onChange={(e) => setRecordEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Record Type:</label>
                    <select
                      value={recordEditType}
                      onChange={(e) => setRecordEditType(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                    >
                      <option value="general">General Log</option>
                      <option value="diagnosis">Diagnostic Log</option>
                      <option value="surgery">Surgery Log</option>
                      <option value="vaccination">Vaccination Log</option>
                      <option value="treatment">Treatment Log</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Symptoms:</label>
                    <textarea
                      rows={2}
                      value={recordEditSymptoms}
                      onChange={(e) => setRecordEditSymptoms(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Clinical Findings:</label>
                    <textarea
                      rows={2}
                      value={recordEditClinicalFindings}
                      onChange={(e) => setRecordEditClinicalFindings(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Diagnosis conclusion:</label>
                    <textarea
                      rows={2}
                      value={recordEditDiagnosis}
                      onChange={(e) => setRecordEditDiagnosis(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Prescribed Treatment:</label>
                    <textarea
                      rows={2}
                      value={recordEditTreatment}
                      onChange={(e) => setRecordEditTreatment(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Medications:</label>
                      <input
                        type="text"
                        value={recordEditMedications}
                        onChange={(e) => setRecordEditMedications(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Follow-up Date:</label>
                      <input
                        type="date"
                        value={recordEditFollowUpDate}
                        onChange={(e) => setRecordEditFollowUpDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Notes:</label>
                    <textarea
                      rows={2}
                      value={recordEditNotes}
                      onChange={(e) => setRecordEditNotes(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
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
                      className="flex-1 bg-turmeric text-ink font-mono text-xs uppercase py-2 font-bold rounded-sm text-center hover:opacity-95 disabled:opacity-50 flex items-center justify-center space-x-1.5"
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
                  <div className="space-y-1.5">
                    <h3 className="font-display font-bold text-xl text-ink flex items-center gap-2">
                      {selectedRecord.title}
                      <span className="font-mono text-[9px] uppercase font-normal text-herb bg-paper border border-cardboard px-2 py-0.5 rounded-sm">
                        File #{selectedRecord.id}
                      </span>
                    </h3>
                    <span className="font-mono text-[9px] text-turmeric uppercase font-bold block">
                      Type: {selectedRecord.record_type}
                    </span>
                  </div>

                  <hr className="border-t border-dashed border-cardboard" />

                  <div className="space-y-4 font-body text-sm text-ink">
                    {selectedRecord.symptoms && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Symptoms Reported</span>
                        <p className="opacity-90">{selectedRecord.symptoms}</p>
                      </div>
                    )}

                    {selectedRecord.clinical_findings && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Clinical Findings</span>
                        <p className="opacity-90">{selectedRecord.clinical_findings}</p>
                      </div>
                    )}

                    {selectedRecord.diagnosis && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[10px] uppercase text-turmeric font-bold block">Diagnosis</span>
                        <p className="opacity-90 font-bold">{selectedRecord.diagnosis}</p>
                      </div>
                    )}

                    {selectedRecord.treatment && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Treatment & Procedures</span>
                        <p className="opacity-90">{selectedRecord.treatment}</p>
                      </div>
                    )}

                    {selectedRecord.medications && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Medications Prescribed</span>
                        <p className="opacity-90 font-mono font-bold text-paprika">{selectedRecord.medications}</p>
                      </div>
                    )}

                    {selectedRecord.follow_up_date && (
                      <div className="bg-paper p-3 rounded-sm border border-cardboard border-opacity-70 font-mono text-[10px]">
                        <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Follow-up Date Plan</span>
                        <span className="font-bold">{new Date(selectedRecord.follow_up_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {selectedRecord.notes && (
                      <div className="space-y-1 bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Special Doctor Notes</span>
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

      {/* Success Delight Overlay */}
      {showSuccessOverlay && lastCreatedPet && (
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop-in">
          <div className="w-full max-w-sm bg-paperLight border border-cardboard p-8 rounded-sm shadow-2xl text-center space-y-6 relative overflow-hidden animate-modal-in flex flex-col items-center">
            
            {/* Confetti Drift Container */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 15 }).map((_, i) => {
                const delay = i * 0.15;
                const left = 5 + Math.random() * 90;
                const size = 12 + Math.random() * 16;
                const rotate = Math.random() * 360;
                return (
                  <span
                    key={i}
                    className="absolute text-paprika opacity-0 animate-drift-down select-none"
                    style={{
                      left: `${left}%`,
                      fontSize: `${size}px`,
                      animationDelay: `${delay}s`,
                      transform: `rotate(${rotate}deg)`,
                      top: '-20px'
                    }}
                  >
                    {i % 3 === 0 ? '🐾' : i % 3 === 1 ? '💚' : '🌾'}
                  </span>
                );
              })}
            </div>

            {/* Polaroid Profile Image inside Overlay */}
            <div className="relative w-32 h-32 bg-white p-2 border border-cardboard shadow-md rotate-[-3deg] animate-pulse">
              {lastCreatedPet.imageUrl ? (
                <img 
                  src={lastCreatedPet.imageUrl} 
                  alt={lastCreatedPet.name} 
                  className="w-full h-full object-cover polaroid-img"
                />
              ) : (
                <div className="w-full h-full bg-paper flex items-center justify-center">
                  <span className="text-3xl">🐾</span>
                </div>
              )}
            </div>

            {/* Hand-written styled stamp */}
            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-herb font-bold block">
                COMPANION ENTRY VERIFIED
              </span>
              <h3 className="font-display font-bold text-3xl text-ink">
                Welcome, {lastCreatedPet.name}!
              </h3>
              <p className="font-body text-sm text-ink opacity-80 leading-relaxed max-w-xs">
                Your companion has been registered in the Scooby Journal Ledger. We've customized your food nutrition calculations!
              </p>
            </div>

            {/* Custom SVG Stamped approved seal */}
            <div className="w-24 h-24 border border-dashed border-turmeric border-opacity-70 rounded-full flex items-center justify-center rotate-[-12deg] p-2 scale-100 animate-pulse mt-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold text-center leading-tight">
                APPROVED<br/>KITCHEN<br/>LEDGER
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
