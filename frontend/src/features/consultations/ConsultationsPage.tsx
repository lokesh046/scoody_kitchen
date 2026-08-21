import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMyPets } from '../../api/pets';
import { 
  fetchDoctors, fetchDoctorSlots, bookConsultation, 
  fetchMyConsultations, cancelConsultation,
  fetchDoctorById, fetchDoctorAvailability, fetchNearbyDoctors
} from '../../api/consultations';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { logoutUser } from '../../api/auth';
import { Eyebrow } from '../../components/Eyebrow';
import { CartDrawer } from '../../components/CartDrawer';
import { 
  ArrowLeft, ShoppingCart, LogOut, User, PawPrint, 
  Clock, Stethoscope, Loader2, AlertCircle, XCircle,
  MapPin, Compass, Calendar as CalendarIcon, Info
} from 'lucide-react';

export const ConsultationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const { items: cartItems, clear: clearCart } = useCartStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Form State
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Nearby Vets Finder States
  const [searchLat, setSearchLat] = useState<string>('');
  const [searchLng, setSearchLng] = useState<string>('');
  const [searchRadius, setSearchRadius] = useState<number>(10);
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

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => fetchDoctors(),
  });

  const { data: consultationsData, isLoading: isConsultationsLoading } = useQuery({
    queryKey: ['consultations'],
    queryFn: () => fetchMyConsultations(),
  });

  const doctors = doctorsData?.items || [];
  const consultations = consultationsData?.items || [];

  // Fetch slots query (triggered when doctor AND date are chosen)
  const { data: slotsData, isLoading: isSlotsLoading } = useQuery({
    queryKey: ['slots', selectedDoctorId, targetDate],
    queryFn: () => fetchDoctorSlots(parseInt(selectedDoctorId), targetDate),
    enabled: !!selectedDoctorId && !!targetDate,
  });

  const availableSlots = slotsData?.slots || [];

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      // Clear inputs
      setReason('');
      setNotes('');
      setSelectedSlot('');
      setFormError('');
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
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
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
            <button onClick={() => navigate('/pets')} className="hover:text-turmeric transition-colors pb-1">Pets Ledger</button>
            <button onClick={() => navigate('/consultations')} className="hover:text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">Vet Consults</button>
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
        {/* Left Column - Active Consultations */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-1">
            <Eyebrow label="VETERINARY MEDICAL CONSULTATION LEDG" />
            <h2 className="font-display font-bold text-3xl text-ink">
              Clinical Sessions
            </h2>
            <p className="font-body text-xs text-ink opacity-70">
              Check upcoming session diagnostics, veterinarian notes, and prescription advice.
            </p>
          </div>

          <hr className="border-t border-dashed border-cardboard" />

          {isConsultationsLoading ? (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
                Reading consultation schedules...
              </p>
            </div>
          ) : consultations.length === 0 ? (
            <div className="border border-cardboard bg-paperLight border-dashed p-10 rounded-sm text-center">
              <Stethoscope className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
              <h4 className="font-display font-bold text-lg text-ink mb-1">No Consultations</h4>
              <p className="font-body text-xs text-ink opacity-70 max-w-xs mx-auto">
                You haven't scheduled any professional veterinary review sessions yet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {consultations.map((consult) => (
                <div 
                  key={consult.id}
                  className="bg-paperLight border border-cardboard p-6 rounded-sm shadow-sm flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Decorative dashed spine tab */}
                  <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>

                  <div className="space-y-4 pl-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-[8px] uppercase font-bold text-herb block">
                          CONSLT ID: #{consult.id}
                        </span>
                        <span className="font-mono text-[9px] text-cardboard block">
                          Scheduled: {new Date(consult.scheduled_at).toLocaleString()}
                        </span>
                      </div>
                      <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 rounded-sm uppercase tracking-wider ${getStatusColor(consult.status)}`}>
                        {consult.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <span className="font-mono text-[8px] uppercase text-herb font-bold block">PATIENT Companion</span>
                        <span className="font-display font-bold text-ink">🐾 {consult.pet?.name || 'My Pet'} ({consult.pet?.species})</span>
                      </div>
                      <div>
                        <span className="font-mono text-[8px] uppercase text-herb font-bold block">SPECIALIST VET</span>
                        <div className="flex items-center space-x-1">
                          <span className="font-display font-bold text-ink">🩺 Dr. ID #{consult.doctor_id} ({consult.doctor?.specialization || 'General Vet'})</span>
                          <button
                            type="button"
                            onClick={() => setInspectingDoctorId(consult.doctor_id)}
                            className="text-turmeric hover:text-opacity-80 flex items-center border-none bg-transparent cursor-pointer"
                            title="Inspect credentials"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <hr className="border-t border-dashed border-cardboard" />

                    <div>
                      <span className="font-mono text-[8px] uppercase text-herb font-bold block">Reason for consultation</span>
                      <p className="font-body text-xs text-ink opacity-85">{consult.reason}</p>
                    </div>

                    {consult.doctor_notes && (
                      <div className="bg-paper p-3 rounded-sm border border-cardboard border-dashed">
                        <span className="font-mono text-[8px] uppercase text-turmeric font-bold block">Veterinary Clinical Notes</span>
                        <p className="font-body text-xs text-ink opacity-90 italic">{consult.doctor_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Cancel Button */}
                  {(consult.status.toUpperCase() === 'PENDING' || consult.status.toUpperCase() === 'APPROVED') && (
                    <div className="mt-4 pt-4 border-t border-cardboard flex justify-end pl-4">
                      <button
                        onClick={() => cancelMutation.mutate(consult.id)}
                        disabled={cancelMutation.isPending}
                        className="bg-paprika hover:bg-opacity-95 text-paperLight font-body font-bold text-[10px] uppercase py-1.5 px-3 rounded-sm tracking-wide transition-colors disabled:opacity-50 flex items-center space-x-1.5"
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

        {/* Right Column - Booking Form */}
        <div className="lg:col-span-5">
          {/* Nearby Vet Locator Widget */}
          <div className="bg-paperLight border border-cardboard p-6 rounded-sm shadow-sm space-y-4 relative overflow-hidden mb-6">
            <div className="absolute top-0 right-6 bg-cardboard bg-opacity-25 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
              GEOSPATIAL FINDER
            </div>
            <div className="space-y-1">
              <span className="font-mono text-[8px] uppercase font-bold text-herb tracking-widest block">Geographic Lookup</span>
              <h3 className="font-display font-bold text-lg text-ink">Find Vets Near You</h3>
              <p className="font-body text-[10px] text-ink opacity-70">
                Search nearby registered clinics by latitude, longitude coordinates.
              </p>
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            <form onSubmit={handleSearchNearby} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[8px] uppercase font-bold text-herb block">Latitude</label>
                  <input
                    type="text"
                    placeholder="e.g. 13.0827"
                    value={searchLat}
                    onChange={(e) => setSearchLat(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-[8px] uppercase font-bold text-herb block">Longitude</label>
                  <input
                    type="text"
                    placeholder="e.g. 80.2707"
                    value={searchLng}
                    onChange={(e) => setSearchLng(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[8px] uppercase font-bold text-herb block flex justify-between">
                  <span>Search Radius: {searchRadius} km</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="150"
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                  className="w-full accent-paprika cursor-pointer"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleAutoLocate}
                    className="border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase py-2.5 font-bold rounded-sm flex items-center justify-center space-x-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-herb" />
                    <span>GPS Locate 🐾</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleIpLocate}
                    className="border border-cardboard hover:bg-paper text-ink font-mono text-[9px] uppercase py-2.5 font-bold rounded-sm flex items-center justify-center space-x-1"
                  >
                    <MapPin className="w-3.5 h-3.5 text-turmeric" />
                    <span>IP Locate 🌐</span>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isSearchingNearby}
                  className="w-full bg-paprika hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase py-2.5 font-bold rounded-sm flex items-center justify-center space-x-1 disabled:opacity-50"
                >
                  {isSearchingNearby ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Search Vets 🩺</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {searchError && (
              <div className="text-[10px] text-paprika bg-red-50 border border-paprika border-opacity-20 p-2 rounded-sm font-body">
                {searchError}
              </div>
            )}

            {nearbyDocs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-dashed border-cardboard">
                <span className="font-mono text-[8px] uppercase font-bold text-herb block">Search Results:</span>
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {nearbyDocs.map((doc) => (
                    <div key={doc.id} className="border border-cardboard p-3 bg-paperLight bg-opacity-40 rounded-sm space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-ink text-xs flex items-center space-x-1.5">
                            <span>Dr. {doc.name || 'Specialist'}</span>
                            <button 
                              type="button"
                              onClick={() => setInspectingDoctorId(doc.id)} 
                              className="text-turmeric hover:text-opacity-80 flex items-center"
                              title="View Credentials & Availability"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-[9px] opacity-75 font-mono">{doc.specialization}</div>
                          <div className="text-[9px] opacity-60 font-mono italic">
                            Distance: {doc.distance_km.toFixed(2)} km
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDoctorId(doc.id.toString());
                            alert(`Selected Dr. ${doc.name} for booking!`);
                          }}
                          className="bg-herb hover:bg-opacity-95 text-paperLight font-mono text-[8px] uppercase py-1 px-2 font-bold rounded-sm border-0 cursor-pointer"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
            {/* Page Tab */}
            <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[8px] uppercase tracking-widest px-3 py-1 rounded-b-sm border-x border-b border-cardboard font-bold">
              APPOINTMENT BOOKING
            </div>

            <div className="space-y-1">
              <Eyebrow label="STEP 1 OF 1 — SCHEDULE APPT" />
              <h3 className="font-display font-bold text-xl text-ink">
                Secure Vet Consult
              </h3>
              <p className="font-body text-xs text-ink opacity-75 leading-relaxed">
                Choose a registered pet and schedule a session with our verified nutritionist specialists.
              </p>
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            {!pets || pets.length === 0 ? (
              <div className="text-center py-6 space-y-4">
                <AlertCircle className="w-8 h-8 text-turmeric mx-auto stroke-1" />
                <p className="font-body text-xs text-ink opacity-80">
                  Please register a companion pet profile in your ledger first before scheduling a veterinary review.
                </p>
                <button
                  onClick={() => navigate('/pets')}
                  className="bg-paprika text-paperLight font-body font-bold text-xs uppercase px-4 py-2 rounded-sm tracking-wider"
                >
                  Create Pet Profile 🐾
                </button>
              </div>
            ) : (
              <form onSubmit={handleBookSession} className="space-y-4">
                {/* Select Pet */}
                <div className="space-y-1.5">
                  <label htmlFor="pet" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    🐾 Select Companion:
                  </label>
                  <select
                    id="pet"
                    value={selectedPetId}
                    onChange={(e) => setSelectedPetId(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  >
                    {pets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.species} - {p.breed || 'Mixed'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Doctor */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="doctor" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      🩺 Select Veterinarian:
                    </label>
                    {selectedDoctorId && (
                      <button
                        type="button"
                        onClick={() => setInspectingDoctorId(parseInt(selectedDoctorId))}
                        className="text-turmeric hover:underline font-mono text-[8px] uppercase font-bold flex items-center space-x-0.5 border-none bg-transparent cursor-pointer"
                      >
                        <Info className="w-2.5 h-2.5" />
                        <span>Inspect Credentials</span>
                      </button>
                    )}
                  </div>
                  <select
                    id="doctor"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                  >
                    {doctors.length === 0 ? (
                      <option value="">No doctors available</option>
                    ) : (
                      doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          Dr. {d.user?.first_name || 'Specialist'} ({d.specialization}) - ${parseFloat(d.consultation_fee).toFixed(2)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Target Date */}
                <div className="space-y-1.5">
                  <label htmlFor="date" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    📅 Consultation Date:
                  </label>
                  <input
                    type="date"
                    id="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                {/* Slots Grid */}
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>Select Available Time Slot:</span>
                  </label>

                  {isSlotsLoading ? (
                    <div className="flex items-center space-x-2 py-2 text-herb font-mono text-[9px] uppercase">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Reading active calendar...</span>
                    </div>
                  ) : !selectedDoctorId || !targetDate ? (
                    <p className="font-body text-[10px] text-cardboard italic">
                      Please choose a doctor and a date first.
                    </p>
                  ) : availableSlots.length === 0 ? (
                    <p className="font-body text-[10px] text-paprika font-bold">
                      No timings available for this date. Please try another day.
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 pt-1.5">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`font-mono text-[10px] py-1 border rounded-sm transition-colors text-center ${
                            selectedSlot === slot 
                              ? 'bg-turmeric text-paper border-turmeric font-bold' 
                              : 'border-cardboard hover:bg-paper text-ink'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reason for session */}
                <div className="space-y-1.5">
                  <label htmlFor="reason" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    💬 Reason for consultation:
                  </label>
                  <textarea
                    id="reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter diagnostic details or recipe health checks..."
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label htmlFor="notes" className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    📝 Additional Notes (Optional):
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g. Scooby prefers chicken flavor recipes..."
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    disabled={isSubmitting}
                  />
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
                      <span>Booking...</span>
                    </>
                  ) : (
                    <span>Secure Slot & Book Session 🐾</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      {/* Footer */}
      <footer className="mt-20 border-t border-cardboard pt-8 text-center text-ink opacity-60 font-mono text-[9px] uppercase tracking-wider">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </footer>
      </div>
      </main>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Doctor Detail & Availability Modal */}
      {inspectingDoctorId && (
        <div className="fixed inset-0 bg-ink bg-opacity-45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-paperLight border border-cardboard p-8 rounded-sm shadow-xl space-y-6 relative max-h-[90vh] overflow-y-auto text-left">
            {/* Torn top edge card styling */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-paper flex overflow-hidden">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="w-4 h-4 bg-paperLight rounded-full -translate-y-2 border border-cardboard shrink-0"></div>
              ))}
            </div>

            <button
              onClick={() => setInspectingDoctorId(null)}
              className="absolute top-4 right-4 text-ink opacity-70 hover:opacity-100 border-0 bg-transparent cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            {isLoadingInspecting ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
                <span className="font-mono text-[10px] uppercase text-herb font-bold">Retrieving Credentials...</span>
              </div>
            ) : inspectingDoctor ? (
              <div className="space-y-6">
                <div className="space-y-1">
                  <span className="font-mono text-[8px] uppercase font-bold text-herb tracking-widest block">
                    Specialist Profile ID #{inspectingDoctor.id}
                  </span>
                  <h3 className="font-display font-bold text-2xl text-ink">
                    Dr. {inspectingDoctor.user?.first_name || ''} {inspectingDoctor.user?.last_name || ''}
                  </h3>
                  <span className="font-mono text-[10px] text-turmeric uppercase font-bold tracking-wider block">
                    {inspectingDoctor.specialization}
                  </span>
                </div>

                <hr className="border-t border-dashed border-cardboard" />

                {/* Professional Info */}
                <div className="space-y-4 text-xs font-body">
                  <div className="grid grid-cols-2 gap-4 bg-paper p-3 border border-cardboard rounded-sm font-mono text-[10px]">
                    <div>
                      <span className="text-[8px] uppercase text-herb font-bold block">Qualifications</span>
                      <span className="text-ink font-bold">{inspectingDoctor.qualification}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-herb font-bold block">Experience</span>
                      <span className="text-ink font-bold">{inspectingDoctor.experience_years} Years</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-herb font-bold block">Consultation Fee</span>
                      <span className="text-ink font-bold">${parseFloat(inspectingDoctor.consultation_fee).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-herb font-bold block">Clinic Mapping</span>
                      <span className="text-ink font-bold">{inspectingDoctor.clinic?.name || 'Private Practice'}</span>
                    </div>
                  </div>

                  {inspectingDoctor.bio && (
                    <div className="space-y-1">
                      <span className="font-mono text-[8px] uppercase font-bold text-herb">Biography & Expertise</span>
                      <p className="text-ink opacity-85 leading-relaxed bg-paper bg-opacity-40 p-3 border border-cardboard border-dashed">
                        {inspectingDoctor.bio}
                      </p>
                    </div>
                  )}

                  {/* Geospatial info */}
                  {(inspectingDoctor.latitude || inspectingDoctor.longitude) && (
                    <div className="space-y-1 font-mono text-[9px] text-ink opacity-70">
                      <span className="font-mono text-[8px] uppercase font-bold text-herb block">Clinic Coordinates</span>
                      <span>Latitude: {inspectingDoctor.latitude} | Longitude: {inspectingDoctor.longitude}</span>
                    </div>
                  )}

                  {/* Availability schedule list (GET /doctors/{id}/availability) */}
                  <div className="space-y-2">
                    <span className="font-mono text-[8px] uppercase font-bold text-herb block flex items-center">
                      <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                      <span>Weekly Consulting Hours</span>
                    </span>

                    {inspectingSchedule?.schedule && inspectingSchedule.schedule.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[9px]">
                        {inspectingSchedule.schedule.map((slot: any) => (
                          <div key={slot.id} className="border border-cardboard border-opacity-65 p-2 rounded-sm bg-paper bg-opacity-40 flex justify-between items-center">
                            <span className="font-bold capitalize">{slot.day_of_week}</span>
                            <span className="opacity-80">{slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-cardboard italic">No regular weekly shift planner registered for this doctor.</p>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoctorId(inspectingDoctor.id.toString());
                      setInspectingDoctorId(null);
                      alert(`Selected Dr. ${inspectingDoctor.user?.first_name || 'Specialist'} for scheduling!`);
                    }}
                    className="flex-1 bg-paprika hover:bg-opacity-95 text-paperLight font-mono text-[10px] uppercase py-2.5 font-bold rounded-sm tracking-wide text-center border-0 cursor-pointer"
                  >
                    Select this Vet
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectingDoctorId(null)}
                    className="flex-1 border border-cardboard hover:bg-paper text-ink font-mono text-[10px] uppercase py-2.5 font-bold rounded-sm tracking-wide text-center cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-paprika">Failed to load doctor profile details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
