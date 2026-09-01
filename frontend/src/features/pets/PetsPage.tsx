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
import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { 
  ArrowLeft, PawPrint, 
  Trash2, Scale, Loader2, AlertCircle,
  Heart, Award, Cake, Save, FileText, X, Activity,
  Plus
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
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      
      setLastCreatedPet({ name: variables.name, imageUrl: variables.profile_image_url });
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
        setActiveSection('ledger');
      }, 3500);

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
      {/* Top Header */}
      <Header activeTab="pets" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">

        {/* Back Link */}
        <div className="mb-6 text-left">
          <button
            onClick={() => navigate('/shop')}
            className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1.5 transition-opacity"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Fresh Meal Store</span>
          </button>
        </div>

        {/* Section Header */}
        <div className="space-y-1 text-left mb-8">
          <Eyebrow label="CANINE & FELINE NUTRITIONAL REGISTRY" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-display font-black text-2xl sm:text-4xl text-ink tracking-tight">
                Companion Pet Profiles
              </h1>
              <p className="font-body text-xs sm:text-sm text-ink opacity-75 max-w-2xl mt-1">
                Manage your companion's bio records, monitor growth weight metrics, and access veterinary diagnostic clinical files.
              </p>
            </div>
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveSection(activeSection === 'ledger' ? 'register' : 'ledger')}
                className="bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                {activeSection === 'ledger' ? (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Companion</span>
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>View Companion Ledger</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-cardboard border-opacity-35 mb-8 font-mono text-xs uppercase tracking-wider font-bold overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSection('ledger')}
            className={`px-5 py-3.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSection === 'ledger'
                ? 'border-turmeric text-ink bg-paperLight font-black shadow-xs'
                : 'border-transparent text-ink opacity-60 hover:opacity-100 hover:text-turmeric'
            }`}
          >
            <PawPrint className="w-4 h-4 text-turmeric" />
            <span>Profile Ledger</span>
            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-sm font-mono font-bold">
              {pets?.length || 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('register')}
            className={`px-5 py-3.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSection === 'register'
                ? 'border-turmeric text-ink bg-paperLight font-black shadow-xs'
                : 'border-transparent text-ink opacity-60 hover:opacity-100 hover:text-turmeric'
            }`}
          >
            <Plus className="w-4 h-4 text-herb" />
            <span>Register Companion</span>
          </button>
        </div>

        {/* PROFILE LEDGER SECTION */}
        {activeSection === 'ledger' && (
          <div className="max-w-5xl mx-auto space-y-6 text-left animate-fade-in">
            {isLoading ? (
              <div className="py-20 text-center space-y-4">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                <p className="font-mono text-[11px] uppercase tracking-wider text-herb font-bold">
                  Reading companion ledger...
                </p>
              </div>
            ) : error ? (
              <div className="max-w-md mx-auto border border-turmeric bg-paperLight p-8 rounded-sm text-center shadow-md space-y-3">
                <AlertCircle className="w-12 h-12 text-paprika mx-auto stroke-1" />
                <h4 className="font-display font-bold text-lg text-ink">Failed to Load Profiles</h4>
                <p className="font-body text-xs text-ink opacity-80">
                  Please check your internet connection or login credentials and try again.
                </p>
              </div>
            ) : !pets || pets.length === 0 ? (
              <div className="border border-cardboard border-dashed bg-paperLight p-12 rounded-sm text-center space-y-4">
                <PawPrint className="w-12 h-12 text-cardboard mx-auto stroke-1" />
                <div>
                  <h4 className="font-display font-bold text-lg text-ink">No Registered Companions</h4>
                  <p className="font-body text-xs text-ink opacity-70 max-w-sm mx-auto mt-1">
                    Your profile ledger is currently blank. Register your companion pet to unlock customized meal plans and clinical health tracking!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('register')}
                  className="bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs uppercase px-5 py-2.5 rounded-sm tracking-wider transition-colors cursor-pointer shadow-xs"
                >
                  Register Companion Pet 🐾
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pets.map((pet) => (
                  <div 
                    key={pet.id} 
                    className="bg-paperLight border border-cardboard border-opacity-40 p-6 pl-8 rounded-sm shadow-xs hover:border-turmeric transition-colors relative overflow-hidden flex flex-col justify-between"
                  >
                    {/* Left dashed notebook spine */}
                    <div className="absolute top-0 bottom-0 left-2.5 border-l border-dashed border-cardboard border-opacity-35"></div>

                    <div className="space-y-4 pl-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3 text-left">
                          {/* Companion Avatar Frame */}
                          <div className="w-14 h-14 bg-paper rounded-sm border border-cardboard border-opacity-40 overflow-hidden shadow-xs shrink-0 flex items-center justify-center">
                            {pet.profile_image_url ? (
                              <img 
                                src={pet.profile_image_url} 
                                alt={pet.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-2xl">🐾</span>
                            )}
                          </div>
                          <div>
                            <span className="font-mono text-[9px] uppercase font-bold text-paprika block">PROFILE #{pet.id}</span>
                            <h3 className="font-display font-black text-xl text-ink">{pet.name}</h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to retire ${pet.name}'s registry file?`)) {
                              deleteMutation.mutate(pet.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-paprika opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30 cursor-pointer"
                          aria-label="Delete pet profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs uppercase text-ink pr-2">
                        <div className="flex justify-between items-center py-1 border-b border-cardboard border-dashed border-opacity-30">
                          <span className="text-herb font-bold flex items-center">
                            <PawPrint className="w-3.5 h-3.5 text-turmeric mr-2" />
                            <span>SPECIES</span>
                          </span>
                          <span className="font-bold text-ink">{pet.species}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-cardboard border-dashed border-opacity-30">
                          <span className="text-herb font-bold flex items-center">
                            <Award className="w-3.5 h-3.5 text-turmeric mr-2" />
                            <span>BREED</span>
                          </span>
                          <span className="font-bold text-ink truncate max-w-[150px]">{pet.breed || 'MIXED BREED'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-cardboard border-dashed border-opacity-30">
                          <span className="text-herb font-bold flex items-center">
                            <Heart className="w-3.5 h-3.5 text-paprika mr-2" />
                            <span>GENDER</span>
                          </span>
                          <span className="font-bold text-ink">{pet.gender || 'UNKNOWN'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-cardboard border-dashed border-opacity-30">
                          <span className="text-herb font-bold flex items-center">
                            <Scale className="w-3.5 h-3.5 text-herb mr-2" />
                            <span>WEIGHT</span>
                          </span>
                          <span className="font-bold text-ink">{pet.weight ? `${pet.weight} KG` : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-herb font-bold flex items-center">
                            <Cake className="w-3.5 h-3.5 text-paprika mr-2" />
                            <span>BIRTHDAY</span>
                          </span>
                          <span className="font-bold text-ink">{pet.date_of_birth ? new Date(pet.date_of_birth).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-cardboard border-dashed border-opacity-35 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setInspectingPetId(pet.id)}
                          className="bg-paper border border-cardboard border-opacity-60 hover:bg-paperLight text-ink font-mono text-[9px] uppercase font-bold py-1.5 px-3 rounded-sm tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-herb" />
                          <span>Medical File & Edit</span>
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
            {/* Stepper Progress Header */}
            <div className="flex justify-between items-center bg-paperLight border border-cardboard border-opacity-35 p-4 rounded-sm font-mono text-[9px] text-ink shadow-xs">
              <span className={registrationStep >= 1 ? "font-bold text-herb flex items-center space-x-1" : "opacity-50"}>
                <span>1. IDENTITY</span>
              </span>
              <span className="text-cardboard opacity-50">➔</span>
              <span className={registrationStep >= 2 ? "font-bold text-herb flex items-center space-x-1" : "opacity-50"}>
                <span>2. PEDIGREE</span>
              </span>
              <span className="text-cardboard opacity-50">➔</span>
              <span className={registrationStep >= 3 ? "font-bold text-herb flex items-center space-x-1" : "opacity-50"}>
                <span>3. AVATAR PHOTO</span>
              </span>
            </div>

            <div className="bg-paperLight border border-cardboard border-opacity-35 p-6 sm:p-8 rounded-sm shadow-sm space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-6 bg-cardboard/25 text-ink font-mono text-[8.5px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard/40 font-bold">
                STEP {registrationStep} OF 3
              </div>

              {formError && (
                <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-sm font-body">
                  {formError}
                </div>
              )}

              {/* STEP 1: Companion Identity */}
              {registrationStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <h3 className="font-display font-black text-xl text-ink">Companion Identity</h3>
                    <p className="font-body text-xs text-ink opacity-75">
                      Input your pet's name, species type, and gender category.
                    </p>
                  </div>
                  
                  <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                  <div className="space-y-1 text-left">
                    <label htmlFor="name" className="font-mono text-[9px] uppercase font-bold text-paprika block">
                      Pet Name (required):
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Scooby"
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <span className="font-mono text-[9px] uppercase font-bold text-paprika block">
                      Species Type:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                            className={`py-2 px-2 border text-center font-mono text-[10px] rounded-sm transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-herb text-white border-herb font-bold shadow-xs' 
                                : 'bg-paper border-cardboard/40 text-ink opacity-80 hover:opacity-100'
                            }`}
                          >
                            {sp.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <span className="font-mono text-[9px] uppercase font-bold text-paprika block">
                      Gender:
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
                            className={`w-1/3 py-2 border text-center font-mono text-[10px] rounded-sm transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-ink text-paper border-ink font-bold shadow-xs' 
                                : 'bg-paper border-cardboard/40 text-ink opacity-80 hover:opacity-100'
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
                    <h3 className="font-display font-black text-xl text-ink">Pedigree & Biometrics</h3>
                    <p className="font-body text-xs text-ink opacity-75">
                      Provide breed and weight details to calibrate accurate dietary meal portions.
                    </p>
                  </div>

                  <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                  <div className="space-y-1 text-left">
                    <label htmlFor="breed" className="font-mono text-[9px] uppercase font-bold text-paprika block">
                      Breed (optional):
                    </label>
                    <input
                      type="text"
                      id="breed"
                      value={breed}
                      onChange={(e) => setBreed(e.target.value)}
                      placeholder="e.g. Golden Retriever"
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="space-y-1">
                      <label htmlFor="dob" className="font-mono text-[9px] uppercase font-bold text-paprika block">
                        Birthday (optional):
                      </label>
                      <input
                        type="date"
                        id="dob"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="weight" className="font-mono text-[9px] uppercase font-bold text-paprika block">
                        Weight (kg):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        id="weight"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="e.g. 14.5"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
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
                    <h3 className="font-display font-black text-xl text-ink">Avatar Photo & Save</h3>
                    <p className="font-body text-xs text-ink opacity-75">
                      Upload an avatar picture for your companion's profile card.
                    </p>
                  </div>

                  <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                  <div className="flex flex-col items-center space-y-3 border border-cardboard border-dashed border-opacity-40 p-6 rounded-sm bg-paper">
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
                    
                    <div className="w-28 h-28 bg-paperLight rounded-sm border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center relative shrink-0 shadow-xs">
                      {petImageUrl ? (
                        <img 
                          src={petImageUrl} 
                          alt="New Pet Preview" 
                          className="w-full h-full object-cover"
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
                    className="w-full bg-herb hover:bg-herb/90 text-white font-mono text-[10px] uppercase py-3 font-bold rounded-sm tracking-wider transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Registering Companion...</span>
                      </>
                    ) : (
                      <span>Complete Registration 🐾</span>
                    )}
                  </button>
                </form>
              )}

              {/* Stepper Navigation buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-cardboard border-opacity-35 mt-4">
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
                    className="bg-ink hover:bg-opacity-90 text-paper font-mono text-[9px] uppercase py-2 px-5 font-bold rounded-sm cursor-pointer disabled:opacity-50"
                  >
                    Next Step
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Inspect Pet & Medical Logs Modal */}
      {inspectingPetId && (
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-xs z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-paper border border-cardboard p-6 sm:p-8 rounded-sm shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto text-left animate-fade-in">
            <button
              type="button"
              onClick={() => setInspectingPetId(null)}
              className="absolute top-4 right-4 text-ink opacity-70 hover:opacity-100 border-0 bg-transparent cursor-pointer p-1"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoadingDetails ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
                <span className="font-mono text-[10px] uppercase text-herb font-bold">Reading clinical profile...</span>
              </div>
            ) : inspectingPet ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-cardboard border-opacity-35 pb-4 gap-4">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">PATIENT FILE #{inspectingPet.id}</span>
                    <h3 className="font-display font-black text-2xl text-ink mt-0.5">
                      🐾 {inspectingPet.name}
                    </h3>
                  </div>

                  {/* Tabs */}
                  <div className="flex bg-paperLight p-1 border border-cardboard border-opacity-40 rounded-sm font-mono text-[9px] uppercase">
                    <button
                      type="button"
                      onClick={() => setActiveTab('profile')}
                      className={`px-3 py-1.5 font-bold rounded-xs transition-colors cursor-pointer ${
                        activeTab === 'profile' ? 'bg-ink text-paper' : 'text-ink opacity-70 hover:opacity-100'
                      }`}
                    >
                      Update Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('health')}
                      className={`px-3 py-1.5 font-bold rounded-xs transition-colors cursor-pointer ${
                        activeTab === 'health' ? 'bg-ink text-paper' : 'text-ink opacity-70 hover:opacity-100'
                      }`}
                    >
                      Medical Logs ({healthRecords.length})
                    </button>
                  </div>
                </div>

                {activeTab === 'profile' ? (
                  <form onSubmit={handleUpdatePet} className="space-y-4">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center space-y-2 border border-cardboard border-dashed border-opacity-40 p-4 rounded-sm bg-paperLight">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold">CHANGE PET PROFILE PHOTO</span>
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
                      
                      <div className="w-24 h-24 bg-paper rounded-sm border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center relative shrink-0 shadow-xs">
                        {editPetImageUrl ? (
                          <img 
                            src={editPetImageUrl} 
                            alt="Edit Pet Preview" 
                            className="w-full h-full object-cover"
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Breed</label>
                        <input
                          type="text"
                          value={editBreed}
                          onChange={(e) => setEditBreed(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Species</label>
                        <select
                          value={editSpecies}
                          onChange={(e) => setEditSpecies(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                        >
                          <option value="Dog">Dog</option>
                          <option value="Cat">Cat</option>
                          <option value="Bird">Bird</option>
                          <option value="Rabbit">Rabbit</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Gender</label>
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Birthday</label>
                      <input
                        type="date"
                        value={editDob}
                        onChange={(e) => setEditDob(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors cursor-pointer"
                      />
                    </div>

                    {updateError && (
                      <p className="text-xs text-rose-800 font-bold">{updateError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isUpdatingPet}
                      className="w-full bg-herb hover:bg-herb/90 text-white font-mono text-[9px] uppercase py-2.5 rounded-sm font-bold tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isUpdatingPet ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Profile Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Medical History & Logs */
                  <div className="space-y-4">
                    <span className="font-mono text-[9px] uppercase font-bold text-paprika block">📋 Patient Clinical Records</span>
                    {healthRecords.length === 0 ? (
                      <div className="border border-cardboard border-dashed border-opacity-35 p-8 text-center bg-paperLight rounded-sm">
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
                            className="border border-cardboard border-opacity-35 p-4 bg-paperLight hover:bg-paper cursor-pointer rounded-sm flex justify-between items-center transition-colors"
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
                            <span className="text-turmeric font-mono text-[9px] uppercase font-bold flex items-center space-x-1">
                              <span>View details &rarr;</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-rose-800">Failed to load pet details.</p>
            )}
          </div>
        </div>
      )}

      {/* Selected Health Record Detail Overlay Modal */}
      {selectedRecordId && (
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-paper border border-cardboard p-6 sm:p-8 rounded-sm shadow-2xl space-y-6 relative max-h-[85vh] overflow-y-auto text-left animate-fade-in">
            <button
              type="button"
              onClick={() => { setSelectedRecordId(null); setIsEditingRecord(false); }}
              className="absolute top-4 right-4 text-ink opacity-70 hover:opacity-100 border-0 bg-transparent cursor-pointer p-1"
              aria-label="Close record details"
            >
              <X className="w-5 h-5" />
            </button>

            {selectedRecord && user?.role === 'doctor' && !isEditingRecord && (
              <button
                type="button"
                onClick={startEditingRecord}
                className="absolute top-4 right-12 text-herb hover:underline font-mono text-[9px] uppercase font-bold border border-herb px-2.5 py-1 rounded-sm bg-paper cursor-pointer"
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
                <form onSubmit={handleUpdateRecordSubmit} className="space-y-3.5 font-body text-xs text-ink">
                  <div className="space-y-1">
                    <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Log Title:</label>
                    <input
                      type="text"
                      required
                      value={recordEditTitle}
                      onChange={(e) => setRecordEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Record Type:</label>
                    <select
                      value={recordEditType}
                      onChange={(e) => setRecordEditType(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors cursor-pointer"
                    >
                      <option value="general">General Log</option>
                      <option value="diagnosis">Diagnostic Log</option>
                      <option value="surgery">Surgery Log</option>
                      <option value="vaccination">Vaccination Log</option>
                      <option value="treatment">Treatment Log</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Symptoms:</label>
                    <textarea
                      rows={2}
                      value={recordEditSymptoms}
                      onChange={(e) => setRecordEditSymptoms(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Clinical Findings:</label>
                    <textarea
                      rows={2}
                      value={recordEditClinicalFindings}
                      onChange={(e) => setRecordEditClinicalFindings(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Diagnosis:</label>
                    <textarea
                      rows={2}
                      value={recordEditDiagnosis}
                      onChange={(e) => setRecordEditDiagnosis(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Treatment:</label>
                    <textarea
                      rows={2}
                      value={recordEditTreatment}
                      onChange={(e) => setRecordEditTreatment(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Medications:</label>
                      <input
                        type="text"
                        value={recordEditMedications}
                        onChange={(e) => setRecordEditMedications(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Follow-up Date:</label>
                      <input
                        type="date"
                        value={recordEditFollowUpDate}
                        onChange={(e) => setRecordEditFollowUpDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2 border-t border-cardboard border-dashed border-opacity-35">
                    <button
                      type="button"
                      onClick={() => setIsEditingRecord(false)}
                      className="flex-1 border border-cardboard hover:bg-paperLight text-ink font-mono text-[9px] uppercase py-2 font-bold rounded-sm text-center cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingRecord}
                      className="flex-1 bg-herb hover:bg-herb/90 text-white font-mono text-[9px] uppercase py-2 font-bold rounded-sm text-center disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
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
                <div className="space-y-5">
                  <div className="space-y-1">
                    <span className="font-mono text-[9px] uppercase font-bold text-paprika block">
                      Case File #{selectedRecord.id} ({selectedRecord.record_type})
                    </span>
                    <h3 className="font-display font-black text-xl text-ink">
                      {selectedRecord.title}
                    </h3>
                  </div>

                  <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                  <div className="space-y-3 font-body text-xs text-ink">
                    {selectedRecord.symptoms && (
                      <div className="space-y-1 bg-paperLight p-3 rounded-sm border border-cardboard border-opacity-30">
                        <span className="font-mono text-[9px] uppercase text-paprika font-bold block">Symptoms Reported</span>
                        <p className="opacity-90">{selectedRecord.symptoms}</p>
                      </div>
                    )}

                    {selectedRecord.clinical_findings && (
                      <div className="space-y-1 bg-paperLight p-3 rounded-sm border border-cardboard border-opacity-30">
                        <span className="font-mono text-[9px] uppercase text-paprika font-bold block">Clinical Findings</span>
                        <p className="opacity-90">{selectedRecord.clinical_findings}</p>
                      </div>
                    )}

                    {selectedRecord.diagnosis && (
                      <div className="space-y-1 bg-paperLight p-3 rounded-sm border border-cardboard border-opacity-30">
                        <span className="font-mono text-[9px] uppercase text-turmeric font-bold block">Diagnosis</span>
                        <p className="opacity-90 font-bold">{selectedRecord.diagnosis}</p>
                      </div>
                    )}

                    {selectedRecord.treatment && (
                      <div className="space-y-1 bg-paperLight p-3 rounded-sm border border-cardboard border-opacity-30">
                        <span className="font-mono text-[9px] uppercase text-paprika font-bold block">Treatment & Procedures</span>
                        <p className="opacity-90">{selectedRecord.treatment}</p>
                      </div>
                    )}

                    {selectedRecord.medications && (
                      <div className="space-y-1 bg-paperLight p-3 rounded-sm border border-cardboard border-opacity-30">
                        <span className="font-mono text-[9px] uppercase text-paprika font-bold block">Medications Prescribed</span>
                        <p className="opacity-90 font-mono font-bold text-herb">{selectedRecord.medications}</p>
                      </div>
                    )}

                    {selectedRecord.follow_up_date && (
                      <div className="bg-paperLight p-3 rounded-sm border border-cardboard border-opacity-30 font-mono text-[9px]">
                        <span className="font-mono text-[9px] uppercase text-paprika font-bold block">Follow-up Date</span>
                        <span className="font-bold">{new Date(selectedRecord.follow_up_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {selectedRecord.notes && (
                      <div className="space-y-1 bg-paperLight p-3 rounded-sm border border-cardboard border-opacity-30">
                        <span className="font-mono text-[9px] uppercase text-paprika font-bold block">Special Case Notes</span>
                        <p className="opacity-80 italic">{selectedRecord.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRecordId(null)}
                      className="w-full border border-cardboard hover:bg-paperLight text-ink font-mono text-[9px] uppercase py-2.5 font-bold rounded-sm tracking-wider text-center cursor-pointer"
                    >
                      Back to Clinical Records
                    </button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-xs text-rose-800">Failed to load medical history details.</p>
            )}
          </div>
        </div>
      )}

      {/* Success Delight Overlay */}
      {showSuccessOverlay && lastCreatedPet && (
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-paper border border-cardboard p-8 rounded-sm shadow-2xl text-center space-y-6 relative overflow-hidden flex flex-col items-center animate-fade-in">
            <div className="w-24 h-24 bg-paperLight rounded-sm border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center shadow-md">
              {lastCreatedPet.imageUrl ? (
                <img 
                  src={lastCreatedPet.imageUrl} 
                  alt={lastCreatedPet.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">🐾</span>
              )}
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-herb font-bold block">
                COMPANION ENTRY VERIFIED
              </span>
              <h3 className="font-display font-black text-2xl text-ink">
                Welcome, {lastCreatedPet.name}!
              </h3>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed max-w-xs">
                Your companion has been registered in your profile ledger. We've customized your food nutrition calculations!
              </p>
            </div>

            <div className="border border-dashed border-herb text-herb font-mono text-[9px] font-bold px-3 py-1.5 uppercase tracking-widest rounded-sm bg-emerald-50">
              🌿 PROFILE APPROVED
            </div>
          </div>
        </div>
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
