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
import { classifyPetImage, type ClassificationResponse } from '../../api/vision';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { 
  ArrowLeft, PawPrint, 
  Trash2, Scale, Loader2, AlertCircle,
  Heart, Award, Cake, Save, FileText, X, Activity,
  Plus, Camera, RefreshCw, Database, ArrowRight, Cpu
} from 'lucide-react';
import { useFeatureFlag, useFeatureFlagFallback } from '../../hooks/useFeatureFlag';
import { AddPetWizard, type PetDraft } from './AddPetWizard';
import { VaccinationsPanel } from './VaccinationsPanel';
import './PetProfileDetails.css';
import { BreedInput, DogCategoryField, SpeciesDropdown } from './PetFormFields';
import { canonSpecies, resolveCategory } from './petFormHelpers';
import { categoryForBreed, type PetCategory } from '../../constants/breedCategory';
import { VaccinationHistoryModal } from './VaccinationHistoryModal';
import { fetchVaccinations, type VaccinationOverview } from '../../api/vaccinations';

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

// Microchip numbers: digits only, 9 to 30 of them. Anything that isn't a digit is dropped as you type or paste.
const cleanMicrochip = (value: string) => value.replace(/\D/g, '').slice(0, 30);
const microchipProblem = (value: string): string | null => {
  const digits = cleanMicrochip(value);
  return digits && !/^\d{9,30}$/.test(digits)
    ? 'Microchip number must be 9 to 30 digits (numbers only, as printed on the chip card).'
    : null;
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
  const [category, setCategory] = useState<PetCategory | null>(null);
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  const [microchip, setMicrochip] = useState('');

  // Pet Profile Image states
  const isPhotoUploadEnabled = useFeatureFlag('pets_photo_upload', true);
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);
  const isVaccinationsEnabled = useFeatureFlag('pets_vaccinations', false);
  const knowYourPetFallback = useFeatureFlagFallback('pets_know_your_pet');
  const [petImageUrl, setPetImageUrl] = useState('');
  const [isUploadingRegImage, setIsUploadingRegImage] = useState(false);
  const [editPetImageUrl, setEditPetImageUrl] = useState('');
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const editFileInputRef = React.useRef<HTMLInputElement>(null);

  // AI Vision Breed Scanner states
  const [isClassifying, setIsClassifying] = useState(false);
  const [visionResult, setVisionResult] = useState<ClassificationResponse | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [previewScanUrl, setPreviewScanUrl] = useState<string | null>(null);
  const [selectedScanFile, setSelectedScanFile] = useState<File | null>(null);
  const scanVersionRef = React.useRef(0);
  const scanOnSelectionRef = React.useRef(false);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const inputs = [galleryInputRef.current, cameraInputRef.current].filter((input): input is HTMLInputElement => !!input);
    const cancel = () => { scanOnSelectionRef.current = false; };
    inputs.forEach((input) => input.addEventListener('cancel', cancel));
    return () => inputs.forEach((input) => input.removeEventListener('cancel', cancel));
  }, [activeSection]);

  // Live Interactive Camera Viewfinder states
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const startCamera = async (facing: 'user' | 'environment' = 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraModalOpen(true);
      setCameraFacingMode(facing);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      console.warn('Could not start webcam feed, falling back to system camera/file input:', err);
      // Fallback: trigger system file/camera picker directly
      cameraInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraModalOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Performance optimization: resize canvas to max 800px to reduce payload size by 85% and speed up AI inference
    const naturalWidth = video.videoWidth || 640;
    const naturalHeight = video.videoHeight || 480;
    const maxDim = 800;
    let targetWidth = naturalWidth;
    let targetHeight = naturalHeight;

    if (naturalWidth > maxDim || naturalHeight > maxDim) {
      if (naturalWidth > naturalHeight) {
        targetWidth = maxDim;
        targetHeight = Math.round((naturalHeight * maxDim) / naturalWidth);
      } else {
        targetHeight = maxDim;
        targetWidth = Math.round((naturalWidth * maxDim) / naturalHeight);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `pet_snapshot_${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      selectScanImage(file);
    }, 'image/jpeg', 0.85);
  };

  const flipCamera = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  };

  // Lifecycle memory cleanup: stop video tracks & revoke blob preview on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (previewScanUrl && previewScanUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewScanUrl);
      }
    };
  }, [previewScanUrl]);

  const resetScan = () => {
    scanOnSelectionRef.current = false;
    scanVersionRef.current += 1;
    setPreviewScanUrl(null);
    setSelectedScanFile(null);
    setPetImageUrl('');
    setVisionResult(null);
    setVisionError(null);
    setIsUploadingRegImage(false);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const selectScanImage = (file: File) => {
    const scanAfterSelection = scanOnSelectionRef.current;
    scanOnSelectionRef.current = false;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setVisionError('Please choose a JPG, PNG or WebP photo.');
      return;
    }
    resetScan();
    setSelectedScanFile(file);
    setPreviewScanUrl(URL.createObjectURL(file));
    if (scanAfterSelection) void handleScanImage(file);
  };

  const handleScanImage = async (file: File) => {
    if (isClassifying) return;
    setIsClassifying(true);
    setVisionError(null);
    setVisionResult(null);
    const scanVersion = scanVersionRef.current;

    try {
      const res = await classifyPetImage(file);
      setVisionResult(res);

      if (res.success && res.is_pet) {
        if (res.species) setSpecies(canonSpecies(res.species));
        if (res.primary_breed) setBreed(res.primary_breed);
        if (res.primary_breed) setCategory(resolveCategory(res.species || species, res.primary_breed, null));
        if (name.trim()) setRegistrationStep(2);
        // Concurrently upload to avatar storage in background
        setIsUploadingRegImage(true);
        uploadAvatarImage(file)
          .then((uploadRes) => {
            if (scanVersionRef.current === scanVersion) setPetImageUrl(uploadRes.url);
          })
          .catch(() => {
            // Retain local preview
          })
          .finally(() => {
            if (scanVersionRef.current === scanVersion) setIsUploadingRegImage(false);
          });
      } else {
        setVisionError(res.error_message || 'No dog or cat detected. Please take a clear photo of your companion!');
      }
    } catch (err: any) {
      setVisionError(err.message || 'We couldn’t scan this photo. Please check your connection and try again.');
    } finally {
      setIsClassifying(false);
    }
  };
  
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
  const [activeTab, setActiveTab] = useState<'profile' | 'health' | 'vaccinations'>('profile');
  // Older pets must give their vaccination history right after being added (cannot be skipped).
  const [historyStep, setHistoryStep] = useState<{ id: number; name: string; dob: string | null; overview: VaccinationOverview } | null>(null);

  // Inline edit state
  const [editName, setEditName] = useState('');
  const [editBreed, setEditBreed] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editMicrochip, setEditMicrochip] = useState('');
  const [editSpecies, setEditSpecies] = useState('');
  const [editCategory, setEditCategory] = useState<PetCategory | null>(null);
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
    onSuccess: async (created, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      
      setLastCreatedPet({ name: variables.name, imageUrl: variables.profile_image_url });
      let needsHistory = false;
      if (isVaccinationsEnabled) {
        try {
          const overview = await fetchVaccinations(created.id);
          if (overview.supported && overview.history_required && !overview.history_complete) {
            setHistoryStep({ id: created.id, name: created.name, dob: created.date_of_birth, overview });
            needsHistory = true;
          }
        } catch { /* if this check fails, don't block adding the pet */ }
      }
      if (!needsHistory) setShowSuccessOverlay(true);

      // Reset all form inputs and AI scan vision state for next pet
      setName('');
      setSpecies('Dog');
      setCategory(null);
      setBreed('');
      setGender('Male');
      setDob('');
      setWeight('');
      setMicrochip('');
      setPetImageUrl('');
      setPreviewScanUrl(null);
      setSelectedScanFile(null);
      setVisionResult(null);
      setVisionError(null);
      setFormError('');
      setRegistrationStep(1);
    },
    onError: (err: any) => {
      console.error('Failed to create pet:', err);
      const detail = err.response?.data?.detail;
      setFormError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((item: { msg?: string }) => item.msg || 'Check the entered details.').join(' ') : 'We couldn’t save your pet. Please try again.');
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
        setEditMicrochip(petData.microchip_number || '');
        setEditSpecies(canonSpecies(petData.species));
        setEditCategory((['Working', 'Hound', 'Sporting', 'Companion'] as const).find((c) => c === petData.category) ?? null);
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

    const editChipProblem = microchipProblem(editMicrochip);
    if (editChipProblem) {
      setUpdateError(editChipProblem);
      return;
    }

    setIsUpdatingPet(true);
    setUpdateError('');

    const petPayload = {
      name: editName,
      breed: editBreed.trim() || null,
      gender: editGender || null,
      date_of_birth: editDob || null,
      weight: editWeight ? parseFloat(editWeight) : null,
      species: editSpecies,
      profile_image_url: editPetImageUrl || null,
      microchip_number: cleanMicrochip(editMicrochip) || null,
      category: resolveCategory(editSpecies, editBreed, editCategory)
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

    if (!breed.trim() || !dob) {
      setFormError('Breed and date of birth are required. Please add them in Details.');
      setRegistrationStep(2);
      return;
    }

    const chipProblem = microchipProblem(microchip);
    if (chipProblem) {
      setFormError(chipProblem);
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    let profileImageUrl = petImageUrl;
    if (selectedScanFile && !profileImageUrl) {
      setIsUploadingRegImage(true);
      try {
        const uploaded = await uploadAvatarImage(selectedScanFile);
        profileImageUrl = uploaded.url;
        setPetImageUrl(profileImageUrl);
      } catch {
        setFormError('We couldn’t upload your pet’s photo. Try saving again, or remove the photo in Meet your pet.');
        setIsSubmitting(false);
        return;
      } finally {
        setIsUploadingRegImage(false);
      }
    }

    const petPayload = {
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      gender: gender || null,
      date_of_birth: dob || null,
      weight: weight ? parseFloat(weight) : null,
      profile_image_url: profileImageUrl || null,
      microchip_number: cleanMicrochip(microchip) || null,
      category: resolveCategory(species, breed, category)
    };

    createMutation.mutate(petPayload, {
      onSettled: () => { setIsSubmitting(false); }
    });
  };

  if (!isKnowYourPetEnabled) {
    return (
      <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
        <Header activeTab="pets" onCartToggle={() => setIsCartOpen(true)} />
        <main className="flex-grow flex items-center justify-center py-16 px-4 md:px-8">
          <div className="max-w-md w-full bg-paperLight border border-cardboard p-8 text-center space-y-5 shadow-md rounded-[16px]">
            <div className="w-14 h-14 bg-paper border border-dashed border-cardboard rounded-[12px] flex items-center justify-center mx-auto">
              <Database className="w-7 h-7 text-turmeric" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-black text-2xl uppercase tracking-tight text-ink">
                Pet Ledger Unavailable
              </h2>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed">
                {knowYourPetFallback === 'coming_soon'
                  ? 'Our companion health passport & pet registry is launching soon. Check back shortly!'
                  : 'The companion pet ledger is temporarily undergoing maintenance.'}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate('/shop/app')}
                className="inline-flex items-center space-x-2 bg-turmeric text-ink font-mono text-[10px] uppercase font-bold px-5 py-2.5 rounded-[8px] hover:bg-opacity-90 transition-all cursor-pointer shadow-xs active:scale-98"
              >
                <span>Browse Recipes</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Top Header */}
      <Header activeTab="pets" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">

        {/* Back Link */}
        <div className="mb-6 text-left">
          <button
            onClick={() => navigate('/')}
            className="font-mono text-[10px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1.5 transition-opacity"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Home</span>
          </button>
        </div>

        {/* Section Header */}
        {activeSection === 'ledger' && <div className="space-y-1 text-left mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-display font-black text-2xl sm:text-4xl text-ink tracking-tight">
                Companion Pet Profiles
              </h1>
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
        </div>}

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
                            <h3 className="font-display font-black text-xl text-ink">{pet.name}</h3>
                            <span className="font-mono text-[10px] uppercase font-bold text-herb block tracking-wide flex items-center">
                              <Cpu className="w-3 h-3 mr-1 shrink-0" />
                              <span>{pet.microchip_number || 'Microchip not recorded'}</span>
                            </span>
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
                        {pet.species?.toLowerCase() === 'dog' && (pet.category || categoryForBreed(pet.breed)) && (
                          <div className="flex justify-between items-center py-1 border-b border-cardboard border-dashed border-opacity-30">
                            <span className="text-herb font-bold flex items-center">
                              <Award className="w-3.5 h-3.5 text-turmeric mr-2" />
                              <span>CATEGORY</span>
                            </span>
                            <span className="font-bold text-ink">{pet.category || categoryForBreed(pet.breed)}</span>
                          </div>
                        )}
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

        {activeSection === 'register' && (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) selectScanImage(file); else scanOnSelectionRef.current = false; e.target.value = ''; }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) selectScanImage(file); else scanOnSelectionRef.current = false; e.target.value = ''; }}
            />
            <AddPetWizard
              value={{ name, species, breed, category, gender, dob, weight, microchip }}
              onChange={(patch: Partial<PetDraft>) => {
                if (patch.name !== undefined) setName(patch.name);
                if (patch.species !== undefined) setSpecies(patch.species);
                if (patch.breed !== undefined) setBreed(patch.breed);
                if (patch.category !== undefined) setCategory(patch.category);
                if (patch.gender !== undefined) setGender(patch.gender);
                if (patch.dob !== undefined) setDob(patch.dob);
                if (patch.weight !== undefined) setWeight(patch.weight);
                if (patch.microchip !== undefined) setMicrochip(patch.microchip);
                setFormError('');
              }}
              step={registrationStep}
              onStepChange={setRegistrationStep}
              onCancel={() => setActiveSection('ledger')}
              photoUrl={previewScanUrl || petImageUrl || null}
              fileName={selectedScanFile?.name}
              knownBreeds={(pets || []).filter((pet) => pet.species.toLowerCase() === species.toLowerCase()).map((pet) => pet.breed || '')}
              canUpload={isPhotoUploadEnabled}
              isScanning={isClassifying}
              isUploading={isUploadingRegImage}
              isSaving={isSubmitting}
              scanResult={visionResult}
              scanError={visionError}
              saveError={formError}
              onUpload={() => { scanOnSelectionRef.current = false; galleryInputRef.current?.click(); }}
              onCamera={() => { scanOnSelectionRef.current = false; void startCamera('environment'); }}
              onSelectPhoto={(file) => { scanOnSelectionRef.current = false; selectScanImage(file); }}
              onRemovePhoto={resetScan}
              onScan={() => {
                if (selectedScanFile) void handleScanImage(selectedScanFile);
                else { scanOnSelectionRef.current = true; galleryInputRef.current?.click(); }
              }}
              onScanUpload={() => { scanOnSelectionRef.current = true; galleryInputRef.current?.click(); }}
              onScanCamera={() => { scanOnSelectionRef.current = true; void startCamera('environment'); }}
              onSave={handleAddPet}
            />
          </>
        )}

      </main>

      {/* Live Interactive Camera Viewfinder Modal */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-paperLight border border-cardboard rounded-sm overflow-hidden max-w-lg w-full shadow-2xl relative flex flex-col items-center">
            
            {/* Header */}
            <div className="w-full px-4 py-3 bg-paper flex items-center justify-between border-b border-cardboard">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-turmeric" />
                <span className="font-mono text-xs uppercase font-bold tracking-wider text-ink">
                  Companion Live Camera
                </span>
              </div>
              <button
                type="button"
                onClick={() => { scanOnSelectionRef.current = false; stopCamera(); }}
                aria-label="Close camera"
                className="w-7 h-7 rounded-sm border border-cardboard hover:bg-cardboard/30 flex items-center justify-center text-ink transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Live Video Viewfinder */}
            <div className="w-full bg-black relative aspect-[4/3] flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Pet Framing Guide Outline */}
              <div className="absolute inset-8 border border-dashed border-white/50 rounded-sm pointer-events-none flex items-center justify-center">
                <span className="font-mono text-[10px] text-white bg-black/60 px-2.5 py-1 rounded-sm uppercase tracking-wider">
                  Align Companion Inside Frame
                </span>
              </div>
            </div>

            {/* Camera Controls Bar */}
            <div className="w-full p-4 bg-paper flex items-center justify-around border-t border-cardboard">
              <button
                type="button"
                onClick={flipCamera}
                title="Switch Camera (Front/Rear)"
                className="w-10 h-10 rounded-sm border border-cardboard hover:bg-cardboard/30 text-ink flex items-center justify-center transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={capturePhoto}
                className="h-10 px-5 rounded-sm bg-paprika hover:bg-paprika/90 text-white font-mono text-xs uppercase font-bold tracking-wider shadow-xs active:scale-98 transition-all cursor-pointer flex items-center space-x-2"
              >
                <Camera className="w-4 h-4" />
                <span>Take Snapshot</span>
              </button>

              <button
                type="button"
                onClick={stopCamera}
                className="h-10 px-3 border border-cardboard hover:bg-cardboard/30 text-ink text-xs font-mono font-bold uppercase rounded-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-cardboard border-opacity-35 pb-3 gap-3">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">PATIENT FILE #{inspectingPet.id}</span>
                    <h3 className="font-display font-black text-2xl text-ink mt-0.5">
                      🐾 {inspectingPet.name}
                    </h3>
                  </div>

                  {/* Tabs */}
                  <div className="flex flex-wrap gap-1 bg-paperLight p-1 border border-cardboard border-opacity-40 rounded-sm font-mono text-[9px] uppercase">
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
                    {isVaccinationsEnabled && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('vaccinations')}
                        className={`px-3 py-1.5 font-bold rounded-xs transition-colors cursor-pointer ${
                          activeTab === 'vaccinations' ? 'bg-ink text-paper' : 'text-ink opacity-70 hover:opacity-100'
                        }`}
                      >
                        Vaccinations
                      </button>
                    )}
                  </div>
                </div>

                {activeTab === 'profile' ? (
                  <form onSubmit={handleUpdatePet} className="pet-edit-form">
                    {/* Avatar Upload */}
                    <div className="pet-edit-photo">
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
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Species</label>
                      <SpeciesDropdown
                        value={editSpecies}
                        onChange={(v) => { setEditSpecies(v); setEditCategory(null); }}
                        className="!h-auto !px-3 !py-2 !bg-paper !text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Breed</label>
                      <BreedInput
                        value={editBreed}
                        onChange={setEditBreed}
                        species={editSpecies}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>

                    <DogCategoryField
                      species={editSpecies}
                      breed={editBreed}
                      value={editCategory}
                      onChange={setEditCategory}
                      labelClass="font-mono text-[9px] uppercase font-bold text-paprika block"
                    />

                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Microchip number (optional)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={30}
                        value={editMicrochip}
                        onChange={(e) => setEditMicrochip(cleanMicrochip(e.target.value))}
                        placeholder="e.g. 985112345678901"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
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

                    <div className="pet-edit-pair grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                ) : activeTab === 'vaccinations' && isVaccinationsEnabled ? (
                  <VaccinationsPanel petId={inspectingPet.id} petName={inspectingPet.name} dob={inspectingPet.date_of_birth ?? null} />
                ) : (
                  /* Medical History & Logs */
                  <div className="pet-medical-logs space-y-3">
                    <span className="font-mono text-[9px] uppercase font-bold text-paprika block">📋 Patient Clinical Records</span>
                    {healthRecords.length === 0 ? (
                      <div className="border border-cardboard border-dashed border-opacity-35 p-8 text-center bg-paperLight rounded-sm">
                        <Activity className="w-8 h-8 text-cardboard mx-auto mb-2 stroke-1" />
                        <p className="font-body text-xs text-ink opacity-70">
                          No diagnostic checks or prescriptions recorded for {inspectingPet.name} yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {healthRecords.map((rec) => (
                          <div
                            key={rec.id}
                            onClick={() => setSelectedRecordId(rec.id)}
                            className="pet-medical-log border border-cardboard p-3 bg-paperLight hover:bg-paper cursor-pointer flex flex-wrap justify-between items-center gap-3 transition-colors"
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
                <form onSubmit={handleUpdateRecordSubmit} className="pet-record-edit space-y-3 font-body text-sm text-ink">
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
                <div className="pet-record-details space-y-3">
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

      {/* Mandatory vaccination history for an older pet that was just added */}
      {historyStep && (
        <VaccinationHistoryModal
          petId={historyStep.id}
          petName={historyStep.name}
          dob={historyStep.dob}
          items={historyStep.overview.items}
          dismissible={false}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['vaccinations', historyStep.id] });
            setHistoryStep(null);
            setShowSuccessOverlay(true);
          }}
        />
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

            {/* Next Actions: Register Another Pet vs View in Ledger */}
            <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessOverlay(false);
                  setActiveSection('register');
                }}
                className="flex-1 h-10 px-3 bg-herb hover:bg-herb/90 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-sm transition-colors shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <PawPrint className="w-3.5 h-3.5" />
                <span>+ Register Next Pet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSuccessOverlay(false);
                  setActiveSection('ledger');
                }}
                className="flex-1 h-10 px-3 border border-cardboard hover:bg-paperLight text-ink font-mono font-bold text-xs uppercase tracking-wider rounded-sm transition-colors shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>View Ledger &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
