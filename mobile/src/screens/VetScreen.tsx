import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Stethoscope,
  Video,
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileText,
  X,
  PawPrint,
  Calendar as CalendarIcon,
  Building2,
  Star,
  MapPin,
  Info,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { BrandMedallion } from '../components/BrandLogo';
import { Doctor } from '../types';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { usePetStore } from '../store/petStore';
import { useAuthStore } from '../store/authStore';
import { tabPrefetchCache } from '../services/tabPrefetch';
import {
  fetchDoctors,
  fetchDoctorSlots,
  fetchDoctorSchedule,
  fetchDoctorDetail,
  fetchDoctorReviews,
  DoctorAvailabilityWindow,
  DoctorReviewItem,
} from '../api/doctors';
import { fetchMyPets } from '../api/pets';
import { submitDoctorReview } from '../api/reviews';
import {
  fetchMyConsultations,
  joinConsultation,
  cancelConsultation,
  createConsultationPaymentIntent,
  bookConsultationWithPayment,
  Consultation,
} from '../api/consultations';
import RazorpayModal from '../components/RazorpayModal';
import { styles } from './vet/vetStyles';
import { formatLocalDateStr, getStatusBadge, formatDate, getDoctorImageUrl, formatTime12h } from './vet/vetHelpers';
import { BookingModal } from './vet/BookingModal';
import { DoctorProfileModal } from './vet/DoctorProfileModal';
import { FilterModal } from './vet/FilterModal';
import { ReviewModal } from './vet/ReviewModal';
import { NearbyVetsModal } from './vet/NearbyVetsModal';

type ActiveTab = 'QUEUE' | 'DOCTORS';
type ConsultationFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

// Pure Memoized Consultation Card Component
interface ConsultationCardItemProps {
  consultation: Consultation;
  isJoining: boolean;
  onJoinVideo: (consultation: Consultation) => void;
  onCancel: (consultationId: number) => void;
  onReview: (consultationId: number) => void;
  reviewsEnabled: boolean;
  cardWidth?: any;
}

const ConsultationCardItem = memo(function ConsultationCardItem({
  consultation,
  isJoining,
  onJoinVideo,
  onCancel,
  onReview,
  reviewsEnabled,
  cardWidth,
}: ConsultationCardItemProps) {
  const statusInfo = getStatusBadge(consultation.status);
  const doc = consultation.doctor;
  const pet = consultation.pet;
  const docImg = getDoctorImageUrl(doc);
  const isCallActive =
    consultation.status === 'confirmed' || consultation.status === 'in_progress';
  const isCompleted = consultation.status === 'completed';
  const isPending = consultation.status === 'pending';

  const scheduledDateStr = useMemo(
    () => formatDate(consultation.scheduled_at),
    [consultation.scheduled_at]
  );

  const handleJoin = useCallback(() => {
    onJoinVideo(consultation);
  }, [onJoinVideo, consultation]);

  const handleCancel = useCallback(() => {
    onCancel(consultation.id);
  }, [onCancel, consultation.id]);

  const handleReview = useCallback(() => {
    onReview(consultation.id);
  }, [onReview, consultation.id]);

  return (
    <View style={[styles.consultationCard, cardWidth ? { width: cardWidth } : null]}>
      {/* Card Top Row: ID, Time, Badge */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIdBadge}>
          <Text style={styles.cardIdText}>APPT #{consultation.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          {isCallActive && <View style={styles.livePulseDot} />}
          <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Doctor Profile Info */}
      <View style={styles.doctorInfoRow}>
        {docImg ? (
          <Image source={{ uri: docImg }} style={styles.doctorAvatar} />
        ) : (
          <View style={styles.doctorAvatarFallback}>
            <Stethoscope size={22} color={COLORS.forestGreen} />
          </View>
        )}
        <View style={styles.doctorTextCol}>
          <Text style={styles.doctorName}>
            {doc?.user?.first_name
              ? `Dr. ${doc.user.first_name} ${doc.user.last_name || ''}`.trim()
              : 'Certified Veterinary Specialist'}
          </Text>
          <Text style={styles.doctorSpec}>
            {doc?.specialization || 'Clinical Nutritionist'}
          </Text>
          {doc?.clinic?.name && (
            <View style={styles.clinicRow}>
              <Building2 size={12} color={COLORS.textMuted} />
              <Text style={styles.clinicText}>
                {doc.clinic.name} • {doc.clinic.city || 'India'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardDivider} />

      {/* Patient & Appointment Details */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>PATIENT</Text>
          <View style={styles.detailValueRow}>
            <PawPrint size={13} color={COLORS.brandGold} />
            <Text style={styles.detailValueText}>
              {pet ? `${pet.name} (${pet.breed || pet.species})` : 'Registered Pet'}
            </Text>
          </View>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>SCHEDULED TIME</Text>
          <View style={styles.detailValueRow}>
            <Clock size={13} color={COLORS.forestGreen} />
            <Text style={styles.detailValueText}>{scheduledDateStr}</Text>
          </View>
        </View>
      </View>

      {/* Reason / Symptoms Card */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>CHIEF REASON / SYMPTOMS:</Text>
        <Text style={styles.reasonText}>"{consultation.reason}"</Text>
      </View>

      {/* Doctor Clinical Notes & Dietary Advice (If Completed) */}
      {isCompleted && (
        <View style={styles.doctorNotesBox}>
          <View style={styles.notesHeader}>
            <FileText size={15} color={COLORS.forestGreen} />
            <Text style={styles.notesHeaderTitle}>
              Doctor's Clinical Notes & Dietary Advice
            </Text>
          </View>
          <Text style={styles.doctorNotesText}>
            {consultation.doctor_notes ||
              'Consultation completed. Formal dietary notes and meal formulation instructions are being finalized by the specialist.'}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.cardActionRow}>
        {isCallActive && (
          <TouchableOpacity
            style={[styles.joinCallBtn, isJoining && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Video size={16} color="#FFFFFF" />
                <Text style={styles.joinCallBtnText}>Join Live Video Call</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isPending && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <X size={14} color="#DC2626" />
            <Text style={styles.cancelBtnText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}

        {isCompleted && (
          <View style={styles.completedStamp}>
            <CheckCircle2 size={14} color={COLORS.forestGreen} />
            <Text style={styles.completedStampText}>Consultation Completed</Text>
          </View>
        )}

        {isCompleted && reviewsEnabled && (
          <TouchableOpacity style={styles.leaveReviewBtn} onPress={handleReview}>
            <Star size={14} color={COLORS.brandGold} />
            <Text style={styles.leaveReviewBtnText}>Leave a Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// Pure Memoized Doctor Directory Card Component
interface DoctorDirectoryCardProps {
  doc: Doctor;
  onSelectProfile: (doc: Doctor) => void;
  onBook: (doc: Doctor) => void;
  cardWidth?: any;
}

const DoctorDirectoryCard = memo(function DoctorDirectoryCard({
  doc,
  onSelectProfile,
  onBook,
  cardWidth,
}: DoctorDirectoryCardProps) {
  const docName =
    doc.name ||
    (doc.user
      ? `Dr. ${doc.user.first_name} ${doc.user.last_name || ''}`.trim()
      : 'Veterinary Specialist');
  const docImg = getDoctorImageUrl(doc);

  const handleProfilePress = useCallback(() => {
    onSelectProfile(doc);
  }, [onSelectProfile, doc]);

  const handleBookPress = useCallback(() => {
    onBook(doc);
  }, [onBook, doc]);

  return (
    <View style={[styles.docCard, cardWidth ? { width: cardWidth } : null]}>
      <TouchableOpacity activeOpacity={0.85} onPress={handleProfilePress}>
        <View style={styles.docCardTop}>
          {docImg ? (
            <Image source={{ uri: docImg }} style={styles.docImg} />
          ) : (
            <View style={styles.docImgFallback}>
              <Stethoscope size={26} color={COLORS.forestGreen} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.verifiedRow}>
              <Text style={styles.docCardName}>{docName}</Text>
              <ShieldCheck size={14} color={COLORS.forestGreen} />
            </View>
            <Text style={styles.docCardSpec}>{doc.specialization}</Text>
            {doc.qualification && (
              <Text style={styles.docCardQual}>{doc.qualification}</Text>
            )}
            <View style={styles.docCardStatsRow}>
              {doc.experience_years ? (
                <Text style={styles.docCardExp}>{doc.experience_years} yrs exp</Text>
              ) : null}
              {doc.average_rating ? (
                <View style={styles.ratingBadge}>
                  <Star size={10} color="#D97706" fill="#D97706" />
                  <Text style={styles.ratingBadgeText}>
                    {doc.average_rating.toFixed(1)} ({doc.review_count || 0})
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <ChevronRight size={18} color={COLORS.textMuted} />
        </View>

        {doc.bio && (
          <Text style={styles.docBio} numberOfLines={2}>
            {doc.bio}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.cardDivider} />

      <View style={styles.docCardBottom}>
        <View>
          <Text style={styles.feeLabel}>CONSULTATION FEE</Text>
          <Text style={styles.feeVal}>
            ₹{Number(doc.consultation_fee).toFixed(0)}
          </Text>
        </View>

        <View style={styles.docCardActionsRow}>
          <TouchableOpacity
            style={styles.viewProfileOutlineBtn}
            onPress={handleProfilePress}
          >
            <Info size={13} color={COLORS.forestGreen} />
            <Text style={styles.viewProfileOutlineBtnText}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bookDocBtn, !doc.is_available && styles.bookDocBtnDisabled]}
            disabled={!doc.is_available}
            onPress={handleBookPress}
          >
            <Video size={14} color="#FFFFFF" />
            <Text style={styles.bookDocBtnText}>
              {doc.is_available ? 'Book' : 'Away'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function VetScreen({ navigation, route }: any) {
  const { user, isGuest } = useAuthStore();
  const { pets, setPets, activePetId } = usePetStore();
  const { isTablet, contentWidth, cardColumns } = useResponsive();
  const vetCardWidth = isTablet ? (Math.min(contentWidth, 1040) - 40 - 14) / 2 : '100%';
  const isBookingEnabled = useFeatureFlag('consultations_booking', true);
  const isReviewsEnabled = useFeatureFlag('consultations_reviews', true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('QUEUE');
  const [consultationFilter, setConsultationFilter] = useState<ConsultationFilter>('ALL');

  // Consultations State — seeded from the app-boot prefetch (see
  // services/tabPrefetch.ts) when available, so this screen's first paint
  // can show the real queue instead of an empty list + spinner while its
  // own fetch is still in flight.
  const [consultations, setConsultations] = useState<Consultation[]>(() => tabPrefetchCache.consultations || []);
  const [loadingConsultations, setLoadingConsultations] = useState(() => !tabPrefetchCache.consultations);
  const [joiningId, setJoiningId] = useState<number | null>(null);

  // Doctor Review Modal State
  const [reviewConsultationId, setReviewConsultationId] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Doctors State & Dynamic Live Filters (Zero Hardcoding)
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [maxPriceLimit, setMaxPriceLimit] = useState<number | null>(null);

  // Dynamic Filter Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [filterModalSection, setFilterModalSection] = useState<'SPECIALIZATION' | 'CITY' | 'PRICE'>('SPECIALIZATION');
  const [tempSpec, setTempSpec] = useState<string>('ALL');
  const [tempCity, setTempCity] = useState<string>('ALL');
  const [tempPriceLimit, setTempPriceLimit] = useState<number | null>(null);

  // DYNAMIC SPECIALIZATIONS (Extracted directly from backend doctor records)
  const dynamicSpecializations = useMemo(() => {
    const counts = new Map<string, number>();
    allDoctors.forEach((doc) => {
      const s = doc.specialization?.trim();
      if (s) {
        counts.set(s, (counts.get(s) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allDoctors]);

  // DYNAMIC CITIES (Only cities where verified doctors are available)
  const dynamicCities = useMemo(() => {
    const counts = new Map<string, { display: string; count: number }>();
    allDoctors.forEach((doc) => {
      const rawCity = doc.clinic?.city?.trim();
      if (rawCity) {
        const key = rawCity.toLowerCase();
        const display = rawCity.charAt(0).toUpperCase() + rawCity.slice(1).toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { display, count: 1 });
        }
      }
    });
    return Array.from(counts.entries())
      .map(([key, val]) => ({ key, display: val.display, count: val.count }))
      .sort((a, b) => b.count - a.count);
  }, [allDoctors]);

  // DYNAMIC PRICE TIERS (Derived directly from doctor consultation fees in DB)
  const dynamicPriceStats = useMemo(() => {
    const fees = allDoctors
      .map((d) => Number(d.consultation_fee))
      .filter((n) => !isNaN(n) && n > 0);
    if (fees.length === 0) return { min: 0, max: 0, tiers: [] };
    const min = Math.min(...fees);
    const max = Math.max(...fees);
    const uniqueSorted = Array.from(new Set(fees)).sort((a, b) => a - b);
    return { min, max, tiers: uniqueSorted };
  }, [allDoctors]);

  // Active filter counter
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSpecialization !== 'ALL') count++;
    if (selectedCity !== 'ALL') count++;
    if (maxPriceLimit !== null) count++;
    return count;
  }, [selectedSpecialization, selectedCity, maxPriceLimit]);

  // Live preview counter in filter modal
  const modalPreviewCount = useMemo(() => {
    let list = allDoctors;
    if (tempSpec !== 'ALL') {
      list = list.filter((d) =>
        d.specialization?.toLowerCase().includes(tempSpec.toLowerCase())
      );
    }
    if (tempCity !== 'ALL') {
      list = list.filter(
        (d) => d.clinic?.city?.toLowerCase() === tempCity.toLowerCase()
      );
    }
    if (tempPriceLimit !== null && tempPriceLimit > 0) {
      list = list.filter((d) => Number(d.consultation_fee) <= tempPriceLimit);
    }
    return list.length;
  }, [allDoctors, tempSpec, tempCity, tempPriceLimit]);

  const openFilterModal = (section: 'SPECIALIZATION' | 'CITY' | 'PRICE' = 'SPECIALIZATION') => {
    setTempSpec(selectedSpecialization);
    setTempCity(selectedCity);
    setTempPriceLimit(maxPriceLimit);
    setFilterModalSection(section);
    setIsFilterModalOpen(true);
  };

  const applyFilters = () => {
    setSelectedSpecialization(tempSpec);
    setSelectedCity(tempCity);
    setMaxPriceLimit(tempPriceLimit);
    setIsFilterModalOpen(false);
  };

  // useCallback here matters beyond the usual: renderDoctorsEmpty below
  // depends on this function, so an unstable resetAllFilters identity would
  // silently defeat renderDoctorsEmpty's own memoization on every render.
  const resetAllFilters = useCallback(() => {
    setSelectedSpecialization('ALL');
    setSelectedCity('ALL');
    setMaxPriceLimit(null);
    setSearchQuery('');
    setTempSpec('ALL');
    setTempCity('ALL');
    setTempPriceLimit(null);
    setIsFilterModalOpen(false);
  }, []);

  // Booking Modal State
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showNearbyVetsModal, setShowNearbyVetsModal] = useState(false);
  const [bookingPetId, setBookingPetId] = useState<number | null>(null);
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [doctorSlots, setDoctorSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [doctorSchedule, setDoctorSchedule] = useState<DoctorAvailabilityWindow[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Consultation Payment State (Razorpay)
  const [consultPaymentIntent, setConsultPaymentIntent] = useState<{
    razorpayOrderId: string;
    razorpayKeyId: string;
    amount: number;
    petId: number;
    doctorId: number;
    scheduledAt: string;
    reasonText: string;
  } | null>(null);
  const [showConsultPayment, setShowConsultPayment] = useState<boolean>(false);

  // Doctor Profile View State
  const [profileDoctor, setProfileDoctor] = useState<Doctor | null>(null);
  const [profileDoctorDetail, setProfileDoctorDetail] = useState<Doctor | null>(null);
  const [profileReviews, setProfileReviews] = useState<DoctorReviewItem[]>([]);
  const [profileSchedule, setProfileSchedule] = useState<DoctorAvailabilityWindow[]>([]);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);

  // Deep-link auto-select doctor if navigated with doctorId
  useEffect(() => {
    if (route?.params?.doctorId && allDoctors.length > 0) {
      setActiveTab('DOCTORS');
      const targetId = Number(route.params.doctorId);
      const targetDoc = allDoctors.find((d) => d.id === targetId);
      if (targetDoc) {
        setSelectedDoctor(targetDoc);
      }
    }
  }, [route?.params?.doctorId, allDoctors]);

  // 1. Generate 14-day interactive calendar strip in LOCAL time
  const upcomingDays = useMemo(() => {
    const days = [];
    const now = new Date();
    const DAY_OF_WEEK_NAMES = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];

    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateStr = formatLocalDateStr(d); // e.g. 2026-09-05 (Local)
      const dayName =
        i === 0
          ? 'TODAY'
          : i === 1
          ? 'TOMORROW'
          : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const dayNum = d.getDate();
      const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const dayOfWeek = DAY_OF_WEEK_NAMES[d.getDay()];
      days.push({ date: d, dateStr, dayName, dayNum, month, dayOfWeek });
    }
    return days;
  }, []);

  // 2. Fetch User Consultations
  const consultationsLastFetchedRef = useRef(tabPrefetchCache.consultationsFetchedAt || 0);
  const loadConsultations = useCallback(
    async (force = false) => {
      if (!user || isGuest) {
        setLoadingConsultations(false);
        return;
      }
      // Skip refetching if we already have a recent copy — avoids a redundant
      // network round-trip every time this tab regains focus.
      if (!force && Date.now() - consultationsLastFetchedRef.current < 12000) {
        setLoadingConsultations(false);
        setRefreshing(false);
        return;
      }
      try {
        const res = await fetchMyConsultations();
        setConsultations(res.items || []);
        consultationsLastFetchedRef.current = Date.now();
      } catch (err: any) {
        console.log('Error fetching consultations:', err?.response?.status || err);
      } finally {
        setLoadingConsultations(false);
        setRefreshing(false);
      }
    },
    [user, isGuest]
  );

  // 3. Load Doctors with Search, Specialization, City, and Price Limit
  const loadDoctorsList = useCallback(
    async (
      query?: string,
      spec?: string,
      city?: string,
      maxPrice?: number | null
    ) => {
      try {
        setLoadingDoctors(true);
        const params: any = { limit: 100 };
        if (query && query.trim()) {
          params.search = query.trim();
        }
        if (spec && spec !== 'ALL') {
          params.specialization = spec;
        }
        if (city && city !== 'ALL') {
          params.city = city;
        }
        const res = await fetchDoctors(params);
        let items = res.items || [];
        if (maxPrice !== null && maxPrice !== undefined && maxPrice > 0) {
          items = items.filter((d) => Number(d.consultation_fee) <= maxPrice);
        }
        setDoctors(items);

        // Keep master allDoctors list fresh when viewing default state
        if (
          (!query || !query.trim()) &&
          (!spec || spec === 'ALL') &&
          (!city || city === 'ALL') &&
          (maxPrice === null || maxPrice === undefined)
        ) {
          setAllDoctors(res.items || []);
        }
      } catch (err) {
        console.log('Error searching doctors:', err);
      } finally {
        setLoadingDoctors(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Debounced live search & dynamic filter trigger
  useEffect(() => {
    if (activeTab !== 'DOCTORS') return;
    const timer = setTimeout(() => {
      loadDoctorsList(searchQuery, selectedSpecialization, selectedCity, maxPriceLimit);
    }, 280);
    return () => clearTimeout(timer);
  }, [
    searchQuery,
    selectedSpecialization,
    selectedCity,
    maxPriceLimit,
    activeTab,
    loadDoctorsList,
  ]);

  // Load Master Doctors & Verified Pets
  const loadDoctorsAndPets = useCallback(async () => {
    try {
      const [doctorsRes, petsRes] = await Promise.allSettled([
        fetchDoctors({ limit: 100 }),
        fetchMyPets(),
      ]);

      if (doctorsRes.status === 'fulfilled') {
        const items = doctorsRes.value.items || [];
        setAllDoctors(items);
        setDoctors(items);
      }
      if (petsRes.status === 'fulfilled' && petsRes.value) {
        setPets(petsRes.value);
        if (petsRes.value.length > 0 && !bookingPetId) {
          setBookingPetId(petsRes.value[0].id);
        }
      }
    } catch (err) {
      console.log('Error loading doctors/pets:', err);
    } finally {
      setLoadingDoctors(false);
      setRefreshing(false);
    }
  }, [setPets, bookingPetId]);

  useEffect(() => {
    loadConsultations();
    loadDoctorsAndPets();
  }, [loadConsultations, loadDoctorsAndPets]);

  // Automatically sync consultations ledger when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (user && !isGuest) {
        loadConsultations();
      }
    }, [user, isGuest, loadConsultations])
  );

  // Check if a slot is already past for today in local time
  const isSlotInPast = useCallback((time24: string, dateStr: string) => {
    const todayStr = formatLocalDateStr(new Date());
    if (dateStr !== todayStr) return false;
    const [hh, mm] = time24.split(':');
    const slotTime = new Date();
    slotTime.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    return slotTime.getTime() <= Date.now() + 5 * 60 * 1000;
  }, []);

  // 4. Fetch Doctor's Weekly Working Schedule & Pre-select First Available Day
  useEffect(() => {
    if (!selectedDoctor) {
      setDoctorSchedule([]);
      return;
    }

    let isMounted = true;
    setLoadingSchedule(true);

    fetchDoctorSchedule(selectedDoctor.id)
      .then((res) => {
        if (!isMounted) return;
        const schedule = res?.schedule || [];
        setDoctorSchedule(schedule);

        // Check which days of the week this doctor actually works
        const activeDays = new Set(
          schedule.filter((w) => w.is_available).map((w) => w.day_of_week.toLowerCase())
        );

        if (activeDays.size > 0) {
          const currentDay = upcomingDays[selectedDateIndex];
          // If current day is off-duty, auto-select the first working day
          if (!currentDay || !activeDays.has(currentDay.dayOfWeek)) {
            const firstActiveIdx = upcomingDays.findIndex((d) => activeDays.has(d.dayOfWeek));
            if (firstActiveIdx !== -1) {
              setSelectedDateIndex(firstActiveIdx);
            }
          }
        }
      })
      .catch((err) => {
        console.log('Error fetching doctor schedule:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingSchedule(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDoctor, upcomingDays]);

  // 5. Fetch dynamic slots strictly from backend doctor schedule
  useEffect(() => {
    if (!selectedDoctor) return;
    const currentDay = upcomingDays[selectedDateIndex];
    if (!currentDay) return;

    let isMounted = true;
    setLoadingSlots(true);

    fetchDoctorSlots(selectedDoctor.id, currentDay.dateStr)
      .then((res) => {
        if (!isMounted) return;
        if (res && res.slots && res.slots.length > 0) {
          setDoctorSlots(res.slots);
          // Set first available upcoming slot strictly from doctor's schedule
          const valid = res.slots.find((s) => !isSlotInPast(s, currentDay.dateStr));
          setSelectedTime(valid || res.slots[0]);
        } else {
          setDoctorSlots([]);
          setSelectedTime('');
        }
      })
      .catch((err) => {
        console.log('Error fetching doctor slots:', err);
        if (isMounted) {
          setDoctorSlots([]);
          setSelectedTime('');
        }
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDoctor, selectedDateIndex, upcomingDays, isSlotInPast]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConsultations(true);
    loadDoctorsAndPets();
  }, [loadConsultations, loadDoctorsAndPets]);


  // Categorize ONLY the doctor's actual slots into Morning, Afternoon, Evening
  const categorizedSlots = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];

    doctorSlots.forEach((slot) => {
      const [hh] = slot.split(':');
      const hour = parseInt(hh, 10);
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    return { morning, afternoon, evening };
  }, [doctorSlots]);

  // Doctor's weekly active schedule summary banner (e.g. "Monday to Friday • 09:00 AM - 08:00 PM")
  const scheduleSummary = useMemo(() => {
    if (!doctorSchedule || doctorSchedule.length === 0) return null;
    const active = doctorSchedule.filter((w) => w.is_available);
    if (active.length === 0) return 'Currently Not Taking Appointments';

    const sample = active[0];
    const startTime = formatTime12h(sample.start_time.slice(0, 5));
    const endTime = formatTime12h(sample.end_time.slice(0, 5));

    const days = active.map((w) => w.day_of_week.toLowerCase());
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hasAll = allDays.every((d) => days.includes(d));
    const hasMonFri =
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every((d) => days.includes(d)) &&
      days.length === 5;

    let dayRangeStr = 'Mon - Fri';
    if (hasAll) dayRangeStr = 'Every Day (Mon - Sun)';
    else if (hasMonFri) dayRangeStr = 'Monday to Friday';
    else {
      dayRangeStr = active.map((w) => w.day_of_week.slice(0, 3).toUpperCase()).join(', ');
    }

    return `${dayRangeStr} • ${startTime} - ${endTime}`;
  }, [doctorSchedule]);

  const workingDaysSet = useMemo(() => {
    return new Set(
      doctorSchedule.filter((w) => w.is_available).map((w) => w.day_of_week.toLowerCase())
    );
  }, [doctorSchedule]);

  // Load full doctor profile, reviews, and clinical schedule when viewing a profile
  useEffect(() => {
    if (!profileDoctor) {
      setProfileDoctorDetail(null);
      setProfileReviews([]);
      setProfileSchedule([]);
      return;
    }

    let isMounted = true;
    setLoadingProfile(true);

    Promise.allSettled([
      fetchDoctorDetail(profileDoctor.id),
      fetchDoctorReviews(profileDoctor.id),
      fetchDoctorSchedule(profileDoctor.id),
    ])
      .then(([detailRes, reviewsRes, scheduleRes]) => {
        if (!isMounted) return;
        if (detailRes.status === 'fulfilled') {
          setProfileDoctorDetail(detailRes.value);
        } else {
          setProfileDoctorDetail(profileDoctor);
        }
        if (reviewsRes.status === 'fulfilled') {
          setProfileReviews(reviewsRes.value.items || []);
        } else {
          setProfileReviews([]);
        }
        if (scheduleRes.status === 'fulfilled') {
          setProfileSchedule(scheduleRes.value.schedule || []);
        } else {
          setProfileSchedule([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [profileDoctor]);

  const profileScheduleSummary = useMemo(() => {
    if (!profileSchedule || profileSchedule.length === 0) return null;
    const active = profileSchedule.filter((w) => w.is_available);
    if (active.length === 0) return 'Currently Not Taking Appointments';

    const sample = active[0];
    const startTime = formatTime12h(sample.start_time.slice(0, 5));
    const endTime = formatTime12h(sample.end_time.slice(0, 5));

    const days = active.map((w) => w.day_of_week.toLowerCase());
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hasAll = allDays.every((d) => days.includes(d));
    const hasMonFri =
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every((d) => days.includes(d)) &&
      days.length === 5;

    let dayRangeStr = 'Mon - Fri';
    if (hasAll) dayRangeStr = 'Every Day (Mon - Sun)';
    else if (hasMonFri) dayRangeStr = 'Monday to Friday';
    else {
      dayRangeStr = active.map((w) => w.day_of_week.slice(0, 3).toUpperCase()).join(', ');
    }

    return `${dayRangeStr} • ${startTime} - ${endTime}`;
  }, [profileSchedule]);



  // 5. Handle Live Video Call Join
  // useCallback matters here beyond the usual: this closes over `user`, and
  // renderConsultationItem below doesn't list it as a dependency, so an
  // unstable reference would have gone stale instead of just re-rendering —
  // the card would keep calling whichever version of this existed the last
  // time joiningId/isReviewsEnabled/vetCardWidth changed.
  const handleJoinVideoRoom = useCallback(async (consultation: Consultation) => {
    try {
      setJoiningId(consultation.id);
      const joinData = await joinConsultation(consultation.id);

      const displayName = encodeURIComponent(
        `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Pet Parent'
      );

      const domain = joinData.jitsi_domain || 'meet.lokeshm.me';
      const room = joinData.room_name;
      const token = joinData.jitsi_token;

      // Construct secure authenticated Jitsi URL
      const directRoomUrl = `https://${domain}/${room}?jwt=${token}#config.prejoinPageEnabled=false&config.prejoinConfig.enabled=false&config.disableDeepLinking=true&config.p2p.enabled=true&userInfo.displayName="${displayName}"`;

      // Open the call embedded in-app, locked to our own Jitsi domain
      navigation.navigate('VideoCall', {
        consultationId: consultation.id,
        roomUrl: directRoomUrl,
        allowedHost: domain,
        petId: consultation.pet_id,
        petName: consultation.pet?.name,
      });
    } catch (err: any) {
      console.log('Error joining consultation room:', err?.response?.data || err);
      const detail =
        err?.response?.data?.detail ||
        'The video consultation room is not available yet. Please check the appointment window.';
      Alert.alert('Video Consultation', detail);
    } finally {
      setJoiningId(null);
    }
  }, [user, navigation]);

  // 6. Handle Cancellation
  const handleCancelConsultation = useCallback((consultationId: number) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this veterinary appointment?',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelConsultation(consultationId);
              Alert.alert('Cancelled', 'Your consultation appointment has been cancelled.');
              loadConsultations(true);
            } catch (err: any) {
              const detail = err?.response?.data?.detail || 'Failed to cancel appointment.';
              Alert.alert('Cancellation Error', detail);
            }
          },
        },
      ]
    );
  }, [loadConsultations]);

  // 6b. Handle Doctor Review Submission
  const handleOpenReviewModal = useCallback((consultationId: number) => {
    setReviewRating(5);
    setReviewComment('');
    setReviewConsultationId(consultationId);
  }, []);

  const handleSubmitReview = async () => {
    if (!reviewConsultationId) return;
    setIsSubmittingReview(true);
    try {
      await submitDoctorReview(reviewConsultationId, {
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      });
      setReviewConsultationId(null);
      Alert.alert('Thank You', 'Your review has been submitted.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to submit your review.';
      Alert.alert('Review Error', detail);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // 7. Handle Confirm Booking
  const handleConfirmBooking = async () => {
    if (!selectedDoctor) return;
    if (!isBookingEnabled) {
      Alert.alert(
        'Bookings Paused',
        'Online appointment bookings are currently paused by the administrator. Please check back later.'
      );
      return;
    }
    if (!bookingPetId) {
      Alert.alert('Pet Required', 'Please select which pet this consultation is for.');
      return;
    }
    if (!selectedTime || doctorSlots.length === 0) {
      Alert.alert(
        'Time Slot Required',
        `Please choose an available time slot from Dr. ${
          selectedDoctor.name || 'the specialist'
        }’s schedule.`
      );
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      Alert.alert(
        'Details Required',
        'Please describe the symptoms or reason for the call (at least 3 characters).'
      );
      return;
    }

    const chosenDay = upcomingDays[selectedDateIndex];
    const [hh, mm] = selectedTime.split(':');
    const scheduledDate = new Date(chosenDay.date);
    scheduledDate.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);

    if (scheduledDate.getTime() <= Date.now()) {
      Alert.alert('Invalid Time', 'Please select an upcoming time slot in the future.');
      return;
    }

    setBookingLoading(true);

    try {
      const intent = await createConsultationPaymentIntent({
        pet_id: bookingPetId,
        doctor_id: selectedDoctor.id,
        scheduled_at: scheduledDate.toISOString(),
      });

      if (intent.razorpay_order_id && intent.razorpay_key_id) {
        // Prepaid via Razorpay: hold booking details and open the checkout sheet.
        setConsultPaymentIntent({
          razorpayOrderId: intent.razorpay_order_id,
          razorpayKeyId: intent.razorpay_key_id,
          amount: parseFloat(intent.amount) || 0,
          petId: bookingPetId,
          doctorId: selectedDoctor.id,
          scheduledAt: scheduledDate.toISOString(),
          reasonText: reason.trim(),
        });
        setShowConsultPayment(true);
      } else {
        // Razorpay not configured on the server: book directly (dev/fallback path).
        await bookConsultationWithPayment({
          pet_id: bookingPetId,
          doctor_id: selectedDoctor.id,
          scheduled_at: scheduledDate.toISOString(),
          reason: reason.trim(),
          customer_notes: null,
        });
        finalizeBookingSuccess(selectedDoctor.name, chosenDay, selectedTime);
      }
    } catch (err: any) {
      console.log('Booking error:', err?.response?.data || err);
      const detail =
        err?.response?.data?.detail || 'Failed to initialize consultation payment.';
      Alert.alert('Booking Error', detail);
    } finally {
      setBookingLoading(false);
    }
  };

  // Shared success handling once a consultation is actually confirmed
  const finalizeBookingSuccess = (
    doctorName: string | null | undefined,
    chosenDay: { dayName: string; dayNum: number; month: string },
    time: string
  ) => {
    setSelectedDoctor(null);
    setReason('');
    setConsultPaymentIntent(null);
    Alert.alert(
      'Appointment Confirmed! 🐾',
      `Your video consultation with ${
        doctorName || 'Specialist'
      } has been booked for ${chosenDay.dayName}, ${chosenDay.dayNum} ${
        chosenDay.month
      } at ${formatTime12h(time)}.`
    );

    // Navigate to Queue tab to display the new appointment
    setActiveTab('QUEUE');
    loadConsultations(true);
  };

  // 7b. Handle Razorpay Consultation Payment Success/Failure
  const handleConsultPaymentSuccess = async (paymentData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    if (!consultPaymentIntent) return;
    setShowConsultPayment(false);
    setBookingLoading(true);
    try {
      await bookConsultationWithPayment({
        pet_id: consultPaymentIntent.petId,
        doctor_id: consultPaymentIntent.doctorId,
        scheduled_at: consultPaymentIntent.scheduledAt,
        reason: consultPaymentIntent.reasonText,
        customer_notes: null,
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature,
      });
      finalizeBookingSuccess(selectedDoctor?.name, upcomingDays[selectedDateIndex], selectedTime);
    } catch (err: any) {
      console.log('Payment verification error:', err?.response?.data || err);
      const detail =
        err?.response?.data?.detail ||
        'Payment verification failed. If money was deducted, please contact support.';
      Alert.alert('Payment Verification Error', detail);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleConsultPaymentFailure = (errorMessage?: string, isDismissed?: boolean) => {
    setShowConsultPayment(false);
    setConsultPaymentIntent(null);
    Alert.alert(
      isDismissed ? 'Payment Not Completed' : 'Payment Failed',
      errorMessage ||
        'Your consultation appointment has not been booked. Please try again.'
    );
  };

  // Single-pass memoized computation of filtered consultations and counters
  const { filteredConsultations, activeCount, completedCount, cancelledCount } = useMemo(() => {
    let act = 0;
    let comp = 0;
    let cancel = 0;
    for (const c of consultations) {
      const s = (c.status || '').toLowerCase();
      if (s === 'confirmed' || s === 'in_progress' || s === 'pending') act++;
      if (s === 'completed') comp++;
      if (s === 'cancelled') cancel++;
    }
    const filtered = consultations.filter((c) => {
      const s = (c.status || '').toLowerCase();
      if (consultationFilter === 'ACTIVE') {
        return s === 'confirmed' || s === 'in_progress' || s === 'pending';
      }
      if (consultationFilter === 'COMPLETED') {
        return s === 'completed';
      }
      if (consultationFilter === 'CANCELLED') {
        return s === 'cancelled';
      }
      return true;
    });
    return { filteredConsultations: filtered, activeCount: act, completedCount: comp, cancelledCount: cancel };
  }, [consultations, consultationFilter]);

  const currentChosenDay = upcomingDays[selectedDateIndex];

  // Virtualized list helpers — only the consultations/doctors actually on screen get built
  const renderConsultationItem = useCallback(
    ({ item }: { item: Consultation }) => (
      <ConsultationCardItem
        consultation={item}
        isJoining={joiningId === item.id}
        onJoinVideo={handleJoinVideoRoom}
        onCancel={handleCancelConsultation}
        onReview={handleOpenReviewModal}
        reviewsEnabled={isReviewsEnabled}
        cardWidth={vetCardWidth}
      />
    ),
    [joiningId, isReviewsEnabled, vetCardWidth, handleJoinVideoRoom, handleCancelConsultation, handleOpenReviewModal]
  );

  const keyExtractorConsultation = useCallback((item: Consultation) => String(item.id), []);

  const renderQueueEmpty = useCallback(() => {
    if (loadingConsultations) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
          <Text style={styles.loadingText}>Retrieving your consultation ledger...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Stethoscope size={40} color={COLORS.brandGold} />
        </View>
        <Text style={styles.emptyTitle}>No Consultations Found</Text>
        <Text style={styles.emptySub}>
          {consultationFilter === 'COMPLETED'
            ? 'You have no completed consultation records or past doctor notes yet.'
            : consultationFilter === 'CANCELLED'
            ? 'You have no cancelled appointments.'
            : 'You do not have any upcoming video appointments booked.'}
        </Text>
        <TouchableOpacity style={styles.bookNowBtn} onPress={() => setActiveTab('DOCTORS')}>
          <Text style={styles.bookNowBtnText}>Schedule with a Doctor</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loadingConsultations, consultationFilter]);

  const renderDoctorItem = useCallback(
    ({ item }: { item: Doctor }) => (
      <DoctorDirectoryCard
        doc={item}
        onSelectProfile={setProfileDoctor}
        onBook={setSelectedDoctor}
        cardWidth={vetCardWidth}
      />
    ),
    [vetCardWidth]
  );

  const keyExtractorDoctor = useCallback((item: Doctor) => String(item.id), []);

  const renderDoctorsEmpty = useCallback(() => {
    if (loadingDoctors) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
          <Text style={styles.loadingText}>Searching available veterinary specialists...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptySearchIconBox}>
          <Search size={28} color={COLORS.brandGold} />
        </View>
        <Text style={styles.emptyTitle}>No Specialists Found</Text>
        <Text style={styles.emptySub}>
          {searchQuery
            ? `No veterinarians matched "${searchQuery}". Try a different name or reset filters.`
            : activeFilterCount > 0
            ? `No doctors found matching the selected criteria${
                selectedCity !== 'ALL'
                  ? ` in ${dynamicCities.find((c) => c.key === selectedCity)?.display || selectedCity}`
                  : ''
              }${maxPriceLimit !== null ? ` under ₹${maxPriceLimit}` : ''}. Try relaxing your filters.`
            : 'No doctors found matching the selected criteria.'}
        </Text>
        {(searchQuery.length > 0 || activeFilterCount > 0) && (
          <TouchableOpacity style={styles.resetSearchBtn} onPress={resetAllFilters}>
            <Text style={styles.resetSearchBtnText}>Reset All Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [loadingDoctors, searchQuery, activeFilterCount, selectedCity, maxPriceLimit, dynamicCities, resetAllFilters]);


  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header — a presence ring on the brand mark signals "the
          practice is staffed" directly, instead of a separate eyebrow
          line; the right-side chip shows the real specialist count
          instead of a decorative "Available" claim. */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <View style={styles.medallionPresenceWrap}>
            <BrandMedallion size="sm" />
            <View style={styles.presenceRing} />
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>Vet Consultations</Text>
        </View>

        <View style={styles.specialistStatChip}>
          <Stethoscope size={13} color={COLORS.sageIcon} strokeWidth={2.3} />
          <Text style={styles.specialistStatCount}>{allDoctors.length}</Text>
          <Text style={styles.specialistStatLabel}>online</Text>
        </View>
      </View>

      {/* 2. Top Segmented Switcher */}
      <ResponsiveContainer>
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'QUEUE' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('QUEUE')}
          >
            <View style={styles.segmentBtnInner}>
              <CalendarIcon
                size={15}
                color={activeTab === 'QUEUE' ? '#FFFFFF' : COLORS.textCoffee}
              />
              <Text
                style={[
                  styles.segmentBtnText,
                  activeTab === 'QUEUE' && styles.segmentBtnTextActive,
                ]}
              >
                My Consultations ({consultations.length})
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'DOCTORS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('DOCTORS')}
          >
            <View style={styles.segmentBtnInner}>
              <Stethoscope
                size={15}
                color={activeTab === 'DOCTORS' ? '#FFFFFF' : COLORS.textCoffee}
              />
              <Text
                style={[
                  styles.segmentBtnText,
                  activeTab === 'DOCTORS' && styles.segmentBtnTextActive,
                ]}
              >
                Book a Specialist
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ResponsiveContainer>

      {/* 3. Tab-Specific Header (filter chips or search/filter bar) */}
      {activeTab === 'QUEUE' ? (
        <ResponsiveContainer style={styles.headerAreaContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                consultationFilter === 'ALL' && styles.filterChipActive,
              ]}
              onPress={() => setConsultationFilter('ALL')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  consultationFilter === 'ALL' && styles.filterChipTextActive,
                ]}
              >
                All ({consultations.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                consultationFilter === 'ACTIVE' && styles.filterChipActive,
              ]}
              onPress={() => setConsultationFilter('ACTIVE')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  consultationFilter === 'ACTIVE' && styles.filterChipTextActive,
                ]}
              >
                Active / Upcoming ({activeCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                consultationFilter === 'COMPLETED' && styles.filterChipActive,
              ]}
              onPress={() => setConsultationFilter('COMPLETED')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  consultationFilter === 'COMPLETED' && styles.filterChipTextActive,
                ]}
              >
                Completed & Notes ({completedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                consultationFilter === 'CANCELLED' && styles.filterChipCancelledActive,
              ]}
              onPress={() => setConsultationFilter('CANCELLED')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  consultationFilter === 'CANCELLED' && styles.filterChipTextActive,
                ]}
              >
                Cancelled ({cancelledCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer style={styles.headerAreaContainer}>
          {/* Search Bar & Filter Action Row */}
            <View style={styles.searchSection}>
              <View style={styles.searchRow}>
                <View style={styles.searchBarContainer}>
                  <Search size={16} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search doctor or clinic..."
                    placeholderTextColor={COLORS.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      style={styles.searchClearBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={14} color={COLORS.textCoffee} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Trigger Button */}
                <TouchableOpacity
                  style={[
                    styles.filterTriggerBtn,
                    activeFilterCount > 0 && styles.filterTriggerBtnActive,
                  ]}
                  onPress={() => openFilterModal('SPECIALIZATION')}
                >
                  <SlidersHorizontal
                    size={16}
                    color={activeFilterCount > 0 ? '#FFFFFF' : COLORS.forestGreen}
                  />
                  <Text
                    style={[
                      styles.filterTriggerBtnText,
                      activeFilterCount > 0 && styles.filterTriggerBtnTextActive,
                    ]}
                  >
                    Filters
                  </Text>
                  {activeFilterCount > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Vets Near Me Trigger */}
                <TouchableOpacity
                  style={styles.filterTriggerBtn}
                  onPress={() => setShowNearbyVetsModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Find vets near me"
                >
                  <MapPin size={16} color={COLORS.forestGreen} />
                  <Text style={styles.filterTriggerBtnText}>Near Me</Text>
                </TouchableOpacity>
              </View>

              {/* Dynamic Quick Dropdown Trigger Pills (Zero Hardcoding) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dropdownTriggersStrip}
              >
                {/* 1. Specialty Dropdown Trigger */}
                <TouchableOpacity
                  style={[
                    styles.dropdownTriggerPill,
                    selectedSpecialization !== 'ALL' && styles.dropdownTriggerPillActive,
                  ]}
                  onPress={() => openFilterModal('SPECIALIZATION')}
                >
                  <Stethoscope
                    size={13}
                    color={
                      selectedSpecialization !== 'ALL' ? '#FFFFFF' : COLORS.forestGreen
                    }
                  />
                  <Text
                    style={[
                      styles.dropdownTriggerPillText,
                      selectedSpecialization !== 'ALL' &&
                        styles.dropdownTriggerPillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedSpecialization === 'ALL'
                      ? 'Specialty'
                      : selectedSpecialization}
                  </Text>
                  <ChevronDown
                    size={13}
                    color={
                      selectedSpecialization !== 'ALL' ? '#FFFFFF' : COLORS.textMuted
                    }
                  />
                </TouchableOpacity>

                {/* 2. City Dropdown Trigger (Only Available Doctors in City) */}
                <TouchableOpacity
                  style={[
                    styles.dropdownTriggerPill,
                    selectedCity !== 'ALL' && styles.dropdownTriggerPillActive,
                  ]}
                  onPress={() => openFilterModal('CITY')}
                >
                  <MapPin
                    size={13}
                    color={selectedCity !== 'ALL' ? '#FFFFFF' : COLORS.brandGold}
                  />
                  <Text
                    style={[
                      styles.dropdownTriggerPillText,
                      selectedCity !== 'ALL' && styles.dropdownTriggerPillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedCity === 'ALL'
                      ? 'City'
                      : dynamicCities.find((c) => c.key === selectedCity)?.display ||
                        selectedCity}
                  </Text>
                  <ChevronDown
                    size={13}
                    color={selectedCity !== 'ALL' ? '#FFFFFF' : COLORS.textMuted}
                  />
                </TouchableOpacity>

                {/* 3. Price Limit Dropdown Trigger */}
                <TouchableOpacity
                  style={[
                    styles.dropdownTriggerPill,
                    maxPriceLimit !== null && styles.dropdownTriggerPillActive,
                  ]}
                  onPress={() => openFilterModal('PRICE')}
                >
                  <Text
                    style={[
                      styles.feeSymbol,
                      maxPriceLimit !== null && styles.dropdownTriggerPillTextActive,
                    ]}
                  >
                    ₹
                  </Text>
                  <Text
                    style={[
                      styles.dropdownTriggerPillText,
                      maxPriceLimit !== null && styles.dropdownTriggerPillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {maxPriceLimit === null ? 'Fee Limit' : `≤ ₹${maxPriceLimit}`}
                  </Text>
                  <ChevronDown
                    size={13}
                    color={maxPriceLimit !== null ? '#FFFFFF' : COLORS.textMuted}
                  />
                </TouchableOpacity>
              </ScrollView>

              {/* Active Filter Chips with Quick Dismiss */}
              {activeFilterCount > 0 && (
                <View style={styles.activeFiltersRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.activeChipsWrap}>
                      {selectedSpecialization !== 'ALL' && (
                        <TouchableOpacity
                          style={styles.activeFilterChip}
                          onPress={() => setSelectedSpecialization('ALL')}
                        >
                          <Text style={styles.activeFilterChipText}>
                            {selectedSpecialization}
                          </Text>
                          <X size={12} color={COLORS.forestGreen} />
                        </TouchableOpacity>
                      )}

                      {selectedCity !== 'ALL' && (
                        <TouchableOpacity
                          style={styles.activeFilterChip}
                          onPress={() => setSelectedCity('ALL')}
                        >
                          <Text style={styles.activeFilterChipText}>
                            📍{' '}
                            {dynamicCities.find((c) => c.key === selectedCity)
                              ?.display || selectedCity}
                          </Text>
                          <X size={12} color={COLORS.forestGreen} />
                        </TouchableOpacity>
                      )}

                      {maxPriceLimit !== null && (
                        <TouchableOpacity
                          style={styles.activeFilterChip}
                          onPress={() => setMaxPriceLimit(null)}
                        >
                          <Text style={styles.activeFilterChipText}>
                            ≤ ₹{maxPriceLimit}
                          </Text>
                          <X size={12} color={COLORS.forestGreen} />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.clearAllFiltersBtn}
                        onPress={resetAllFilters}
                      >
                        <Text style={styles.clearAllFiltersText}>Clear all</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Results Count Summary */}
              <View style={styles.searchSummaryRow}>
                <Text style={styles.searchSummaryText}>
                  {loadingDoctors
                    ? 'Searching specialists...'
                    : `${doctors.length} ${
                        doctors.length === 1 ? 'specialist' : 'specialists'
                      } available${
                        selectedCity !== 'ALL'
                          ? ` in ${
                              dynamicCities.find((c) => c.key === selectedCity)
                                ?.display || selectedCity
                            }`
                          : ''
                      }`}
                </Text>
                {(searchQuery.length > 0 || activeFilterCount > 0) && (
                  <TouchableOpacity onPress={resetAllFilters}>
                    <Text style={styles.resetFiltersText}>Reset filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
        </ResponsiveContainer>
      )}

      {/* Virtualized List — only the cards actually on screen get built */}
      {activeTab === 'QUEUE' ? (
        <FlatList
          key={isTablet ? 'queue-grid' : 'queue-list'}
          data={loadingConsultations ? [] : filteredConsultations}
          keyExtractor={keyExtractorConsultation}
          renderItem={renderConsultationItem}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? styles.consultationsGridRow : undefined}
          ListEmptyComponent={renderQueueEmpty}
          contentContainerStyle={[
            styles.scrollBody,
            isTablet && { maxWidth: 1040, width: '100%', alignSelf: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.forestGreen]} />
          }
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      ) : (
        <FlatList
          key={isTablet ? 'doctors-grid' : 'doctors-list'}
          data={loadingDoctors ? [] : doctors}
          keyExtractor={keyExtractorDoctor}
          renderItem={renderDoctorItem}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? styles.doctorGridRow : undefined}
          ListEmptyComponent={renderDoctorsEmpty}
          contentContainerStyle={[
            styles.scrollBody,
            isTablet && { maxWidth: 1040, width: '100%', alignSelf: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.forestGreen]} />
          }
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      {/* ======================================================== */}
      {/* 4-7. Booking, Profile, Filter & Review Modals             */}
      {/* ======================================================== */}
      <BookingModal
        doctor={selectedDoctor}
        onClose={() => setSelectedDoctor(null)}
        pets={pets}
        bookingPetId={bookingPetId}
        onSelectPet={setBookingPetId}
        upcomingDays={upcomingDays}
        selectedDateIndex={selectedDateIndex}
        onSelectDateIndex={setSelectedDateIndex}
        currentChosenDay={currentChosenDay}
        workingDaysSet={workingDaysSet}
        scheduleSummary={scheduleSummary}
        loadingSlots={loadingSlots}
        doctorSlots={doctorSlots}
        categorizedSlots={categorizedSlots}
        selectedTime={selectedTime}
        onSelectTime={setSelectedTime}
        isSlotInPast={isSlotInPast}
        reason={reason}
        onChangeReason={setReason}
        bookingLoading={bookingLoading}
        onConfirmBooking={handleConfirmBooking}
      />

      <DoctorProfileModal
        doctor={profileDoctor}
        doctorDetail={profileDoctorDetail}
        loading={loadingProfile}
        reviews={profileReviews}
        scheduleSummary={profileScheduleSummary}
        onClose={() => setProfileDoctor(null)}
        onBook={() => {
          const docToBook = profileDoctor;
          setProfileDoctor(null);
          setSelectedDoctor(docToBook);
        }}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        section={filterModalSection}
        onChangeSection={setFilterModalSection}
        tempSpec={tempSpec}
        onChangeTempSpec={setTempSpec}
        tempCity={tempCity}
        onChangeTempCity={setTempCity}
        tempPriceLimit={tempPriceLimit}
        onChangeTempPriceLimit={setTempPriceLimit}
        onResetTemp={() => {
          setTempSpec('ALL');
          setTempCity('ALL');
          setTempPriceLimit(null);
        }}
        dynamicSpecializations={dynamicSpecializations}
        dynamicCities={dynamicCities}
        dynamicPriceStats={dynamicPriceStats}
        allDoctorsCount={allDoctors.length}
        modalPreviewCount={modalPreviewCount}
        onApply={applyFilters}
      />

      <ReviewModal
        isOpen={!!reviewConsultationId}
        onClose={() => setReviewConsultationId(null)}
        rating={reviewRating}
        onChangeRating={setReviewRating}
        comment={reviewComment}
        onChangeComment={setReviewComment}
        isSubmitting={isSubmittingReview}
        onSubmit={handleSubmitReview}
      />

      <NearbyVetsModal
        isOpen={showNearbyVetsModal}
        onClose={() => setShowNearbyVetsModal(false)}
        onSelectDoctor={setSelectedDoctor}
        onBookOnlineInstead={() => {}}
      />

      {/* Consultation Fee Payment (Razorpay) */}
      {consultPaymentIntent && (
        <RazorpayModal
          visible={showConsultPayment}
          description={`Veterinary Consultation - Dr. ${selectedDoctor?.name || 'Specialist'}`}
          razorpayOrderId={consultPaymentIntent.razorpayOrderId}
          razorpayKeyId={consultPaymentIntent.razorpayKeyId}
          amount={consultPaymentIntent.amount}
          userName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Pet Parent'}
          userEmail={user?.email || undefined}
          userPhone={user?.phone || undefined}
          onSuccess={handleConsultPaymentSuccess}
          onFailure={handleConsultPaymentFailure}
          onClose={() => setShowConsultPayment(false)}
        />
      )}
    </SafeAreaView>
  );
}
