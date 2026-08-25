import React, { useState, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { CartDrawer } from '../../components/CartDrawer';
import { Eyebrow } from '../../components/Eyebrow';
import { 
  getDoctorProfile, 
  updateDoctorProfile, 
  getDoctorAvailabilities, 
  createDoctorAvailability, 
  deleteDoctorAvailability, 
  replaceDoctorAvailabilityBulk,
  getDoctorConsultations, 
  updateConsultationStatus,
  getDoctorConsultationById,
  updateDoctorAvailabilitySlot,
  getPetHealthRecords
} from '../../api/doctor';
import type { 
  DoctorAvailabilityResponse, 
  DoctorAvailabilityUpdate,
  PetHealthHistoryResponse
} from '../../api/doctor';
import {
  createHealthRecord,
  updateHealthRecord
} from '../../api/pets';
import type { DoctorResponse, ConsultationResponse } from '../../api/consultations';
import { fetchMyApplicationStatus } from '../../api/doctor_applications';
import type { DoctorApplicationResponse } from '../../api/doctor_applications';

import { Header } from '../../components/Header';
import { 
  Loader2, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Save, 
  Trash2, 
  Stethoscope,
  Briefcase,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ExternalLink
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

export const DoctorDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'consultations' | 'schedule' | 'profile' | 'verification'>('consultations');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Form States - Availability
  const [availDay, setAvailDay] = useState('monday');
  const [availStart, setAvailStart] = useState('09:00');
  const [availEnd, setAvailEnd] = useState('17:00');

  // Form States - Bulk Availability
  const [bulkStart, setBulkStart] = useState('09:00');
  const [bulkEnd, setBulkEnd] = useState('17:00');
  const [bulkDays, setBulkDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);

  // Form States - Profile
  const [spec, setSpec] = useState('');
  const [qual, setQual] = useState('');
  const [fee, setFee] = useState('');
  const [expYears, setExpYears] = useState('');
  const [bioText, setBioText] = useState('');
  const [isProfileInitialized, setIsProfileInitialized] = useState(false);

  // Form States - Medical Log Modal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedConsultationForLog, setSelectedConsultationForLog] = useState<ConsultationResponse | null>(null);
  const [logId, setLogId] = useState<number | null>(null);
  const [logRecordType, setLogRecordType] = useState('general');
  const [logTitle, setLogTitle] = useState('');
  const [logSymptoms, setLogSymptoms] = useState('');
  const [logClinicalFindings, setLogClinicalFindings] = useState('');
  const [logDiagnosis, setLogDiagnosis] = useState('');
  const [logTreatment, setLogTreatment] = useState('');
  const [logMedications, setLogMedications] = useState('');
  const [logFollowUpDate, setLogFollowUpDate] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [isSearchingLog, setIsSearchingLog] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Clinic / Doctor Panel Enhancements States
  const [selectedConsultationId, setSelectedConsultationId] = useState<number | null>(null);
  const [inspectingPetId, setInspectingPetId] = useState<number | null>(null);
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('17:00');
  const [mutatingSlotIds, setMutatingSlotIds] = useState<number[]>([]);

  const handleOpenLogModal = async (consultation: ConsultationResponse) => {
    setSelectedConsultationForLog(consultation);
    setIsLogModalOpen(true);
    setLogId(null);
    setLogRecordType('general');
    setLogTitle(`Consultation for ${consultation.pet?.name || 'Pet'}`);
    setLogSymptoms('');
    setLogClinicalFindings('');
    setLogDiagnosis('');
    setLogTreatment('');
    setLogMedications('');
    setLogFollowUpDate('');
    setLogNotes('');
    
    if (consultation.pet_id) {
      setIsSearchingLog(true);
      try {
        const history = await getPetHealthRecords(consultation.pet_id);
        const existingRecord = history.records?.find(r => r.consultation_id === consultation.id);
        if (existingRecord) {
          setLogId(existingRecord.id);
          setLogRecordType(mapRecordType(existingRecord.record_type));
          setLogTitle(existingRecord.title || '');
          setLogSymptoms(existingRecord.symptoms || '');
          setLogClinicalFindings(existingRecord.clinical_findings || '');
          setLogDiagnosis(existingRecord.diagnosis || '');
          setLogTreatment(existingRecord.treatment || '');
          setLogMedications(existingRecord.medications || '');
          setLogFollowUpDate(existingRecord.follow_up_date || '');
          setLogNotes(existingRecord.notes || '');
        }
      } catch (err) {
        console.error('Failed to search existing consultation medical log:', err);
      } finally {
        setIsSearchingLog(false);
      }
    }
  };

  const handleSaveLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsultationForLog || !selectedConsultationForLog.pet_id) return;
    
    setIsSavingLog(true);
    try {
      const payload = {
        pet_id: selectedConsultationForLog.pet_id,
        consultation_id: selectedConsultationForLog.id,
        record_type: mapRecordType(logRecordType),
        title: logTitle,
        symptoms: logSymptoms || null,
        clinical_findings: logClinicalFindings || null,
        diagnosis: logDiagnosis || null,
        treatment: logTreatment || null,
        medications: logMedications || null,
        follow_up_date: logFollowUpDate || null,
        notes: logNotes || null,
      };

      if (logId) {
        await updateHealthRecord(logId, payload);
        alert('Medical log updated successfully!');
      } else {
        await createHealthRecord(selectedConsultationForLog.pet_id, payload);
        alert('Medical log created successfully!');
      }
      setIsLogModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['doctorConsultations'] });
    } catch (err: any) {
      alert(`Failed to save medical log: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsSavingLog(false);
    }
  };

  // Queries
  const { data: consultations, isLoading: consultationsLoading } = useQuery<ConsultationResponse[], Error>({
    queryKey: ['doctorConsultations'],
    queryFn: getDoctorConsultations,
    enabled: activeTab === 'consultations'
  });

  const { data: doctorConsultationDetails, isLoading: doctorConsultationDetailsLoading } = useQuery({
    queryKey: ['doctorConsultationDetails', selectedConsultationId],
    queryFn: () => getDoctorConsultationById(selectedConsultationId!),
    enabled: selectedConsultationId !== null,
  });

  const { data: petHealthHistory, isLoading: petHealthHistoryLoading } = useQuery<PetHealthHistoryResponse, Error>({
    queryKey: ['petHealthHistory', inspectingPetId],
    queryFn: () => getPetHealthRecords(inspectingPetId!),
    enabled: inspectingPetId !== null,
  });

  const updateAvailabilitySlotMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DoctorAvailabilityUpdate }) => updateDoctorAvailabilitySlot(id, data),
    onMutate: async ({ id, data }) => {
      // Add slot ID to mutating list
      setMutatingSlotIds((prev) => [...prev, id]);

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['doctorAvailabilities'] });

      // Snapshot the previous value
      const previousAvailabilities = queryClient.getQueryData<DoctorAvailabilityResponse[]>(['doctorAvailabilities']);

      // Optimistically update to the new value
      if (previousAvailabilities) {
        queryClient.setQueryData<DoctorAvailabilityResponse[]>(
          ['doctorAvailabilities'],
          previousAvailabilities.map((avail) =>
            avail.id === id ? { ...avail, ...data } : avail
          )
        );
      }

      // Return a context object with the snapshotted value
      return { previousAvailabilities };
    },
    onError: (err: any, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousAvailabilities) {
        queryClient.setQueryData(['doctorAvailabilities'], context.previousAvailabilities);
      }
      alert(`Failed to update availability slot: ${err?.response?.data?.detail || err.message}`);
    },
    onSuccess: (data) => {
      // Update the query cache with the actual response data from the server
      const previousAvailabilities = queryClient.getQueryData<DoctorAvailabilityResponse[]>(['doctorAvailabilities']);
      if (previousAvailabilities) {
        queryClient.setQueryData<DoctorAvailabilityResponse[]>(
          ['doctorAvailabilities'],
          previousAvailabilities.map((avail) =>
            avail.id === data.id ? data : avail
          )
        );
      }
      setEditingAvailabilityId(null);
    },
    onSettled: (_data, _error, variables) => {
      // Remove slot ID from mutating list when finished
      setMutatingSlotIds((prev) => prev.filter((id) => id !== variables.id));
    }
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

  const { data: application, isLoading: applicationLoading } = useQuery<DoctorApplicationResponse | null, Error>({
    queryKey: ['myDoctorApplicationStatus'],
    queryFn: fetchMyApplicationStatus,
    enabled: activeTab === 'verification'
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

  const bulkReplaceMutation = useMutation({
    mutationFn: replaceDoctorAvailabilityBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorAvailabilities'] });
      alert('Standard weekly schedule applied successfully! All previous availability shifts have been replaced.');
    },
    onError: (err: any) => {
      alert(`Failed to set bulk schedule: ${err?.response?.data?.detail || err.message}`);
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

  const handleBulkScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkDays.length === 0) {
      alert('Please select at least one day for your standard weekly schedule.');
      return;
    }
    if (bulkStart >= bulkEnd) {
      alert('Start shift time must be earlier than end shift time.');
      return;
    }

    if (!confirm('Are you sure you want to replace all current availability shifts with this bulk standard schedule? This cannot be undone.')) {
      return;
    }

    const schedule = bulkDays.map((day) => ({
      day_of_week: day as any,
      start_time: bulkStart,
      end_time: bulkEnd,
      is_available: true
    }));

    bulkReplaceMutation.mutate(schedule);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="doctor" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main Workspace */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 md:px-8 py-10">
        
        {/* Banner Section */}
        <div className="border border-cardboard bg-paperLight p-6 rounded-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 shadow-sm text-left">
          <div className="space-y-1">
            <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">Dashboard Workspace</span>
            <h2 className="font-display font-bold text-3xl text-ink tracking-tight">Doctor Panel</h2>
            <p className="font-body text-sm text-ink opacity-70">
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
                ? 'border-turmeric text-paprika'
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
                ? 'border-turmeric text-paprika'
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
                ? 'border-turmeric text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Doctor Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('verification')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'verification'
                ? 'border-turmeric text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Verify Log & Status</span>
          </button>
        </div>

        {/* Tab 1: Consultations Registry */}
        {activeTab === 'consultations' && (
          <div className="space-y-6 text-left animate-fade-in-up">
            <div className="border border-cardboard bg-paperLight p-6 rounded-none space-y-4 shadow-sm">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">Patient Queue</span>
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
                        <tr className="bg-paper border-b border-cardboard font-mono text-[10px] uppercase tracking-wider text-paprika text-left">
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
                                <div className="flex items-center space-x-1.5">
                                  <div className="font-bold text-ink">{formattedDate}</div>
                                  <button
                                    onClick={() => setSelectedConsultationId(c.id)}
                                    className="text-cardboard hover:text-ink hover:underline lowercase font-semibold text-[8px]"
                                  >
                                    (view)
                                  </button>
                                </div>
                                <div className="text-[10px] text-ink opacity-70 font-mono mt-0.5">{formattedTime}</div>
                                <div className="text-[9px] text-ink opacity-60 font-mono">ID: {c.id}</div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center space-x-1.5">
                                  <div className="font-bold text-ink">{c.pet?.name || 'Pet'}</div>
                                  <button
                                    onClick={() => setInspectingPetId(c.pet_id)}
                                    className="text-herb hover:underline uppercase font-bold text-[8px] tracking-wider"
                                  >
                                    [History]
                                  </button>
                                </div>
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
                                  <div className="flex justify-center items-center space-x-2">
                                    <button
                                      onClick={() => updateStatusMutation.mutate({ id: c.id, status: 'completed' })}
                                      disabled={updateStatusMutation.isPending}
                                      className="bg-green-100 hover:bg-green-200 text-green-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-green-300 disabled:opacity-50"
                                    >
                                      Complete
                                    </button>
                                    <button
                                      onClick={() => handleOpenLogModal(c)}
                                      className="bg-paper hover:bg-paperLight text-ink font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-cardboard flex items-center space-x-1"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>Medical Log</span>
                                    </button>
                                  </div>
                                )}

                                {c.status?.toUpperCase() === 'CANCELLED' && (
                                  <span className="font-mono text-[9px] text-ink opacity-50 font-bold uppercase tracking-wider">Finalized</span>
                                )}
                                
                                {c.status?.toUpperCase() === 'COMPLETED' && (
                                  <div className="flex justify-center items-center space-x-2">
                                    <span className="font-mono text-[9px] text-ink opacity-50 font-bold uppercase tracking-wider mr-2">Completed</span>
                                    <button
                                      onClick={() => handleOpenLogModal(c)}
                                      className="bg-paper hover:bg-paperLight text-ink font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-cardboard flex items-center space-x-1"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>View/Edit Log</span>
                                    </button>
                                  </div>
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
                <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">Calendar Grid</span>
                <h3 className="font-display font-bold text-lg text-ink mt-0.5">Declare Shift Hours</h3>
              </div>

              <form onSubmit={handleAddAvailSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Day of Week:</label>
                  <select
                    value={availDay}
                    onChange={(e) => setAvailDay(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Start Shift:</label>
                    <input
                      type="time"
                      required
                      value={availStart}
                      onChange={(e) => setAvailStart(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">End Shift:</label>
                    <input
                      type="time"
                      required
                      value={availEnd}
                      onChange={(e) => setAvailEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addAvailMutation.isPending}
                  className="w-full bg-turmeric text-ink font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50 flex items-center justify-center space-x-1.5"
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

              <hr className="border-t border-dashed border-cardboard my-6" />

              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">Standard Presets</span>
                <h3 className="font-display font-bold text-lg text-ink mt-0.5">Bulk Weekly Shifts</h3>
              </div>

              <form onSubmit={handleBulkScheduleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Start Time:</label>
                    <input
                      type="time"
                      required
                      value={bulkStart}
                      onChange={(e) => setBulkStart(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">End Time:</label>
                    <input
                      type="time"
                      required
                      value={bulkEnd}
                      onChange={(e) => setBulkEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Select Days:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isChecked = bulkDays.includes(day.value);
                      return (
                        <label key={day.value} className="flex items-center space-x-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setBulkDays(bulkDays.filter((d) => d !== day.value));
                              } else {
                                setBulkDays([...bulkDays, day.value]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-cardboard text-turmeric focus:ring-turmeric focus:ring-opacity-40"
                          />
                          <span className="font-body text-sm text-ink">{day.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={bulkReplaceMutation.isPending}
                  className="w-full bg-turmeric hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50 flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  {bulkReplaceMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Set Standard Schedule</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* List on the right */}
            <div className="lg:col-span-8 border border-cardboard bg-paperLight p-6 rounded-none space-y-4 shadow-sm">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">Active Time Windows</span>
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
                        <tr className="bg-paper border-b border-cardboard font-mono text-[10px] uppercase tracking-wider text-paprika text-left">
                          <th className="p-4 font-bold">Week Day</th>
                          <th className="p-4 font-bold">Shift Start</th>
                          <th className="p-4 font-bold">Shift End</th>
                          <th className="p-4 font-bold text-center">Status Toggle</th>
                          <th className="p-4 font-bold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cardboard divide-dashed">
                        {availabilities.map((avail) => {
                          const isEditing = editingAvailabilityId === avail.id;

                          return (
                            <tr key={avail.id} className="hover:bg-paper transition-colors">
                              <td className="p-4 font-bold uppercase tracking-wider font-mono text-[10px] text-herb">
                                {avail.day_of_week}
                              </td>
                              <td className="p-4 font-mono text-[11px]">
                                {isEditing ? (
                                  <input
                                    type="time"
                                    value={editStart}
                                    onChange={(e) => setEditStart(e.target.value)}
                                    className="px-2 py-1 border border-cardboard rounded-sm bg-paperLight font-mono text-sm text-ink focus:outline-none focus:border-turmeric"
                                  />
                                ) : (
                                  avail.start_time.substring(0, 5)
                                )}
                              </td>
                              <td className="p-4 font-mono text-[11px]">
                                {isEditing ? (
                                  <input
                                    type="time"
                                    value={editEnd}
                                    onChange={(e) => setEditEnd(e.target.value)}
                                    className="px-2 py-1 border border-cardboard rounded-sm bg-paperLight font-mono text-sm text-ink focus:outline-none focus:border-turmeric"
                                  />
                                ) : (
                                  avail.end_time.substring(0, 5)
                                )}
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={() => 
                                      updateAvailabilitySlotMutation.mutate({ 
                                        id: avail.id, 
                                        data: { is_available: !avail.is_available } 
                                      })
                                    }
                                    disabled={mutatingSlotIds.includes(avail.id)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      mutatingSlotIds.includes(avail.id) ? 'opacity-50 cursor-not-allowed' : ''
                                    } ${
                                      avail.is_available ? 'bg-herb' : 'bg-cardboard bg-opacity-40'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-paperLight shadow ring-0 transition duration-200 ease-in-out ${
                                        avail.is_available ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                  <span className="ml-2 font-mono text-[9px] uppercase font-bold text-ink">
                                    {avail.is_available ? 'On' : 'Off'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                {isEditing ? (
                                  <div className="flex justify-center space-x-2">
                                    <button
                                      onClick={() => 
                                        updateAvailabilitySlotMutation.mutate({ 
                                          id: avail.id, 
                                          data: { start_time: editStart, end_time: editEnd } 
                                        })
                                      }
                                      className="font-mono text-[9px] uppercase font-bold text-herb hover:underline"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingAvailabilityId(null)}
                                      className="font-mono text-[9px] uppercase font-bold text-cardboard hover:underline"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-center space-x-3">
                                    <button
                                      onClick={() => {
                                        setEditingAvailabilityId(avail.id);
                                        setEditStart(avail.start_time.substring(0, 5));
                                        setEditEnd(avail.end_time.substring(0, 5));
                                      }}
                                      className="font-mono text-[9px] uppercase font-bold text-turmeric hover:underline"
                                    >
                                      Edit Hours
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm('Are you sure you want to delete this shift window?')) {
                                          deleteAvailMutation.mutate(avail.id);
                                        }
                                      }}
                                      disabled={deleteAvailMutation.isPending}
                                      className="font-mono text-[9px] uppercase font-bold text-paprika hover:underline flex items-center space-x-0.5 disabled:opacity-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove</span>
                                    </button>
                                  </div>
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

        {/* Tab 3: Doctor Profile */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-fade-in-up">
            
            {/* Edit Profile Form */}
            <div className="lg:col-span-8 border border-cardboard bg-paperLight p-6 rounded-none space-y-4 shadow-sm">
              <div className="border-b border-cardboard border-dashed pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">Credentials Card</span>
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
                      <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Specialization:</label>
                      <input
                        type="text"
                        required
                        value={spec}
                        onChange={(e) => setSpec(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        placeholder="e.g. Canine Nutritionist, Surgery"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Qualification:</label>
                      <input
                        type="text"
                        required
                        value={qual}
                        onChange={(e) => setQual(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        placeholder="e.g. B.V.Sc & A.H."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Consultation Fee (INR):</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Experience (Years):</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={expYears}
                        onChange={(e) => setExpYears(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Biography (Bio):</label>
                    <textarea
                      rows={4}
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors resize-none"
                      placeholder="Share a summary of your professional experience and philosophy on veterinary care..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="w-full bg-turmeric text-ink font-mono text-[9px] uppercase px-4 py-3 font-bold rounded-sm hover-bounce disabled:opacity-50 flex items-center justify-center space-x-1.5"
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
                <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">Active Badge</span>
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

        {activeTab === 'verification' && (
          <div className="max-w-4xl mx-auto space-y-6 text-left animate-fade-in-up">
            <div className="border border-cardboard bg-paperLight p-8 rounded-none space-y-6 shadow-sm relative overflow-hidden">
              {/* Decorative left notebook spine border */}
              <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-40"></div>
              
              <div className="border-b border-cardboard border-dashed pb-4 pl-4">
                <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">Audit Credentials Ledger</span>
                <h3 className="font-display font-bold text-2xl text-ink mt-1">Onboarding & Verification Log</h3>
                <p className="font-body text-sm text-ink opacity-70">
                  Review your license credentials log, verification checklist statuses, and stage activation details.
                </p>
              </div>

              {applicationLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
                  <span className="font-mono text-[10px] uppercase text-paprika font-bold">Reading verification files...</span>
                </div>
              ) : !application ? (
                <div className="border border-cardboard bg-paperLight p-8 rounded-sm text-center max-w-md mx-auto space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-herb mx-auto stroke-1 animate-pulse" />
                  <h4 className="font-display font-bold text-lg text-ink">Verification Logs Clear</h4>
                  <p className="font-body text-sm text-ink opacity-70 leading-relaxed">
                    You have been directly registered or bulk-verified by the system administrator. All credentials, shift schedules, and consultations access are active.
                  </p>
                </div>
              ) : (
                <div className="space-y-8 pl-4">
                  {/* Onboarding Stage Timeline Flow */}
                  <div className="space-y-3">
                    <span className="font-mono text-[10px] uppercase font-bold text-paprika block">Onboarding Verification Flow</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[10px] text-ink uppercase">
                      {/* Step 1 */}
                      <div className="border border-cardboard p-4 rounded-sm bg-paper bg-opacity-40 space-y-2 flex flex-col justify-between">
                        <div>
                          <span className="opacity-60 block text-[8px]">Stage 01</span>
                          <span className="font-bold text-ink">Submit Application</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-green-700 font-bold mt-2 text-[9px]">
                          <CheckCircle2 className="w-4 h-4 text-herb" />
                          <span>Submitted</span>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="border border-cardboard p-4 rounded-sm bg-paper bg-opacity-40 space-y-2 flex flex-col justify-between">
                        <div>
                          <span className="opacity-60 block text-[8px]">Stage 02</span>
                          <span className="font-bold text-ink">Documents Verification</span>
                        </div>
                        {application.aadhaar_card_url && application.pan_card_url && application.medical_certificate_url ? (
                          <div className="flex items-center space-x-1.5 text-green-700 font-bold mt-2 text-[9px]">
                            <CheckCircle2 className="w-4 h-4 text-herb" />
                            <span>Documents Logged</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-yellow-750 font-bold mt-2 text-[9px]">
                            <AlertTriangle className="w-4 h-4 text-turmeric" />
                            <span>Incomplete Uploads</span>
                          </div>
                        )}
                      </div>

                      {/* Step 3 */}
                      <div className="border border-cardboard p-4 rounded-sm bg-paper bg-opacity-40 space-y-2 flex flex-col justify-between">
                        <div>
                          <span className="opacity-60 block text-[8px]">Stage 03</span>
                          <span className="font-bold text-ink">Verification Decision</span>
                        </div>
                        {application.status?.toUpperCase() === 'APPROVED' ? (
                          <div className="flex items-center space-x-1.5 text-green-700 font-bold mt-2 text-[9px]">
                            <CheckCircle2 className="w-4 h-4 text-herb" />
                            <span>Approved & Active</span>
                          </div>
                        ) : application.status?.toUpperCase() === 'REJECTED' ? (
                          <div className="flex items-center space-x-1.5 text-red-800 font-bold mt-2 text-[9px]">
                            <AlertTriangle className="w-4 h-4 text-paprika" />
                            <span>Rejected</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1.5 text-yellow-750 font-bold mt-2 text-[9px] animate-pulse">
                            <Clock className="w-4 h-4 text-turmeric animate-spin" />
                            <span>Pending Review</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Verification checklist details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-cardboard border-dashed">
                    {/* Logged Documents Checklist */}
                    <div className="border border-cardboard p-6 rounded-sm bg-paper bg-opacity-50 space-y-4">
                      <h4 className="font-display font-bold text-sm text-ink uppercase tracking-wide border-b border-cardboard border-dashed pb-2">
                        Verification Files Checklist
                      </h4>
                      
                      <div className="space-y-3 font-mono text-[10px]">
                        <div className="flex justify-between items-center dotted-divider pb-2">
                          <span className="bg-paper pr-2 text-ink font-bold flex items-center">
                            <CheckCircle2 className="w-4 h-4 text-herb mr-2" />
                            <span>Aadhaar Card Record</span>
                          </span>
                          <span className="bg-paper pl-2">
                            {application.aadhaar_card_url ? (
                              <a 
                                href={application.aadhaar_card_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-herb hover:text-ink font-bold underline flex items-center space-x-1"
                              >
                                <span>View File</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-paprika font-bold">Missing</span>
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between items-center dotted-divider pb-2">
                          <span className="bg-paper pr-2 text-ink font-bold flex items-center">
                            <CheckCircle2 className="w-4 h-4 text-herb mr-2" />
                            <span>PAN Card Record</span>
                          </span>
                          <span className="bg-paper pl-2">
                            {application.pan_card_url ? (
                              <a 
                                href={application.pan_card_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-herb hover:text-ink font-bold underline flex items-center space-x-1"
                              >
                                <span>View File</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-paprika font-bold">Missing</span>
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pb-1">
                          <span className="bg-paper pr-2 text-ink font-bold flex items-center">
                            <CheckCircle2 className="w-4 h-4 text-herb mr-2" />
                            <span>Medical Certificate</span>
                          </span>
                          <span className="bg-paper pl-2">
                            {application.medical_certificate_url ? (
                              <a 
                                href={application.medical_certificate_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-herb hover:text-ink font-bold underline flex items-center space-x-1"
                              >
                                <span>View File</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-paprika font-bold">Missing</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Onboarding Logged Credentials */}
                    <div className="border border-cardboard p-6 rounded-sm bg-paper bg-opacity-50 space-y-4">
                      <h4 className="font-display font-bold text-sm text-ink uppercase tracking-wide border-b border-cardboard border-dashed pb-2">
                        Logged Credentials Details
                      </h4>
                      
                      <div className="space-y-3 font-mono text-[10px]">
                        <div className="flex justify-between items-center dotted-divider pb-2">
                          <span className="bg-paper pr-2 text-ink opacity-70">License Number</span>
                          <span className="bg-paper pl-2 font-bold">{application.license_number}</span>
                        </div>
                        <div className="flex justify-between items-center dotted-divider pb-2">
                          <span className="bg-paper pr-2 text-ink opacity-70">Study Period Duration</span>
                          <span className="bg-paper pl-2 font-bold">{application.degree_start_year} - {application.degree_end_year} ({application.degree_end_year - application.degree_start_year} years)</span>
                        </div>
                        <div className="flex justify-between items-center dotted-divider pb-2">
                          <span className="bg-paper pr-2 text-ink opacity-70">Clinic Association</span>
                          <span className="bg-paper pl-2 font-bold text-right">{application.clinic_name} ({application.clinic_city})</span>
                        </div>
                        <div className="flex justify-between items-center pb-1">
                          <span className="bg-paper pr-2 text-ink opacity-70">Submitted On</span>
                          <span className="bg-paper pl-2 font-bold">{new Date(application.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Medical Log Editor Modal */}
      {isLogModalOpen && selectedConsultationForLog && (
        <div className="fixed inset-0 bg-ink bg-opacity-65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-paper border border-cardboard max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 flex flex-col space-y-4 text-left">
            <div className="flex justify-between items-start border-b border-cardboard border-dashed pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-paprika tracking-widest block">
                  Patient Dietary & Medical Journal
                </span>
                <h3 className="font-display font-bold text-xl text-ink mt-0.5">
                  {logId ? 'Edit Medical Log Entry' : 'Create Medical Log Entry'}
                </h3>
                <p className="font-body text-[10px] text-ink opacity-70 mt-0.5">
                  Consulting for <span className="font-bold text-ink">{selectedConsultationForLog.pet?.name || 'Pet'}</span> (ID: #{selectedConsultationForLog.pet_id})
                </p>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-ink opacity-50 hover:opacity-100 font-mono text-xs uppercase"
              >
                ✕ Close
              </button>
            </div>

            {isSearchingLog ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2 text-ink opacity-60">
                <Loader2 className="w-6 h-6 animate-spin text-turmeric" />
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Searching Consultation Records...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveLogSubmit} className="space-y-4 font-body text-sm text-ink">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Title field */}
                  <div className="md:col-span-8 space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Log Entry Title:</label>
                    <input
                      type="text"
                      required
                      value={logTitle}
                      onChange={(e) => setLogTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      placeholder="e.g. Annual Checkup or Nutrition Diagnostic"
                    />
                  </div>

                  {/* Record Type field */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Record Type:</label>
                    <select
                      value={logRecordType}
                      onChange={(e) => setLogRecordType(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                    >
                      <option value="general">General Log</option>
                      <option value="diagnosis">Diagnostic Log</option>
                      <option value="surgery">Surgery Log</option>
                      <option value="vaccination">Vaccination Log</option>
                      <option value="treatment">Treatment Log</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Symptoms */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Observed Symptoms:</label>
                    <textarea
                      rows={2}
                      value={logSymptoms}
                      onChange={(e) => setLogSymptoms(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                      placeholder="List any signs or symptoms reported by the owner..."
                    />
                  </div>

                  {/* Clinical Findings */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Clinical Findings:</label>
                    <textarea
                      rows={2}
                      value={logClinicalFindings}
                      onChange={(e) => setLogClinicalFindings(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                      placeholder="Physical exam results, vital signs..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Diagnosis */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Diagnosis conclusion:</label>
                    <textarea
                      rows={2}
                      value={logDiagnosis}
                      onChange={(e) => setLogDiagnosis(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                      placeholder="Primary medical conclusions..."
                    />
                  </div>

                  {/* Treatment */}
                  <div className="space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Prescribed Treatment:</label>
                    <textarea
                      rows={2}
                      value={logTreatment}
                      onChange={(e) => setLogTreatment(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                      placeholder="Recommended therapeutic or dietary changes..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Medications */}
                  <div className="md:col-span-8 space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Prescribed Medications:</label>
                    <input
                      type="text"
                      value={logMedications}
                      onChange={(e) => setLogMedications(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      placeholder="e.g. Amoxicillin 250mg once daily for 5 days"
                    />
                  </div>

                  {/* Follow-up Date */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Follow-up Date:</label>
                    <input
                      type="date"
                      value={logFollowUpDate}
                      onChange={(e) => setLogFollowUpDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase font-bold text-paprika tracking-wide block">Internal Notes:</label>
                  <textarea
                    rows={2}
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-cardboard rounded-xl bg-paperLight font-body text-sm text-ink focus:outline-none focus:border-turmeric transition-colors resize-none"
                    placeholder="Any private case notes, specific recommendations..."
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t border-cardboard border-dashed">
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                    className="px-4 py-2 border border-cardboard rounded-full font-mono text-[10px] uppercase font-bold text-ink hover:bg-paper transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingLog}
                    className="px-4 py-2 bg-turmeric text-ink rounded-full font-mono text-[10px] uppercase font-bold hover:opacity-95 transition-opacity flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {isSavingLog ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Log Entry</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Doctor Consultation Details Modal */}
      {selectedConsultationId !== null && (
        <div className="fixed inset-0 bg-ink bg-opacity-45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in-up relative text-left">
            <button 
              onClick={() => setSelectedConsultationId(null)}
              className="absolute top-4 right-4 text-ink opacity-60 hover:opacity-100 font-bold"
            >
              ✕
            </button>

            <div className="space-y-1">
              <Eyebrow label="DOCTOR PATIENT CONSULTATION JOURNAL" />
              <h3 className="font-display font-bold text-xl text-ink">
                Consultation Ledger Details #{selectedConsultationId}
              </h3>
            </div>

            {doctorConsultationDetailsLoading ? (
              <div className="py-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-turmeric animate-spin mx-auto" />
                <span className="font-mono text-xs uppercase text-ink opacity-60">Loading Session Details...</span>
              </div>
            ) : !doctorConsultationDetails ? (
              <p className="font-body text-sm text-ink opacity-60">Failed to load consultation record.</p>
            ) : (
              <div className="space-y-4 text-xs font-body">
                {/* Session Summary card */}
                <div className="p-4 border border-cardboard rounded-sm bg-paper bg-opacity-50 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold block">APPOINT TIME</span>
                      <span className="font-mono text-sm text-ink font-bold">{new Date(doctorConsultationDetails.scheduled_at).toLocaleString()}</span>
                    </div>
                    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold border ${
                      doctorConsultationDetails.status?.toUpperCase() === 'COMPLETED' ? 'bg-green-100 text-green-800 border-green-200' :
                      doctorConsultationDetails.status?.toUpperCase() === 'CANCELLED' ? 'bg-red-100 text-red-800 border-red-200' :
                      doctorConsultationDetails.status?.toUpperCase() === 'CONFIRMED' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      doctorConsultationDetails.status?.toUpperCase() === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-850 border-indigo-200' :
                      'bg-yellow-100 text-yellow-800 border-yellow-200'
                    }`}>
                      {doctorConsultationDetails.status}
                    </span>
                  </div>
                  
                  <hr className="border-t border-cardboard border-dashed" />
                  
                  <div className="grid grid-cols-2 gap-4 font-mono text-[11px] text-ink">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-paprika font-bold block">PATIENT PET</span>
                      <span className="font-bold flex items-center space-x-1">
                        <span>🐾 {doctorConsultationDetails.pet?.name || 'Pet'}</span>
                        <button
                          onClick={() => {
                            setInspectingPetId(doctorConsultationDetails.pet_id);
                            setSelectedConsultationId(null);
                          }}
                          className="text-paprika hover:underline uppercase font-bold text-[9px]"
                        >
                          (View Timeline)
                        </button>
                      </span>
                      <div className="opacity-70 mt-0.5">{doctorConsultationDetails.pet?.species} {doctorConsultationDetails.pet?.breed ? `(${doctorConsultationDetails.pet.breed})` : ''}</div>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase text-paprika font-bold block">FELLOW SPECIALIST</span>
                      <div className="font-bold">Dr. ID #{doctorConsultationDetails.doctor_id}</div>
                      <div className="opacity-70 mt-0.5">Qualifications: {doctorConsultationDetails.doctor?.qualification}</div>
                    </div>
                  </div>
                </div>

                {/* Reason & Notes */}
                <div className="space-y-2 font-body text-sm text-ink">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Owner's Inquiry Reason</span>
                    <p className="text-ink opacity-90">{doctorConsultationDetails.reason}</p>
                  </div>
                  {doctorConsultationDetails.customer_notes && (
                    <div>
                      <span className="font-mono text-[10px] uppercase text-paprika font-bold block">Customer Consultation Notes</span>
                      <p className="text-ink opacity-70 italic">"{doctorConsultationDetails.customer_notes}"</p>
                    </div>
                  )}
                </div>

                {/* Doctor's Notes */}
                <div className="border-t border-cardboard border-dashed pt-3">
                  <span className="font-mono text-[10px] uppercase text-turmeric font-bold block mb-1">Your Prescribed Diagnostics & Notes</span>
                  {doctorConsultationDetails.doctor_notes ? (
                    <p className="p-3 border border-cardboard border-dashed bg-paper rounded-sm text-ink opacity-90 italic">
                      "{doctorConsultationDetails.doctor_notes}"
                    </p>
                  ) : (
                    <p className="text-[10px] text-ink opacity-60 italic">No notes recorded yet for this session. Use the "Medical Log" tool when the session is IN PROGRESS or COMPLETED to update.</p>
                  )}
                </div>

                <div className="flex space-x-2 pt-2">
                  {(doctorConsultationDetails.status?.toUpperCase() === 'IN_PROGRESS' || doctorConsultationDetails.status?.toUpperCase() === 'COMPLETED') && (
                    <button
                      onClick={() => {
                        handleOpenLogModal(doctorConsultationDetails);
                        setSelectedConsultationId(null);
                      }}
                      className="flex-1 bg-turmeric text-ink font-mono text-[10px] uppercase py-2.5 font-bold rounded-sm tracking-wide text-center"
                    >
                      Open Medical Log Editor
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedConsultationId(null)}
                    className="flex-grow border border-cardboard hover:bg-paper text-ink font-mono text-[10px] uppercase py-2.5 font-bold rounded-sm tracking-wide text-center"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pet Health History timeline modal */}
      {inspectingPetId !== null && (
        <div className="fixed inset-0 bg-ink bg-opacity-45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-lg w-full p-6 space-y-6 animate-fade-in-up relative text-left max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setInspectingPetId(null)}
              className="absolute top-4 right-4 text-ink opacity-60 hover:opacity-100 font-bold"
            >
              ✕
            </button>

            <div className="space-y-1">
              <Eyebrow label="VETERINARY MEDICAL HISTORY LEDGER" />
              <h3 className="font-display font-bold text-2xl text-ink">
                Pet Health History Timeline
              </h3>
              <p className="font-body text-sm text-ink opacity-70">
                Detailed clinical history registry timeline.
              </p>
            </div>

            <hr className="border-t border-cardboard border-dashed" />

            {petHealthHistoryLoading ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                <span className="font-mono text-xs uppercase text-ink opacity-60">Retrieving Timeline Registry...</span>
              </div>
            ) : !petHealthHistory?.records || petHealthHistory.records.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-cardboard rounded-sm bg-paper bg-opacity-40">
                <FileText className="w-8 h-8 text-cardboard mx-auto stroke-1 mb-2" />
                <h4 className="font-display font-bold text-ink text-xs">No Medical History</h4>
                <p className="font-body text-[10px] text-ink opacity-70 max-w-[280px] mx-auto mt-1">
                  This companion pet has no recorded history entries in our platform ledger yet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative pl-6 border-l border-cardboard border-dashed space-y-6 ml-2 pt-1 pb-1">
                  {petHealthHistory.records.map((record) => {
                    const dateStr = new Date(record.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const recordType = record.record_type?.toUpperCase();

                    return (
                      <div key={record.id} className="relative text-xs">
                        {/* Timeline Bullet tag */}
                        <span className="absolute -left-[32px] top-1 w-4 h-4 rounded-full bg-herb text-paperLight flex items-center justify-center border border-herb">
                          <Stethoscope className="w-2.5 h-2.5" />
                        </span>

                        <div className="space-y-2 bg-paper bg-opacity-50 p-4 border border-cardboard border-dashed rounded-sm">
                          <div className="flex justify-between items-baseline">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-paprika font-bold">
                              {recordType}
                            </span>
                            <span className="font-mono text-[9px] text-cardboard font-bold">{dateStr}</span>
                          </div>

                          <h4 className="font-display font-bold text-sm text-ink">{record.title}</h4>
                          <hr className="border-t border-cardboard border-dashed" />

                          <div className="space-y-1.5 font-body text-sm text-ink opacity-90">
                            {record.symptoms && (
                              <div><strong>Symptoms:</strong> {record.symptoms}</div>
                            )}
                            {record.diagnosis && (
                              <div><strong>Diagnosis:</strong> {record.diagnosis}</div>
                            )}
                            {record.treatment && (
                              <div><strong>Treatment Plan:</strong> {record.treatment}</div>
                            )}
                            {record.medications && (
                              <div className="bg-paper p-2 rounded-sm font-mono text-[9px] border border-cardboard border-opacity-70">
                                💊 <strong>Prescription:</strong> {record.medications}
                              </div>
                            )}
                            {record.notes && (
                              <div className="italic text-ink opacity-70">Notes: "{record.notes}"</div>
                            )}
                            {record.follow_up_date && (
                              <div className="flex items-center text-[10px] text-paprika font-bold font-mono pt-1">
                                <Calendar className="w-3.5 h-3.5 mr-1" />
                                <span>Follow-up Scheduled: {new Date(record.follow_up_date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setInspectingPetId(null)}
                  className="w-full bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[9px] uppercase font-bold py-3 tracking-wider rounded-sm transition-colors text-center"
                >
                  Return to Assigned Queue
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
