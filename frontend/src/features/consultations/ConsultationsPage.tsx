import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMyPets, fetchPetHealthRecords } from '../../api/pets';
import { 
  fetchDoctors, fetchDoctorSlots, bookConsultation, 
  fetchMyConsultations, cancelConsultation,
  fetchDoctorById, fetchDoctorAvailability, fetchNearbyDoctors,
  fetchConsultationById
} from '../../api/consultations';

import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { 
  ArrowLeft, PawPrint, 
  Clock, Stethoscope, Loader2, AlertCircle, XCircle,
  Compass, Calendar as CalendarIcon, Info
} from 'lucide-react';

export const ConsultationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCartOpen, setIsCartOpen] = useState(false);



  // Form State
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delight overlay states
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [lastBookedSession, setLastBookedSession] = useState<{ doctorName: string; scheduledAt: string } | null>(null);

  // Tab & Booking Stepper States
  const [activeSection, setActiveSection] = useState<'sessions' | 'book' | 'directory'>('directory');
  const [bookingStep, setBookingStep] = useState<number>(1);
  const [isDirectBooking, setIsDirectBooking] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('');
  const [selectedSpecializationFilter, setSelectedSpecializationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'CANCELLED'>('ALL');

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

  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);

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

  // Book Mutation
  const bookMutation = useMutation({
    mutationFn: (bookingData: any) => bookConsultation(bookingData),
    onSuccess: (_, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      
      // Trigger success delight overlay
      const doc = doctors.find((d: any) => d.id === variables.doctor_id);
      const docName = doc && doc.user ? `${doc.user.first_name || ''} ${doc.user.last_name || ''}`.trim() : `Specialist ID #${variables.doctor_id}`;
      
      setLastBookedSession({
        doctorName: docName,
        scheduledAt: variables.scheduled_at,
      });
      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
        // Switch back to Ledger view
        setActiveSection('sessions');
      }, 3500);

      // Clear inputs and reset booking stepper
      setReason('');
      setNotes('');
      setSelectedSlot('');
      setFormError('');
      setSelectedDoctorId('');
      setSelectedPetId('');
      setIsDirectBooking(false);
      setBookingStep(1);
    },
    onError: (err: any) => {
      console.error('Booking failed:', err);
      setFormError(err.response?.data?.detail || 'Failed to book consultation session.');
    }
  });

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
        alert('Failed to load doctor details. Please try again.');
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
    setBookingStep(1); // Start directly at companion selection
    setActiveSection('book');
    setInspectingDoctorId(null);
  };

  const handleBookSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPetId) {
      setFormError('Please select a pet.');
      return;
    }
    if (!selectedDoctorId) {
      setFormError('Please select a doctor.');
      return;
    }
    if (!targetDate) {
      setFormError('Please select a consultation date.');
      return;
    }
    if (!selectedSlot) {
      setFormError('Please choose a slot time.');
      return;
    }
    if (reason.trim().length < 3) {
      setFormError('Please enter a valid reason (minimum 3 characters).');
      return;
    }

    setIsSubmitting(true);

    const scheduledAt = `${targetDate}T${selectedSlot}:00`;

    bookMutation.mutate({
      pet_id: parseInt(selectedPetId),
      doctor_id: parseInt(selectedDoctorId),
      scheduled_at: scheduledAt,
      reason,
      customer_notes: notes.trim() || null,
    }, {
      onSettled: () => {
        setIsSubmitting(false);
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'text-turmeric bg-amber-50 border-amber-200';
      case 'APPROVED':
        return 'text-herb bg-emerald-50 border-emerald-200';
      case 'COMPLETED':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'CANCELLED':
        return 'text-paprika bg-red-50 border-red-200';
      default:
        return 'text-ink bg-gray-50 border-gray-200';
    }
  };

  const filteredConsultations = consultations.filter((c: any) => {
    if (statusFilter === 'ALL') return true;
    return c.status.toUpperCase() === statusFilter;
  });

  const getCountForStatus = (status: 'ALL' | 'PENDING' | 'APPROVED' | 'COMPLETED' | 'CANCELLED') => {
    if (status === 'ALL') return consultations.length;
    return consultations.filter((c: any) => c.status.toUpperCase() === status).length;
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="consultations" onCartToggle={() => setIsCartOpen(true)} />

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
          onClick={() => {
            setActiveSection('directory');
            setIsDirectBooking(false);
          }}
          className={`px-6 py-3 border-t-2 border-x transition-colors cursor-pointer ${
            activeSection === 'directory'
              ? 'bg-paperLight border-t-turmeric border-x-cardboard text-ink'
              : 'bg-transparent border-t-transparent border-x-transparent text-ink opacity-60 hover:opacity-100'
          }`}
        >
          🔍 Specialist Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('sessions')}
          className={`px-6 py-3 border-t-2 border-x transition-colors cursor-pointer ${
            activeSection === 'sessions'
              ? 'bg-paperLight border-t-turmeric border-x-cardboard text-ink'
              : 'bg-transparent border-t-transparent border-x-transparent text-ink opacity-60 hover:opacity-100'
          }`}
        >
          📓 Session Ledger ({consultations.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSection('book');
            setIsDirectBooking(false);
            setSelectedDoctorId(''); // reset pre-selected doctor if booking normally
            setBookingStep(1);
          }}
          className={`px-6 py-3 border-t-2 border-x transition-colors cursor-pointer ${
            activeSection === 'book'
              ? 'bg-paperLight border-t-turmeric border-x-cardboard text-ink'
              : 'bg-transparent border-t-transparent border-x-transparent text-ink opacity-60 hover:opacity-100'
          }`}
        >
          🩺 Schedule Specialist
        </button>
      </div>

      {/* DIRECTORY SECTION */}
      {activeSection === 'directory' && (
        <div className="max-w-7xl mx-auto space-y-6 text-left animate-fade-in">
          {/* Header Title */}
          <div className="space-y-1">
            <h2 className="font-display font-black text-3xl uppercase tracking-tight text-ink">
              Specialist Directory
            </h2>
            <p className="font-body text-xs text-ink opacity-70">
              Browse, search, and filter verified veterinarians and pet nutritionists in your city.
            </p>
          </div>

          <hr className="border-t border-dashed border-cardboard" />

          {/* Search & Filter Bar */}
          <div className="bg-paperLight border border-cardboard p-6 rounded-sm shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Search Input */}
            <div className="md:col-span-6 flex flex-col space-y-1.5 text-left">
              <label htmlFor="search-directory" className="font-mono text-[11px] uppercase font-bold text-paprika tracking-wide block">
                🔍 Search Specialist:
              </label>
              <input
                type="text"
                id="search-directory"
                placeholder="Search by name, qualification, or bio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
              />
            </div>

            {/* City Dropdown */}
            <div className="md:col-span-3 flex flex-col space-y-1.5 text-left">
              <label htmlFor="city-filter" className="font-mono text-[11px] uppercase font-bold text-paprika tracking-wide block">
                📍 Filter by City:
              </label>
              <select
                id="city-filter"
                value={selectedCityFilter}
                onChange={(e) => setSelectedCityFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors cursor-pointer"
              >
                <option value="">All Cities</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            {/* Specialization Filter Dropdown */}
            <div className="md:col-span-3 flex flex-col space-y-1.5 text-left">
              <label htmlFor="specialization-filter" className="font-mono text-[11px] uppercase font-bold text-paprika tracking-wide block">
                🩺 Filter by Specialization:
              </label>
              <select
                id="specialization-filter"
                value={selectedSpecializationFilter}
                onChange={(e) => setSelectedSpecializationFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors cursor-pointer"
              >
                <option value="">All Specializations</option>
                {uniqueSpecializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Directory Loading / Results */}
          {isDoctorsLoading ? (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold animate-pulse">
                Fetching specialists register...
              </p>
            </div>
          ) : doctors.length === 0 ? (
            <div className="border border-cardboard bg-paperLight border-dashed p-12 rounded-sm text-center">
              <Stethoscope className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
              <h4 className="font-display font-bold text-lg text-ink mb-1">No Specialists Found</h4>
              <p className="font-body text-xs text-ink opacity-70 max-w-xs mx-auto mb-6">
                Try expanding your filters or adjusting your search query.
              </p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {doctors.map((d: any) => {
                const doctorName = `Dr. ${d.user?.first_name || 'Specialist'} ${d.user?.last_name || ''}`.trim();
                return (
                  <div 
                    key={d.id} 
                    className="border border-cardboard bg-paperLight rounded-sm shadow-xs flex flex-col justify-between overflow-hidden relative group hover:border-turmeric transition-colors"
                  >
                    {/* Notebook spine visual accent */}
                    <div className="absolute left-1 top-0 bottom-0 border-l border-dashed border-cardboard opacity-25"></div>

                    {/* Polaroid Image Area */}
                    <div className="p-6 pb-4 pl-8 flex justify-center bg-paper bg-opacity-25 border-b border-cardboard border-dashed">
                      <div className="w-32 h-32 bg-white p-2.5 border border-cardboard shadow-xs rotate-[-1.5deg] group-hover:rotate-0 transition-transform duration-300 relative flex items-center justify-center shrink-0">
                        {d.profile_image_url ? (
                          <img 
                            src={d.profile_image_url} 
                            alt={doctorName} 
                            className="w-full h-full object-cover polaroid-img"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-paperLight font-display font-black text-3xl text-cardboard">
                            {d.user?.first_name?.[0]?.toUpperCase() || 'D'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info text */}
                    <div className="p-6 pt-4 pl-8 flex-grow space-y-3">
                      <div className="space-y-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-paprika font-bold block">
                          {d.specialization}
                        </span>
                        <h4 className="font-display font-black text-xl text-ink">
                          {doctorName}
                        </h4>
                        <span className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80 block">
                          Qualification: {d.qualification}
                        </span>
                      </div>

                      <p className="font-body text-xs text-ink opacity-75 line-clamp-3">
                        {d.bio || 'A dedicated companion animal specialist committed to custom small-batch dietary wellness and diagnosis.'}
                      </p>

                      <hr className="border-t border-cardboard border-dashed opacity-40" />

                      {/* Location & Experience tags */}
                      <div className="flex justify-between items-center text-xs font-mono text-ink">
                        <div>
                          <span className="text-[10px] uppercase text-ink opacity-70 block font-bold">EXP LEVEL</span>
                          <span className="font-bold text-paprika">{d.experience_years} Years</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-ink opacity-70 block font-bold">CLINIC CITY</span>
                          <span className="font-bold text-paprika">{d.clinic?.city || 'Chennai'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-ink opacity-70 block font-bold">FEE</span>
                          <span className="font-bold text-turmeric">${parseFloat(d.consultation_fee).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Buttons */}
                    <div className="border-t border-cardboard p-4 pl-8 bg-paper bg-opacity-20 flex space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInspectingDoctorId(d.id)}
                        className="flex-1 border border-cardboard hover:bg-paper text-ink font-body font-bold text-xs uppercase py-2.5 rounded-sm tracking-wide text-center cursor-pointer transition-colors shadow-xs"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartBooking(d.id)}
                        className="flex-1 bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs uppercase py-2.5 rounded-sm tracking-wide text-center cursor-pointer transition-colors shadow-xs hover-bounce"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SESSIONS SECTION */}
      {activeSection === 'sessions' && (
        <div className="max-w-7xl mx-auto space-y-6 text-left animate-fade-in">
          <div className="space-y-1">
            <h2 className="font-display font-bold text-3xl text-ink">
              Clinical Sessions
            </h2>
            <p className="font-body text-xs text-ink opacity-70">
              Check upcoming session diagnostics, veterinarian notes, and prescription advice.
            </p>
          </div>

          <hr className="border-t border-dashed border-cardboard" />

          {/* Grid Layout for Sessions & Filter sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Pane (9 columns) - Sessions Logs */}
            <div className="lg:col-span-9 space-y-6 order-2 lg:order-1">
              {isConsultationsLoading ? (
                <div className="py-20 text-center space-y-4">
                  <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                    Reading consultation schedules...
                  </p>
                </div>
              ) : filteredConsultations.length === 0 ? (
                <div className="border border-cardboard bg-paperLight border-dashed p-10 rounded-sm text-center">
                  <Stethoscope className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
                  <h4 className="font-display font-bold text-lg text-ink mb-1">No Consultations Found</h4>
                  <p className="font-body text-xs text-ink opacity-70 max-w-xs mx-auto mb-6">
                    {statusFilter === 'ALL'
                      ? "You haven't scheduled any professional veterinary review sessions yet."
                      : `No clinical sessions logged with status '${statusFilter}' at this time.`}
                  </p>
                  {statusFilter === 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setActiveSection('book')}
                      className="bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase font-bold py-2.5 px-6 rounded-sm tracking-wide transition-colors cursor-pointer"
                    >
                      Schedule First Appointment 🩺
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredConsultations.map((consult: any) => (
                    <div 
                      key={consult.id}
                      className="bg-paperLight border border-cardboard p-6 rounded-sm shadow-sm flex flex-col justify-between relative overflow-hidden"
                    >
                      {/* Decorative dashed spine tab */}
                      <div className="absolute top-0 bottom-0 left-3 border-l border-dashed border-cardboard opacity-35"></div>

                      <div className="space-y-4 pl-8 md:pl-10">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-[10px] uppercase font-bold text-paprika bg-herb bg-opacity-10 border border-herb px-2.5 py-0.5 rounded-sm">
                                LEDGER FILE #{consult.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedConsultationId(consult.id)}
                                className="text-ink hover:text-opacity-80 hover:underline lowercase font-mono text-[10px] tracking-wide"
                              >
                                [inspect record]
                              </button>
                            </div>
                          </div>
                          <span className={`font-mono text-[10px] font-bold border border-dashed px-2.5 py-1 rounded-sm uppercase tracking-wider ${getStatusColor(consult.status)}`}>
                            {consult.status}
                          </span>
                        </div>

                        <div className="space-y-1.5 font-mono text-xs uppercase text-ink pr-4">
                          <div className="flex justify-between items-center dotted-divider py-1.5">
                            <span className="bg-paperLight pr-1 text-paprika font-bold flex items-center">
                              <Clock className="w-3.5 h-3.5 text-turmeric mr-2" />
                              <span>SCHEDULED AT</span>
                            </span>
                            <span className="bg-paperLight pl-1 font-bold text-ink">{new Date(consult.scheduled_at).toLocaleString()}</span>
                          </div>
                          
                          <div className="flex justify-between items-center dotted-divider py-1.5">
                            <span className="bg-paperLight pr-1 text-paprika font-bold flex items-center">
                              <PawPrint className="w-3.5 h-3.5 text-turmeric mr-2" />
                              <span>COMPANION PATIENT</span>
                            </span>
                            <span className="bg-paperLight pl-1 font-bold text-ink">🐾 {consult.pet?.name || 'My Pet'} ({consult.pet?.species})</span>
                          </div>
                          
                          <div className="flex justify-between items-center py-1.5">
                            <span className="bg-paperLight pr-1 text-paprika font-bold flex items-center">
                              <Stethoscope className="w-3.5 h-3.5 text-paprika mr-2" />
                              <span>VET SPECIALIST</span>
                            </span>
                            <span className="bg-paperLight pl-1 font-bold text-ink flex items-center space-x-1">
                              <span>
                                🩺 {consult.doctor?.user?.first_name || consult.doctor?.user?.last_name 
                                  ? `Dr. ${consult.doctor.user.first_name || ''} ${consult.doctor.user.last_name || ''}`.trim() 
                                  : `Dr. ID #${consult.doctor_id}`} ({consult.doctor?.specialization || 'Nutritionist'})
                              </span>
                              <button
                                type="button"
                                onClick={() => setInspectingDoctorId(consult.doctor_id)}
                                className="text-turmeric hover:text-opacity-80 flex items-center border-none bg-transparent cursor-pointer p-0.5"
                                title="Inspect credentials"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          </div>
                        </div>

                        <hr className="border-t border-dashed border-cardboard" />

                        <div>
                          <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Reason for consultation</span>
                          <p className="font-body text-xs text-ink opacity-85">{consult.reason}</p>
                        </div>

                        {consult.doctor_notes && (
                          <div className="bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                            <span className="font-mono text-[10px] uppercase text-turmeric font-bold block">Veterinary Clinical Notes</span>
                            <p className="font-body text-xs text-ink opacity-90 italic">{consult.doctor_notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Cancel Button */}
                      {(consult.status.toUpperCase() === 'PENDING' || consult.status.toUpperCase() === 'APPROVED') && (
                        <div className="mt-4 pt-4 border-t border-cardboard flex justify-end pl-4">
                          <button
                            type="button"
                            onClick={() => cancelMutation.mutate(consult.id)}
                            disabled={cancelMutation.isPending}
                            className="bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-[11px] uppercase py-2 px-4 rounded-sm tracking-wide transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                          >
                            {cancelMutation.isPending && cancelMutation.variables === consult.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancel Appointment</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Pane (3 columns) - Clickable Status Filter Card */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <div className="bg-paperLight border border-cardboard p-5 rounded-sm shadow-xs space-y-4 relative overflow-hidden">
                {/* Decorative spine tab */}
                <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>

                <div className="pl-3 space-y-3">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    Filter Ledger
                  </span>
                  <h3 className="font-display font-bold text-lg text-ink">
                    Status Logs
                  </h3>
                  
                  <hr className="border-t border-dashed border-cardboard" />
                  
                  <div className="space-y-1.5 font-mono text-xs uppercase font-bold">
                    {[
                      { id: 'ALL', label: 'All Sessions' },
                      { id: 'PENDING', label: 'Pending' },
                      { id: 'APPROVED', label: 'Confirmed' },
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
                          className={`w-full flex justify-between items-center py-2 px-3 border rounded-xs transition-colors text-left cursor-pointer ${
                            isActive
                              ? 'bg-paper border-turmeric text-ink shadow-xs'
                              : 'bg-transparent border-transparent text-ink opacity-65 hover:opacity-100 hover:bg-paperLight hover:bg-opacity-50'
                          }`}
                        >
                          <span className="flex items-center space-x-1.5">
                            {isActive ? <span>🐾</span> : <span className="w-3.5" />}
                            <span>{filter.label}</span>
                          </span>
                          <span className="bg-cardboard bg-opacity-25 text-ink font-mono text-[9px] px-1.5 py-0.5 rounded-sm">
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
        </div>
      )}

      {/* BOOKING SECTION */}
      {activeSection === 'book' && (
        <div className="max-w-xl mx-auto space-y-6 text-left animate-fade-in">
          {/* Stepper Progress Bar */}
          <div className="flex justify-between items-center bg-paperLight border border-cardboard p-4 rounded-sm font-mono text-[9px] text-ink shadow-xs">
            <span className={bookingStep >= 1 ? "font-bold text-herb" : "opacity-50"}>
              1. COMPANION
            </span>
            <span className="text-cardboard opacity-60">➔</span>
            <span className={bookingStep >= 2 ? "font-bold text-herb" : "opacity-50"}>
              2. SPECIALIST
            </span>
            <span className="text-cardboard opacity-60">➔</span>
            <span className={bookingStep >= 3 ? "font-bold text-herb" : "opacity-50"}>
              3. SCHEDULE
            </span>
            <span className="text-cardboard opacity-60">➔</span>
            <span className={bookingStep >= 4 ? "font-bold text-herb" : "opacity-50"}>
              4. CONTEXT
            </span>
          </div>

          <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
            {/* Stamp Step Indicator Tag */}
            <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
              STEP {bookingStep} OF 4
            </div>

            {/* Error messaging inside wizard card */}
            {formError && (
              <div className="text-[10px] text-paprika bg-red-50 border border-turmeric border-opacity-20 p-2.5 rounded-sm font-body">
                {formError}
              </div>
            )}

            {!pets || pets.length === 0 ? (
              <div className="text-center py-6 space-y-4 animate-fade-in">
                <AlertCircle className="w-8 h-8 text-turmeric mx-auto stroke-1" />
                <p className="font-body text-xs text-ink opacity-80">
                  Please register a companion pet profile in your ledger first before scheduling a veterinary review.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/pets')}
                  className="bg-turmeric text-ink font-body font-bold text-xs uppercase px-4 py-2 rounded-sm tracking-wider cursor-pointer"
                >
                  Create Pet Profile 🐾
                </button>
              </div>
            ) : (
              <div>
                {/* STEP 1: Select Companion */}
                {bookingStep === 1 && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-xl text-ink">Choose Companion Patient</h3>
                      <p className="font-body text-xs text-ink opacity-70">
                        Select which companion profile this medical session is booked for:
                      </p>
                    </div>
                    
                    <hr className="border-t border-dashed border-cardboard" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {pets.map((p) => {
                        const isSelected = selectedPetId === p.id.toString();
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPetId(p.id.toString());
                              if (isDirectBooking) {
                                setBookingStep(3); // skip Step 2 select specialist
                              } else {
                                setBookingStep(2);
                              }
                            }}
                            className={`p-4 border text-left rounded-sm transition-all hover:border-turmeric cursor-pointer relative overflow-hidden flex flex-col items-center justify-center space-y-3 ${
                              isSelected ? 'bg-paper border-turmeric ring-1 ring-turmeric shadow-sm' : 'bg-paperLight border-cardboard opacity-80 hover:opacity-100'
                            }`}
                          >
                            {/* Polaroid frame preview */}
                            <div className="w-16 h-16 bg-white p-1 border border-cardboard shadow-xs rotate-[-2deg] flex items-center justify-center shrink-0">
                              {p.profile_image_url ? (
                                <img src={p.profile_image_url} alt={p.name} className="w-full h-full object-cover polaroid-img" />
                              ) : (
                                <span className="text-xl">🐾</span>
                              )}
                            </div>
                            <div className="text-center">
                              <span className="font-display font-bold text-ink block">{p.name}</span>
                              <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard block">
                                {p.species} - {p.breed || 'Mixed'}
                              </span>
                            </div>
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
                      <h3 className="font-display font-bold text-xl text-ink">Select Veterinarian</h3>
                      <p className="font-body text-xs text-ink opacity-70">
                        Pick a professional nutritionist or schedule a diagnostic session:
                      </p>
                    </div>
                    
                    <hr className="border-t border-dashed border-cardboard" />

                    {/* Integrated Geospatial Locator Tool */}
                    <div className="border border-cardboard border-dashed p-4 rounded-sm bg-paper bg-opacity-40 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide flex items-center">
                          <Compass className="w-3.5 h-3.5 mr-1.5 text-turmeric" />
                          <span>GPS Clinic Locator</span>
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <input
                          type="text"
                          placeholder="Latitude e.g. 13.0827"
                          value={searchLat}
                          onChange={(e) => setSearchLat(e.target.value)}
                          className="px-2.5 py-1.5 border border-cardboard rounded-sm bg-paperLight text-ink placeholder-cardboard focus:outline-none focus:border-turmeric text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Longitude e.g. 80.2707"
                          value={searchLng}
                          onChange={(e) => setSearchLng(e.target.value)}
                          className="px-2.5 py-1.5 border border-cardboard rounded-sm bg-paperLight text-ink placeholder-cardboard focus:outline-none focus:border-turmeric text-xs"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={handleAutoLocate}
                          className="w-1/3 border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase py-2 font-bold rounded-sm flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <span>GPS Locate</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleIpLocate}
                          className="w-1/3 border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase py-2 font-bold rounded-sm flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <span>IP Locate</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSearchNearby}
                          disabled={isSearchingNearby}
                          className="w-1/3 bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[9px] uppercase py-2 font-bold rounded-sm flex items-center justify-center space-x-1 disabled:opacity-50 cursor-pointer"
                        >
                          {isSearchingNearby ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Search</span>}
                        </button>
                      </div>

                      {searchError && (
                        <div className="text-[10px] text-paprika bg-red-50 border border-turmeric border-opacity-20 p-2 rounded-sm font-body">
                          {searchError}
                        </div>
                      )}

                      {nearbyDocs.length > 0 && (
                        <div className="max-h-[140px] overflow-y-auto space-y-1.5 border-t border-cardboard border-dashed pt-2 pr-1 custom-scrollbar">
                          {nearbyDocs.map((doc) => (
                            <div key={doc.id} className="flex justify-between items-center border border-cardboard p-2 bg-paperLight rounded-xs text-xs font-mono">
                              <div>
                                <span className="font-bold text-ink block">Dr. {doc.name}</span>
                                <span className="text-[9px] opacity-60 italic">{doc.distance_km.toFixed(1)} km away</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDoctorId(doc.id.toString());
                                  setBookingStep(3);
                                }}
                                className="bg-herb text-paperLight px-2.5 py-1 text-[8px] uppercase font-bold rounded-sm cursor-pointer border-0"
                              >
                                Select
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Standard Doctors List */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                      {doctors.map((d: any) => {
                        const isSelected = selectedDoctorId === d.id.toString();
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSelectedDoctorId(d.id.toString());
                              setBookingStep(3);
                            }}
                            className={`w-full p-3 border text-left rounded-sm transition-all hover:border-turmeric cursor-pointer relative overflow-hidden flex justify-between items-center ${
                              isSelected ? 'bg-paper border-turmeric ring-1 ring-turmeric' : 'bg-paperLight border-cardboard'
                            }`}
                          >
                            <div>
                              <span className="font-display font-bold text-ink block">
                                Dr. {d.user?.first_name || 'Specialist'} {d.user?.last_name || ''}
                              </span>
                              <span className="font-mono text-[9px] uppercase tracking-wider text-cardboard block">
                                {d.specialization} • Exp: {d.experience_years} years
                              </span>
                            </div>
                            <span className="font-mono text-[10px] font-bold text-herb bg-herb bg-opacity-10 border border-herb px-2 py-0.5 rounded-sm">
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
                      <h3 className="font-display font-bold text-xl text-ink">Pick Date & Time</h3>
                      <p className="font-body text-xs text-ink opacity-70">
                        Choose an available slot for your veterinary session:
                      </p>
                    </div>

                    <hr className="border-t border-dashed border-cardboard" />

                    <div className="space-y-2 text-left">
                      <label htmlFor="date" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                        📅 Select Date:
                      </label>
                      <input
                        type="date"
                        id="date"
                        value={targetDate}
                        min={getTodayLocalDateString()}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors cursor-pointer"
                      />
                    </div>

                    {targetDate && (
                      <div className="space-y-2 text-left pt-2">
                        <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block mb-1">
                          ⏰ Select Time Slot:
                        </span>
                        
                        {isSlotsLoading ? (
                          <div className="text-center py-4">
                            <Loader2 className="w-5 h-5 text-turmeric animate-spin mx-auto" />
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="text-xs text-paprika bg-red-50 border border-turmeric border-opacity-15 p-3 rounded-sm text-center">
                            No available slots for this date.
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
                                  className={`py-1.5 border text-center font-mono text-xs rounded-sm transition-all hover:border-turmeric cursor-pointer ${
                                    isSelected ? 'bg-turmeric text-paper border-turmeric' : 'bg-paperLight border-cardboard text-ink'
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
                  <form onSubmit={handleBookSession} className="space-y-4 animate-fade-in">
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-xl text-ink">Clinical Context</h3>
                      <p className="font-body text-xs text-ink opacity-70">
                        Provide notes for the veterinarian regarding symptoms or nutritional needs:
                      </p>
                    </div>

                    <hr className="border-t border-dashed border-cardboard" />

                    <div className="space-y-1.5 text-left">
                      <label htmlFor="reason" className="font-mono text-[9px] uppercase font-bold text-herb block">
                        Reason for Visit (required):
                      </label>
                      <input
                        type="text"
                        id="reason"
                        placeholder="e.g. Skin allergy, digestion reviews"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric transition-colors"
                        required
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label htmlFor="notes" className="font-mono text-[9px] uppercase font-bold text-herb block">
                        Additional Notes (optional):
                      </label>
                      <textarea
                        id="notes"
                        rows={3}
                        placeholder="Detail recent diets, weight changes, or symptoms..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase py-3 font-bold rounded-sm tracking-wide transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Ledger Consultation Appointment 🩺</span>
                      )}
                    </button>
                  </form>
                )}

                {/* Stepper Navigation buttons */}
                <div className="flex justify-between items-center pt-6 border-t border-cardboard mt-6">
                  {bookingStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (bookingStep === 3 && isDirectBooking) {
                          setBookingStep(1); // skip going back to Step 2
                        } else {
                          setBookingStep(bookingStep - 1);
                        }
                      }}
                      className="border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase py-2 px-4 font-bold rounded-sm cursor-pointer"
                    >
                      Back
                    </button>
                  ) : (
                    <div />
                  )}
                  {bookingStep < 4 && (
                    <button
                      type="button"
                      disabled={
                        (bookingStep === 1 && !selectedPetId) ||
                        (bookingStep === 2 && !selectedDoctorId) ||
                        (bookingStep === 3 && (!targetDate || !selectedSlot))
                      }
                      onClick={() => setBookingStep(bookingStep + 1)}
                      className="bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[9px] uppercase py-2 px-4 font-bold rounded-sm cursor-pointer disabled:opacity-50"
                    >
                      Next Step
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      </main>
      {/* Footer */}
      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 font-mono text-[9px] uppercase tracking-wider w-full">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Doctor Detail & Availability Side Drawer */}
      {inspectingDoctorId && (
        <div className="fixed inset-0 z-50 overflow-hidden font-body animate-fade-in animate-duration-300">
          {/* Backdrop */}
          <div 
            onClick={() => setInspectingDoctorId(null)}
            className="absolute inset-0 bg-ink bg-opacity-40 backdrop-blur-xs transition-opacity duration-300"
          ></div>

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            {/* Sliding Panel */}
            <div className="w-screen max-w-md bg-paperLight border-l border-cardboard shadow-2xl flex flex-col justify-between relative transform transition-transform duration-300 animate-slide-in-right">
              
              {/* Decorative notebook binding left border */}
              <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-40"></div>

              {/* Panel Header */}
              <div className="p-6 border-b border-cardboard flex justify-between items-center bg-paperLight pl-8">
                <div className="text-left space-y-1">
                  <Eyebrow label={`SPECIALIST PROFILE ID #${inspectingDoctorId}`} />
                  <h3 className="font-display font-bold text-xl text-ink">
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

              {/* Panel Content */}
              <div className="flex-grow overflow-y-auto p-6 space-y-6 pl-8 text-left">
                {isLoadingInspecting ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-2 py-20">
                    <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
                    <span className="font-mono text-[10px] uppercase text-herb font-bold animate-pulse">Retrieving Credentials...</span>
                  </div>
                ) : inspectingDoctor ? (
                  <div className="space-y-6">
                    {/* Polaroid-style Avatar inside Drawer */}
                    <div className="max-w-[200px] mx-auto border-double border-4 border-cardboard bg-paper p-2.5 rounded-none shadow-xs rotate-[-1deg]">
                      <div className="aspect-square bg-paper border border-cardboard overflow-hidden relative">
                        {inspectingDoctor.profile_image_url ? (
                          <img 
                            src={inspectingDoctor.profile_image_url} 
                            alt={inspectingDoctor.user?.first_name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-paperLight font-display font-black text-4xl text-cardboard">
                            {inspectingDoctor.user?.first_name?.[0]?.toUpperCase() || 'D'}
                          </div>
                        )}
                      </div>
                      <div className="pt-2 text-center">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold">
                          {inspectingDoctor.specialization}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Qualification info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-paper p-3 border border-cardboard rounded-sm font-mono text-[11px]">
                        <div>
                          <span className="text-[10px] uppercase text-paprika font-bold block">Qualifications</span>
                          <span className="text-ink font-bold">{inspectingDoctor.qualification}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-paprika font-bold block">Experience</span>
                          <span className="text-ink font-bold">{inspectingDoctor.experience_years} Years</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-paprika font-bold block">Consultation Fee</span>
                          <span className="text-ink font-bold text-turmeric">${parseFloat(inspectingDoctor.consultation_fee).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-paprika font-bold block">Clinic Mapping</span>
                          <span className="text-ink font-bold">{inspectingDoctor.clinic?.name || 'Private Practice'}</span>
                        </div>
                      </div>

                      {/* Bio */}
                      {inspectingDoctor.bio && (
                        <div className="space-y-1">
                          <span className="font-mono text-[10px] uppercase font-bold text-paprika">Biography & Expertise</span>
                          <p className="text-ink opacity-85 leading-relaxed bg-paper bg-opacity-40 p-3 border border-cardboard border-dashed text-xs">
                            {inspectingDoctor.bio}
                          </p>
                        </div>
                      )}

                      {/* Clinic Address details */}
                      {inspectingDoctor.clinic && (
                        <div className="space-y-1 font-mono text-[10px] text-ink opacity-80">
                          <span className="font-mono text-[10px] uppercase font-bold text-paprika block">Clinic Address</span>
                          <p className="font-body text-xs text-ink bg-paper bg-opacity-40 p-3 border border-cardboard border-dashed">
                            {inspectingDoctor.clinic.address}, {inspectingDoctor.clinic.city}
                          </p>
                        </div>
                      )}

                      {/* Weekly Availability */}
                      <div className="space-y-2">
                        <span className="font-mono text-[10px] uppercase font-bold text-paprika block flex items-center">
                          <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                          <span>Weekly Consulting Hours</span>
                        </span>

                        {inspectingSchedule?.schedule && inspectingSchedule.schedule.length > 0 ? (
                          <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px]">
                            {inspectingSchedule.schedule.map((slot: any) => (
                              <div key={slot.id} className="border border-cardboard border-opacity-65 p-2 rounded-sm bg-paper bg-opacity-40 flex justify-between items-center">
                                <span className="font-bold capitalize">{slot.day_of_week}</span>
                                <span className="opacity-80">{slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-cardboard italic">No regular weekly shift planner registered.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-paprika">Failed to load doctor profile details.</p>
                )}
              </div>

              {/* Panel Footer / Actions */}
              {inspectingDoctor && (
                <div className="p-6 bg-paperLight border-t border-cardboard pl-8 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleStartBooking(inspectingDoctor.id)}
                    className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-colors shadow-sm flex items-center justify-center space-x-2 cursor-pointer hover-bounce"
                  >
                    <span>Book Appointment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectingDoctorId(null)}
                    className="w-full border border-cardboard hover:bg-paper text-ink font-body font-bold text-xs uppercase py-3.5 rounded-sm tracking-wide transition-colors text-center cursor-pointer"
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
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in-up relative text-left">
            <button 
              onClick={() => setSelectedConsultationId(null)}
              className="absolute top-4 right-4 text-ink opacity-60 hover:opacity-100 font-bold"
            >
              ✕
            </button>

            <div className="space-y-1">
              <Eyebrow label="VETERINARY APPOINTMENT JOURNAL" />
              <h3 className="font-display font-bold text-xl text-ink">
                Consultation Details #{selectedConsultationId}
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
                <div className="p-4 border border-cardboard rounded-sm bg-paper bg-opacity-50 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">SCHEDULED TIME</span>
                      <span className="font-mono text-xs text-ink font-bold">{new Date(consultationDetails.scheduled_at).toLocaleString()}</span>
                    </div>
                    <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 rounded-sm uppercase tracking-wider ${getStatusColor(consultationDetails.status)}`}>
                      {consultationDetails.status}
                    </span>
                  </div>
                  
                  <hr className="border-t border-cardboard border-dashed" />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-ink">
                    <div>
                      <span className="text-[10px] uppercase text-paprika font-bold block">Patient Companion</span>
                      <span className="font-bold">🐾 {consultationDetails.pet?.name || 'Pet'} ({consultationDetails.pet?.species})</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-paprika font-bold block">Specialist Vet</span>
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
                    <span className="font-mono text-[8px] uppercase text-herb font-bold block">Reason for Inquiry</span>
                    <p className="font-body text-xs text-ink opacity-90">{consultationDetails.reason}</p>
                  </div>
                  {consultationDetails.customer_notes && (
                    <div>
                      <span className="font-mono text-[8px] uppercase text-herb font-bold block">Your Session Notes</span>
                      <p className="font-body text-xs text-ink opacity-75 italic">"{consultationDetails.customer_notes}"</p>
                    </div>
                  )}
                </div>

                {/* Clinical Notes & Health Record */}
                <div className="border-t border-cardboard border-dashed pt-3 space-y-3">
                  {consultationDetails.doctor_notes ? (
                    <div className="bg-paper p-3 border border-cardboard border-dashed rounded-sm space-y-2">
                      <span className="font-mono text-[8px] uppercase text-turmeric font-bold block">Veterinary Diagnosis & Notes</span>
                      <p className="font-body text-xs text-ink opacity-90 italic">"{consultationDetails.doctor_notes}"</p>
                    </div>
                  ) : (
                    <p className="font-body text-[10px] text-ink opacity-60 italic">Doctor has not added consultation notes yet.</p>
                  )}

                  {matchingHealthRecord && (
                    <div className="bg-emerald-50 bg-opacity-50 p-3 border border-emerald-200 rounded-sm space-y-2 font-mono text-[10px]">
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

                <button
                  type="button"
                  onClick={() => setSelectedConsultationId(null)}
                  className="w-full bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[9px] uppercase font-bold py-3 tracking-wider rounded-sm transition-colors text-center"
                >
                  Return to Consults List
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Booking Delight Overlay */}
      {showSuccessOverlay && lastBookedSession && (
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
                    className="absolute text-herb opacity-0 animate-drift-down select-none"
                    style={{
                      left: `${left}%`,
                      fontSize: `${size}px`,
                      animationDelay: `${delay}s`,
                      transform: `rotate(${rotate}deg)`,
                      top: '-20px'
                    }}
                  >
                    {i % 3 === 0 ? '🩺' : i % 3 === 1 ? '💚' : '🐾'}
                  </span>
                );
              })}
            </div>

            {/* Polaroid Booking details inside Overlay */}
            <div className="relative w-36 h-36 bg-white p-3 border border-cardboard shadow-md rotate-[3deg] animate-pulse flex flex-col justify-between items-center text-center">
              <div className="w-full border-b border-dashed border-cardboard pb-1.5 flex justify-center">
                <Stethoscope className="w-6 h-6 text-herb" />
              </div>
              <div className="space-y-1">
                <span className="font-mono text-[8px] uppercase tracking-wider text-cardboard font-bold block">CONFIRMED VET</span>
                <div className="font-display font-bold text-xs text-ink truncate max-w-[120px]">
                  Dr. {lastBookedSession.doctorName}
                </div>
              </div>
              <div className="font-mono text-[8px] text-herb font-bold bg-herb bg-opacity-10 border border-herb px-2 py-0.5 rounded-sm">
                APPROVED APPT
              </div>
            </div>

            {/* Custom stamped title */}
            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-herb font-bold block">
                VET CONSULTATION REGISTERED
              </span>
              <h3 className="font-display font-bold text-2xl text-ink">
                Session Booked!
              </h3>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed max-w-xs">
                Your consultation has been officially ledgered for <strong>{new Date(lastBookedSession.scheduledAt).toLocaleString()}</strong>.
              </p>
            </div>

            {/* Custom SVG Stamped approved seal */}
            <div className="w-24 h-24 border border-dashed border-turmeric border-opacity-70 rounded-full flex items-center justify-center rotate-[-12deg] p-2 scale-100 animate-pulse mt-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold text-center leading-tight">
                SESSION<br/>LEDGERED<br/>CLINIC INK
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
