import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatNaiveDateTime } from '../../utils/date';
import { fetchMyPets, fetchPetHealthRecords } from '../../api/pets';
import { useAuthStore } from '../../store/auth';
import { 
  fetchDoctors, fetchDoctorSlots, 
  fetchMyConsultations, cancelConsultation,
  fetchDoctorById, fetchDoctorAvailability, fetchNearbyDoctors,
  fetchConsultationById, createConsultationPaymentIntent,
  bookConsultationWithPayment
} from '../../api/consultations';

import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { 
  ArrowLeft, 
  Clock, Stethoscope, Loader2, AlertCircle, XCircle,
  Compass, Calendar as CalendarIcon, Star, Video,
  CheckCircle2, ShieldCheck, ChevronRight, CreditCard, Receipt
} from 'lucide-react';
import { submitDoctorReview } from '../../api/reviews';
import { loadRazorpaySDK } from '../../utils/razorpay';

const getDoctorAvatarUrl = (doc: any): string | null => {
  if (!doc) return null;
  return doc.profile_image_url || doc.user?.profile_image_url || null;
};

export const ConsultationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Payment states
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewConsultationId, setSelectedReviewConsultationId] = useState<number | null>(null);
  const [selectedReviewDoctorName, setSelectedReviewDoctorName] = useState<string>('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(false);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewConsultationId) return;
    setIsSubmittingReview(true);
    setReviewSubmitError(null);
    setReviewSubmitSuccess(false);

    try {
      await submitDoctorReview(selectedReviewConsultationId, {
        rating: reviewRating,
        comment: reviewComment || null,
      });
      setReviewSubmitSuccess(true);
      setTimeout(() => {
        setIsReviewModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['consultations'] });
      }, 1500);
    } catch (err: any) {
      setReviewSubmitError(err.response?.data?.detail || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Form State
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Delight overlay states
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [lastBookedSession, setLastBookedSession] = useState<{ doctorName: string; scheduledAt: string } | null>(null);

  // Tab & Booking Stepper States
  const [activeSection, setActiveSection] = useState<'directory' | 'sessions' | 'book'>('directory');
  const [bookingStep, setBookingStep] = useState<number>(1);
  const [isDirectBooking, setIsDirectBooking] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [selectedSpecializationFilter, setSelectedSpecializationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL');

  // Nearby Vets Finder States
  const [searchLat, setSearchLat] = useState<string>('');
  const [searchLng, setSearchLng] = useState<string>('');
  const searchRadius = 10;
  const [nearbyDocs, setNearbyDocs] = useState<any[]>([]);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Doctor Detail Modal States
  const [inspectingDoctorId, setInspectingDoctorId] = useState<number | null>(null);
  const [inspectingDoctor, setInspectingDoctor] = useState<any | null>(null);
  const [inspectingSchedule, setInspectingSchedule] = useState<any | null>(null);
  const [isLoadingInspecting, setIsLoadingInspecting] = useState(false);

  // Queries
  const { data: pets } = useQuery({
    queryKey: ['pets'],
    queryFn: fetchMyPets,
  });

  const { data: allDoctorsData } = useQuery({
    queryKey: ['allDoctors'],
    queryFn: () => fetchDoctors({ limit: 100 }),
  });

  const allDoctors = allDoctorsData?.items || [];
  const uniqueCities = Array.from(new Set(allDoctors.map(d => d.clinic?.city).filter(Boolean))) as string[];
  const uniqueSpecializations = Array.from(new Set(allDoctors.map(d => d.specialization).filter(Boolean))) as string[];

  const { data: doctorsData, isLoading: isDoctorsLoading } = useQuery({
    queryKey: ['doctors', searchQuery, selectedCityFilter, selectedSpecializationFilter],
    queryFn: () => fetchDoctors({
      search: searchQuery || undefined,
      city: selectedCityFilter || undefined,
      specialization: selectedSpecializationFilter || undefined,
    }),
  });

  const { data: consultationsData, isLoading: isConsultationsLoading } = useQuery({
    queryKey: ['consultations'],
    queryFn: () => fetchMyConsultations(),
  });

  const doctors = doctorsData?.items || [];
  const consultations = consultationsData?.items || [];

  const { id } = useParams<{ id?: string }>();
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);

  // Automatically open consultation details journal if loaded via /consultations/:id (e.g. from notification)
  useEffect(() => {
    if (id && !isNaN(Number(id))) {
      setSelectedConsultationId(Number(id));
      setActiveSection('sessions');
    }
  }, [id]);

  const { data: consultationDetails, isLoading: isConsultationDetailsLoading } = useQuery({
    queryKey: ['consultationDetails', selectedConsultationId],
    queryFn: () => fetchConsultationById(selectedConsultationId!),
    enabled: selectedConsultationId !== null,
  });

  const { data: petHealthHistory } = useQuery({
    queryKey: ['petHealthHistory', consultationDetails?.pet_id],
    queryFn: () => fetchPetHealthRecords(consultationDetails!.pet_id),
    enabled: !!consultationDetails?.pet_id,
  });

  const matchingHealthRecord = petHealthHistory?.records?.find(
    r => r.consultation_id === selectedConsultationId
  );

  // Fetch slots query (triggered when doctor AND date are chosen)
  const { data: slotsData, isLoading: isSlotsLoading } = useQuery({
    queryKey: ['slots', selectedDoctorId, targetDate],
    queryFn: () => fetchDoctorSlots(parseInt(selectedDoctorId), targetDate),
    enabled: !!selectedDoctorId && !!targetDate,
  });

  const getTodayLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFilteredAvailableSlots = () => {
    const rawSlots = slotsData?.slots || [];
    const todayStr = getTodayLocalDateString();
    
    if (targetDate !== todayStr) {
      return rawSlots;
    }
    
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    
    return rawSlots.filter((slot) => slot > currentTimeStr);
  };

  const availableSlots = getFilteredAvailableSlots();

  // Reset slot selection if doctor or date changes
  useEffect(() => {
    setSelectedSlot('');
  }, [selectedDoctorId, targetDate]);

  // Set default values when data loads
  useEffect(() => {
    if (pets && pets.length > 0 && !selectedPetId) {
      setSelectedPetId(pets[0].id.toString());
    }
  }, [pets, selectedPetId]);

  useEffect(() => {
    if (doctors && doctors.length > 0 && !selectedDoctorId) {
      setSelectedDoctorId(doctors[0].id.toString());
    }
  }, [doctors, selectedDoctorId]);

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: (consultationId: number) => cancelConsultation(consultationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
    },
    onError: (err) => {
      console.error('Cancellation failed:', err);
    }
  });

  // Locate user automatically
  const handleAutoLocate = () => {
    setSearchError('');

    const fallbackToIp = async () => {
      try {
        const res = await fetch('https://freeipapi.com/api/json');
        if (!res.ok) throw new Error('IP geolocation API returned error status');
        const data = await res.json();
        
        if (data.latitude !== undefined && data.longitude !== undefined) {
          setSearchLat(Number(data.latitude).toFixed(6));
          setSearchLng(Number(data.longitude).toFixed(6));
        } else {
          throw new Error('Coordinates not found in IP payload');
        }
      } catch (err: any) {
        console.error('IP Geolocation fallback failed:', err);
        setSearchError('Could not capture location automatically. Please input coordinates manually.');
      }
    };

    if (!navigator.geolocation) {
      fallbackToIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchLat(position.coords.latitude.toFixed(6));
        setSearchLng(position.coords.longitude.toFixed(6));
      },
      (error) => {
        console.warn('Browser Geolocation failed, attempting IP-based fallback...', error);
        fallbackToIp();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleIpLocate = async () => {
    setSearchError('');
    try {
      const res = await fetch('https://freeipapi.com/api/json');
      if (!res.ok) throw new Error('IP geolocation API returned error status');
      const data = await res.json();
      
      if (data.latitude !== undefined && data.longitude !== undefined) {
        setSearchLat(Number(data.latitude).toFixed(6));
        setSearchLng(Number(data.longitude).toFixed(6));
        setSearchError('🌐 Located approximately via IP Geolocation.');
      } else {
        throw new Error('Coordinates not found in IP payload');
      }
    } catch (err: any) {
      console.error('IP Geolocation failed:', err);
      setSearchError('Could not capture location via IP. Please input coordinates manually.');
    }
  };

  // Search Nearby Vets
  const handleSearchNearby = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setIsSearchingNearby(true);

    const lat = parseFloat(searchLat);
    const lng = parseFloat(searchLng);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setSearchError('Please enter a valid Latitude (-90 to 90).');
      setIsSearchingNearby(false);
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setSearchError('Please enter a valid Longitude (-180 to 180).');
      setIsSearchingNearby(false);
      return;
    }

    try {
      const data = await fetchNearbyDoctors(lat, lng, searchRadius);
      setNearbyDocs(data);
      if (data.length === 0) {
        setSearchError('No clinics or specialists found within the specified radius.');
      }
    } catch (err: any) {
      console.error('Nearby search failed:', err);
      setSearchError(err.response?.data?.detail || 'Nearby search failed.');
    } finally {
      setIsSearchingNearby(false);
    }
  };

  // Load details & schedule for selected inspecting doctor
  useEffect(() => {
    if (!inspectingDoctorId) {
      setInspectingDoctor(null);
      setInspectingSchedule(null);
      return;
    }

    const loadDoctorDetails = async () => {
      setIsLoadingInspecting(true);
      try {
        const [docData, scheduleData] = await Promise.all([
          fetchDoctorById(inspectingDoctorId),
          fetchDoctorAvailability(inspectingDoctorId)
        ]);
        setInspectingDoctor(docData);
        setInspectingSchedule(scheduleData);
      } catch (err) {
        console.error('Failed to load doctor details modal:', err);
        setInspectingDoctorId(null);
      } finally {
        setIsLoadingInspecting(false);
      }
    };

    loadDoctorDetails();
  }, [inspectingDoctorId]);

  const handleStartBooking = (doctorId: number) => {
    setSelectedDoctorId(doctorId.toString());
    setIsDirectBooking(true);
    setBookingStep(1);
    setActiveSection('book');
    setInspectingDoctorId(null);
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPetId) {
      setFormError('Please select a companion patient profile.');
      return;
    }
    if (!selectedDoctorId) {
      setFormError('Please select a veterinary specialist.');
      return;
    }
    if (!targetDate) {
      setFormError('Please select a consultation date.');
      return;
    }
    if (!selectedSlot) {
      setFormError('Please choose a time slot.');
      return;
    }
    if (reason.trim().length < 3) {
      setFormError('Please enter the reason for visit (minimum 3 characters).');
      return;
    }

    setBookingStep(5);
  };

  const handleInitiatePayment = async () => {
    setPaymentError(null);
    setIsPaying(true);

    const selectedDoc = doctors.find((d: any) => d.id.toString() === selectedDoctorId) || 
      allDoctors.find((d: any) => d.id.toString() === selectedDoctorId);

    const scheduledAt = `${targetDate}T${selectedSlot}:00`;

    try {
      const intent = await createConsultationPaymentIntent({
        pet_id: parseInt(selectedPetId),
        doctor_id: parseInt(selectedDoctorId),
        scheduled_at: scheduledAt,
      });

      if (intent.razorpay_order_id && intent.razorpay_key_id) {
        const options = {
          key: intent.razorpay_key_id,
          amount: Math.round(parseFloat(intent.amount) * 100),
          currency: intent.currency || 'INR',
          name: "Scooby's Kitchen",
          description: `Veterinary Consultation - Dr. ${selectedDoc?.user?.first_name || 'Specialist'}`,
          order_id: intent.razorpay_order_id,
          handler: async (response: any) => {
            try {
              const confirmedConsultation = await bookConsultationWithPayment({
                pet_id: parseInt(selectedPetId),
                doctor_id: parseInt(selectedDoctorId),
                scheduled_at: scheduledAt,
                reason,
                customer_notes: notes.trim() || null,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              queryClient.invalidateQueries({ queryKey: ['consultations'] });

              const docName = `Dr. ${selectedDoc?.user?.first_name || ''} ${selectedDoc?.user?.last_name || ''}`.trim();
              setLastBookedSession({
                doctorName: docName,
                scheduledAt: confirmedConsultation.scheduled_at,
              });
              setShowSuccessOverlay(true);
              setTimeout(() => {
                setShowSuccessOverlay(false);
                setActiveSection('sessions');
              }, 4000);

              setReason('');
              setNotes('');
              setSelectedSlot('');
              setFormError('');
              setSelectedDoctorId('');
              setSelectedPetId('');
              setIsDirectBooking(false);
              setBookingStep(1);
            } catch (err: any) {
              console.error('Paid booking verification error:', err);
              setPaymentError(err.response?.data?.detail || 'Payment verification failed. Please contact support.');
            } finally {
              setIsPaying(false);
            }
          },
          prefill: {
            name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Pet Parent',
            email: user?.email || '',
            contact: user?.phone || '',
          },
          theme: {
            color: '#D09E6B',
          },
          modal: {
            ondismiss: () => {
              setIsPaying(false);
              setPaymentError('Payment was not completed. Your consultation appointment has not been booked.');
            }
          }
        };

        const isLoaded = await loadRazorpaySDK();
        if (isLoaded && (window as any).Razorpay) {
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        } else {
          setIsPaying(false);
          setPaymentError('Razorpay checkout SDK failed to load. Please check your internet connection.');
        }
      } else {
        // Direct booking when Razorpay keys are not active in server config
        const confirmedConsultation = await bookConsultationWithPayment({
          pet_id: parseInt(selectedPetId),
          doctor_id: parseInt(selectedDoctorId),
          scheduled_at: scheduledAt,
          reason,
          customer_notes: notes.trim() || null,
        });

        queryClient.invalidateQueries({ queryKey: ['consultations'] });

        const docName = `Dr. ${selectedDoc?.user?.first_name || ''} ${selectedDoc?.user?.last_name || ''}`.trim();
        setLastBookedSession({
          doctorName: docName,
          scheduledAt: confirmedConsultation.scheduled_at,
        });
        setShowSuccessOverlay(true);
        setTimeout(() => {
          setShowSuccessOverlay(false);
          setActiveSection('sessions');
        }, 4000);

        setReason('');
        setNotes('');
        setSelectedSlot('');
        setFormError('');
        setSelectedDoctorId('');
        setSelectedPetId('');
        setIsDirectBooking(false);
        setBookingStep(1);
        setIsPaying(false);
      }
    } catch (err: any) {
      console.error('Payment intent failed:', err);
      setPaymentError(err.response?.data?.detail || 'Could not initiate consultation booking. Please check slot availability.');
      setIsPaying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'text-amber-800 bg-amber-50 border-amber-300';
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return 'text-emerald-800 bg-emerald-50 border-emerald-300';
      case 'COMPLETED':
        return 'text-sky-800 bg-sky-50 border-sky-300';
      case 'CANCELLED':
        return 'text-rose-800 bg-rose-50 border-rose-300';
      default:
        return 'text-ink bg-gray-50 border-gray-200';
    }
  };

  const filteredConsultations = consultations.filter((c: any) => {
    if (statusFilter === 'ALL') return true;
    return c.status.toUpperCase() === statusFilter;
  });

  const getCountForStatus = (status: 'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') => {
    if (status === 'ALL') return consultations.length;
    return consultations.filter((c: any) => c.status.toUpperCase() === status).length;
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Navigation Header */}
      <Header activeTab="consultations" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Container */}
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

        {/* Section Header Title */}
        <div className="space-y-1 text-left mb-8">
          <Eyebrow label="VETERINARY & CLINICAL CARE DESK" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-display font-black text-2xl sm:text-4xl text-ink tracking-tight">
                Veterinary Consultations
              </h1>
              <p className="font-body text-xs sm:text-sm text-ink opacity-75 max-w-2xl mt-1">
                Schedule one-on-one live video consultations with verified companion nutritionists and veterinary doctors.
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <span className="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-mono font-bold bg-herb/10 text-herb border border-herb/30">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                <span>100% Board Certified Vets</span>
              </span>
            </div>
          </div>
        </div>

        {/* Binder Tab Navigation Bar */}
        <div className="flex border-b border-cardboard border-opacity-35 mb-8 font-mono text-xs uppercase tracking-wider font-bold overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveSection('directory');
              setIsDirectBooking(false);
            }}
            className={`px-5 py-3.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSection === 'directory'
                ? 'border-turmeric text-ink bg-paperLight font-black shadow-xs'
                : 'border-transparent text-ink opacity-60 hover:opacity-100 hover:text-turmeric'
            }`}
          >
            <Stethoscope className="w-4 h-4 text-turmeric" />
            <span>Specialist Directory</span>
            <span className="text-[10px] bg-cardboard/30 px-1.5 py-0.5 rounded-sm font-mono">{doctors.length}</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveSection('sessions')}
            className={`px-5 py-3.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSection === 'sessions'
                ? 'border-turmeric text-ink bg-paperLight font-black shadow-xs'
                : 'border-transparent text-ink opacity-60 hover:opacity-100 hover:text-turmeric'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-turmeric" />
            <span>Session Ledger</span>
            <span className="text-[10px] bg-cardboard/30 px-1.5 py-0.5 rounded-sm font-mono">{consultations.length}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('book');
              setIsDirectBooking(false);
              setSelectedDoctorId('');
              setBookingStep(1);
            }}
            className={`px-5 py-3.5 border-b-2 transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSection === 'book'
                ? 'border-turmeric text-ink bg-paperLight font-black shadow-xs'
                : 'border-transparent text-ink opacity-60 hover:opacity-100 hover:text-turmeric'
            }`}
          >
            <Clock className="w-4 h-4 text-turmeric" />
            <span>Schedule Appointment</span>
          </button>
        </div>

        {/* 1. DIRECTORY SECTION */}
        {activeSection === 'directory' && (
          <div className="max-w-7xl mx-auto space-y-8 text-left animate-fade-in">
            
            {/* Search & Filter Toolbar */}
            <div className="bg-paperLight border border-cardboard border-opacity-40 p-5 rounded-sm shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Search Bar */}
              <div className="md:col-span-6 flex flex-col space-y-1.5">
                <label htmlFor="search-directory" className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wider">
                  Search Specialist:
                </label>
                <input
                  type="text"
                  id="search-directory"
                  placeholder="Search doctor by name, qualification, or clinic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-cardboard border-opacity-60 rounded-sm bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                />
              </div>

              {/* City Filter */}
              <div className="md:col-span-3 flex flex-col space-y-1.5">
                <label htmlFor="city-filter" className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wider">
                  Clinic City:
                </label>
                <select
                  id="city-filter"
                  value={selectedCityFilter}
                  onChange={(e) => setSelectedCityFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-cardboard border-opacity-60 rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors cursor-pointer"
                >
                  <option value="">All Cities ({uniqueCities.length})</option>
                  {uniqueCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Specialization Filter */}
              <div className="md:col-span-3 flex flex-col space-y-1.5">
                <label htmlFor="specialization-filter" className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wider">
                  Specialization:
                </label>
                <select
                  id="specialization-filter"
                  value={selectedSpecializationFilter}
                  onChange={(e) => setSelectedSpecializationFilter(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-cardboard border-opacity-60 rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors cursor-pointer"
                >
                  <option value="">All Specializations ({uniqueSpecializations.length})</option>
                  {uniqueSpecializations.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Grid */}
            {isDoctorsLoading ? (
              <div className="py-20 text-center space-y-4">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                <p className="font-mono text-[11px] uppercase tracking-wider text-herb font-bold animate-pulse">
                  Retrieving certified specialist ledger...
                </p>
              </div>
            ) : doctors.length === 0 ? (
              <div className="border border-cardboard border-dashed bg-paperLight p-12 rounded-sm text-center space-y-4">
                <Stethoscope className="w-12 h-12 text-cardboard mx-auto stroke-1" />
                <div>
                  <h4 className="font-display font-bold text-lg text-ink">No Specialists Matching Filters</h4>
                  <p className="font-body text-xs text-ink opacity-70 max-w-sm mx-auto mt-1">
                    Try clearing or expanding your city and specialization filters to view all verified veterinarians.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCityFilter('');
                    setSelectedSpecializationFilter('');
                  }}
                  className="bg-turmeric text-ink font-body font-bold text-xs uppercase px-5 py-2.5 rounded-sm tracking-wide hover-bounce cursor-pointer"
                >
                  Reset Filter Ledger
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doctors.map((d: any) => {
                  const doctorName = `Dr. ${d.user?.first_name || 'Specialist'} ${d.user?.last_name || ''}`.trim();
                  const doctorImg = getDoctorAvatarUrl(d);
                  return (
                    <div 
                      key={d.id} 
                      className="border border-cardboard border-opacity-40 bg-paperLight rounded-sm shadow-xs flex flex-col justify-between overflow-hidden relative group hover:border-turmeric transition-colors"
                    >
                      {/* Left vertical notebook spine motif */}
                      <div className="absolute left-1 top-0 bottom-0 border-l border-dashed border-cardboard opacity-30"></div>

                      <div className="p-6 pl-8 space-y-4 flex-grow">
                        {/* Top Doctor Avatar & Info Header */}
                        <div className="flex items-start space-x-4">
                          <div className="w-16 h-16 rounded-full bg-paper border-2 border-turmeric/60 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                            {doctorImg ? (
                              <img 
                                src={doctorImg} 
                                alt={doctorName} 
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="font-display font-black text-2xl text-turmeric">
                                {d.user?.first_name?.[0]?.toUpperCase() || 'D'}
                              </span>
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <span className="inline-block font-mono text-[9px] uppercase tracking-wider font-bold text-herb bg-herb/10 px-2 py-0.5 rounded-xs mb-1">
                              {d.specialization}
                            </span>
                            <h3 className="font-display font-black text-lg text-ink truncate">
                              {doctorName}
                            </h3>
                            <p className="font-mono text-[10px] text-ink opacity-75 truncate">
                              {d.qualification}
                            </p>
                          </div>
                        </div>

                        {/* Bio summary */}
                        <p className="font-body text-xs text-ink opacity-80 line-clamp-2 leading-relaxed">
                          {d.bio || 'Dedicated clinical nutritionist specializing in canine allergies, small-batch recovery diets, and digestive balance.'}
                        </p>

                        <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-center bg-paper/60 p-2.5 rounded-sm border border-cardboard/30">
                          <div>
                            <span className="text-[8.5px] uppercase text-ink opacity-60 block font-bold">Experience</span>
                            <span className="font-bold text-ink">{d.experience_years} Yrs</span>
                          </div>
                          <div>
                            <span className="text-[8.5px] uppercase text-ink opacity-60 block font-bold">Clinic City</span>
                            <span className="font-bold text-ink truncate block">{d.clinic?.city || 'Chennai'}</span>
                          </div>
                          <div>
                            <span className="text-[8.5px] uppercase text-ink opacity-60 block font-bold">Consult Fee</span>
                            <span className="font-bold text-herb">${parseFloat(d.consultation_fee).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="border-t border-cardboard border-opacity-35 p-3.5 pl-8 bg-paper/40 flex space-x-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setInspectingDoctorId(d.id)}
                          className="flex-1 border border-cardboard border-opacity-60 hover:bg-paper text-ink font-body font-bold text-xs uppercase py-2.5 rounded-sm tracking-wide text-center cursor-pointer transition-colors"
                        >
                          View Bio & Shifts
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartBooking(d.id)}
                          className="flex-1 bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs uppercase py-2.5 rounded-sm tracking-wide text-center cursor-pointer transition-colors shadow-xs"
                        >
                          Book Slot
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. SESSIONS SECTION */}
        {activeSection === 'sessions' && (
          <div className="max-w-7xl mx-auto space-y-6 text-left animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column (9 cols): Consultation Sessions List */}
              <div className="lg:col-span-9 space-y-6 order-2 lg:order-1">
                {isConsultationsLoading ? (
                  <div className="py-20 text-center space-y-4">
                    <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                    <p className="font-mono text-[11px] uppercase tracking-wider text-herb font-bold">
                      Reading consultation logs...
                    </p>
                  </div>
                ) : filteredConsultations.length === 0 ? (
                  <div className="border border-cardboard border-dashed bg-paperLight p-10 rounded-sm text-center space-y-4">
                    <Stethoscope className="w-12 h-12 text-cardboard mx-auto stroke-1" />
                    <div>
                      <h4 className="font-display font-bold text-lg text-ink">No Consultations Found</h4>
                      <p className="font-body text-xs text-ink opacity-70 max-w-sm mx-auto mt-1">
                        {statusFilter === 'ALL'
                          ? "You haven't scheduled any veterinary consultation sessions yet."
                          : `No sessions registered with status '${statusFilter}' at this time.`}
                      </p>
                    </div>
                    {statusFilter === 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setActiveSection('book')}
                        className="bg-herb hover:bg-herb/90 text-white font-mono text-[10px] uppercase font-bold py-2.5 px-6 rounded-sm tracking-wider transition-colors cursor-pointer"
                      >
                        Schedule First Appointment 🩺
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredConsultations.map((consult: any) => {
                      const docName = consult.doctor?.user?.first_name || consult.doctor?.user?.last_name
                        ? `Dr. ${consult.doctor.user.first_name || ''} ${consult.doctor.user.last_name || ''}`.trim()
                        : `Dr. ID #${consult.doctor_id}`;

                      return (
                        <div 
                          key={consult.id}
                          className="bg-paperLight border border-cardboard border-opacity-40 p-5 rounded-sm shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-turmeric transition-colors"
                        >
                          <div className="absolute top-0 bottom-0 left-2 border-l border-dashed border-cardboard opacity-30"></div>

                          <div className="space-y-4 pl-6 md:pl-8">
                            {/* Card Header */}
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-[9px] uppercase font-bold text-ink bg-cardboard/30 px-2 py-0.5 rounded-xs">
                                  LOG #{consult.id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedConsultationId(consult.id)}
                                  className="text-turmeric hover:underline font-mono text-[10px] font-bold"
                                >
                                  [inspect file]
                                </button>
                              </div>
                              <span className={`font-mono text-[10px] font-bold border px-2.5 py-0.5 rounded-sm uppercase tracking-wider ${getStatusColor(consult.status)}`}>
                                {consult.status}
                              </span>
                            </div>

                            {/* Details Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs border-y border-cardboard border-dashed py-3">
                              <div>
                                <span className="text-[9px] uppercase text-paprika font-bold block">Scheduled At</span>
                                <span className="font-bold text-ink">{formatNaiveDateTime(consult.scheduled_at).full}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-paprika font-bold block">Companion Patient</span>
                                <span className="font-bold text-ink">🐾 {consult.pet?.name || 'Pet'} ({consult.pet?.species || 'Canine'})</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-paprika font-bold block">Specialist</span>
                                <div className="flex items-center space-x-2 mt-0.5">
                                  <div className="w-6 h-6 rounded-full bg-paper border border-cardboard overflow-hidden flex items-center justify-center shrink-0">
                                    {getDoctorAvatarUrl(consult.doctor) ? (
                                      <img src={getDoctorAvatarUrl(consult.doctor)!} alt={docName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="font-mono font-bold text-[9px] text-turmeric">Dr</span>
                                    )}
                                  </div>
                                  <span className="font-bold text-ink truncate">{docName}</span>
                                </div>
                              </div>
                            </div>

                            {/* Reason for visit */}
                            <div>
                              <span className="font-mono text-[9px] uppercase text-paprika font-bold block">Reason For Consultation</span>
                              <p className="font-body text-xs text-ink opacity-85 mt-0.5">{consult.reason}</p>
                            </div>

                            {/* Doctor Clinical Notes */}
                            {consult.doctor_notes && (
                              <div className="bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                                <span className="font-mono text-[9px] uppercase text-herb font-bold block">Veterinary Clinical Assessment</span>
                                <p className="font-body text-xs text-ink opacity-90 italic mt-0.5">{consult.doctor_notes}</p>
                              </div>
                            )}
                          </div>

                          {/* Action Bar */}
                          <div className="mt-4 pt-3.5 border-t border-cardboard border-opacity-35 flex flex-wrap justify-end gap-2.5 pl-6">
                            {(consult.status.toUpperCase() === 'PENDING' || consult.status.toUpperCase() === 'CONFIRMED' || consult.status.toUpperCase() === 'IN_PROGRESS') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/consultations/${consult.id}/call`)}
                                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-body font-bold text-xs uppercase py-2.5 px-4 rounded-sm tracking-wider transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer animate-pulse"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>Join Video Call</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelMutation.mutate(consult.id)}
                                  disabled={cancelMutation.isPending}
                                  className="border border-cardboard hover:bg-paper text-ink font-body font-bold text-xs uppercase py-2.5 px-3.5 rounded-sm tracking-wider transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                                >
                                  {cancelMutation.isPending && cancelMutation.variables === consult.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>Cancel</span>
                                    </>
                                  )}
                                </button>
                              </>
                            )}

                            {consult.status.toUpperCase() === 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReviewConsultationId(consult.id);
                                  setSelectedReviewDoctorName(docName);
                                  setReviewRating(5);
                                  setReviewComment('');
                                  setReviewSubmitError(null);
                                  setReviewSubmitSuccess(false);
                                  setIsReviewModalOpen(true);
                                }}
                                className="bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs uppercase py-2.5 px-4 rounded-sm tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs hover-bounce"
                              >
                                <Star className="w-3.5 h-3.5 fill-ink text-ink" />
                                <span>Rate Vet Specialist</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column (3 cols): Status Filter Card */}
              <div className="lg:col-span-3 order-1 lg:order-2 w-full">
                <div className="bg-paperLight border border-cardboard border-opacity-40 p-5 rounded-sm shadow-xs space-y-4 text-left">
                  <div className="space-y-1">
                    <span className="font-mono text-[9px] uppercase font-bold text-paprika tracking-wider block">
                      Status Ledger
                    </span>
                    <h3 className="font-display font-black text-lg text-ink">
                      Filter Sessions
                    </h3>
                  </div>

                  <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                  <div className="space-y-1.5 font-mono text-xs uppercase font-bold">
                    {[
                      { id: 'ALL', label: 'All Sessions' },
                      { id: 'CONFIRMED', label: 'Confirmed' },
                      { id: 'PENDING', label: 'Pending' },
                      { id: 'COMPLETED', label: 'Completed' },
                      { id: 'CANCELLED', label: 'Cancelled' },
                    ].map((filter) => {
                      const isActive = statusFilter === filter.id;
                      const count = getCountForStatus(filter.id as any);
                      return (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => setStatusFilter(filter.id as any)}
                          className={`w-full flex justify-between items-center py-2 px-3 border rounded-sm transition-colors text-left cursor-pointer ${
                            isActive
                              ? 'bg-paper border-turmeric text-ink shadow-xs'
                              : 'bg-transparent border-transparent text-ink opacity-65 hover:opacity-100 hover:bg-paper'
                          }`}
                        >
                          <span className="flex items-center space-x-1.5">
                            {isActive ? <span>🐾</span> : <span className="w-3.5" />}
                            <span>{filter.label}</span>
                          </span>
                          <span className="bg-cardboard/30 text-ink font-mono text-[9px] px-1.5 py-0.5 rounded-xs">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 3. BOOKING SECTION */}
        {activeSection === 'book' && (
          <div className="max-w-2xl mx-auto space-y-6 text-left animate-fade-in">
            
            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-4 gap-2 bg-paperLight border border-cardboard border-opacity-40 p-3 rounded-sm font-mono text-[9px] text-center shadow-xs">
              <div className={`py-1.5 rounded-xs ${bookingStep >= 1 ? 'bg-herb/15 text-herb font-bold' : 'text-ink opacity-50'}`}>
                1. PATIENT
              </div>
              <div className={`py-1.5 rounded-xs ${(bookingStep >= 2 || (isDirectBooking && selectedDoctorId)) ? 'bg-herb/15 text-herb font-bold' : 'text-ink opacity-50'}`}>
                2. VET {isDirectBooking && selectedDoctorId ? '✓' : ''}
              </div>
              <div className={`py-1.5 rounded-xs ${bookingStep >= 3 ? 'bg-herb/15 text-herb font-bold' : 'text-ink opacity-50'}`}>
                3. SLOT
              </div>
              <div className={`py-1.5 rounded-xs ${bookingStep >= 4 ? 'bg-herb/15 text-herb font-bold' : 'text-ink opacity-50'}`}>
                4. REASON
              </div>
            </div>

            {/* Main Form Wizard Box */}
            <div className="bg-paperLight border border-cardboard border-opacity-40 p-6 md:p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
              
              {formError && (
                <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-sm font-body">
                  {formError}
                </div>
              )}

              {!pets || pets.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <AlertCircle className="w-8 h-8 text-turmeric mx-auto stroke-1" />
                  <div>
                    <h4 className="font-display font-bold text-base text-ink">No Pets Registered Yet</h4>
                    <p className="font-body text-xs text-ink opacity-75 max-w-xs mx-auto mt-1">
                      Please create a companion profile before scheduling a veterinary review.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/pets')}
                    className="bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs uppercase px-5 py-2.5 rounded-sm tracking-wider cursor-pointer"
                  >
                    Create Pet Profile 🐾
                  </button>
                </div>
              ) : (
                <div>
                  {/* STEP 1: Select Pet */}
                  {bookingStep === 1 && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="space-y-1">
                        <Eyebrow label="STEP 1 OF 5" />
                        <h3 className="font-display font-black text-xl text-ink">Choose Companion Patient</h3>
                        <p className="font-body text-xs text-ink opacity-70">
                          Select which pet this veterinary consultation is booked for:
                        </p>
                      </div>

                      {/* Doctor Confirmed Notice if Direct Booking */}
                      {isDirectBooking && selectedDoctorId && (() => {
                        const selectedDoc = doctors.find((d: any) => d.id.toString() === selectedDoctorId) || 
                          allDoctors.find((d: any) => d.id.toString() === selectedDoctorId);
                        if (!selectedDoc) return null;
                        const docImg = getDoctorAvatarUrl(selectedDoc);
                        const docName = `Dr. ${selectedDoc.user?.first_name || 'Specialist'} ${selectedDoc.user?.last_name || ''}`.trim();
                        return (
                          <div className="p-3 bg-paper border border-herb/40 rounded-sm flex items-center justify-between shadow-xs">
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-paperLight border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center shrink-0">
                                {docImg ? (
                                  <img src={docImg} alt={docName} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-bold text-turmeric text-xs">{selectedDoc.user?.first_name?.[0]?.toUpperCase() || 'D'}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide">Selected Specialist</span>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-herb" />
                                </div>
                                <span className="font-display font-bold text-xs text-ink block truncate">{docName} ({selectedDoc.specialization})</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsDirectBooking(false);
                                setBookingStep(2);
                              }}
                              className="font-mono text-[9px] uppercase font-bold text-herb hover:underline shrink-0 ml-2 cursor-pointer"
                            >
                              Change Vet
                            </button>
                          </div>
                        );
                      })()}

                      <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {pets.map((p) => {
                          const isSelected = selectedPetId === p.id.toString();
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPetId(p.id.toString());
                                if (isDirectBooking) {
                                  setBookingStep(3);
                                } else {
                                  setBookingStep(2);
                                }
                              }}
                              className={`p-4 border text-left rounded-sm transition-all cursor-pointer flex items-center space-x-3.5 ${
                                isSelected 
                                  ? 'bg-paper border-turmeric ring-1 ring-turmeric shadow-xs' 
                                  : 'bg-paperLight border-cardboard border-opacity-50 hover:border-turmeric'
                              }`}
                            >
                              <div className="w-12 h-12 rounded-full bg-paper border border-cardboard overflow-hidden flex items-center justify-center shrink-0">
                                {p.profile_image_url ? (
                                  <img src={p.profile_image_url} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xl">🐾</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-display font-bold text-ink block truncate">{p.name}</span>
                                <span className="font-mono text-[9px] uppercase tracking-wider text-paprika block truncate">
                                  {p.species} • {p.breed || 'Mixed'}
                                </span>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-herb shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Select Veterinarian */}
                  {bookingStep === 2 && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="space-y-1">
                        <Eyebrow label="STEP 2 OF 5" />
                        <h3 className="font-display font-black text-xl text-ink">Select Specialist</h3>
                        <p className="font-body text-xs text-ink opacity-70">
                          Choose a certified veterinarian or use the GPS locator tool:
                        </p>
                      </div>

                      <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                      {/* GPS Locator */}
                      <div className="border border-cardboard border-dashed p-4 rounded-sm bg-paper/50 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center">
                            <Compass className="w-3.5 h-3.5 mr-1.5 text-turmeric" />
                            <span>GPS Clinic Locator</span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <input
                            type="text"
                            placeholder="Latitude (e.g. 13.0827)"
                            value={searchLat}
                            onChange={(e) => setSearchLat(e.target.value)}
                            className="px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight text-ink text-xs focus:outline-none focus:border-turmeric"
                          />
                          <input
                            type="text"
                            placeholder="Longitude (e.g. 80.2707)"
                            value={searchLng}
                            onChange={(e) => setSearchLng(e.target.value)}
                            className="px-3 py-1.5 border border-cardboard rounded-sm bg-paperLight text-ink text-xs focus:outline-none focus:border-turmeric"
                          />
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={handleAutoLocate}
                            className="w-1/3 border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase py-2 font-bold rounded-sm flex items-center justify-center cursor-pointer"
                          >
                            GPS Detect
                          </button>
                          <button
                            type="button"
                            onClick={handleIpLocate}
                            className="w-1/3 border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase py-2 font-bold rounded-sm flex items-center justify-center cursor-pointer"
                          >
                            IP Detect
                          </button>
                          <button
                            type="button"
                            onClick={handleSearchNearby}
                            disabled={isSearchingNearby}
                            className="w-1/3 bg-turmeric text-ink font-mono text-[9px] uppercase py-2 font-bold rounded-sm flex items-center justify-center disabled:opacity-50 cursor-pointer"
                          >
                            {isSearchingNearby ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Search Nearby</span>}
                          </button>
                        </div>

                        {searchError && (
                          <div className="text-[10px] text-paprika bg-rose-50 p-2 rounded-sm font-body">
                            {searchError}
                          </div>
                        )}

                        {nearbyDocs.length > 0 && (
                          <div className="max-h-[160px] overflow-y-auto space-y-2 border-t border-cardboard border-dashed pt-2 pr-1 custom-scrollbar">
                            {nearbyDocs.map((doc) => {
                              const docImg = getDoctorAvatarUrl(doc);
                              return (
                                <div key={doc.id} className="flex justify-between items-center border border-cardboard border-opacity-40 p-2 bg-paperLight rounded-xs text-xs font-mono gap-2">
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-paper border border-cardboard overflow-hidden flex items-center justify-center shrink-0">
                                      {docImg ? (
                                        <img src={docImg} alt={doc.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="font-bold text-turmeric text-xs">{doc.name?.[0]?.toUpperCase() || 'D'}</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-bold text-ink block truncate">Dr. {doc.name}</span>
                                      <span className="text-[9px] opacity-60 italic">{doc.distance_km.toFixed(1)} km away</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDoctorId(doc.id.toString());
                                      setBookingStep(3);
                                    }}
                                    className="bg-herb text-white px-2.5 py-1 text-[9px] uppercase font-bold rounded-sm cursor-pointer border-0 shrink-0"
                                  >
                                    Select
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Doctor Select Cards */}
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                        {doctors.map((d: any) => {
                          const isSelected = selectedDoctorId === d.id.toString();
                          const doctorName = `Dr. ${d.user?.first_name || 'Specialist'} ${d.user?.last_name || ''}`.trim();
                          const doctorImg = getDoctorAvatarUrl(d);
                          
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setSelectedDoctorId(d.id.toString());
                                setBookingStep(3);
                              }}
                              className={`w-full p-3 border text-left rounded-sm transition-all cursor-pointer flex justify-between items-center gap-3 ${
                                isSelected 
                                  ? 'bg-paper border-turmeric ring-1 ring-turmeric shadow-xs' 
                                  : 'bg-paperLight border-cardboard border-opacity-50 hover:border-turmeric'
                              }`}
                            >
                              <div className="flex items-center space-x-3 min-w-0 pr-2">
                                <div className="w-10 h-10 rounded-full bg-paper border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                                  {doctorImg ? (
                                    <img src={doctorImg} alt={doctorName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-display font-black text-sm text-turmeric">
                                      {d.user?.first_name?.[0]?.toUpperCase() || 'D'}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-display font-bold text-xs sm:text-sm text-ink block truncate">{doctorName}</span>
                                  <span className="font-mono text-[9px] uppercase tracking-wider text-paprika block truncate">
                                    {d.specialization} • Exp: {d.experience_years} yrs • {d.clinic?.city || 'Chennai'}
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono text-[10px] font-bold text-herb bg-herb/10 border border-herb/30 px-2.5 py-1 rounded-sm shrink-0">
                                ${parseFloat(d.consultation_fee).toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Date & Slot Booking */}
                  {bookingStep === 3 && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="space-y-1">
                        <Eyebrow label="STEP 3 OF 5" />
                        <h3 className="font-display font-black text-xl text-ink">Select Date & Time</h3>
                        <p className="font-body text-xs text-ink opacity-70">
                          Pick an available time slot on your preferred consultation date:
                        </p>
                      </div>

                      {/* Selected Doctor Summary Card in Step 3 */}
                      {(() => {
                        const selectedDoc = doctors.find((d: any) => d.id.toString() === selectedDoctorId) || 
                          allDoctors.find((d: any) => d.id.toString() === selectedDoctorId);
                        if (!selectedDoc) return null;
                        const docImg = getDoctorAvatarUrl(selectedDoc);
                        const docName = `Dr. ${selectedDoc.user?.first_name || 'Specialist'} ${selectedDoc.user?.last_name || ''}`.trim();
                        return (
                          <div className="p-3 bg-paper border border-cardboard border-opacity-40 rounded-sm flex items-center justify-between">
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-paperLight border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center shrink-0">
                                {docImg ? (
                                  <img src={docImg} alt={docName} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-bold text-turmeric text-sm">{selectedDoc.user?.first_name?.[0]?.toUpperCase() || 'D'}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-display font-bold text-xs text-ink block truncate">{docName}</span>
                                <span className="font-mono text-[9px] text-paprika uppercase block truncate">
                                  {selectedDoc.specialization} • ${parseFloat(selectedDoc.consultation_fee).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsDirectBooking(false);
                                setBookingStep(2);
                              }}
                              className="font-mono text-[9px] uppercase font-bold text-herb hover:underline shrink-0 ml-2 cursor-pointer"
                            >
                              Change
                            </button>
                          </div>
                        );
                      })()}

                      <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                      <div className="space-y-1.5 text-left">
                        <label htmlFor="date" className="font-mono text-[10px] uppercase font-bold text-paprika block">
                          Consultation Date:
                        </label>
                        <input
                          type="date"
                          id="date"
                          value={targetDate}
                          min={getTodayLocalDateString()}
                          onChange={(e) => setTargetDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-cardboard border-opacity-60 rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors cursor-pointer"
                        />
                      </div>

                      {targetDate && (
                        <div className="space-y-2 text-left pt-2">
                          <span className="font-mono text-[10px] uppercase font-bold text-paprika block">
                            Available Time Slots:
                          </span>
                          
                          {isSlotsLoading ? (
                            <div className="text-center py-6">
                              <Loader2 className="w-6 h-6 text-turmeric animate-spin mx-auto" />
                              <span className="font-mono text-[10px] text-herb uppercase font-bold mt-1 block">Checking availability...</span>
                            </div>
                          ) : availableSlots.length === 0 ? (
                            <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-3.5 rounded-sm text-center">
                              No slots available on this date. Please pick another date.
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {availableSlots.map((slot: string) => {
                                const isSelected = selectedSlot === slot;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSlot(slot);
                                      setBookingStep(4);
                                    }}
                                    className={`py-2 px-3 border text-center font-mono text-xs font-bold rounded-sm transition-all cursor-pointer ${
                                      isSelected 
                                        ? 'bg-herb text-white border-herb shadow-xs' 
                                        : 'bg-paper border-cardboard border-opacity-60 text-ink hover:border-turmeric'
                                    }`}
                                  >
                                    {slot}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 4: Symptoms & Notes context */}
                  {bookingStep === 4 && (
                    <form onSubmit={handleProceedToPayment} className="space-y-4 animate-fade-in">
                      <div className="space-y-1">
                        <Eyebrow label="STEP 4 OF 5" />
                        <h3 className="font-display font-black text-xl text-ink">Clinical Reason & Notes</h3>
                        <p className="font-body text-xs text-ink opacity-70">
                          Provide medical context and dietary background for the doctor:
                        </p>
                      </div>

                      {/* Doctor & Patient Summary Banner in Step 4 */}
                      {(() => {
                        const selectedDoc = doctors.find((d: any) => d.id.toString() === selectedDoctorId) || 
                          allDoctors.find((d: any) => d.id.toString() === selectedDoctorId);
                        const selectedPet = pets?.find((p: any) => p.id.toString() === selectedPetId);
                        const docImg = getDoctorAvatarUrl(selectedDoc);
                        const docName = `Dr. ${selectedDoc?.user?.first_name || 'Specialist'} ${selectedDoc?.user?.last_name || ''}`.trim();
                        return (
                          <div className="grid grid-cols-2 gap-3 p-3 bg-paper border border-cardboard border-opacity-40 rounded-sm">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-paperLight border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center shrink-0">
                                {docImg ? (
                                  <img src={docImg} alt="Doctor" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-bold text-turmeric text-xs">Dr</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-mono text-[8px] uppercase text-herb font-bold block">Selected Vet</span>
                                <span className="font-display font-bold text-xs text-ink truncate block">
                                  {docName}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-paperLight border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center shrink-0">
                                {selectedPet?.profile_image_url ? (
                                  <img src={selectedPet.profile_image_url} alt={selectedPet.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm">🐾</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-mono text-[8px] uppercase text-paprika font-bold block">Patient</span>
                                <span className="font-display font-bold text-xs text-ink truncate block">
                                  {selectedPet?.name || 'Pet'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                      <div className="space-y-1.5 text-left">
                        <label htmlFor="reason" className="font-mono text-[10px] uppercase font-bold text-paprika block">
                          Reason for Consultation (required):
                        </label>
                        <input
                          type="text"
                          id="reason"
                          placeholder="e.g. Skin allergy, digestion review, custom meal plan transition"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-cardboard border-opacity-60 rounded-sm bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric transition-colors"
                          required
                        />
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label htmlFor="notes" className="font-mono text-[10px] uppercase font-bold text-paprika block">
                          Additional Context (optional):
                        </label>
                        <textarea
                          id="notes"
                          rows={3}
                          placeholder="Detail current food brands, stool consistency, appetite, or past medications..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-cardboard border-opacity-60 rounded-sm bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric transition-colors resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-turmeric hover:bg-turmeric/90 text-ink font-mono text-[11px] uppercase py-3.5 font-bold rounded-sm tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                      >
                        <span>Next: Review Invoice & Pay ➔</span>
                      </button>
                    </form>
                  )}

                  {/* STEP 5: Invoice Review & Strict Upfront Payment */}
                  {bookingStep === 5 && (
                    <div className="space-y-5 animate-fade-in text-left">
                      <div className="space-y-1">
                        <Eyebrow label="STEP 5 OF 5 — PAYMENT & INVOICE" />
                        <h3 className="font-display font-black text-xl text-ink">Invoice & Secure Payment</h3>
                        <p className="font-body text-xs text-ink opacity-70">
                          Review your consultation appointment invoice and complete payment to confirm your booking:
                        </p>
                      </div>

                      <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                      {/* Invoice Details Card */}
                      {(() => {
                        const selectedDoc = doctors.find((d: any) => d.id.toString() === selectedDoctorId) || 
                          allDoctors.find((d: any) => d.id.toString() === selectedDoctorId);
                        const selectedPet = pets?.find((p: any) => p.id.toString() === selectedPetId);
                        const docImg = getDoctorAvatarUrl(selectedDoc);
                        const docName = `Dr. ${selectedDoc?.user?.first_name || 'Specialist'} ${selectedDoc?.user?.last_name || ''}`.trim();
                        const fee = selectedDoc ? parseFloat(selectedDoc.consultation_fee) : 0;

                        return (
                          <div className="space-y-4">
                            {/* Summary Box */}
                            <div className="bg-paper p-4 border border-cardboard border-opacity-60 rounded-sm space-y-3 shadow-xs">
                              <div className="flex items-center justify-between border-b border-dashed border-cardboard border-opacity-40 pb-3">
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-11 h-11 rounded-full bg-paperLight border-2 border-turmeric/60 overflow-hidden flex items-center justify-center shrink-0">
                                    {docImg ? (
                                      <img src={docImg} alt={docName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="font-display font-black text-sm text-turmeric">Dr</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-display font-bold text-sm text-ink block truncate">{docName}</span>
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-paprika block truncate">
                                      {selectedDoc?.specialization} • {selectedDoc?.qualification}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-mono text-xs font-bold text-herb bg-herb/10 border border-herb/30 px-2.5 py-1 rounded-sm shrink-0">
                                  ${fee.toFixed(2)}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                                <div>
                                  <span className="text-[9px] uppercase text-paprika font-bold block">Patient Companion</span>
                                  <span className="font-bold text-ink">🐾 {selectedPet?.name || 'Pet'} ({selectedPet?.species || 'Canine'})</span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase text-paprika font-bold block">Scheduled Appointment</span>
                                  <span className="font-bold text-ink">{targetDate} • {selectedSlot}</span>
                                </div>
                              </div>

                              <div className="text-xs font-mono pt-1 border-t border-dashed border-cardboard border-opacity-40">
                                <span className="text-[9px] uppercase text-paprika font-bold block">Reason For Visit</span>
                                <p className="font-body text-xs text-ink opacity-85 mt-0.5">{reason}</p>
                                {notes && <p className="font-body text-[11px] text-ink opacity-65 italic mt-1">Note: {notes}</p>}
                              </div>
                            </div>

                            {/* Itemized Payment Table */}
                            <div className="bg-paperLight border border-cardboard border-opacity-50 rounded-sm p-4 space-y-2 font-mono text-xs">
                              <div className="flex justify-between items-center text-ink opacity-80">
                                <span>Veterinary Clinical Consultation (30 mins)</span>
                                <span>${fee.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center text-ink opacity-80">
                                <span>Encrypted Video Call & Digital Health File</span>
                                <span className="text-herb font-bold">FREE (Included)</span>
                              </div>
                              <div className="flex justify-between items-center text-ink opacity-80">
                                <span>Platform Service & Compliance</span>
                                <span className="text-herb font-bold">$0.00</span>
                              </div>
                              <div className="border-t border-cardboard border-dashed pt-2 mt-2 flex justify-between items-center font-bold text-sm text-ink">
                                <span className="uppercase text-paprika text-xs">Total Payable Amount:</span>
                                <span className="text-herb text-base">${fee.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Payment Error Alert */}
                            {paymentError && (
                              <div className="bg-rose-50 border border-rose-200 text-paprika p-3.5 rounded-sm text-xs font-body flex items-start space-x-2">
                                <AlertCircle className="w-4 h-4 text-paprika shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold block">Payment Incomplete</span>
                                  <span>{paymentError}</span>
                                </div>
                              </div>
                            )}

                            {/* Primary Pay Button */}
                            <button
                              type="button"
                              onClick={handleInitiatePayment}
                              disabled={isPaying}
                              className="w-full bg-herb hover:bg-herb/90 text-white font-mono text-[11px] uppercase py-3.5 font-bold rounded-sm tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 shadow-sm"
                            >
                              {isPaying ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  <span>Connecting to Payment Gateway...</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-4 h-4 mr-1.5" />
                                  <span>Pay ${fee.toFixed(2)} & Confirm Appointment 💳</span>
                                </>
                              )}
                            </button>

                            <p className="text-center font-mono text-[9px] text-ink opacity-60 uppercase tracking-wide">
                              🔒 256-Bit SSL Encrypted • Itemized receipt dispatched to your email automatically in the background
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Stepper Navigation Controls */}
                  <div className="flex justify-between items-center pt-6 border-t border-cardboard border-opacity-35 mt-6">
                    {bookingStep > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (bookingStep === 3 && isDirectBooking) {
                            setBookingStep(1);
                          } else {
                            setBookingStep(bookingStep - 1);
                          }
                        }}
                        className="border border-cardboard border-opacity-60 hover:bg-paper text-ink font-mono text-[9px] uppercase py-2 px-4 font-bold rounded-sm cursor-pointer"
                      >
                        Back
                      </button>
                    ) : <div />}

                    {bookingStep < 4 && (
                      <button
                        type="button"
                        disabled={
                          (bookingStep === 1 && !selectedPetId) ||
                          (bookingStep === 2 && !selectedDoctorId) ||
                          (bookingStep === 3 && (!targetDate || !selectedSlot))
                        }
                        onClick={() => {
                          if (bookingStep === 1 && isDirectBooking && selectedDoctorId) {
                            setBookingStep(3);
                          } else {
                            setBookingStep(bookingStep + 1);
                          }
                        }}
                        className="bg-ink hover:bg-ink/90 text-paper font-mono text-[9px] uppercase py-2 px-4 font-bold rounded-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                      >
                        <span>Next Step</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Doctor Bio & Schedule Drawer */}
      {inspectingDoctorId && (
        <div className="fixed inset-0 z-50 overflow-hidden font-body animate-fade-in">
          <div 
            onClick={() => setInspectingDoctorId(null)}
            className="absolute inset-0 bg-ink bg-opacity-40 backdrop-blur-xs transition-opacity"
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-paperLight border-l border-cardboard shadow-2xl flex flex-col justify-between relative animate-slide-in-right">
              
              <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-35"></div>

              {/* Header */}
              <div className="p-6 border-b border-cardboard border-opacity-40 flex justify-between items-center bg-paperLight pl-8">
                <div className="text-left space-y-1">
                  <Eyebrow label={`SPECIALIST PROFILE ID #${inspectingDoctorId}`} />
                  <h3 className="font-display font-black text-xl text-ink">
                    {isLoadingInspecting ? 'Loading Credentials...' : inspectingDoctor ? `Dr. ${inspectingDoctor.user?.first_name || ''} ${inspectingDoctor.user?.last_name || ''}` : 'Specialist Detail'}
                  </h3>
                </div>
                <button 
                  onClick={() => setInspectingDoctorId(null)}
                  className="p-1 hover:bg-paper rounded-full text-ink opacity-70 hover:opacity-100 transition-colors cursor-pointer border-none bg-transparent"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6 pl-8 text-left custom-scrollbar">
                {isLoadingInspecting ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-2 py-20">
                    <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
                    <span className="font-mono text-[10px] uppercase text-herb font-bold animate-pulse">Retrieving Credentials...</span>
                  </div>
                ) : inspectingDoctor ? (
                  <div className="space-y-5">
                    {/* Avatar */}
                    {(() => {
                      const modalDocImg = getDoctorAvatarUrl(inspectingDoctor);
                      return (
                        <div className="w-24 h-24 mx-auto rounded-full bg-paper border-2 border-turmeric overflow-hidden flex items-center justify-center shadow-xs">
                          {modalDocImg ? (
                            <img 
                              src={modalDocImg} 
                              alt={inspectingDoctor.user?.first_name} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-display font-black text-3xl text-turmeric">
                              {inspectingDoctor.user?.first_name?.[0]?.toUpperCase() || 'D'}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="text-center space-y-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold bg-herb/10 px-2.5 py-0.5 rounded-sm">
                        {inspectingDoctor.specialization}
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-3 bg-paper p-4 border border-cardboard border-opacity-40 rounded-sm font-mono text-[11px]">
                      <div>
                        <span className="text-[9px] uppercase text-paprika font-bold block">Qualifications</span>
                        <span className="text-ink font-bold">{inspectingDoctor.qualification}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-paprika font-bold block">Experience</span>
                        <span className="text-ink font-bold">{inspectingDoctor.experience_years} Years</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-paprika font-bold block">Consultation Fee</span>
                        <span className="text-herb font-bold">${parseFloat(inspectingDoctor.consultation_fee).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-paprika font-bold block">Clinic Mapping</span>
                        <span className="text-ink font-bold">{inspectingDoctor.clinic?.name || 'Private Practice'}</span>
                      </div>
                    </div>

                    {/* Bio */}
                    {inspectingDoctor.bio && (
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] uppercase font-bold text-paprika">Biography & Expertise</span>
                        <p className="text-ink opacity-85 leading-relaxed bg-paper p-3.5 border border-cardboard border-dashed rounded-sm text-xs">
                          {inspectingDoctor.bio}
                        </p>
                      </div>
                    )}

                    {/* Clinic Address */}
                    {inspectingDoctor.clinic && (
                      <div className="space-y-1 font-mono text-[10px]">
                        <span className="text-[10px] uppercase font-bold text-paprika block">Clinic Location</span>
                        <p className="font-body text-xs text-ink bg-paper p-3 border border-cardboard border-dashed rounded-sm">
                          {inspectingDoctor.clinic.address}, {inspectingDoctor.clinic.city}
                        </p>
                      </div>
                    )}

                    {/* Weekly Hours */}
                    <div className="space-y-2">
                      <span className="font-mono text-[10px] uppercase font-bold text-paprika block flex items-center">
                        <CalendarIcon className="w-3.5 h-3.5 mr-1 text-turmeric" />
                        <span>Weekly Consulting Hours</span>
                      </span>

                      {inspectingSchedule?.schedule && inspectingSchedule.schedule.length > 0 ? (
                        <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px]">
                          {inspectingSchedule.schedule.map((slot: any) => (
                            <div key={slot.id} className="border border-cardboard border-opacity-50 p-2 rounded-sm bg-paper flex justify-between items-center">
                              <span className="font-bold capitalize">{slot.day_of_week}</span>
                              <span className="opacity-80 font-bold">{slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-cardboard italic">No regular weekly shift planner registered.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-paprika">Failed to load doctor profile details.</p>
                )}
              </div>

              {/* Drawer Actions */}
              {inspectingDoctor && (
                <div className="p-6 bg-paperLight border-t border-cardboard border-opacity-40 pl-8 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleStartBooking(inspectingDoctor.id)}
                    className="w-full bg-herb hover:bg-herb/90 text-white font-body font-bold text-xs uppercase py-3 rounded-sm tracking-wider transition-colors shadow-sm cursor-pointer"
                  >
                    Book Appointment With Dr. {inspectingDoctor.user?.first_name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectingDoctorId(null)}
                    className="w-full border border-cardboard hover:bg-paper text-ink font-body font-bold text-xs uppercase py-2.5 rounded-sm tracking-wider transition-colors cursor-pointer"
                  >
                    Close Profile
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Consultation Details Modal */}
      {selectedConsultationId !== null && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in relative text-left">
            <button 
              onClick={() => setSelectedConsultationId(null)}
              className="absolute top-4 right-4 text-ink opacity-60 hover:opacity-100 font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1">
              <Eyebrow label="VETERINARY APPOINTMENT JOURNAL" />
              <h3 className="font-display font-black text-xl text-ink">
                Consultation File #{selectedConsultationId}
              </h3>
            </div>

            {isConsultationDetailsLoading ? (
              <div className="py-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-turmeric animate-spin mx-auto" />
                <span className="font-mono text-xs uppercase text-ink opacity-60">Retrieving Record...</span>
              </div>
            ) : !consultationDetails ? (
              <p className="font-body text-xs text-ink opacity-60">Failed to load consultation details.</p>
            ) : (
              <div className="space-y-4 text-xs font-body">
                {/* General Info */}
                <div className="p-4 border border-cardboard border-opacity-40 rounded-sm bg-paper space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">SCHEDULED TIME</span>
                      <span className="font-mono text-xs text-ink font-bold">{formatNaiveDateTime(consultationDetails.scheduled_at).full}</span>
                    </div>
                    <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 rounded-sm uppercase tracking-wider ${getStatusColor(consultationDetails.status)}`}>
                      {consultationDetails.status}
                    </span>
                  </div>
                  
                  <hr className="border-t border-cardboard border-dashed" />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-ink">
                    <div>
                      <span className="text-[9px] uppercase text-paprika font-bold block">Patient Companion</span>
                      <span className="font-bold">🐾 {consultationDetails.pet?.name || 'Pet'} ({consultationDetails.pet?.species})</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-paprika font-bold block">Specialist Vet</span>
                      <span className="font-bold">
                        {consultationDetails.doctor?.user?.first_name || consultationDetails.doctor?.user?.last_name 
                          ? `Dr. ${consultationDetails.doctor.user.first_name || ''} ${consultationDetails.doctor.user.last_name || ''}`.trim() 
                          : `Dr. ID #${consultationDetails.doctor_id}`} ({consultationDetails.doctor?.specialization || 'Vet'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reason & Notes */}
                <div className="space-y-2">
                  <div>
                    <span className="font-mono text-[9px] uppercase text-herb font-bold block">Reason for Inquiry</span>
                    <p className="font-body text-xs text-ink opacity-90">{consultationDetails.reason}</p>
                  </div>
                  {consultationDetails.customer_notes && (
                    <div>
                      <span className="font-mono text-[9px] uppercase text-herb font-bold block">Your Session Notes</span>
                      <p className="font-body text-xs text-ink opacity-75 italic">"{consultationDetails.customer_notes}"</p>
                    </div>
                  )}
                </div>

                {/* Clinical Notes & Health Record */}
                <div className="border-t border-cardboard border-dashed pt-3 space-y-3">
                  {consultationDetails.doctor_notes ? (
                    <div className="bg-paper p-3 border border-cardboard border-dashed rounded-sm space-y-1">
                      <span className="font-mono text-[9px] uppercase text-turmeric font-bold block">Veterinary Diagnosis & Notes</span>
                      <p className="font-body text-xs text-ink opacity-90 italic">"{consultationDetails.doctor_notes}"</p>
                    </div>
                  ) : (
                    <p className="font-body text-[10px] text-ink opacity-60 italic">Doctor has not added consultation notes yet.</p>
                  )}

                  {matchingHealthRecord && (
                    <div className="bg-emerald-50 p-3 border border-emerald-200 rounded-sm space-y-1.5 font-mono text-[10px]">
                      <span className="text-[8px] uppercase text-herb font-bold block">Prescription & Follow-up Plan</span>
                      {matchingHealthRecord.medications && (
                        <div><strong>Medications:</strong> {matchingHealthRecord.medications}</div>
                      )}
                      {matchingHealthRecord.treatment && (
                        <div><strong>Treatment:</strong> {matchingHealthRecord.treatment}</div>
                      )}
                      {matchingHealthRecord.follow_up_date && (
                        <div className="text-paprika font-bold">
                          📅 Follow-up Date: {new Date(matchingHealthRecord.follow_up_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {(consultationDetails.status.toUpperCase() === 'CONFIRMED' || consultationDetails.status.toUpperCase() === 'IN_PROGRESS') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedConsultationId(null);
                      navigate(`/consultations/${consultationDetails.id}/call`);
                    }}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-[10px] uppercase font-bold py-3 tracking-wider rounded-sm transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Enter Video Consultation</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedConsultationId(null)}
                  className="w-full bg-paper border border-cardboard hover:bg-paperLight text-ink font-mono text-[9px] uppercase font-bold py-2.5 tracking-wider rounded-sm transition-colors text-center cursor-pointer"
                >
                  Close Record
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Booking Delight Overlay */}
      {showSuccessOverlay && lastBookedSession && (
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-paperLight border border-cardboard p-8 rounded-sm shadow-2xl text-center space-y-6 relative overflow-hidden flex flex-col items-center">
            
            <div className="w-16 h-16 rounded-full bg-herb/15 text-herb border border-herb flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-herb font-bold block">
                PAYMENT VERIFIED & APPOINTMENT CONFIRMED
              </span>
              <h3 className="font-display font-black text-2xl text-ink">
                Session Booked! 🩺
              </h3>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed max-w-xs">
                Your consultation with <strong>Dr. {lastBookedSession.doctorName}</strong> is ledgered for <strong>{formatNaiveDateTime(lastBookedSession.scheduledAt).full}</strong>.
              </p>
              <div className="mt-3 p-2.5 bg-paper border border-cardboard border-dashed rounded-xs text-[10px] font-mono text-herb font-bold flex items-center justify-center space-x-1.5">
                <Receipt className="w-3.5 h-3.5 text-turmeric shrink-0" />
                <span>Invoice receipt dispatched to your email in background</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Vet Specialist Modal Overlay */}
      {isReviewModalOpen && selectedReviewConsultationId && (
        <div className="fixed inset-0 bg-ink bg-opacity-60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-paper border border-cardboard p-6 sm:p-8 rounded-sm shadow-2xl space-y-6 relative overflow-hidden text-left">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(false)}
              className="absolute top-4 right-4 z-10 text-ink opacity-60 hover:opacity-100 cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-herb font-bold block">
                SUBMIT PROFESSIONAL FEEDBACK
              </span>
              <h3 className="font-display font-black text-2xl text-ink">
                Rate {selectedReviewDoctorName}
              </h3>
              <p className="font-body text-xs text-ink opacity-70">
                Help pet parents in the Scooby's Kitchen community by rating your consultation experience.
              </p>
            </div>

            <hr className="border-t border-dashed border-cardboard border-opacity-40" />

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Your Star Rating</label>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= reviewRating
                            ? 'fill-[#00b67a] text-[#00b67a]'
                            : 'text-cardboard opacity-40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase font-bold text-paprika block">Consultation Feedback</label>
                <textarea
                  placeholder="How was the consultation? Did the doctor provide actionable nutritional or wellness guidance?"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  maxLength={1000}
                  rows={4}
                  className="w-full px-3.5 py-2.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric resize-none"
                  required
                />
              </div>

              {reviewSubmitError && (
                <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-sm font-body">
                  {reviewSubmitError}
                </div>
              )}

              {reviewSubmitSuccess && (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-sm font-body font-bold">
                  Thank you! Your review has been successfully submitted.
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="w-full bg-herb hover:bg-herb/90 text-white font-mono text-[10px] uppercase font-bold py-3.5 tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSubmittingReview ? 'Submitting...' : 'Submit Session Feedback'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
