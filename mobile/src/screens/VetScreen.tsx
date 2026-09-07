import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
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
  AlertCircle,
  Building2,
  Sunrise,
  Sun,
  Moon,
  Star,
  MapPin,
  Award,
  Info,
  ChevronRight,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { BrandMedallion } from '../components/BrandLogo';
import { Doctor } from '../types';
import { useResponsive } from '../hooks/useResponsive';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { usePetStore } from '../store/petStore';
import { useAuthStore } from '../store/authStore';
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

type ActiveTab = 'QUEUE' | 'DOCTORS';
type ConsultationFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';

const QUICK_SYMPTOMS = [
  '🐾 Skin Itching & Allergies',
  '🥗 Transition to Fresh Food',
  '🤢 Digestive Issues & Vomiting',
  '⚖️ Weight & Portion Guidance',
  '🦴 Joint & Mobility Health',
  '🩺 General Nutrition Review',
];

const formatLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Pure Helpers Hoisted Outside Component
const getStatusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'confirmed' || s === 'in_progress') {
    return {
      bg: '#EDF5F0',
      text: COLORS.forestGreen,
      label: s === 'in_progress' ? 'LIVE NOW' : 'CONFIRMED',
    };
  }
  if (s === 'completed') {
    return { bg: '#F3F4F6', text: '#4B5563', label: 'COMPLETED' };
  }
  if (s === 'cancelled') {
    return { bg: '#FEE2E2', text: '#DC2626', label: 'CANCELLED' };
  }
  return { bg: '#FAF5EE', text: '#B45309', label: 'PENDING' };
};

const formatDate = (isoStr: string) => {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
};

const getDoctorImageUrl = (doc: any) => {
  return doc?.profile_image_url || doc?.user?.profile_image_url || null;
};

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
  const { isTablet, contentWidth, cardColumns, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();
  const vetCardWidth = isTablet ? (Math.min(contentWidth, 1040) - 40 - 14) / 2 : '100%';
  const isBookingEnabled = useFeatureFlag('consultations_booking', true);
  const isReviewsEnabled = useFeatureFlag('consultations_reviews', true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('QUEUE');
  const [consultationFilter, setConsultationFilter] = useState<ConsultationFilter>('ALL');

  // Consultations State
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loadingConsultations, setLoadingConsultations] = useState(true);
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

  const resetAllFilters = () => {
    setSelectedSpecialization('ALL');
    setSelectedCity('ALL');
    setMaxPriceLimit(null);
    setSearchQuery('');
    setTempSpec('ALL');
    setTempCity('ALL');
    setTempPriceLimit(null);
    setIsFilterModalOpen(false);
  };

  // Booking Modal State
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
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
  const consultationsLastFetchedRef = useRef(0);
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

  const onRefresh = () => {
    setRefreshing(true);
    loadConsultations(true);
    loadDoctorsAndPets();
  };

  const formatTime12h = (time24: string) => {
    if (!time24) return 'Select a Slot';
    try {
      const [hStr, mStr] = time24.split(':');
      let h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${h.toString().padStart(2, '0')}:${mStr} ${ampm}`;
    } catch {
      return time24;
    }
  };

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
  const handleJoinVideoRoom = async (consultation: Consultation) => {
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
  };

  // 6. Handle Cancellation
  const handleCancelConsultation = (consultationId: number) => {
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
  };

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
  const { filteredConsultations, activeCount, completedCount } = useMemo(() => {
    let act = 0;
    let comp = 0;
    for (const c of consultations) {
      const s = (c.status || '').toLowerCase();
      if (s === 'confirmed' || s === 'in_progress' || s === 'pending') act++;
      if (s === 'completed') comp++;
    }
    const filtered = consultations.filter((c) => {
      const s = (c.status || '').toLowerCase();
      if (consultationFilter === 'ACTIVE') {
        return s === 'confirmed' || s === 'in_progress' || s === 'pending';
      }
      if (consultationFilter === 'COMPLETED') {
        return s === 'completed';
      }
      return true;
    });
    return { filteredConsultations: filtered, activeCount: act, completedCount: comp };
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
    [joiningId, isReviewsEnabled, vetCardWidth]
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
      {/* 1. Header */}
      <View style={styles.header}>
        <View style={styles.headerLeftGroup}>
          <BrandMedallion size="sm" />
          <View style={styles.headerTextCol}>
            <View style={styles.brandRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.brandLabel}>TELEMEDICINE & NUTRITION</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>Vet Consultations</Text>
          </View>
        </View>

        <View style={styles.liveBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.liveBadgeText}>Specialists Available</Text>
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
          <View style={styles.filterChipRow}>
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
          </View>
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
      {/* 4. INTERACTIVE BOOKING MODAL (Date & Time Picker)        */}
      {/* ======================================================== */}
      <Modal visible={!!selectedDoctor} transparent animationType="slide">
        <View style={isTablet ? modalOverlayStyle : styles.modalOverlay}>
          <View style={[styles.modalSheet, isTablet && modalSheetContainerStyle]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalSubHeader}>SCHEDULE APPOINTMENT</Text>
                <Text style={styles.modalTitle}>Book Video Consultation</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedDoctor(null)}
                style={styles.closeBtn}
              >
                <X size={20} color={COLORS.textCoffee} />
              </TouchableOpacity>
            </View>

            {selectedDoctor && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalBody}
              >
                {/* Doctor Card Brief */}
                <View style={styles.modalDoctorBrief}>
                  {getDoctorImageUrl(selectedDoctor) ? (
                    <Image
                      source={{ uri: getDoctorImageUrl(selectedDoctor)! }}
                      style={styles.modalDocAvatarImg}

                    />
                  ) : (
                    <View style={styles.docBriefAvatar}>
                      <Stethoscope size={20} color={COLORS.forestGreen} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalDocName}>
                      {selectedDoctor.name ||
                        (selectedDoctor.user
                          ? `Dr. ${selectedDoctor.user.first_name}`
                          : 'Specialist')}
                    </Text>
                    <Text style={styles.modalDocSpec}>
                      {selectedDoctor.specialization}
                    </Text>
                    <Text style={styles.modalDocFee}>
                      Consultation Fee: ₹
                      {Number(selectedDoctor.consultation_fee).toFixed(0)} (30 min video)
                    </Text>
                  </View>
                </View>

                {/* 1. SELECT PATIENT */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.modalFieldLabel}>1. SELECT PATIENT (PET)</Text>
                  <Text style={styles.requiredBadge}>REQUIRED</Text>
                </View>

                {pets.length === 0 ? (
                  <View style={styles.noPetsWarning}>
                    <AlertCircle size={16} color="#B45309" />
                    <Text style={styles.noPetsText}>
                      No registered pets found. Please add a pet in the Pets tab first.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.petsScroll}
                  >
                    {pets.map((p) => {
                      const isChosen = bookingPetId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.petCard, isChosen && styles.petCardSelected]}
                          onPress={() => setBookingPetId(p.id)}
                        >
                          {p.profile_image_url ? (
                            <Image
                              source={{ uri: p.profile_image_url }}
                              style={styles.petAvatarImg}

                            />
                          ) : (
                            <View
                              style={[
                                styles.petAvatarBox,
                                isChosen && styles.petAvatarBoxSelected,
                              ]}
                            >
                              <PawPrint
                                size={16}
                                color={isChosen ? '#FFFFFF' : COLORS.brandGold}
                              />
                            </View>
                          )}
                          <View>
                            <Text
                              style={[
                                styles.petNameText,
                                isChosen && styles.petNameTextSelected,
                              ]}
                            >
                              {p.name}
                            </Text>
                            <Text
                              style={[
                                styles.petBreedText,
                                isChosen && styles.petBreedTextSelected,
                              ]}
                            >
                              {p.breed || p.species || 'Dog'}
                            </Text>
                          </View>
                          {isChosen && (
                            <CheckCircle2 size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* 2. SELECT DATE (14-DAY CALENDAR STRIP) */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.modalFieldLabel}>2. SELECT APPOINTMENT DATE</Text>
                  <Text style={styles.subDateHint}>
                    {currentChosenDay.dayName}, {currentChosenDay.dayNum}{' '}
                    {currentChosenDay.month}
                  </Text>
                </View>

                {scheduleSummary ? (
                  <View style={styles.scheduleSummaryBanner}>
                    <Clock size={13} color={COLORS.forestGreen} />
                    <Text style={styles.scheduleSummaryText}>
                      Clinical Hours: {scheduleSummary}
                    </Text>
                  </View>
                ) : null}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.calendarStrip}
                >
                  {upcomingDays.map((day, idx) => {
                    const isSelected = selectedDateIndex === idx;
                    const isWorking =
                      workingDaysSet.size === 0 || workingDaysSet.has(day.dayOfWeek);

                    return (
                      <TouchableOpacity
                        key={day.dateStr}
                        style={[
                          styles.dateItem,
                          !isWorking && styles.dateItemOffDuty,
                          isSelected && styles.dateItemSelected,
                        ]}
                        onPress={() => setSelectedDateIndex(idx)}
                      >
                        <Text
                          style={[
                            styles.dateDayName,
                            !isWorking && styles.dateDayNameOffDuty,
                            isSelected && styles.dateDayNameSelected,
                          ]}
                        >
                          {day.dayName}
                        </Text>
                        <Text
                          style={[
                            styles.dateNumber,
                            !isWorking && styles.dateNumberOffDuty,
                            isSelected && styles.dateNumberSelected,
                          ]}
                        >
                          {day.dayNum}
                        </Text>
                        <Text
                          style={[
                            styles.dateMonth,
                            !isWorking && styles.dateMonthOffDuty,
                            isSelected && styles.dateMonthSelected,
                          ]}
                        >
                          {day.month}
                        </Text>
                        {isSelected ? (
                          <View style={styles.dateDotActive} />
                        ) : isWorking ? (
                          <View style={styles.dateDotWorking} />
                        ) : (
                          <Text style={styles.dateOffBadge}>OFF</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* 3. SELECT TIME SLOT (Strictly Doctor's Scheduled Hours) */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.modalFieldLabel}>3. DOCTOR'S SCHEDULED HOURS</Text>
                  {loadingSlots ? (
                    <ActivityIndicator size="small" color={COLORS.forestGreen} />
                  ) : selectedTime ? (
                    <Text style={styles.selectedTimeBadge}>
                      {formatTime12h(selectedTime)}
                    </Text>
                  ) : null}
                </View>

                {loadingSlots ? (
                  <View style={styles.slotLoadingBox}>
                    <ActivityIndicator size="small" color={COLORS.forestGreen} />
                    <Text style={styles.slotLoadingText}>
                      Checking Dr. {selectedDoctor.name || 'specialist'}’s schedule...
                    </Text>
                  </View>
                ) : doctorSlots.length === 0 ? (
                  /* When doctor has no slots on this date */
                  <View style={styles.noDoctorSlotsCard}>
                    <CalendarIcon size={24} color={COLORS.brandGold} />
                    <Text style={styles.noDoctorSlotsTitle}>
                      {workingDaysSet.size > 0 && !workingDaysSet.has(currentChosenDay.dayOfWeek)
                        ? `Doctor Off-Duty on ${currentChosenDay.dayName}`
                        : 'No Slots Available for this Date'}
                    </Text>
                    <Text style={styles.noDoctorSlotsSub}>
                      {workingDaysSet.size > 0 && !workingDaysSet.has(currentChosenDay.dayOfWeek)
                        ? `Dr. ${selectedDoctor.name || 'this specialist'} has no consultation hours on ${currentChosenDay.dayOfWeek}. ${scheduleSummary ? 'Active clinical hours: ' + scheduleSummary + '.' : ''} Please tap a highlighted working day (green dot) above.`
                        : `All consultation slots for Dr. ${selectedDoctor.name || 'this specialist'} on ${currentChosenDay.dayName}, ${currentChosenDay.dayNum} ${currentChosenDay.month} have already passed today or are booked. Please pick an upcoming working day.`}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.slotsSourceNotice}>
                      <CheckCircle2 size={12} color={COLORS.forestGreen} />
                      <Text style={styles.slotsSourceText}>
                        Official Doctor Schedule • {doctorSlots.length} Available Slots
                      </Text>
                    </View>

                    {/* Morning Section */}
                    {categorizedSlots.morning.length > 0 && (
                      <View style={styles.slotPeriodGroup}>
                        <View style={styles.slotPeriodHeader}>
                          <Sunrise size={14} color="#D97706" />
                          <Text style={styles.slotPeriodTitle}>
                            Morning Slots ({categorizedSlots.morning.length})
                          </Text>
                        </View>
                        <View style={styles.slotsGrid}>
                          {categorizedSlots.morning.map((slot) => {
                            const isSelected = selectedTime === slot;
                            const inPast = isSlotInPast(slot, currentChosenDay.dateStr);

                            return (
                              <TouchableOpacity
                                key={slot}
                                style={[
                                  styles.timeSlotChip,
                                  isSelected && styles.timeSlotChipSelected,
                                  inPast && styles.timeSlotChipDisabled,
                                ]}
                                onPress={() => {
                                  if (!inPast) setSelectedTime(slot);
                                }}
                                disabled={inPast}
                              >
                                <Clock
                                  size={12}
                                  color={
                                    inPast
                                      ? '#D1D5DB'
                                      : isSelected
                                      ? '#FFFFFF'
                                      : COLORS.forestGreen
                                  }
                                />
                                <Text
                                  style={[
                                    styles.timeSlotText,
                                    isSelected && styles.timeSlotTextSelected,
                                    inPast && styles.timeSlotTextDisabled,
                                  ]}
                                >
                                  {formatTime12h(slot)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Afternoon Section */}
                    {categorizedSlots.afternoon.length > 0 && (
                      <View style={styles.slotPeriodGroup}>
                        <View style={styles.slotPeriodHeader}>
                          <Sun size={14} color="#D97706" />
                          <Text style={styles.slotPeriodTitle}>
                            Afternoon Slots ({categorizedSlots.afternoon.length})
                          </Text>
                        </View>
                        <View style={styles.slotsGrid}>
                          {categorizedSlots.afternoon.map((slot) => {
                            const isSelected = selectedTime === slot;
                            const inPast = isSlotInPast(slot, currentChosenDay.dateStr);

                            return (
                              <TouchableOpacity
                                key={slot}
                                style={[
                                  styles.timeSlotChip,
                                  isSelected && styles.timeSlotChipSelected,
                                  inPast && styles.timeSlotChipDisabled,
                                ]}
                                onPress={() => {
                                  if (!inPast) setSelectedTime(slot);
                                }}
                                disabled={inPast}
                              >
                                <Clock
                                  size={12}
                                  color={
                                    inPast
                                      ? '#D1D5DB'
                                      : isSelected
                                      ? '#FFFFFF'
                                      : COLORS.forestGreen
                                  }
                                />
                                <Text
                                  style={[
                                    styles.timeSlotText,
                                    isSelected && styles.timeSlotTextSelected,
                                    inPast && styles.timeSlotTextDisabled,
                                  ]}
                                >
                                  {formatTime12h(slot)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Evening Section */}
                    {categorizedSlots.evening.length > 0 && (
                      <View style={styles.slotPeriodGroup}>
                        <View style={styles.slotPeriodHeader}>
                          <Moon size={14} color="#4B5563" />
                          <Text style={styles.slotPeriodTitle}>
                            Evening Slots ({categorizedSlots.evening.length})
                          </Text>
                        </View>
                        <View style={styles.slotsGrid}>
                          {categorizedSlots.evening.map((slot) => {
                            const isSelected = selectedTime === slot;
                            const inPast = isSlotInPast(slot, currentChosenDay.dateStr);

                            return (
                              <TouchableOpacity
                                key={slot}
                                style={[
                                  styles.timeSlotChip,
                                  isSelected && styles.timeSlotChipSelected,
                                  inPast && styles.timeSlotChipDisabled,
                                ]}
                                onPress={() => {
                                  if (!inPast) setSelectedTime(slot);
                                }}
                                disabled={inPast}
                              >
                                <Clock
                                  size={12}
                                  color={
                                    inPast
                                      ? '#D1D5DB'
                                      : isSelected
                                      ? '#FFFFFF'
                                      : COLORS.forestGreen
                                  }
                                />
                                <Text
                                  style={[
                                    styles.timeSlotText,
                                    isSelected && styles.timeSlotTextSelected,
                                    inPast && styles.timeSlotTextDisabled,
                                  ]}
                                >
                                  {formatTime12h(slot)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* 4. CHIEF SYMPTOMS & REASON */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.modalFieldLabel}>
                    4. CHIEF REASON / SYMPTOMS
                  </Text>
                  <Text style={styles.requiredBadge}>REQUIRED</Text>
                </View>

                {/* Quick Symptom Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.quickSymptomsScroll}
                >
                  {QUICK_SYMPTOMS.map((sym, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.quickSymptomChip}
                      onPress={() => {
                        const clean = sym.replace(/^[^\w]+/, '').trim();
                        setReason((prev) => (prev ? `${prev}, ${clean}` : clean));
                      }}
                    >
                      <Text style={styles.quickSymptomText}>{sym}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TextInput
                  style={styles.reasonInput}
                  placeholder="Describe your pet's current diet, allergies, or symptoms in detail..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  value={reason}
                  onChangeText={setReason}
                />

                {/* 5. APPOINTMENT SUMMARY CARD */}
                <View style={styles.appointmentSummaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>APPOINTMENT DATE & TIME</Text>
                    <Text style={styles.summaryValue}>
                      {currentChosenDay.dayName}, {currentChosenDay.dayNum}{' '}
                      {currentChosenDay.month} at{' '}
                      {selectedTime ? formatTime12h(selectedTime) : 'None Selected'}
                    </Text>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>PATIENT</Text>
                    <Text style={styles.summaryValue}>
                      {pets.find((p) => p.id === bookingPetId)?.name || 'Selected Pet'}
                    </Text>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>TOTAL CONSULTATION FEE</Text>
                    <Text style={styles.summaryFee}>
                      ₹{Number(selectedDoctor.consultation_fee).toFixed(0)}
                    </Text>
                  </View>
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                  style={[
                    styles.confirmBookBtn,
                    (bookingLoading || doctorSlots.length === 0 || !selectedTime) &&
                      styles.btnDisabled,
                  ]}
                  onPress={handleConfirmBooking}
                  disabled={bookingLoading || doctorSlots.length === 0 || !selectedTime}
                >
                  {bookingLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Video size={18} color="#FFFFFF" />
                      <Text style={styles.confirmBookBtnText}>
                        {doctorSlots.length === 0
                          ? 'No Slots on this Date - Pick Another Day'
                          : `Pay ₹${Number(selectedDoctor.consultation_fee).toFixed(0)} & Confirm`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* 5. DEDICATED DOCTOR PROFILE MODAL                        */}
      {/* ======================================================== */}
      <Modal visible={!!profileDoctor} transparent animationType="slide">
        <View style={isTablet ? modalOverlayStyle : styles.modalOverlay}>
          <View style={[styles.profileModalSheet, isTablet && modalSheetContainerStyle]}>
            {/* Profile Header Bar */}
            <View style={styles.modalHeader}>
              <View style={styles.profileHeaderBadgeRow}>
                <ShieldCheck size={18} color={COLORS.forestGreen} />
                <View>
                  <Text style={styles.modalSubHeader}>CLINICAL SPECIALIST</Text>
                  <Text style={styles.modalTitle}>Doctor Profile</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setProfileDoctor(null)}
                style={styles.closeBtn}
              >
                <X size={20} color={COLORS.textCoffee} />
              </TouchableOpacity>
            </View>

            {loadingProfile ? (
              <View style={styles.profileLoadingBox}>
                <ActivityIndicator size="large" color={COLORS.forestGreen} />
                <Text style={styles.slotLoadingText}>
                  Loading specialist credentials & reviews...
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.profileContentScroll}
              >
                {profileDoctor && (
                  <>
                    {/* Hero Card */}
                    <View style={styles.profileHeroCard}>
                      {getDoctorImageUrl(profileDoctor) ? (
                        <Image
                          source={{ uri: getDoctorImageUrl(profileDoctor)! }}
                          style={styles.profileHeroImg}

                        />
                      ) : (
                        <View style={styles.profileHeroImgFallback}>
                          <Stethoscope size={36} color={COLORS.forestGreen} />
                        </View>
                      )}

                      <Text style={styles.profileHeroName}>
                        {profileDoctorDetail?.name ||
                          profileDoctor.name ||
                          (profileDoctor.user
                            ? `Dr. ${profileDoctor.user.first_name} ${
                                profileDoctor.user.last_name || ''
                              }`.trim()
                            : 'Veterinary Specialist')}
                      </Text>

                      <Text style={styles.profileHeroSpec}>
                        {profileDoctorDetail?.specialization ||
                          profileDoctor.specialization}
                      </Text>

                      {/* Highlights Pill Row */}
                      <View style={styles.profilePillRow}>
                        <View style={styles.profileHighlightPill}>
                          <Star size={12} color="#D97706" fill="#D97706" />
                          <Text style={styles.profileHighlightPillText}>
                            {profileDoctorDetail?.average_rating
                              ? `${profileDoctorDetail.average_rating.toFixed(
                                  1
                                )} (${profileDoctorDetail.review_count || 0})`
                              : '5.0 Rating'}
                          </Text>
                        </View>

                        {profileDoctor.experience_years ? (
                          <View style={styles.profileHighlightPill}>
                            <Award size={12} color={COLORS.forestGreen} />
                            <Text style={styles.profileHighlightPillText}>
                              {profileDoctor.experience_years} Years Exp
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.profileHighlightPill}>
                          <ShieldCheck size={12} color={COLORS.forestGreen} />
                          <Text style={styles.profileHighlightPillText}>
                            Verified
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* About Doctor (Full Bio) */}
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>
                        ABOUT THE SPECIALIST
                      </Text>
                      <Text style={styles.profileBioText}>
                        {profileDoctorDetail?.bio ||
                          profileDoctor.bio ||
                          'Dedicated veterinary nutritionist committed to helping pets thrive on wholesome, balanced nutrition.'}
                      </Text>
                    </View>

                    {/* Credentials & Expertise */}
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>
                        CREDENTIALS & EXPERTISE
                      </Text>
                      <View style={styles.profileInfoBox}>
                        <View style={styles.profileInfoRow}>
                          <Award size={16} color={COLORS.brandGold} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.profileInfoLabel}>
                              Medical Qualification
                            </Text>
                            <Text style={styles.profileInfoValue}>
                              {profileDoctorDetail?.qualification ||
                                profileDoctor.qualification ||
                                'Certified Veterinary Professional'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.profileInfoDivider} />

                        <View style={styles.profileInfoRow}>
                          <Stethoscope size={16} color={COLORS.forestGreen} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.profileInfoLabel}>
                              Specialization
                            </Text>
                            <Text style={styles.profileInfoValue}>
                              {profileDoctorDetail?.specialization ||
                                profileDoctor.specialization}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Associated Clinic */}
                    {profileDoctorDetail?.clinic && (
                      <View style={styles.profileSection}>
                        <Text style={styles.profileSectionTitle}>
                          AFFILIATED CLINIC
                        </Text>
                        <View style={styles.profileInfoBox}>
                          <View style={styles.profileInfoRow}>
                            <Building2 size={16} color={COLORS.forestGreen} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.profileInfoLabel}>
                                Practice / Clinic Name
                              </Text>
                              <Text style={styles.profileInfoValue}>
                                {profileDoctorDetail.clinic.name}
                              </Text>
                            </View>
                          </View>

                          {(profileDoctorDetail.clinic.city ||
                            profileDoctorDetail.clinic.state) && (
                            <>
                              <View style={styles.profileInfoDivider} />
                              <View style={styles.profileInfoRow}>
                                <MapPin size={16} color={COLORS.brandGold} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.profileInfoLabel}>
                                    Location
                                  </Text>
                                  <Text style={styles.profileInfoValue}>
                                    {[
                                      profileDoctorDetail.clinic.city,
                                      profileDoctorDetail.clinic.state,
                                    ]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </Text>
                                </View>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Clinical Schedule */}
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>
                        CONSULTATION SCHEDULE
                      </Text>
                      <View style={styles.profileScheduleBox}>
                        <Clock size={16} color={COLORS.forestGreen} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.profileScheduleTitle}>
                            Working Hours
                          </Text>
                          <Text style={styles.profileScheduleSub}>
                            {profileScheduleSummary ||
                              'Monday to Friday • Official Consultation Hours'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Patient Reviews */}
                    <View style={styles.profileSection}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.profileSectionTitle}>
                          PATIENT REVIEWS
                        </Text>
                        <Text style={styles.reviewsCountBadge}>
                          {profileReviews.length} Verified Reviews
                        </Text>
                      </View>

                      {profileReviews.length === 0 ? (
                        <View style={styles.noReviewsBox}>
                          <Text style={styles.noReviewsText}>
                            No reviews submitted yet for this specialist.
                          </Text>
                        </View>
                      ) : (
                        profileReviews.map((rev) => {
                          const reviewerName = rev.customer
                            ? [rev.customer.first_name, rev.customer.last_name]
                                .filter(Boolean)
                                .join(' ')
                            : 'Pet Parent';
                          const dateFormatted = new Date(
                            rev.created_at
                          ).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });

                          return (
                            <View key={rev.id} style={styles.reviewCard}>
                              <View style={styles.reviewCardTop}>
                                <View style={styles.reviewerInfo}>
                                  <View style={styles.reviewerAvatar}>
                                    <Text style={styles.reviewerAvatarText}>
                                      {(reviewerName[0] || 'P').toUpperCase()}
                                    </Text>
                                  </View>
                                  <View>
                                    <Text style={styles.reviewerName}>
                                      {reviewerName}
                                    </Text>
                                    <Text style={styles.reviewDate}>
                                      {dateFormatted}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.reviewStarsRow}>
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      size={11}
                                      color={
                                        s <= rev.rating ? '#D97706' : '#E5E7EB'
                                      }
                                      fill={
                                        s <= rev.rating ? '#D97706' : 'none'
                                      }
                                    />
                                  ))}
                                </View>
                              </View>
                              {rev.comment ? (
                                <Text style={styles.reviewComment}>
                                  {rev.comment.trim()}
                                </Text>
                              ) : null}
                            </View>
                          );
                        })
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            )}

            {/* Bottom Sticky Action Bar */}
            {profileDoctor && (
              <View style={styles.profileBottomBar}>
                <View>
                  <Text style={styles.feeLabel}>CONSULTATION FEE</Text>
                  <Text style={styles.feeVal}>
                    ₹{Number(profileDoctor.consultation_fee).toFixed(0)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.profileBookBtn,
                    !profileDoctor.is_available && styles.bookDocBtnDisabled,
                  ]}
                  disabled={!profileDoctor.is_available}
                  onPress={() => {
                    const docToBook = profileDoctor;
                    setProfileDoctor(null);
                    setSelectedDoctor(docToBook);
                  }}
                >
                  <Video size={16} color="#FFFFFF" />
                  <Text style={styles.profileBookBtnText}>
                    {profileDoctor.is_available
                      ? 'Book Video Consult'
                      : 'Currently Away'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* 6. DYNAMIC SPECIALISTS FILTER BOTTOM SHEET MODAL        */}
      {/* ======================================================== */}
      <Modal visible={isFilterModalOpen} transparent animationType="slide">
        <View style={isTablet ? modalOverlayStyle : styles.modalOverlay}>
          <View style={[styles.filterModalSheet, isTablet && modalSheetContainerStyle]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.profileHeaderBadgeRow}>
                <SlidersHorizontal size={18} color={COLORS.forestGreen} />
                <View>
                  <Text style={styles.modalSubHeader}>REFINED DISCOVERY</Text>
                  <Text style={styles.modalTitle}>Filter Specialists</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity
                  onPress={() => {
                    setTempSpec('ALL');
                    setTempCity('ALL');
                    setTempPriceLimit(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.filterResetModalText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsFilterModalOpen(false)}
                  style={styles.closeBtn}
                >
                  <X size={20} color={COLORS.textCoffee} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Segment Header (Specialty / City / Fee Limit) */}
            <View style={styles.filterSegmentBar}>
              <TouchableOpacity
                style={[
                  styles.filterSegmentTab,
                  filterModalSection === 'SPECIALIZATION' &&
                    styles.filterSegmentTabActive,
                ]}
                onPress={() => setFilterModalSection('SPECIALIZATION')}
              >
                <Stethoscope
                  size={14}
                  color={
                    filterModalSection === 'SPECIALIZATION'
                      ? COLORS.forestGreen
                      : COLORS.textMuted
                  }
                />
                <Text
                  style={[
                    styles.filterSegmentTabText,
                    filterModalSection === 'SPECIALIZATION' &&
                      styles.filterSegmentTabTextActive,
                  ]}
                >
                  Specialty
                </Text>
                {tempSpec !== 'ALL' && <View style={styles.filterSegmentDot} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterSegmentTab,
                  filterModalSection === 'CITY' && styles.filterSegmentTabActive,
                ]}
                onPress={() => setFilterModalSection('CITY')}
              >
                <MapPin
                  size={14}
                  color={
                    filterModalSection === 'CITY'
                      ? COLORS.forestGreen
                      : COLORS.textMuted
                  }
                />
                <Text
                  style={[
                    styles.filterSegmentTabText,
                    filterModalSection === 'CITY' &&
                      styles.filterSegmentTabTextActive,
                  ]}
                >
                  City
                </Text>
                {tempCity !== 'ALL' && <View style={styles.filterSegmentDot} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterSegmentTab,
                  filterModalSection === 'PRICE' && styles.filterSegmentTabActive,
                ]}
                onPress={() => setFilterModalSection('PRICE')}
              >
                <Text
                  style={[
                    styles.filterSegmentPriceSymbol,
                    filterModalSection === 'PRICE' &&
                      styles.filterSegmentTabTextActive,
                  ]}
                >
                  ₹
                </Text>
                <Text
                  style={[
                    styles.filterSegmentTabText,
                    filterModalSection === 'PRICE' &&
                      styles.filterSegmentTabTextActive,
                  ]}
                >
                  Fee Limit
                </Text>
                {tempPriceLimit !== null && (
                  <View style={styles.filterSegmentDot} />
                )}
              </TouchableOpacity>
            </View>

            {/* Modal Body Scroll */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.filterModalScroll}
            >
              {/* SECTION 1: SPECIALIZATION */}
              <View style={styles.filterSectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.filterSectionTitle}>
                    CLINICAL SPECIALIZATION
                  </Text>
                  <Text style={styles.filterSectionCountBadge}>
                    {dynamicSpecializations.length} Disciplines
                  </Text>
                </View>
                <Text style={styles.filterSectionHint}>
                  Select an area of expertise to connect with targeted practitioners
                </Text>

                <View style={styles.filterPillsGrid}>
                  <TouchableOpacity
                    style={[
                      styles.filterChoicePill,
                      tempSpec === 'ALL' && styles.filterChoicePillActive,
                    ]}
                    onPress={() => setTempSpec('ALL')}
                  >
                    {tempSpec === 'ALL' && (
                      <Check size={13} color="#FFFFFF" />
                    )}
                    <Text
                      style={[
                        styles.filterChoicePillText,
                        tempSpec === 'ALL' && styles.filterChoicePillTextActive,
                      ]}
                    >
                      All Disciplines ({allDoctors.length})
                    </Text>
                  </TouchableOpacity>

                  {dynamicSpecializations.map((item) => {
                    const isChosen = tempSpec === item.name;
                    return (
                      <TouchableOpacity
                        key={item.name}
                        style={[
                          styles.filterChoicePill,
                          isChosen && styles.filterChoicePillActive,
                        ]}
                        onPress={() => setTempSpec(item.name)}
                      >
                        {isChosen && <Check size={13} color="#FFFFFF" />}
                        <Text
                          style={[
                            styles.filterChoicePillText,
                            isChosen && styles.filterChoicePillTextActive,
                          ]}
                        >
                          {item.name} ({item.count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SECTION 2: CITIES (Only cities where doctors exist) */}
              <View style={styles.filterSectionDivider} />

              <View style={styles.filterSectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.filterSectionTitle}>PRACTICING CITY</Text>
                  <Text style={styles.filterSectionCountBadge}>
                    {dynamicCities.length} Cities
                  </Text>
                </View>
                <Text style={styles.filterSectionHint}>
                  Showing only cities where active veterinary specialists are practicing
                </Text>

                <View style={styles.filterPillsGrid}>
                  <TouchableOpacity
                    style={[
                      styles.filterChoicePill,
                      tempCity === 'ALL' && styles.filterChoicePillActive,
                    ]}
                    onPress={() => setTempCity('ALL')}
                  >
                    {tempCity === 'ALL' && (
                      <Check size={13} color="#FFFFFF" />
                    )}
                    <Text
                      style={[
                        styles.filterChoicePillText,
                        tempCity === 'ALL' && styles.filterChoicePillTextActive,
                      ]}
                    >
                      All Cities
                    </Text>
                  </TouchableOpacity>

                  {dynamicCities.map((c) => {
                    const isChosen = tempCity === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[
                          styles.filterChoicePill,
                          isChosen && styles.filterChoicePillActive,
                        ]}
                        onPress={() => setTempCity(c.key)}
                      >
                        <MapPin
                          size={12}
                          color={isChosen ? '#FFFFFF' : COLORS.brandGold}
                        />
                        <Text
                          style={[
                            styles.filterChoicePillText,
                            isChosen && styles.filterChoicePillTextActive,
                          ]}
                        >
                          {c.display} ({c.count} {c.count === 1 ? 'doctor' : 'doctors'})
                        </Text>
                        {isChosen && <Check size={13} color="#FFFFFF" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* SECTION 3: CONSULTATION FEE / PRICE LIMIT */}
              <View style={styles.filterSectionDivider} />

              <View style={styles.filterSectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.filterSectionTitle}>
                    MAX CONSULTATION FEE (BUDGET LIMIT)
                  </Text>
                  {tempPriceLimit !== null && (
                    <Text style={styles.filterCurrentLimitBadge}>
                      Up to ₹{tempPriceLimit}
                    </Text>
                  )}
                </View>
                <Text style={styles.filterSectionHint}>
                  {dynamicPriceStats.min > 0
                    ? `Active practitioner fees range from ₹${dynamicPriceStats.min} to ₹${dynamicPriceStats.max}`
                    : 'Set a maximum fee limit to filter your results'}
                </Text>

                <View style={styles.filterPillsGrid}>
                  <TouchableOpacity
                    style={[
                      styles.filterChoicePill,
                      tempPriceLimit === null && styles.filterChoicePillActive,
                    ]}
                    onPress={() => setTempPriceLimit(null)}
                  >
                    {tempPriceLimit === null && (
                      <Check size={13} color="#FFFFFF" />
                    )}
                    <Text
                      style={[
                        styles.filterChoicePillText,
                        tempPriceLimit === null &&
                          styles.filterChoicePillTextActive,
                      ]}
                    >
                      Any Fee (No Limit)
                    </Text>
                  </TouchableOpacity>

                  {/* Dynamic Fee Tiers derived directly from DB */}
                  {dynamicPriceStats.tiers.map((fee) => {
                    const isChosen = tempPriceLimit === fee;
                    return (
                      <TouchableOpacity
                        key={fee}
                        style={[
                          styles.filterChoicePill,
                          isChosen && styles.filterChoicePillActive,
                        ]}
                        onPress={() => setTempPriceLimit(fee)}
                      >
                        {isChosen && <Check size={13} color="#FFFFFF" />}
                        <Text
                          style={[
                            styles.filterChoicePillText,
                            isChosen && styles.filterChoicePillTextActive,
                          ]}
                        >
                          ≤ ₹{fee.toLocaleString('en-IN')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Modal Bottom Action Bar */}
            <View style={styles.filterModalFooter}>
              <View>
                <Text style={styles.feeLabel}>MATCHING SPECIALISTS</Text>
                <Text style={styles.filterFooterCountText}>
                  {modalPreviewCount} {modalPreviewCount === 1 ? 'Doctor' : 'Doctors'} Available
                </Text>
              </View>

              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={applyFilters}
              >
                <Check size={16} color="#FFFFFF" />
                <Text style={styles.filterApplyBtnText}>
                  Apply Filters ({modalPreviewCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Doctor Review Modal */}
      <Modal visible={!!reviewConsultationId} transparent animationType="slide">
        <View style={isTablet ? modalOverlayStyle : styles.modalOverlay}>
          <View style={[styles.reviewModalSheet, isTablet && modalSheetContainerStyle]}>
            <View style={styles.reviewModalHeaderRow}>
              <Text style={styles.reviewModalTitle}>Rate Your Consultation</Text>
              <TouchableOpacity
                onPress={() => setReviewConsultationId(null)}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <X size={20} color={COLORS.textCoffee} />
              </TouchableOpacity>
            </View>

            <Text style={styles.reviewModalSubtitle}>
              How was your experience with the veterinary specialist?
            </Text>

            <View style={styles.reviewStarRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                  activeOpacity={0.7}
                  style={styles.reviewStarBtn}
                >
                  <Star
                    size={32}
                    color={COLORS.brandGold}
                    fill={star <= reviewRating ? COLORS.brandGold : 'none'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewCommentInput}
              placeholder="Share details about the advice you received (optional)..."
              placeholderTextColor={COLORS.textLight}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.reviewSubmitBtn, isSubmittingReview && styles.btnDisabled]}
              onPress={handleSubmitReview}
              disabled={isSubmittingReview}
            >
              {isSubmittingReview ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.reviewSubmitBtnText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAF7F2' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FAF7F2',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerTextCol: { flex: 1, minWidth: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brandGold,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textCoffee,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2E7D32' },
  liveBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.forestGreen },

  // Top Segmented Switcher
  segmentContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    backgroundColor: '#FAF7F2',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  segmentBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textCoffee },
  segmentBtnTextActive: { color: '#FFFFFF' },

  scrollBody: { padding: 16, paddingBottom: 40, gap: 14 },
  headerAreaContainer: { paddingHorizontal: 16, paddingTop: 14 },

  // Filter Chips
  filterChipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  filterChipActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  filterChipText: { fontSize: 11, fontWeight: '700', color: COLORS.textCoffee },
  filterChipTextActive: { color: '#FFFFFF' },

  // Consultations Cards
  consultationsGridRow: { gap: 14 },
  consultationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardIdBadge: {
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardIdText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brandGold,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E7D32' },
  statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  doctorInfoRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  doctorAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  doctorTextCol: { flex: 1, gap: 2 },
  doctorName: { fontSize: 15, fontWeight: '800', color: COLORS.textCoffee },
  doctorSpec: { fontSize: 12, fontWeight: '600', color: COLORS.brandGold },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  clinicText: { fontSize: 11, color: COLORS.textMuted },

  cardDivider: { height: 1, backgroundColor: COLORS.kraftBorder },

  detailsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  detailItem: { gap: 2, flex: 1 },
  detailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailValueText: { fontSize: 12, fontWeight: '700', color: COLORS.textCoffee },

  reasonBox: {
    backgroundColor: '#FAF9F6',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.brandGold,
    gap: 2,
  },
  reasonLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted },
  reasonText: { fontSize: 12, fontStyle: 'italic', color: COLORS.textCoffee },

  doctorNotesBox: {
    backgroundColor: '#EDF5F0',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C3E6CB',
    gap: 6,
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notesHeaderTitle: { fontSize: 12, fontWeight: '800', color: COLORS.forestGreen },
  doctorNotesText: { fontSize: 12, color: COLORS.textCoffee, lineHeight: 17 },

  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  joinCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 12,
    borderRadius: 12,
  },
  joinCallBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  cancelBtnText: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  completedStamp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completedStampText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  btnDisabled: { opacity: 0.5 },
  leaveReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
  },
  leaveReviewBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textCoffee },

  // Empty & Loading States
  loadingBox: { padding: 40, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: COLORS.textMuted },
  emptyContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textCoffee },
  emptySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  bookNowBtn: {
    marginTop: 6,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bookNowBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  // Tab 2: Doctors List
  doctorGridRow: { gap: 14 },
  docCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 10,
  },
  docCardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  docImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  docImgFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EDF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docCardName: { fontSize: 16, fontWeight: '800', color: COLORS.textCoffee },
  docCardSpec: { fontSize: 12, fontWeight: '700', color: COLORS.brandGold },
  docCardQual: { fontSize: 11, color: COLORS.textMuted },
  docCardExp: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.forestGreen,
    marginTop: 2,
  },
  docBio: { fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },
  docCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted },
  feeVal: { fontSize: 18, fontWeight: '900', color: COLORS.forestGreen },
  bookDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bookDocBtnDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  bookDocBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  // ==========================================================
  // Interactive Modal Styles
  // ==========================================================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSubHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brandGold,
    letterSpacing: 0.8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textCoffee },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { gap: 14, paddingBottom: 24 },

  reviewModalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  reviewModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewModalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textCoffee },
  reviewModalSubtitle: { fontSize: 13, color: COLORS.textMuted },
  reviewStarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  reviewStarBtn: { padding: 4 },
  reviewCommentInput: {
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: COLORS.textCoffee,
    minHeight: 90,
    backgroundColor: COLORS.canvas,
  },
  reviewSubmitBtn: {
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewSubmitBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  modalDoctorBrief: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FAF5EE',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  modalDocAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  docBriefAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDocName: { fontSize: 14, fontWeight: '800', color: COLORS.textCoffee },
  modalDocSpec: { fontSize: 11, color: COLORS.brandGold, fontWeight: '600' },
  modalDocFee: { fontSize: 11, color: COLORS.forestGreen, fontWeight: '700' },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textCoffee,
    letterSpacing: 0.5,
  },
  requiredBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.brandGold,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subDateHint: { fontSize: 11, fontWeight: '700', color: COLORS.forestGreen },

  // Pet Selector
  noPetsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
  },
  noPetsText: { fontSize: 11, color: '#92400E', flex: 1 },
  petsScroll: { flexDirection: 'row' },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    marginRight: 8,
  },
  petCardSelected: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  petAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  petAvatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  petAvatarBoxSelected: { backgroundColor: '#2E7D32' },
  petNameText: { fontSize: 13, fontWeight: '800', color: COLORS.textCoffee },
  petNameTextSelected: { color: '#FFFFFF' },
  petBreedText: { fontSize: 10, color: COLORS.textMuted },
  petBreedTextSelected: { color: '#E5E7EB' },

  // 14-Day Calendar Strip
  calendarStrip: { flexDirection: 'row', paddingVertical: 4 },
  dateItem: {
    width: 60,
    height: 74,
    borderRadius: 14,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    gap: 2,
  },
  dateItemSelected: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  dateDayName: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted },
  dateDayNameSelected: { color: '#E5E7EB' },
  dateNumber: { fontSize: 17, fontWeight: '900', color: COLORS.textCoffee },
  dateNumberSelected: { color: '#FFFFFF' },
  dateMonth: { fontSize: 9, fontWeight: '800', color: COLORS.brandGold },
  dateMonthSelected: { color: '#FFDD43' },
  dateDotActive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFDD43',
    marginTop: 1,
  },
  dateItemOffDuty: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.65,
  },
  dateDayNameOffDuty: {
    color: '#9CA3AF',
  },
  dateNumberOffDuty: {
    color: '#9CA3AF',
  },
  dateMonthOffDuty: {
    color: '#9CA3AF',
  },
  dateDotWorking: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.forestGreen,
    marginTop: 1,
  },
  dateOffBadge: {
    fontSize: 7,
    fontWeight: '800',
    color: '#9CA3AF',
    marginTop: 1,
  },
  scheduleSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 8,
  },
  scheduleSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textCoffee,
    flex: 1,
  },

  // Time Slots
  selectedTimeBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forestGreen,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  slotLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  slotLoadingText: { fontSize: 12, color: COLORS.textMuted },
  noDoctorSlotsCard: {
    alignItems: 'center',
    backgroundColor: '#FAF5EE',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 6,
    marginVertical: 4,
  },
  noDoctorSlotsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  noDoctorSlotsSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  slotsSourceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDF5F0',
    padding: 6,
    borderRadius: 6,
  },
  slotsSourceText: { fontSize: 10, color: COLORS.forestGreen, fontWeight: '600' },

  // Slot Groups by Time of Day
  slotPeriodGroup: { gap: 6, marginTop: 4 },
  slotPeriodHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotPeriodTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textCoffee },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    minWidth: '22%',
    justifyContent: 'center',
  },
  timeSlotChipSelected: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  timeSlotChipDisabled: {
    opacity: 0.35,
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  timeSlotText: { fontSize: 11, fontWeight: '700', color: COLORS.textCoffee },
  timeSlotTextSelected: { color: '#FFFFFF' },
  timeSlotTextDisabled: { color: '#9CA3AF' },

  // Quick Symptoms
  quickSymptomsScroll: { flexDirection: 'row', marginVertical: 4 },
  quickSymptomChip: {
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    marginRight: 6,
  },
  quickSymptomText: { fontSize: 11, fontWeight: '600', color: COLORS.textCoffee },

  reasonInput: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: COLORS.textCoffee,
    textAlignVertical: 'top',
    minHeight: 70,
  },

  // Summary Card
  appointmentSummaryCard: {
    backgroundColor: '#FAF9F6',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted },
  summaryValue: { fontSize: 12, fontWeight: '800', color: COLORS.textCoffee },
  summaryFee: { fontSize: 16, fontWeight: '900', color: COLORS.forestGreen },

  confirmBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 4,
  },
  confirmBookBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  // ==========================================================
  // Doctor Profile Modal & Card Action Styles
  // ==========================================================
  docCardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  docCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewProfileOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF5F0',
    borderWidth: 1,
    borderColor: '#C3E6CB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewProfileOutlineBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.forestGreen,
  },

  profileModalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    minHeight: '65%',
    paddingTop: 16,
  },
  profileHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileLoadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  profileContentScroll: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  profileHeroCard: {
    alignItems: 'center',
    backgroundColor: '#FAF5EE',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    marginBottom: 16,
  },
  profileHeroImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: COLORS.forestGreen,
    marginBottom: 12,
  },
  profileHeroImgFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EDF5F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#C3E6CB',
    marginBottom: 12,
  },
  profileHeroName: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textCoffee,
    textAlign: 'center',
  },
  profileHeroSpec: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brandGold,
    marginTop: 2,
    textAlign: 'center',
  },
  profilePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  profileHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  profileHighlightPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  profileSection: {
    marginBottom: 16,
  },
  profileSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  profileBioText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textCoffee,
    backgroundColor: COLORS.canvas,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  profileInfoBox: {
    backgroundColor: COLORS.canvas,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileInfoLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  profileInfoValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
    marginTop: 1,
  },
  profileInfoDivider: {
    height: 1,
    backgroundColor: COLORS.kraftBorder,
    marginVertical: 10,
  },
  profileScheduleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EDF5F0',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  profileScheduleTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forestGreen,
  },
  profileScheduleSub: {
    fontSize: 12,
    color: COLORS.textCoffee,
    fontWeight: '600',
    marginTop: 2,
  },
  reviewsCountBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forestGreen,
  },
  noReviewsBox: {
    padding: 16,
    backgroundColor: COLORS.canvas,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  noReviewsText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  reviewCard: {
    backgroundColor: COLORS.canvas,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    marginBottom: 8,
  },
  reviewCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reviewerName: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  reviewDate: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 12,
    color: COLORS.textCoffee,
    marginTop: 6,
    lineHeight: 17,
  },
  profileBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
  },
  profileBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  profileBookBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },

  // Search & Dynamic Live Filters
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textCoffee,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: COLORS.canvas,
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  filterTriggerBtnActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  filterTriggerBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.forestGreen,
  },
  filterTriggerBtnTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.forestGreen,
  },

  dropdownTriggersStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  dropdownTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    maxWidth: 200,
  },
  dropdownTriggerPillActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  dropdownTriggerPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  dropdownTriggerPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  feeSymbol: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.forestGreen,
  },

  activeFiltersRow: {
    paddingTop: 8,
  },
  activeChipsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF5F0',
    borderWidth: 1,
    borderColor: '#C3E6CB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeFilterChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forestGreen,
  },
  clearAllFiltersBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllFiltersText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.brandGold,
    textDecorationLine: 'underline',
  },

  searchSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  searchSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  resetFiltersText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.brandGold,
    textDecorationLine: 'underline',
  },
  emptySearchIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  resetSearchBtn: {
    marginTop: 14,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resetSearchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Dynamic Filter Modal Bottom Sheet
  filterModalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    minHeight: '60%',
    paddingTop: 16,
  },
  filterResetModalText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.brandGold,
    paddingHorizontal: 6,
  },
  filterSegmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    gap: 8,
  },
  filterSegmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.canvas,
  },
  filterSegmentTabActive: {
    backgroundColor: '#EDF5F0',
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  filterSegmentTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  filterSegmentTabTextActive: {
    color: COLORS.forestGreen,
    fontWeight: '800',
  },
  filterSegmentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.forestGreen,
  },
  filterSegmentPriceSymbol: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.textMuted,
  },

  filterModalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  filterSectionBlock: {
    marginBottom: 8,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textCoffee,
    letterSpacing: 0.8,
  },
  filterSectionCountBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.forestGreen,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  filterSectionHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  filterSectionDivider: {
    height: 1,
    backgroundColor: COLORS.kraftBorder,
    marginVertical: 16,
  },
  filterPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChoicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
  },
  filterChoicePillActive: {
    backgroundColor: COLORS.forestGreen,
    borderColor: COLORS.forestGreen,
  },
  filterChoicePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  filterChoicePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterCurrentLimitBadge: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.forestGreen,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  filterModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
  },
  filterFooterCountText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
    marginTop: 2,
  },
  filterApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  filterApplyBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
});

