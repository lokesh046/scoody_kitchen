import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { formatNaiveDateTime } from '../../utils/date';
import { fetchMyPets, fetchPetHealthRecords } from '../../api/pets';
import { fetchIpLocation, lookupPincode } from '../../api/geo';
import { API_BASE_URL } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import {
  fetchDoctors, fetchDoctorSlots,
  fetchMyConsultations, cancelConsultation,
  fetchDoctorById, fetchDoctorAvailability,
  fetchNearbyClinics, fetchClinicDetails, buildDirectionsUrl,
  type NearbyClinicResult, type PlaceDetailsResponse,
  fetchConsultationById, createConsultationPaymentIntent,
  bookConsultationWithPayment
} from '../../api/consultations';

import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { Map, MapMarker, MapControls, type MapRefHandle } from '../../components/ui/map';
import {
  ArrowLeft, ArrowRight,
  Clock, Stethoscope, Loader2, AlertCircle, XCircle,
  Compass, Calendar as CalendarIcon, Star, Video,
  CheckCircle2, ShieldCheck, ChevronRight, CreditCard, Receipt, MapPin, Navigation, Phone, Search
} from 'lucide-react';
import { submitDoctorReview } from '../../api/reviews';
import { loadRazorpaySDK } from '../../utils/razorpay';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const getDoctorAvatarUrl = (doc: any): string | null => {
  if (!doc) return null;
  return doc.profile_image_url || doc.user?.profile_image_url || null;
};

export const DoctorAvatar: React.FC<{
  src?: string | null;
  name?: string;
  className?: string;
  shape?: 'circle' | 'square';
  initialsClassName?: string;
}> = ({ 
  src, 
  name = 'Doctor', 
  className = 'w-16 h-16', 
  shape = 'circle',
  initialsClassName = 'font-display font-black text-2xl text-turmeric' 
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const cleanName = name.replace(/^Dr\.?\s*/i, '').trim();
  const initial = (cleanName[0] || name[0] || 'D').toUpperCase();
  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-sm';

  if (!src || hasError) {
    return (
      <div className={`${className} ${radiusClass} bg-paper border border-cardboard border-opacity-60 flex items-center justify-center shrink-0 shadow-2xs select-none`}>
        <span className={initialsClassName}>
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className} ${radiusClass} bg-paper border border-cardboard border-opacity-60 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs`}>
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
};

const getUpcomingAlternativeDates = (baseDateStr: string, count: number = 6) => {
  const dates: { dateStr: string; label: string; weekday: string; formatted: string }[] = [];
  
  let base: Date;
  if (baseDateStr) {
    const parts = baseDateStr.split('-');
    if (parts.length === 3) {
      base = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      base = new Date();
    }
  } else {
    base = new Date();
  }

  for (let i = 1; i <= count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = d.getDate();

    const label = i === 1 ? `Tomorrow (${weekday})` : `${weekday}`;
    dates.push({
      dateStr,
      label,
      weekday,
      formatted: `${monthName} ${dayNum}`,
    });
  }

  return dates;
};

const SuggestedDoctorCard: React.FC<{
  doctor: any;
  targetDate: string;
  slots: string[];
  isLoading: boolean;
  onSelectDoctor: (doctorId: number) => void;
  onSelectSlot: (doctorId: number, slot: string) => void;
}> = ({ doctor, targetDate: _targetDate, slots, isLoading, onSelectDoctor, onSelectSlot }) => {
  const docName = doctor.user?.first_name 
    ? `Dr. ${doctor.user.first_name} ${doctor.user.last_name || ''}`.trim()
    : `Dr. ${doctor.name || 'Practitioner'}`;
  const avatarUrl = getDoctorAvatarUrl(doctor);
  const hasSlots = slots.length > 0;

  return (
    <div className={`bg-paper border rounded-sm p-3.5 space-y-3 transition-all shadow-2xs text-left ${
      hasSlots ? 'border-herb/60 ring-1 ring-herb/25' : 'border-cardboard border-opacity-60 hover:border-turmeric'
    }`}>
      {/* Top Profile Header (Clickable anywhere on profile to switch doctor) */}
      <button
        type="button"
        onClick={() => onSelectDoctor(doctor.id)}
        className="w-full flex items-start justify-between gap-2.5 cursor-pointer text-left group p-1 -m-1 rounded-sm hover:bg-paperLight/80 transition-colors focus:outline-none"
        title={`Click to select ${docName}`}
      >
        <div className="flex items-center space-x-3 min-w-0">
          <DoctorAvatar
            src={avatarUrl}
            name={docName}
            className="w-12 h-12 group-hover:border-turmeric transition-colors"
            shape="square"
            initialsClassName="text-base font-display font-black text-turmeric"
          />
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-display font-bold text-xs sm:text-sm text-ink group-hover:text-paprika transition-colors block truncate">
                {docName}
              </span>
              {hasSlots ? (
                <span className="font-mono text-[8px] uppercase font-bold text-herb bg-herb/15 px-1.5 py-0.5 rounded-xs border border-herb/30 shrink-0">
                  {slots.length} Slots Open
                </span>
              ) : (
                <span className="font-mono text-[8px] uppercase font-bold text-herb bg-herb/10 px-1.5 py-0.5 rounded-xs border border-herb/25 shrink-0 group-hover:bg-paprika group-hover:text-white group-hover:border-paprika transition-colors">
                  Select Vet
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1.5 text-ink/70 text-[10px] font-mono uppercase mt-0.5">
              <span>{doctor.specialization || 'Veterinarian'}</span>
              {doctor.experience_years ? <span>• {doctor.experience_years}y exp</span> : null}
            </div>
            {doctor.clinic?.city && (
              <div className="flex items-center space-x-1 text-herb text-[10px] font-mono uppercase mt-0.5">
                <Compass className="w-3 h-3 text-herb shrink-0" />
                <span className="truncate">{doctor.clinic.name ? `${doctor.clinic.name}, ` : ''}{doctor.clinic.city}</span>
              </div>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="font-mono text-xs font-bold text-paprika block">
            ₹{parseFloat(doctor.consultation_fee || '0').toFixed(2)}
          </span>
          {Number(doctor.average_rating) > 0 && (
            <span className="font-mono text-[9px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm inline-flex items-center space-x-0.5 mt-0.5">
              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
              <span>{Number(doctor.average_rating).toFixed(1)}</span>
            </span>
          )}
        </div>
      </button>

      {/* Available Slots Row for this Suggested Doctor */}
      <div className="pt-2 border-t border-dashed border-cardboard border-opacity-40">
        {isLoading ? (
          <div className="flex items-center space-x-2 text-ink/50 text-[10px] font-mono py-1">
            <Loader2 className="w-3 h-3 animate-spin text-turmeric" />
            <span>Checking availability for {docName}...</span>
          </div>
        ) : hasSlots ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-herb font-bold uppercase flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span>{slots.length} Slots Open on this date</span>
              </span>
              <button
                type="button"
                onClick={() => onSelectDoctor(doctor.id)}
                className="text-paprika font-bold hover:underline cursor-pointer uppercase flex items-center space-x-1"
              >
                <span>Select Doctor</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {slots.slice(0, 5).map((slot: string) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onSelectSlot(doctor.id, slot)}
                  className="py-1 px-2.5 bg-paperLight hover:bg-herb hover:text-white border border-cardboard text-ink font-mono text-[11px] font-bold rounded-sm transition-colors cursor-pointer shadow-2xs active:scale-95"
                  title={`Book ${slot} with ${docName}`}
                >
                  {slot}
                </button>
              ))}
              {slots.length > 5 && (
                <button
                  type="button"
                  onClick={() => onSelectDoctor(doctor.id)}
                  className="py-1 px-2 bg-paperLight hover:bg-cardboard/30 border border-cardboard text-ink/70 font-mono text-[10px] font-bold rounded-sm transition-colors cursor-pointer"
                >
                  +{slots.length - 5} more
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-ink/50 uppercase">No slots on this date</span>
            <button
              type="button"
              onClick={() => onSelectDoctor(doctor.id)}
              className="font-bold text-paprika hover:underline cursor-pointer uppercase flex items-center space-x-1"
            >
              <span>Switch to this Doctor</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SuggestedDoctorsList: React.FC<{
  doctors: any[];
  targetDate: string;
  onSelectDoctor: (doctorId: number) => void;
  onSelectSlot: (doctorId: number, slot: string) => void;
}> = ({ doctors, targetDate, onSelectDoctor, onSelectSlot }) => {
  const todayStr = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const queries = useQueries({
    queries: doctors.map((doc) => ({
      queryKey: ['suggestedDoctorSlots', doc.id, targetDate],
      queryFn: () => fetchDoctorSlots(doc.id, targetDate),
      staleTime: 30 * 1000,
    })),
  });

  // Sort: Doctors with open slots (> 0) ALWAYS appear first
  const sortedDoctors = useMemo(() => {
    const items = doctors.map((doc, idx) => {
      const q = queries[idx];
      const rawSlots = q?.data?.slots || [];
      const slots = targetDate === todayStr 
        ? rawSlots.filter((slot: string) => {
            const now = new Date();
            const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            return slot > curTime;
          })
        : rawSlots;

      return {
        doctor: doc,
        slots,
        isLoading: q?.isLoading || false,
      };
    });

    return [...items].sort((a, b) => {
      const aHas = a.slots.length > 0 ? 1 : 0;
      const bHas = b.slots.length > 0 ? 1 : 0;
      if (bHas !== aHas) {
        return bHas - aHas; // Doctors with available slots FIRST
      }
      return b.slots.length - a.slots.length; // More slots first
    });
  }, [doctors, queries, targetDate, todayStr]);

  if (doctors.length === 0) {
    return (
      <div className="p-4 bg-paper/40 border border-dashed border-cardboard rounded-sm text-center text-xs font-mono text-ink/60">
        No other doctors currently listed in this specific area.
      </div>
    );
  }

  // Strictly show top 4 profiles so even with 100+ doctors the UI remains fast, compact, and uncluttered
  const displayedDoctors = sortedDoctors.slice(0, 4);

  return (
    <div className="space-y-2.5 pt-1">
      {displayedDoctors.map(({ doctor, slots, isLoading }) => (
        <SuggestedDoctorCard
          key={doctor.id}
          doctor={doctor}
          targetDate={targetDate}
          slots={slots}
          isLoading={isLoading}
          onSelectDoctor={onSelectDoctor}
          onSelectSlot={onSelectSlot}
        />
      ))}
      {doctors.length > 4 && (
        <div className="text-center pt-1 border-t border-dashed border-cardboard border-opacity-30">
          <span className="font-mono text-[9px] text-ink/60 uppercase">
            Showing top 4 specialists prioritized by availability
          </span>
        </div>
      )}
    </div>
  );
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
  
  // Platform Feature Flags
  const isAltDoctorsEnabled = useFeatureFlag('consultations_suggest_alternative_doctors', true);
  const isBookingEnabled = useFeatureFlag('consultations_booking', true);
  const isGpsEnabled = useFeatureFlag('consultations_gps_locator', true);
  const isReviewsEnabled = useFeatureFlag('consultations_reviews', true);
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

  // Specialist Directory has two discovery modes — browsing our own vet
  // ledger (search/filter grid) or finding vets near a location (registered
  // + Google clinics). Kept as separate views behind a toggle rather than
  // stacked, so neither one crowds out the other.
  const [directoryView, setDirectoryView] = useState<'browse' | 'nearby'>('browse');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [selectedSpecializationFilter, setSelectedSpecializationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL');

  // Nearby Vets Finder States ("Vets Near Me" — registered vets merged
  // with real-world clinics from Google Places)
  const mapRef = useRef<MapRefHandle | null>(null);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number }>({ lat: 13.0827, lng: 80.2707 });
  const [pincodeQuery, setPincodeQuery] = useState('');
  const [isPincodeSearching, setIsPincodeSearching] = useState(false);
  const [searchRadius, setSearchRadius] = useState<2 | 5 | 10>(5);
  const [nearbyClinics, setNearbyClinics] = useState<NearbyClinicResult[]>([]);
  const [nearbyRadiusUsed, setNearbyRadiusUsed] = useState<number | null>(null);
  const [nearbyFallback, setNearbyFallback] = useState(false);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearchedNearby, setHasSearchedNearby] = useState(false);
  const [nearbyResultsPage, setNearbyResultsPage] = useState(1);
  const [showManualLocationControls, setShowManualLocationControls] = useState(false);
  // Lazy details for Google-sourced clinics — fetched only when a clinic
  // card is opened in the side drawer, cached by place_id so reopening
  // doesn't re-fetch.
  const [clinicDetailsCache, setClinicDetailsCache] = useState<Record<string, PlaceDetailsResponse>>({});
  const [inspectingClinic, setInspectingClinic] = useState<NearbyClinicResult | null>(null);
  const [isLoadingClinicDetails, setIsLoadingClinicDetails] = useState(false);

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

  const currentSelectedDoc = doctors.find((d: any) => d.id.toString() === selectedDoctorId) || 
    allDoctors.find((d: any) => d.id.toString() === selectedDoctorId);
  const currentDocName = currentSelectedDoc 
    ? `Dr. ${currentSelectedDoc.user?.first_name || 'Specialist'} ${currentSelectedDoc.user?.last_name || ''}`.trim()
    : 'Practitioner';

  const getAlternativeDoctors = () => {
    if (!currentSelectedDoc) return [];
    const currentCity = currentSelectedDoc.clinic?.city?.toLowerCase()?.trim();
    const currentSpec = currentSelectedDoc.specialization?.toLowerCase()?.trim();

    // 1. Same city doctors (excluding currently selected doctor)
    const sameCity = allDoctors.filter((d: any) => 
      d.id.toString() !== selectedDoctorId &&
      d.clinic?.city &&
      d.clinic.city.toLowerCase().trim() === currentCity
    );

    // 2. Same specialization doctors (not already in sameCity)
    const sameSpec = allDoctors.filter((d: any) => 
      d.id.toString() !== selectedDoctorId &&
      d.specialization &&
      d.specialization.toLowerCase().trim() === currentSpec &&
      !sameCity.some((sc: any) => sc.id === d.id)
    );

    // 3. Other verified doctors across platform
    const others = allDoctors.filter((d: any) => 
      d.id.toString() !== selectedDoctorId &&
      !sameCity.some((sc: any) => sc.id === d.id) &&
      !sameSpec.some((ss: any) => ss.id === d.id)
    );

    // Candidate pool limited to top 8 to check slots in parallel, UI displays strictly top 4
    return [...sameCity, ...sameSpec, ...others].slice(0, 8);
  };

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

  // Core "Vets Near Me" search — merges registered vets with real-world
  // clinics from Google Places (see /doctors/nearby-clinics). Shared by
  // both the one-click "Find Vets Near Me" flow and the manual
  // radius/coordinate controls, so there's exactly one place that knows
  // how to call the endpoint.
  const runNearbySearch = async (lat: number, lng: number, radius: 2 | 5 | 10) => {
    setIsSearchingNearby(true);
    setHasSearchedNearby(true);
    setInspectingClinic(null);
    setNearbyResultsPage(1);
    try {
      const data = await fetchNearbyClinics(lat, lng, radius);
      setNearbyClinics(data.results);
      setNearbyRadiusUsed(data.radius_km_used);
      setNearbyFallback(data.fallback_to_registered_only);
      if (data.results.length === 0) {
        setSearchError('No clinics or specialists found within the specified radius.');
      }
    } catch (err: any) {
      console.error('Nearby search failed:', err);
      setSearchError(err.response?.data?.detail || 'Nearby search failed.');
    } finally {
      setIsSearchingNearby(false);
    }
  };

  // Moves the map picker's pin (used by drag, click, "Locate Me", and
  // pincode search alike) so there's exactly one place that keeps the map
  // view and the marker position in sync.
  const updateMapPin = (lat: number, lng: number) => {
    setMapCoords({ lat, lng });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 800 });
  };

  // The main "Find Vets Near Me" action — detects location (GPS, falling
  // back to IP) and immediately searches with it, in one click, rather
  // than making the user detect location and then separately press search.
  const handleFindVetsNearMe = () => {
    setSearchError('');

    const fallbackToIp = async () => {
      try {
        const data = await fetchIpLocation();
        if (data.latitude === undefined || data.longitude === undefined) {
          throw new Error('Coordinates not found in IP payload');
        }
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        setMapCoords({ lat, lng });
        setSearchError('🌐 Located approximately via secure IP Geolocation.');
        await runNearbySearch(lat, lng, searchRadius);
      } catch (err: any) {
        console.error('IP Geolocation fallback failed:', err);
        setSearchError('Could not capture location automatically. Please pick a location on the map below.');
      }
    };

    if (!navigator.geolocation) {
      fallbackToIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setMapCoords({ lat, lng });
        runNearbySearch(lat, lng, searchRadius);
      },
      (error) => {
        console.warn('Browser Geolocation failed, attempting IP-based fallback...', error);
        fallbackToIp();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // "Search this location" — runs the nearby search from wherever the map
  // pin currently sits (after a drag, a map click, "Locate Me", or a
  // pincode search below).
  const handleSearchThisLocation = async () => {
    setSearchError('');
    await runNearbySearch(mapCoords.lat, mapCoords.lng, searchRadius);
  };

  // Pincode/zip search for the map picker — moves the pin to the looked-up
  // location and searches it immediately, mirroring Checkout's own pincode
  // lookup pattern for consistency across the app.
  const handlePincodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincodeQuery.trim()) {
      setSearchError('Please enter a Pincode / Zip Code to search.');
      return;
    }

    setIsPincodeSearching(true);
    setSearchError('');
    try {
      const results = await lookupPincode(pincodeQuery);
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        updateMapPin(lat, lng);
        await runNearbySearch(lat, lng, searchRadius);
      } else {
        setSearchError('Pincode / Zip Code not found. Try dragging the pin instead.');
      }
    } catch (err) {
      console.error('Pincode lookup failed:', err);
      setSearchError('Failed to search that pincode.');
    } finally {
      setIsPincodeSearching(false);
    }
  };

  // Opens the clinic side drawer (same slide-in pattern as the doctor "View
  // Bio & Shifts" drawer). Google clinics need a lazy Details fetch for
  // phone/hours/photo — only called once per place_id, then cached.
  const handleOpenClinicDrawer = async (clinic: NearbyClinicResult) => {
    setInspectingClinic(clinic);
    if (!clinic.place_id || clinicDetailsCache[clinic.place_id]) return;

    setIsLoadingClinicDetails(true);
    try {
      const details = await fetchClinicDetails(clinic.place_id);
      setClinicDetailsCache((prev) => ({ ...prev, [clinic.place_id!]: details }));
    } catch (err) {
      console.error('Failed to load clinic details:', err);
    } finally {
      setIsLoadingClinicDetails(false);
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

  // Vets Near Me — a real, visible section shown right at the top of the
  // Specialist Directory (the page's default landing view), not buried
  // inside the booking wizard where it's easy to never see at all.
  const vetsNearMeSection = isGpsEnabled && (
    <div className="border border-cardboard rounded-md bg-paperLight overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-cardboard">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-turmeric/15 flex items-center justify-center shrink-0">
            <Compass className="w-3.5 h-3.5 text-turmeric" />
          </span>
          <span className="font-mono text-[11px] uppercase font-bold text-turmeric tracking-wide">Vets Near Me</span>
        </div>
        {hasSearchedNearby && nearbyClinics.length > 0 && (
          <span className="font-mono text-[9px] uppercase font-bold text-herb bg-herb/10 border border-herb/30 px-2 py-0.5 rounded-sm shrink-0">
            {nearbyClinics.length} found
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
      <button
        type="button"
        onClick={handleFindVetsNearMe}
        disabled={isSearchingNearby}
        className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase py-3 font-bold rounded-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-colors"
      >
        {isSearchingNearby ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <MapPin className="w-4 h-4" />
            <span>Find Vets Near Me</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => setShowManualLocationControls((v) => !v)}
        className="w-full text-center font-mono text-[9px] uppercase font-bold text-ink/50 hover:text-ink/80 cursor-pointer"
      >
        {showManualLocationControls ? 'Hide manual search' : 'Search a different location'}
      </button>

      {showManualLocationControls && (
        <div className="space-y-2.5 pt-1 border-t border-dashed border-cardboard border-opacity-40">
          <form onSubmit={handlePincodeSearch} className="flex gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-ink/35 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Pincode / Zip Code"
                value={pincodeQuery}
                onChange={(e) => setPincodeQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-cardboard rounded-sm bg-paperLight text-ink text-xs focus:outline-none focus:border-turmeric"
              />
            </div>
            <button
              type="submit"
              disabled={isPincodeSearching}
              className="px-4 py-1.5 border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase font-bold rounded-sm disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isPincodeSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
            </button>
          </form>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] uppercase font-bold text-ink/40">
              Drag the pin, click the map, or use Locate Me
            </span>
            <span className="font-mono text-[8px] text-ink/40">
              [{mapCoords.lat.toFixed(4)}, {mapCoords.lng.toFixed(4)}]
            </span>
          </div>

          <div
            className="h-56 w-full border border-cardboard rounded-md relative overflow-hidden bg-paper"
            style={{ zIndex: 1 }}
          >
            <Map
              ref={mapRef}
              center={[mapCoords.lng, mapCoords.lat]}
              zoom={13}
              className="w-full h-full min-h-[220px]"
              onClick={(coords) => setMapCoords({ lat: coords.lat, lng: coords.lng })}
            >
              <MapControls
                position="top-right"
                showZoom={true}
                showCompass={false}
                showGeolocate={true}
                isLocating={isSearchingNearby}
                onGeolocate={(coords) => setMapCoords({ lat: coords.latitude, lng: coords.longitude })}
              />
              <MapMarker
                position={[mapCoords.lng, mapCoords.lat]}
                draggable={true}
                onDragEnd={(coords) => setMapCoords({ lat: coords.lat, lng: coords.lng })}
              >
                <div className="flex flex-col items-center cursor-grab active:cursor-grabbing -translate-y-1/2">
                  <MapPin className="w-7 h-7 text-turmeric fill-turmeric/20 drop-shadow-md" />
                </div>
              </MapMarker>
            </Map>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase font-bold text-ink/50 shrink-0">Radius:</span>
            {([2, 5, 10] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSearchRadius(preset)}
                className={`px-2.5 py-1 font-mono text-[9px] uppercase font-bold rounded-sm border cursor-pointer transition-colors ${
                  searchRadius === preset
                    ? 'bg-turmeric border-turmeric text-ink'
                    : 'border-cardboard text-ink/70 hover:bg-paper'
                }`}
              >
                {preset} km
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSearchThisLocation}
            disabled={isSearchingNearby}
            className="w-full bg-turmeric text-ink font-mono text-[9px] uppercase py-2 font-bold rounded-sm flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            {isSearchingNearby ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Search This Location</span>}
          </button>
        </div>
      )}

      {searchError && (
        <div className="text-[10px] text-paprika bg-rose-50 p-2 rounded-sm font-body">
          {searchError}
        </div>
      )}

      {hasSearchedNearby && nearbyClinics.length > 0 && (() => {
        const NEARBY_PAGE_SIZE = 6;
        const totalPages = Math.ceil(nearbyClinics.length / NEARBY_PAGE_SIZE) || 1;
        const page = Math.min(nearbyResultsPage, totalPages);
        const pagedClinics = nearbyClinics.slice((page - 1) * NEARBY_PAGE_SIZE, page * NEARBY_PAGE_SIZE);

        return (
        <div className="space-y-2 pt-1">
          <span className="font-mono text-[9px] uppercase font-bold text-ink/50">
            {nearbyClinics.length} found within {nearbyRadiusUsed ?? searchRadius} km
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pagedClinics.map((clinic, idx) => {
              const key = clinic.source === 'registered' ? `reg-${clinic.doctor_id}` : `google-${clinic.place_id}`;
              const isGoogle = clinic.source === 'google';

              return (
                <button
                  key={key || idx}
                  type="button"
                  onClick={() =>
                    isGoogle
                      ? handleOpenClinicDrawer(clinic)
                      : clinic.doctor_id && setSelectedDoctorId(clinic.doctor_id.toString())
                  }
                  className="text-left border border-cardboard rounded-md bg-paperLight p-3 hover:border-turmeric transition-colors cursor-pointer flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-body text-[13px] font-bold text-ink truncate">
                          {clinic.name || clinic.clinic_name || 'Unnamed clinic'}
                        </span>
                        <span
                          className={`font-mono text-[7.5px] uppercase font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${
                            clinic.source === 'registered'
                              ? 'bg-herb/15 text-herb'
                              : 'bg-ink/10 text-ink/60'
                          }`}
                        >
                          {clinic.source === 'registered' ? 'Registered' : 'Google'}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-ink/50 shrink-0 pt-0.5">
                      {clinic.distance_km.toFixed(1)} km
                    </span>
                  </div>

                  <p className="font-body text-[11px] text-ink/60 line-clamp-2">
                    {clinic.address || clinic.specialization || ''}
                  </p>

                  {clinic.phone && (
                    <p className="flex items-center gap-1.5 text-[11px] font-body text-ink/70">
                      <Phone className="w-3 h-3 text-herb shrink-0" />
                      {clinic.phone}
                    </p>
                  )}

                  {clinic.opening_hours && clinic.opening_hours.length > 0 && (
                    <p className="flex items-center gap-1.5 text-[11px] font-body text-ink/70">
                      <Clock className="w-3 h-3 text-herb shrink-0" />
                      <span className="truncate">{clinic.opening_hours[0]}</span>
                    </p>
                  )}

                  {isGoogle && (
                    <span className="mt-auto pt-1 font-mono text-[8px] uppercase font-bold text-turmeric">
                      View details →
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-cardboard border-dashed pt-3 mt-1">
              <button
                type="button"
                onClick={() => setNearbyResultsPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="bg-paper border border-cardboard text-ink px-3 py-1.5 text-[9px] font-mono font-bold uppercase rounded-sm hover:bg-paperLight disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                ← Previous
              </button>
              <span className="font-mono text-[9px] text-ink uppercase opacity-75">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setNearbyResultsPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page === totalPages}
                className="bg-paper border border-cardboard text-ink px-3 py-1.5 text-[9px] font-mono font-bold uppercase rounded-sm hover:bg-paperLight disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next →
              </button>
            </div>
          )}

          {nearbyClinics.some((c) => c.source === 'google') && (
            <p className="font-mono text-[8px] text-ink/35 text-right pt-1">Powered by Google</p>
          )}
        </div>
        );
      })()}

      {hasSearchedNearby && nearbyFallback && (
        <div className="p-2.5 bg-turmeric/10 border border-turmeric border-opacity-40 rounded-sm text-[10px] font-body text-ink/80">
          No nearby clinics found. Consider{' '}
          <button
            type="button"
            onClick={() => setActiveSection('book')}
            className="text-herb underline font-bold cursor-pointer"
          >
            booking an online consultation
          </button>{' '}
          instead.
        </div>
      )}
      </div>
    </div>
  );

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

            {isGpsEnabled && (
              <div className="inline-flex border border-cardboard rounded-md overflow-hidden bg-paperLight">
                <button
                  type="button"
                  onClick={() => setDirectoryView('browse')}
                  className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wide cursor-pointer transition-colors ${
                    directoryView === 'browse' ? 'bg-turmeric text-ink' : 'text-ink/50 hover:bg-paper'
                  }`}
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  Browse Our Vets
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryView('nearby')}
                  className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wide cursor-pointer transition-colors border-l border-cardboard ${
                    directoryView === 'nearby' ? 'bg-turmeric text-ink' : 'text-ink/50 hover:bg-paper'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Vets Near Me
                </button>
              </div>
            )}

            {directoryView === 'nearby' && vetsNearMeSection}

            {directoryView === 'browse' && (
              <>
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
                          <DoctorAvatar
                            src={doctorImg}
                            name={doctorName}
                            className="w-16 h-16"
                            shape="circle"
                            initialsClassName="font-display font-black text-2xl text-turmeric"
                          />
                          
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
                            <span className="font-bold text-herb">₹{parseFloat(d.consultation_fee).toFixed(2)}</span>
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
              </>
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
                                    <DoctorAvatar
                                      src={getDoctorAvatarUrl(consult.doctor)}
                                      name={docName}
                                      className="w-6 h-6"
                                      shape="circle"
                                      initialsClassName="font-mono font-bold text-[9px] text-turmeric"
                                    />
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

                            {isReviewsEnabled && consult.status === 'COMPLETED' && (
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
          <div className={`mx-auto space-y-6 text-left animate-fade-in transition-all ${bookingStep === 3 ? 'max-w-5xl' : 'max-w-2xl'}`}>
            
            {/* 5-Step Architectural Ledger Stepper */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 bg-paperLight border border-cardboard border-opacity-40 p-2 sm:p-2.5 rounded-sm font-mono text-[9px] text-center shadow-xs">
              {[
                { step: 1, label: '1. PATIENT', complete: !!selectedPetId },
                { step: 2, label: '2. SPECIALIST', complete: !!selectedDoctorId },
                { step: 3, label: '3. SCHEDULE', complete: !!(targetDate && selectedSlot) },
                { step: 4, label: '4. SYMPTOMS', complete: !!reason.trim() },
                { step: 5, label: '5. CONFIRM & PAY', complete: false },
              ].map((item) => {
                const isCurrent = bookingStep === item.step;
                const isPast = bookingStep > item.step;
                const canClick = isPast || (item.step === 2 && isDirectBooking);

                return (
                  <button
                    key={item.step}
                    type="button"
                    disabled={!canClick && !isCurrent}
                    onClick={() => {
                      if (canClick) {
                        setBookingStep(item.step);
                      }
                    }}
                    className={`py-2 px-1.5 rounded-xs transition-all flex items-center justify-center space-x-1 ${
                      isCurrent 
                        ? 'bg-turmeric text-ink font-bold shadow-2xs' 
                        : isPast 
                          ? 'bg-herb/15 text-herb font-bold hover:bg-herb/25 cursor-pointer' 
                          : 'text-ink/40 cursor-default'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isPast && <CheckCircle2 className="w-2.5 h-2.5 text-herb shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Main Form Wizard Box */}
            <div className="bg-paperLight border border-cardboard border-opacity-40 p-6 md:p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
              
              {formError && (
                <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-sm font-body">
                  {formError}
                </div>
              )}

              {!isBookingEnabled ? (
                <div className="text-center py-8 space-y-4">
                  <AlertCircle className="w-8 h-8 text-turmeric mx-auto stroke-1" />
                  <div>
                    <h4 className="font-display font-bold text-base text-ink">Online Bookings Paused</h4>
                    <p className="font-body text-xs text-ink opacity-75 max-w-sm mx-auto mt-1">
                      Online appointment bookings are currently paused by administrator. You can still explore verified veterinarians in the directory below.
                    </p>
                  </div>
                </div>
              ) : !pets || pets.length === 0 ? (
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
                        <Eyebrow label="STEP 1 OF 5 // COMPANION IDENTIFIER" />
                        <h3 className="font-display font-black text-xl text-ink">Choose Companion Patient</h3>
                        <p className="font-body text-xs text-ink opacity-70">
                          Select which pet this veterinary consultation dossier is scheduled for:
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
                              <DoctorAvatar
                                src={docImg}
                                name={docName}
                                className="w-9 h-9"
                                shape="square"
                                initialsClassName="font-bold text-turmeric text-xs"
                              />
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
                                  ? 'bg-paper border-herb ring-1 ring-herb/40 shadow-xs' 
                                  : 'bg-paperLight border-cardboard border-opacity-50 hover:border-turmeric'
                              }`}
                            >
                              <div className="w-12 h-12 rounded-sm bg-paper border border-cardboard overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                                {p.profile_image_url ? (
                                  <img 
                                    src={p.profile_image_url} 
                                    alt={p.name} 
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <span className="text-xl">🐾</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-display font-bold text-ink block truncate">{p.name}</span>
                                  {isSelected && (
                                    <span className="font-mono text-[8px] uppercase font-bold text-herb bg-herb/15 px-1.5 py-0.2 rounded-xs border border-herb/30">
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[9px] uppercase tracking-wider text-paprika block truncate">
                                  {p.species} • {p.breed || 'Mixed Breed'}
                                </span>
                                {p.weight && (
                                  <span className="font-mono text-[8.5px] text-ink/60 block">
                                    Weight: {p.weight} kg
                                  </span>
                                )}
                              </div>
                              {isSelected ? (
                                <CheckCircle2 className="w-5 h-5 text-herb shrink-0" />
                              ) : (
                                <span className="font-mono text-[9px] uppercase text-ink/40 font-bold">Select ➔</span>
                              )}
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
                        <Eyebrow label="STEP 2 OF 5 // PRACTITIONER ROSTER" />
                        <h3 className="font-display font-black text-xl text-ink">Select Specialist</h3>
                        <p className="font-body text-xs text-ink opacity-70">
                          Choose a certified practitioner or search by doctor name / specialization:
                        </p>
                      </div>

                      {/* Search Bar for Doctors */}
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Search vet by name, specialty, or clinic city..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-3.5 py-2 border border-cardboard border-opacity-60 rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="px-3 py-1.5 text-[10px] font-mono uppercase font-bold text-paprika border border-cardboard rounded-sm hover:bg-paper cursor-pointer shrink-0"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Doctor Select Cards */}
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                        {doctors.length === 0 ? (
                          <div className="p-6 bg-paper/40 border border-dashed border-cardboard rounded-sm text-center font-mono text-xs text-ink/60 space-y-1">
                            <span>No specialists found matching your search.</span>
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="text-herb underline font-bold block mx-auto text-[10px] cursor-pointer"
                            >
                              Clear search query
                            </button>
                          </div>
                        ) : (
                          doctors.map((d: any) => {
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
                                className={`w-full p-3.5 border text-left rounded-sm transition-all cursor-pointer flex justify-between items-center gap-3 ${
                                  isSelected 
                                    ? 'bg-paper border-herb ring-1 ring-herb/40 shadow-xs' 
                                    : 'bg-paperLight border-cardboard border-opacity-50 hover:border-turmeric'
                                }`}
                              >
                                <div className="flex items-center space-x-3 min-w-0 pr-2">
                                  <DoctorAvatar
                                    src={doctorImg}
                                    name={doctorName}
                                    className="w-12 h-12"
                                    shape="square"
                                    initialsClassName="font-display font-black text-sm text-turmeric"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-display font-bold text-xs sm:text-sm text-ink block truncate">{doctorName}</span>
                                      {Number(d.average_rating) > 0 && (
                                        <span className="font-mono text-[9px] text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded-xs inline-flex items-center space-x-0.5">
                                          <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                          <span>{Number(d.average_rating).toFixed(1)}</span>
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-paprika block truncate">
                                      {d.specialization} • Exp: {d.experience_years} yrs • {d.clinic?.city || 'Chennai'}
                                    </span>
                                    {d.qualification && (
                                      <span className="font-mono text-[8.5px] text-ink/60 block truncate">
                                        {d.qualification}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono text-xs font-bold text-herb bg-herb/10 border border-herb/30 px-2.5 py-1 rounded-sm block">
                                    ₹{parseFloat(d.consultation_fee).toFixed(2)}
                                  </span>
                                  <span className="font-mono text-[8.5px] uppercase font-bold text-paprika mt-1 block">
                                    Select Vet ➔
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Date & Slot Booking (HORIZONTAL WORKSPACE) */}
                  {bookingStep === 3 && (
                    <div className="space-y-5 animate-fade-in text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cardboard border-opacity-40 pb-3">
                        <div>
                          <Eyebrow label="STEP 3 OF 5 // CLINICAL SCHEDULE" />
                          <h3 className="font-display font-black text-xl sm:text-2xl text-ink">
                            Select Consultation Date & Time
                          </h3>
                        </div>
                        <span className="font-mono text-[10px] text-herb uppercase font-bold bg-herb/10 border border-herb/30 px-2.5 py-1 rounded-sm self-start sm:self-auto">
                          In-Person & Telehealth
                        </span>
                      </div>

                      {/* Top Horizontal Row: Selected Doctor (Left) + Consultation Date Input (Right) */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-paper p-3.5 sm:p-4 rounded-sm border border-cardboard border-opacity-60 shadow-2xs">
                        {/* Doctor Info (Left 7 cols) */}
                        <div className="md:col-span-7 flex items-center justify-between gap-3 pr-2">
                          <div className="flex items-center space-x-3 min-w-0">
                            <DoctorAvatar
                              src={getDoctorAvatarUrl(currentSelectedDoc)}
                              name={currentDocName}
                              className="w-12 h-12"
                              shape="square"
                              initialsClassName="font-display font-black text-base text-turmeric"
                            />
                            <div className="min-w-0">
                              <span className="font-mono text-[9px] uppercase font-bold text-herb block">Attending Practitioner</span>
                              <span className="font-display font-bold text-sm sm:text-base text-ink block truncate">{currentDocName}</span>
                              <span className="font-mono text-[10px] text-paprika uppercase block truncate">
                                {currentSelectedDoc?.specialization} • ₹{parseFloat(currentSelectedDoc?.consultation_fee || '0').toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDirectBooking(false);
                              setBookingStep(2);
                            }}
                            className="font-mono text-[10px] uppercase font-bold text-herb hover:text-paprika underline underline-offset-2 shrink-0 cursor-pointer"
                          >
                            Change Doctor
                          </button>
                        </div>

                        {/* Date Picker Input (Right 5 cols) */}
                        <div className="md:col-span-5 md:border-l md:border-cardboard md:border-dashed md:border-opacity-40 md:pl-4 space-y-1">
                          <label htmlFor="date" className="font-mono text-[10px] uppercase font-bold text-paprika flex items-center justify-between">
                            <span>Consultation Date:</span>
                            <span className="text-ink/60">{formatDisplayDate(targetDate)}</span>
                          </label>
                          <input
                            type="date"
                            id="date"
                            value={targetDate}
                            min={getTodayLocalDateString()}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="w-full px-3 py-2 border border-cardboard border-opacity-60 rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Main Slots / Recovery View */}
                      {targetDate && (
                        <div className="space-y-4 pt-1">
                          {isSlotsLoading ? (
                            <div className="text-center py-10 bg-paper/30 border border-cardboard border-opacity-40 rounded-sm">
                              <Loader2 className="w-7 h-7 text-turmeric animate-spin mx-auto" />
                              <span className="font-mono text-xs text-herb uppercase font-bold mt-2 block">
                                Checking appointment windows in RAM...
                              </span>
                            </div>
                          ) : availableSlots.length === 0 ? (
                            /* HORIZONTAL RECOVERY WORKSPACE (No Slots Available) */
                            <div className="space-y-4 animate-fade-in">
                              {/* Full-Width Notice Banner */}
                              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-sm text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center space-x-2.5">
                                  <AlertCircle className="w-5 h-5 text-paprika shrink-0" />
                                  <div>
                                    <span className="font-bold font-mono uppercase text-[11px] text-paprika block">
                                      No Consultation Slots on {formatDisplayDate(targetDate)}
                                    </span>
                                    <span className="font-body text-xs text-ink/80">
                                      All consultation windows for <strong>{currentDocName}</strong> are booked or closed on this date.
                                    </span>
                                  </div>
                                </div>
                                <div className="font-mono text-[10px] bg-paper px-2.5 py-1 rounded-sm border border-cardboard text-herb uppercase font-bold shrink-0 self-start sm:self-auto">
                                  {isAltDoctorsEnabled ? '2 Options Side-by-Side Below ➔' : 'Upcoming Dates Below ➔'}
                                </div>
                              </div>

                              {/* HORIZONTAL COLUMNS (Feature Gated) */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                                
                                {/* LEFT HORIZONTAL BLOCK: Next Available Dates for This Doctor */}
                                <div className={`${isAltDoctorsEnabled ? 'md:col-span-6' : 'md:col-span-12'} bg-paperLight border border-cardboard border-opacity-60 p-4 sm:p-5 rounded-sm shadow-xs space-y-4 relative overflow-hidden flex flex-col justify-between`}>
                                  {/* Left dashed notebook spine */}
                                  <div className="absolute top-0 bottom-0 left-2 border-l border-dashed border-cardboard border-opacity-35"></div>

                                  <div className="pl-2.5 space-y-3">
                                    <div className="flex items-center justify-between border-b border-cardboard border-opacity-40 pb-2.5">
                                      <div>
                                        <span className="font-mono text-[9px] uppercase font-bold text-paprika block">
                                          OPTION 1 // SAME SPECIALIST
                                        </span>
                                        <h4 className="font-display font-black text-sm sm:text-base text-ink flex items-center gap-1.5 mt-0.5">
                                          <CalendarIcon className="w-4 h-4 text-turmeric shrink-0" />
                                          <span>Upcoming Dates for {currentDocName}</span>
                                        </h4>
                                      </div>
                                      <span className="font-mono text-[9px] bg-paper border border-cardboard px-2 py-0.5 rounded-sm text-herb uppercase font-bold shrink-0">
                                        6 Dates
                                      </span>
                                    </div>

                                    <p className="font-body text-xs text-ink/75">
                                      Want to consult with <strong>{currentDocName}</strong>? Tap an upcoming date to immediately load open slots:
                                    </p>

                                    {/* 6 Clean Date Selection Tiles */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                                      {getUpcomingAlternativeDates(targetDate, 6).map((alt) => (
                                        <button
                                          key={alt.dateStr}
                                          type="button"
                                          onClick={() => setTargetDate(alt.dateStr)}
                                          className="p-2.5 border border-cardboard hover:border-turmeric hover:bg-paper rounded-sm text-left transition-all cursor-pointer group shadow-2xs hover:shadow-xs active:scale-98"
                                        >
                                          <span className="font-mono text-[9px] uppercase font-bold text-herb block group-hover:text-paprika transition-colors truncate">
                                            {alt.label}
                                          </span>
                                          <span className="font-display font-black text-sm text-ink block mt-0.5">
                                            {alt.formatted}
                                          </span>
                                          <span className="font-mono text-[9px] text-ink/45 group-hover:text-paprika mt-1 block">
                                            Check Slots ➔
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* RIGHT HORIZONTAL BLOCK: Alternative Doctors in the Area Today (Feature Gated) */}
                                {isAltDoctorsEnabled && (
                                  <div className="md:col-span-6 bg-paperLight border border-cardboard border-opacity-60 p-4 sm:p-5 rounded-sm shadow-xs space-y-3 relative overflow-hidden flex flex-col justify-between">
                                    {/* Left dashed notebook spine */}
                                    <div className="absolute top-0 bottom-0 left-2 border-l border-dashed border-cardboard border-opacity-35"></div>

                                    <div className="pl-2.5 space-y-3">
                                      <div className="flex items-center justify-between border-b border-cardboard border-opacity-40 pb-2.5">
                                        <div>
                                          <span className="font-mono text-[9px] uppercase font-bold text-herb block">
                                            OPTION 2 // SAME-DAY CARE
                                          </span>
                                          <h4 className="font-display font-black text-sm sm:text-base text-ink flex items-center gap-1.5 mt-0.5">
                                            <Stethoscope className="w-4 h-4 text-paprika shrink-0" />
                                            <span>Other Vets in {currentSelectedDoc?.clinic?.city || 'Your Area'}</span>
                                          </h4>
                                        </div>
                                        <span className="font-mono text-[9px] bg-paper border border-cardboard px-2 py-0.5 rounded-sm text-paprika uppercase font-bold shrink-0">
                                          Top 4 Vets
                                        </span>
                                      </div>

                                    <p className="font-body text-xs text-ink/75">
                                      Need an appointment on <strong>{formatDisplayDate(targetDate)}</strong>? Book another verified veterinarian:
                                    </p>

                                    {/* Suggested Doctors Stack */}
                                    {(() => {
                                      const altDoctors = getAlternativeDoctors();
                                      if (altDoctors.length === 0) {
                                        return (
                                          <div className="p-4 bg-paper/40 border border-dashed border-cardboard rounded-sm text-center text-xs font-mono text-ink/60">
                                            No other doctors currently listed in this specific area.
                                          </div>
                                        );
                                      }
                                      return (
                                        <SuggestedDoctorsList
                                          doctors={altDoctors}
                                          targetDate={targetDate}
                                          onSelectDoctor={(docId) => {
                                            setSelectedDoctorId(docId.toString());
                                            setSelectedSlot('');
                                          }}
                                          onSelectSlot={(docId, slot) => {
                                            setSelectedDoctorId(docId.toString());
                                            setSelectedSlot(slot);
                                            setBookingStep(4);
                                          }}
                                        />
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}

                              </div>
                            </div>
                          ) : (
                            /* HORIZONTAL SLOTS WORKSPACE (Slots Available) */
                            <div className="bg-paperLight border border-cardboard border-opacity-60 p-5 sm:p-6 rounded-sm shadow-xs space-y-4">
                              <div className="flex items-center justify-between border-b border-cardboard border-opacity-40 pb-2.5">
                                <span className="font-mono text-xs uppercase font-bold text-paprika flex items-center space-x-1.5">
                                  <Clock className="w-4 h-4 text-turmeric" />
                                  <span>Available Time Slots ({availableSlots.length} Windows Open)</span>
                                </span>
                                <span className="font-mono text-[10px] text-herb font-bold uppercase bg-herb/10 border border-herb/30 px-2 py-0.5 rounded-sm">
                                  Select to proceed
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
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
                                      className={`py-3 px-3 border text-center font-mono text-xs font-bold rounded-sm transition-all cursor-pointer shadow-2xs ${
                                        isSelected 
                                          ? 'bg-herb text-white border-herb shadow-xs scale-102' 
                                          : 'bg-paper hover:bg-white border-cardboard border-opacity-60 text-ink hover:border-turmeric'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  );
                                })}
                              </div>
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
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-paper border border-cardboard border-opacity-40 rounded-sm">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <DoctorAvatar
                                src={docImg}
                                name={docName}
                                className="w-9 h-9"
                                shape="square"
                                initialsClassName="font-bold text-turmeric text-xs"
                              />
                              <div className="min-w-0">
                                <span className="font-mono text-[8px] uppercase text-herb font-bold block">Specialist</span>
                                <span className="font-display font-bold text-xs text-ink truncate block">
                                  {docName}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-sm bg-paperLight border border-cardboard border-opacity-40 overflow-hidden flex items-center justify-center shrink-0">
                                {selectedPet?.profile_image_url ? (
                                  <img src={selectedPet.profile_image_url} alt={selectedPet.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm">🐾</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-mono text-[8px] uppercase text-paprika font-bold block">Patient</span>
                                <span className="font-display font-bold text-xs text-ink truncate block">
                                  {selectedPet?.name || 'Pet'} ({selectedPet?.species || 'Canine'})
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2.5 min-w-0 sm:border-l sm:border-cardboard sm:border-dashed sm:pl-2.5">
                              <CalendarIcon className="w-5 h-5 text-turmeric shrink-0" />
                              <div className="min-w-0">
                                <span className="font-mono text-[8px] uppercase text-herb font-bold block">Schedule Window</span>
                                <span className="font-mono font-bold text-xs text-ink truncate block">
                                  {targetDate} • {selectedSlot}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <hr className="border-t border-dashed border-cardboard border-opacity-35" />

                      {/* Common Clinical Concern Quick-Chips */}
                      <div className="space-y-1.5 text-left">
                        <span className="font-mono text-[9px] uppercase font-bold text-paprika block">
                          Tap Common Consultation Reason:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            '🐾 Routine Wellness & Diet Review',
                            '🍗 Food Allergy & Skin Itch',
                            '🤢 Digestion & Sensitive Stomach',
                            '⚖️ Weight & Portion Planning',
                            '🩹 Senior Mobility & Joint Support',
                            '🩺 Post-Surgery Recovery Nutrition',
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setReason(chip)}
                              className={`px-2.5 py-1 text-[10px] font-mono rounded-sm border transition-colors cursor-pointer ${
                                reason === chip 
                                  ? 'bg-herb text-white border-herb font-bold shadow-2xs' 
                                  : 'bg-paper border-cardboard border-opacity-60 text-ink hover:border-turmeric hover:bg-turmeric/10'
                              }`}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>

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
                          Additional Clinical Notes (optional):
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

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setBookingStep(3)}
                          className="w-1/3 border border-cardboard hover:bg-paper text-ink font-mono text-[10px] uppercase py-3 font-bold rounded-sm cursor-pointer"
                        >
                          ← Back to Slot
                        </button>
                        <button
                          type="submit"
                          className="w-2/3 bg-herb hover:bg-herb/90 text-white font-mono text-[10px] uppercase py-3 font-bold rounded-sm tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                        >
                          <span>Review Invoice & Pay ➔</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 5: Invoice Review & Strict Upfront Payment */}
                  {bookingStep === 5 && (
                    <div className="space-y-5 animate-fade-in text-left">
                      <div className="space-y-1">
                        <Eyebrow label="STEP 5 OF 5 // PAYMENT & INVOICE" />
                        <h3 className="font-display font-black text-xl text-ink">Invoice & Secure Payment</h3>
                        <p className="font-body text-xs text-ink opacity-70">
                          Review your veterinary consultation appointment voucher and complete payment:
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
                                  <DoctorAvatar
                                    src={docImg}
                                    name={docName}
                                    className="w-11 h-11"
                                    shape="square"
                                    initialsClassName="font-display font-black text-sm text-turmeric"
                                  />
                                  <div className="min-w-0">
                                    <span className="font-display font-bold text-sm text-ink block truncate">{docName}</span>
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-paprika block truncate">
                                      {selectedDoc?.specialization} • {selectedDoc?.qualification}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-mono text-xs font-bold text-herb bg-herb/10 border border-herb/30 px-2.5 py-1 rounded-sm shrink-0">
                                  ₹{fee.toFixed(2)}
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

                            {/* Itemized Payment Table in INR */}
                            <div className="bg-paperLight border border-cardboard border-opacity-50 rounded-sm p-4 space-y-2 font-mono text-xs">
                              <div className="flex justify-between items-center text-ink opacity-80">
                                <span>Veterinary Clinical Consultation (30 mins)</span>
                                <span>₹{fee.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center text-ink opacity-80">
                                <span>Encrypted Telehealth Video Call & Digital Health File</span>
                                <span className="text-herb font-bold">FREE (Included)</span>
                              </div>
                              <div className="flex justify-between items-center text-ink opacity-80">
                                <span>Platform Service & Compliance</span>
                                <span className="text-herb font-bold">₹0.00</span>
                              </div>
                              <div className="border-t border-cardboard border-dashed pt-2 mt-2 flex justify-between items-center font-bold text-sm text-ink">
                                <span className="uppercase text-paprika text-xs">Total Payable Amount:</span>
                                <span className="text-herb text-base">₹{fee.toFixed(2)}</span>
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

                            {/* Payment Actions */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setBookingStep(4)}
                                className="w-1/3 border border-cardboard hover:bg-paper text-ink font-mono text-[10px] uppercase py-3.5 font-bold rounded-sm cursor-pointer"
                              >
                                ← Edit Notes
                              </button>
                              <button
                                type="button"
                                onClick={handleInitiatePayment}
                                disabled={isPaying}
                                className="w-2/3 bg-herb hover:bg-herb/90 text-white font-mono text-[11px] uppercase py-3.5 font-bold rounded-sm tracking-wider transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 shadow-sm"
                              >
                                {isPaying ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    <span>Connecting to Gateway...</span>
                                  </>
                                ) : (
                                  <>
                                    <CreditCard className="w-4 h-4 mr-1.5" />
                                    <span>Pay ₹{fee.toFixed(2)} & Confirm Appointment 💳</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="text-center font-mono text-[9px] text-ink opacity-60 uppercase tracking-wide">
                              🔒 256-Bit SSL Encrypted • Powered by Razorpay • Instant Digital Confirmation
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
                        ← Previous Step
                      </button>
                    ) : <div />}

                    <span className="font-mono text-[10px] text-ink/50 uppercase tracking-widest font-bold">
                      Step {bookingStep} of 5
                    </span>

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
                        <span className="text-herb font-bold">₹{parseFloat(inspectingDoctor.consultation_fee).toFixed(2)}</span>
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

      {/* Clinic Detail Drawer — same slide-in pattern as the doctor drawer
          above, for a Google-sourced "Vets Near Me" result. */}
      {inspectingClinic && (
        <div className="fixed inset-0 z-50 overflow-hidden font-body animate-fade-in">
          <div
            onClick={() => setInspectingClinic(null)}
            className="absolute inset-0 bg-ink bg-opacity-40 backdrop-blur-xs transition-opacity"
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-paperLight border-l border-cardboard shadow-2xl flex flex-col relative animate-slide-in-right">

              <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-35"></div>

              {/* Header */}
              <div className="p-6 border-b border-cardboard border-opacity-40 flex justify-between items-center bg-paperLight pl-8">
                <div className="text-left space-y-1 min-w-0">
                  <Eyebrow label="CLINIC PROFILE" />
                  <h3 className="font-display font-black text-xl text-ink truncate">
                    {inspectingClinic.name || 'Clinic Detail'}
                  </h3>
                </div>
                <button
                  onClick={() => setInspectingClinic(null)}
                  className="p-1 hover:bg-paper rounded-full text-ink opacity-70 hover:opacity-100 transition-colors cursor-pointer border-none bg-transparent shrink-0"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-grow overflow-y-auto p-6 space-y-5 pl-8 text-left custom-scrollbar">
                {(() => {
                  const placeDetails = inspectingClinic.place_id ? clinicDetailsCache[inspectingClinic.place_id] : undefined;
                  const isLoading = isLoadingClinicDetails && !placeDetails;
                  const directionsUrl = buildDirectionsUrl(inspectingClinic);

                  return (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-ink/60 bg-ink/10 px-2.5 py-0.5 rounded-sm">
                          Google
                        </span>
                        <span className="font-mono text-[10px] text-ink/50">
                          {inspectingClinic.distance_km.toFixed(1)} km away
                        </span>
                      </div>

                      {isLoading ? (
                        <div className="w-full aspect-[4/3] rounded-md border border-cardboard bg-paper flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-turmeric animate-spin" />
                        </div>
                      ) : placeDetails?.photo_url ? (
                        <img
                          src={`${API_BASE_URL}${placeDetails.photo_url}`}
                          alt={placeDetails.name || 'Clinic photo'}
                          className="w-full aspect-[4/3] object-cover rounded-md border border-cardboard"
                        />
                      ) : null}

                      {(inspectingClinic.address) && (
                        <p className="font-body text-sm text-ink/80">{inspectingClinic.address}</p>
                      )}

                      {!isLoading && placeDetails?.phone && (
                        <p className="flex items-center gap-2 text-sm font-body text-ink/80">
                          <Phone className="w-4 h-4 text-herb shrink-0" />
                          {placeDetails.phone}
                        </p>
                      )}

                      {!isLoading && placeDetails?.opening_hours && placeDetails.opening_hours.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="flex items-center gap-2 text-[11px] font-mono uppercase font-bold text-ink/50">
                            <Clock className="w-3.5 h-3.5 text-herb shrink-0" />
                            Opening Hours
                          </p>
                          <div className="rounded-md border border-cardboard overflow-hidden divide-y divide-dashed divide-cardboard">
                            {placeDetails.opening_hours.map((line, i) => {
                              const separatorIndex = line.indexOf(':');
                              const day = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
                              const hours = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trim();
                              const jsToday = new Date().getDay();
                              const isToday = i === (jsToday === 0 ? 6 : jsToday - 1);
                              return (
                                <div
                                  key={line}
                                  className={`flex items-center justify-between gap-3 px-3 py-2 text-[12px] font-body ${
                                    isToday ? 'bg-turmeric/10' : 'bg-paperLight'
                                  }`}
                                >
                                  <span className={`shrink-0 ${isToday ? 'font-bold text-turmeric' : 'text-ink/70'}`}>
                                    {day}
                                    {isToday && <span className="ml-1.5 font-mono text-[8px] uppercase">Today</span>}
                                  </span>
                                  <span className={`font-mono text-right ${hours.toLowerCase() === 'closed' ? 'text-ink/35' : 'text-ink/70'}`}>
                                    {hours}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!isLoading && placeDetails && !placeDetails.phone && !placeDetails.photo_url && (!placeDetails.opening_hours || placeDetails.opening_hours.length === 0) && (
                        <p className="text-sm font-body text-ink/40">No further details available from Google for this clinic.</p>
                      )}

                      {directionsUrl && (
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase py-3 font-bold rounded-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Navigation className="w-4 h-4" />
                          Get Directions
                        </a>
                      )}

                      <p className="font-mono text-[8px] text-ink/35 text-right">Powered by Google</p>
                    </>
                  );
                })()}
              </div>
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
