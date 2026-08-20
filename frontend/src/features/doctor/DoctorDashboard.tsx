import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { CartDrawer } from '../../components/CartDrawer';
import { 
  getDoctorProfile, 
  updateDoctorProfile, 
  getDoctorAvailabilities, 
  createDoctorAvailability, 
  deleteDoctorAvailability, 
  getDoctorConsultations, 
  updateConsultationStatus 
} from '../../api/doctor';
import type { DoctorAvailabilityResponse } from '../../api/doctor';
import type { DoctorResponse, ConsultationResponse } from '../../api/consultations';
import { logoutUser } from '../../api/auth';
import { 
  Loader2, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Save, 
  Trash2, 
  LogOut, 
  ShoppingCart, 
  PawPrint,
  Stethoscope,
  Briefcase
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'consultations' | 'schedule' | 'profile'>('consultations');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartItems = useCartStore((state) => state.items);
  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Form States - Availability
  const [availDay, setAvailDay] = useState('monday');
  const [availStart, setAvailStart] = useState('09:00');
  const [availEnd, setAvailEnd] = useState('17:00');

  // Form States - Profile
  const [spec, setSpec] = useState('');
  const [qual, setQual] = useState('');
  const [fee, setFee] = useState('');
  const [expYears, setExpYears] = useState('');
  const [bioText, setBioText] = useState('');
  const [isProfileInitialized, setIsProfileInitialized] = useState(false);

  // Queries
  const { data: consultations, isLoading: consultationsLoading } = useQuery<ConsultationResponse[], Error>({
    queryKey: ['doctorConsultations'],
    queryFn: getDoctorConsultations,
    enabled: activeTab === 'consultations'
  });

  const { data: availabilities, isLoading: availabilitiesLoading } = useQuery<DoctorAvailabilityResponse[], Error>({
    queryKey: ['doctorAvailabilities'],
    queryFn: getDoctorAvailabilities,
    enabled: activeTab === 'schedule'
  });

  const { data: profile, isLoading: profileLoading } = useQuery<DoctorResponse, Error>({
    queryKey: ['doctorProfile'],
    queryFn: getDoctorProfile
  });

  useEffect(() => {
    if (profile && !isProfileInitialized) {
      setSpec(profile.specialization || '');
      setQual(profile.qualification || '');
      setFee(profile.consultation_fee || '');
      setExpYears(String(profile.experience_years || '0'));
      setBioText(profile.bio || '');
      setIsProfileInitialized(true);
    }
  }, [profile, isProfileInitialized]);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: updateDoctorProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorProfile'] });
      alert('Profile updated successfully!');
    },
    onError: (err: any) => {
      alert(`Profile update failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const addAvailMutation = useMutation({
    mutationFn: createDoctorAvailability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorAvailabilities'] });
      setAvailStart('09:00');
      setAvailEnd('17:00');
    },
    onError: (err: any) => {
      alert(`Failed to add availability: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const deleteAvailMutation = useMutation({
    mutationFn: deleteDoctorAvailability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorAvailabilities'] });
    },
    onError: (err: any) => {
      alert(`Failed to delete availability: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateConsultationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorConsultations'] });
    },
    onError: (err: any) => {
      alert(`Failed to update consultation: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      specialization: spec,
      qualification: qual,
      consultation_fee: fee,
      experience_years: Number(expYears),
      bio: bioText || null
    } as any);
  };

  const handleAddAvailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAvailMutation.mutate({
      day_of_week: availDay as any,
      start_time: availStart,
      end_time: availEnd
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
                Veterinarian Ledger v1.0
              </p>
            </div>
          </div>

          {/* Center: Navigation Menu */}
          <nav className="hidden md:flex space-x-4 lg:space-x-6 font-body text-xs font-bold uppercase tracking-wider text-paper md:col-span-6 justify-center">
            <button onClick={() => navigate('/shop')} className="hover:text-turmeric transition-colors pb-1">Shop Recipes</button>
            <button onClick={() => navigate('/pets')} className="hover:text-turmeric transition-colors pb-1">Pets Ledger</button>
            <button onClick={() => navigate('/consultations')} className="hover:text-turmeric transition-colors pb-1">Vet Consults</button>
            <button onClick={() => navigate('/orders')} className="hover:text-turmeric transition-colors pb-1">My Orders</button>
            <button onClick={() => navigate('/assistant')} className="hover:text-turmeric transition-colors pb-1">AI Assistant 🐾</button>
            <button onClick={() => navigate('/profile')} className="hover:text-turmeric transition-colors pb-1">My Profile</button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="hover:text-turmeric text-turmeric transition-colors pb-1">Admin Panel 🛠️</button>
            )}
            {(user?.role === 'doctor' || user?.role === 'admin') && (
              <button onClick={() => navigate('/doctor')} className="hover:text-turmeric text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">Doctor Panel 🩺</button>
            )}
          </nav>

          {/* Right Corner: Actions */}
          <div className="flex items-center space-x-4 md:col-span-3 justify-end">
            {user && (
              <span className="font-mono text-[10px] uppercase font-bold text-turmeric">
                Dr. {user.first_name || 'Vet'}
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

            <button 
              onClick={handleLogout}
              className="p-2 border border-cardboard border-opacity-40 rounded-none hover:bg-paprika hover:border-paprika text-paperLight hover:text-paperLight transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 md:px-8 py-10">
        
        {/* Banner Section */}
        <div className="border border-cardboard bg-paperLight p-6 rounded-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 shadow-sm text-left">
          <div className="space-y-1">
            <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Dashboard Workspace</span>
            <h2 className="font-display font-bold text-3xl text-ink tracking-tight">Doctor Panel</h2>
            <p className="font-body text-xs text-ink opacity-70">
              Manage your consulting availability, review patient schedules, and update your doctor credentials card.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-cardboard mb-10 overflow-x-auto space-x-8 text-left">
          <button
            onClick={() => setActiveTab('consultations')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'consultations'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Consultations Ledger</span>
          </button>
          
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Weekly Availability</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Doctor Profile</span>
          </button>
        </div>

        {/* Tab 1: Consultations Registry */}
        {activeTab === 'consultations' && (
          <div className="space-y-6 text-left animate-fade-in-up">
            <div className="border border-cardboard bg-paperLight p-6 rounded-none space-y-4 shadow-sm">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Patient Queue</span>
                <h3 className="font-display font-bold text-lg text-ink mt-0.5">Assigned Consultations</h3>
              </div>

              {consultationsLoading ? (
                <div className="flex items-center space-x-2 text-ink opacity-60 py-10 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-turmeric" />
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Loading Queue Ledger...</span>
                </div>
              ) : !consultations || consultations.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-cardboard rounded-sm bg-paper bg-opacity-35">
                  <Stethoscope className="w-8 h-8 text-cardboard mx-auto stroke-1 mb-2" />
                  <h4 className="font-display font-bold text-ink text-xs">Queue is Empty</h4>
                  <p className="font-body text-[10px] text-ink opacity-70 max-w-[280px] mx-auto mt-1">
                    You have no scheduled patient consultations. When customers book consultation slots, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-cardboard bg-paperLight overflow-hidden rounded-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-body text-ink border-collapse">
                      <thead>
                        <tr className="bg-paper border-b border-cardboard font-mono text-[9px] uppercase tracking-wider text-herb text-left">
                          <th className="p-4 font-bold">Appointment</th>
                          <th className="p-4 font-bold">Patient Pet</th>
                          <th className="p-4 font-bold">Inquiry Reason</th>
                          <th className="p-4 font-bold">Status</th>
                          <th className="p-4 font-bold text-center">Fulfillment Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cardboard divide-dashed">
                        {consultations.map((c) => {
                          const dateObj = new Date(c.scheduled_at);
                          const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                          return (
                            <tr key={c.id} className="hover:bg-paper transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-ink">{formattedDate}</div>
                                <div className="text-[10px] text-ink opacity-70 font-mono mt-0.5">{formattedTime}</div>
                                <div className="text-[9px] text-ink opacity-60 font-mono">ID: {c.id}</div>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-ink">{c.pet?.name || 'Pet'}</div>
                                <div className="text-[10px] text-ink opacity-70 font-mono mt-0.5">
                                  {c.pet?.species} {c.pet?.breed ? `(${c.pet.breed})` : ''}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-ink">{c.reason}</div>
                                {c.customer_notes && (
                                  <div className="text-[10px] text-ink opacity-75 italic mt-1 bg-paper p-1.5 border border-cardboard border-opacity-50">
                                    Notes: "{c.customer_notes}"
                                  </div>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold inline-block ${
                                  c.status?.toUpperCase() === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                  c.status?.toUpperCase() === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                  c.status?.toUpperCase() === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                                  c.status?.toUpperCase() === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                {c.status?.toUpperCase() === 'PENDING' && (
                                  <div className="flex justify-center space-x-2">
                                    <button
                                      onClick={() => updateStatusMutation.mutate({ id: c.id, status: 'confirmed' })}
                                      disabled={updateStatusMutation.isPending}
                                      className="bg-green-100 hover:bg-green-200 text-green-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-green-300 disabled:opacity-50"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => updateStatusMutation.mutate({ id: c.id, status: 'cancelled' })}
                                      disabled={updateStatusMutation.isPending}
                                      className="bg-red-100 hover:bg-red-200 text-red-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-red-300 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}

                                {c.status?.toUpperCase() === 'CONFIRMED' && (
                                  <div className="flex justify-center space-x-2">
                                    <button
                                      onClick={() => updateStatusMutation.mutate({ id: c.id, status: 'in_progress' })}
                                      disabled={updateStatusMutation.isPending}
                                      className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-indigo-300 disabled:opacity-50"
                                    >
                                      Start
                                    </button>
                                    <button
                                      onClick={() => updateStatusMutation.mutate({ id: c.id, status: 'cancelled' })}
                                      disabled={updateStatusMutation.isPending}
                                      className="bg-red-100 hover:bg-red-200 text-red-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-red-300 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}

                                {c.status?.toUpperCase() === 'IN_PROGRESS' && (
                                  <div className="flex justify-center space-x-2">
                                    <button
                                      onClick={() => updateStatusMutation.mutate({ id: c.id, status: 'completed' })}
                                      disabled={updateStatusMutation.isPending}
                                      className="bg-green-100 hover:bg-green-200 text-green-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-green-300 disabled:opacity-50"
                                    >
                                      Complete
                                    </button>
                                  </div>
                                )}

                                {['COMPLETED', 'CANCELLED'].includes(c.status?.toUpperCase()) && (
                                  <span className="font-mono text-[9px] text-ink opacity-50 font-bold uppercase tracking-wider">Finalized</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Shift Schedule Management */}
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-fade-in-up">
            
            {/* Form on the left */}
            <div className="lg:col-span-4 border border-cardboard bg-paperLight p-6 rounded-none space-y-4 shadow-sm h-fit">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Calendar Grid</span>
                <h3 className="font-display font-bold text-lg text-ink mt-0.5">Declare Shift Hours</h3>
              </div>

              <form onSubmit={handleAddAvailSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Day of Week:</label>
                  <select
                    value={availDay}
                    onChange={(e) => setAvailDay(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Start Shift:</label>
                    <input
                      type="time"
                      required
                      value={availStart}
                      onChange={(e) => setAvailStart(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">End Shift:</label>
                    <input
                      type="time"
                      required
                      value={availEnd}
                      onChange={(e) => setAvailEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addAvailMutation.isPending}
                  className="w-full bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  {addAvailMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register Shift</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* List on the right */}
            <div className="lg:col-span-8 border border-cardboard bg-paperLight p-6 rounded-none space-y-4 shadow-sm">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Active Time Windows</span>
                <h3 className="font-display font-bold text-lg text-ink mt-0.5">Declared Booking Shifts</h3>
              </div>

              {availabilitiesLoading ? (
                <div className="flex items-center space-x-2 text-ink opacity-60 py-10 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-turmeric" />
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Loading Schedule Slots...</span>
                </div>
              ) : !availabilities || availabilities.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-cardboard rounded-sm bg-paper bg-opacity-35">
                  <Clock className="w-8 h-8 text-cardboard mx-auto stroke-1 mb-2" />
                  <h4 className="font-display font-bold text-ink text-xs">No Declared Slots</h4>
                  <p className="font-body text-[10px] text-ink opacity-70 max-w-[280px] mx-auto mt-1">
                    You have not declared any shift windows. Declare hours on the left to allow customers to book appointments.
                  </p>
                </div>
              ) : (
                <div className="border border-cardboard bg-paperLight overflow-hidden rounded-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-body text-ink border-collapse">
                      <thead>
                        <tr className="bg-paper border-b border-cardboard font-mono text-[9px] uppercase tracking-wider text-herb text-left">
                          <th className="p-4 font-bold">Week Day</th>
                          <th className="p-4 font-bold">Shift Start</th>
                          <th className="p-4 font-bold">Shift End</th>
                          <th className="p-4 font-bold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cardboard divide-dashed">
                        {availabilities.map((avail) => (
                          <tr key={avail.id} className="hover:bg-paper transition-colors">
                            <td className="p-4 font-bold uppercase tracking-wider font-mono text-[10px] text-herb">
                              {avail.day_of_week}
                            </td>
                            <td className="p-4 font-mono text-[11px]">
                              {avail.start_time.substring(0, 5)}
                            </td>
                            <td className="p-4 font-mono text-[11px]">
                              {avail.end_time.substring(0, 5)}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this shift window?')) {
                                    deleteAvailMutation.mutate(avail.id);
                                  }
                                }}
                                disabled={deleteAvailMutation.isPending}
                                className="font-mono text-[9px] uppercase font-bold tracking-wider text-paprika hover:underline flex items-center justify-center space-x-1 mx-auto disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Shift</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Doctor Profile */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-fade-in-up">
            
            {/* Edit Profile Form */}
            <div className="lg:col-span-8 border border-cardboard bg-paperLight p-6 rounded-none space-y-4 shadow-sm">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Credentials Card</span>
                <h3 className="font-display font-bold text-lg text-ink mt-0.5">Edit Professional Profile</h3>
              </div>

              {profileLoading ? (
                <div className="flex items-center space-x-2 text-ink opacity-60 py-10 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-turmeric" />
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Loading Profile...</span>
                </div>
              ) : (
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Specialization:</label>
                      <input
                        type="text"
                        required
                        value={spec}
                        onChange={(e) => setSpec(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        placeholder="e.g. Canine Nutritionist, Surgery"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Qualification:</label>
                      <input
                        type="text"
                        required
                        value={qual}
                        onChange={(e) => setQual(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        placeholder="e.g. B.V.Sc & A.H."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Consultation Fee (INR):</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Experience (Years):</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={expYears}
                        onChange={(e) => setExpYears(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Biography (Bio):</label>
                    <textarea
                      rows={4}
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors resize-none"
                      placeholder="Share a summary of your professional experience and philosophy on veterinary care..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="w-full bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-3 font-bold rounded-sm hover-bounce disabled:opacity-50 flex items-center justify-center space-x-1.5"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Profile Detail Card on the right */}
            <div className="lg:col-span-4 border border-cardboard bg-paperLight p-6 rounded-none space-y-4 shadow-sm h-fit">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Active Badge</span>
                <h3 className="font-display font-bold text-lg text-ink mt-0.5">Professional Card</h3>
              </div>

              {profile && (
                <div className="space-y-4 text-xs font-body">
                  <div className="flex items-center space-x-3 bg-paper p-3 border border-cardboard rounded-sm">
                    <div className="p-2 bg-turmeric bg-opacity-20 rounded-full text-turmeric">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold">Medical License</div>
                      <div className="font-bold text-ink">{profile.license_number}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-cardboard border-dashed py-1.5">
                      <span className="text-ink opacity-70">Specialization:</span>
                      <span className="font-bold">{profile.specialization}</span>
                    </div>
                    <div className="flex justify-between border-b border-cardboard border-dashed py-1.5">
                      <span className="text-ink opacity-70">Qualification:</span>
                      <span className="font-bold">{profile.qualification}</span>
                    </div>
                    <div className="flex justify-between border-b border-cardboard border-dashed py-1.5">
                      <span className="text-ink opacity-70">Consultation Fee:</span>
                      <span className="font-bold font-mono text-[10px] text-herb">₹{profile.consultation_fee}</span>
                    </div>
                    <div className="flex justify-between border-b border-cardboard border-dashed py-1.5">
                      <span className="text-ink opacity-70">Experience:</span>
                      <span className="font-bold">{profile.experience_years} Years</span>
                    </div>
                    <div className="flex justify-between border-b border-cardboard border-dashed py-1.5">
                      <span className="text-ink opacity-70">Clinic Association:</span>
                      <span className="font-bold text-right">{profile.clinic?.name || `Clinic ID: ${profile.clinic_id}`}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-ink opacity-70">Verification Status:</span>
                      <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold ${
                        profile.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-850'
                      }`}>
                        {profile.is_verified ? 'Verified ✓' : 'Pending Verification'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
