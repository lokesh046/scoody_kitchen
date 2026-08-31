import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import { fetchConsultationById } from '../../api/consultations';
import { formatNaiveDateTime, getNaiveDate } from '../../utils/date';
import { fetchPetHealthRecords } from '../../api/pets';
import { submitDoctorReview } from '../../api/reviews';
import { updateConsultationStatus, getDoctorConsultationById, getPetHealthRecords } from '../../api/doctor';
import { createHealthRecord } from '../../api/pets';
import { Eyebrow } from '../../components/Eyebrow';
import { 
  Loader2, ShieldAlert, Clock, CheckCircle, 
  ArrowLeft, FileText, Star, Video
} from 'lucide-react';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export const VideoCallPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const consultationId = parseInt(id || '0');
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Layout & UI Tabs
  const [activeTab, setActiveTab] = useState<'patient' | 'notes'>('patient');
  
  // Custom timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  // Waiting room countdown
  const [timeUntilStart, setTimeUntilStart] = useState<number | null>(null);

  // Script load & Jitsi API reference
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const [jitsiApi, setJitsiApi] = useState<any>(null);

  // Review popup for customer
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Doctor notes form states
  const [clinicalFindings, setClinicalFindings] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [medications, setMedications] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';

  // 1. Fetch Consultation Details (Updates dynamically on WebSocket notifications)
  const { data: consultation, isLoading: isLoadingConsult } = useQuery({
    queryKey: ['videoConsultation', consultationId, user?.id],
    queryFn: () => 
      isDoctor 
        ? getDoctorConsultationById(consultationId) 
        : fetchConsultationById(consultationId),
    enabled: consultationId > 0 && !!user,
  });

  const apiRef = useRef<any>(null);

  const isJaaS = !!consultation?.jitsi_token && !!consultation?.jitsi_app_id && consultation?.jitsi_domain === '8x8.vc';
  const fallbackDomain = consultation?.jitsi_domain || 'scoobykitchen.duckdns.org';
  const rawRoomName = consultation
    ? (consultation.meeting_room_id ? (consultation.meeting_room_id.startsWith('scooby-') ? consultation.meeting_room_id : `scooby-${consultation.meeting_room_id}`) : `scooby-consultation-${consultation.id}`)
    : '';
  const roomName = isJaaS ? `${consultation?.jitsi_app_id}/${rawRoomName}` : rawRoomName;
  const domain = isJaaS ? '8x8.vc' : fallbackDomain;
  const userName = isDoctor 
    ? `Dr. ${user?.first_name || ''} ${user?.last_name || ''}`.trim() 
    : `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  
  const directRoomUrl = consultation 
    ? `https://${domain}/${roomName}${consultation.jitsi_token ? `?jwt=${consultation.jitsi_token}` : ''}#config.prejoinPageEnabled=false&config.disableDeepLinking=true${!isJaaS ? `&config.focusUserJid=focus%40auth.${domain}` : ''}&userInfo.displayName=${encodeURIComponent(userName)}` 
    : '';

  const hasAccess = Boolean(
    consultation && (
      isAdmin ||
      Number(user?.id) === Number(consultation.customer_id) || 
      (isDoctor && (
        !consultation.doctor ||
        consultation.doctor?.user?.email === user?.email || 
        Number(consultation.doctor?.user?.id ?? consultation.doctor?.user_id) === Number(user?.id) ||
        Number(consultation.doctor_id) === Number((user as any)?.doctor_id)
      ))
    )
  );

  // Fetch Pet Health History
  const { data: petHistory } = useQuery({
    queryKey: ['videoPetHistory', consultation?.pet_id],
    queryFn: async (): Promise<any> => 
      isDoctor 
        ? getPetHealthRecords(consultation!.pet_id) 
        : fetchPetHealthRecords(consultation!.pet_id),
    enabled: !!consultation?.pet_id && hasAccess,
  });

  // Load Jitsi Meet External Script
  useEffect(() => {
    if (!consultation) return;
    if (typeof (window as any).JitsiMeetExternalAPI === 'function') {
      setIsScriptLoaded(true);
      return;
    }

    const isJaaS = !!consultation.jitsi_token && !!consultation.jitsi_app_id && consultation.jitsi_domain === '8x8.vc';
    const activeDomain = consultation.jitsi_domain || 'scoobykitchen.duckdns.org';
    const scriptSrc = isJaaS ? 'https://8x8.vc/external_api.js' : `https://${activeDomain}/external_api.js`;
    
    const scriptId = 'jitsi-meet-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = scriptSrc;
      script.async = true;
      script.onload = () => setIsScriptLoaded(true);
      script.onerror = () => {
        console.error('Failed to load Jitsi external_api.js from', scriptSrc);
      };
      document.body.appendChild(script);
    } else {
      if (typeof (window as any).JitsiMeetExternalAPI === 'function') {
        setIsScriptLoaded(true);
      } else {
        script.addEventListener('load', () => setIsScriptLoaded(true));
      }
    }
  }, [consultation?.jitsi_domain, consultation?.jitsi_token]);

  // Waiting room countdown effect
  useEffect(() => {
    if (!consultation || consultation.status.toUpperCase() !== 'CONFIRMED') return;

    const timer = setInterval(() => {
      const now = Date.now();
      const scheduledTime = getNaiveDate(consultation.scheduled_at).getTime();
      const diffSeconds = Math.floor((scheduledTime - now) / 1000);

      if (diffSeconds > 600) { // More than 10 mins early
        setTimeUntilStart(diffSeconds);
      } else {
        setTimeUntilStart(null);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [consultation]);

  // Session Duration Timer countdown
  useEffect(() => {
    if (!consultation) return;
    const statusUpper = consultation.status.toUpperCase();
    if (statusUpper !== 'CONFIRMED' && statusUpper !== 'IN_PROGRESS') return;

    const timer = setInterval(() => {
      const now = Date.now();
      const startTime = getNaiveDate(consultation.scheduled_at).getTime();
      const durationMs = consultation.duration_minutes * 60 * 1000;
      const endTime = startTime + durationMs;
      const remainingSeconds = Math.floor((endTime - now) / 1000);

      if (remainingSeconds <= 0) {
        setTimeLeft(0);
        clearInterval(timer);
        handleSessionTimeExpired();
      } else {
        setTimeLeft(remainingSeconds);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [consultation]);

  // Auto-detect Completion (For Customer)
  useEffect(() => {
    if (consultation && !isDoctor && consultation.status.toUpperCase() === 'COMPLETED' && !showReviewModal) {
      if (jitsiApi || apiRef.current) {
        (jitsiApi || apiRef.current).executeCommand('hangup');
      }
      setShowReviewModal(true);
    }
  }, [consultation, isDoctor, jitsiApi, showReviewModal]);

  // Initialize Jitsi Conference Frame
  useEffect(() => {
    if (!isScriptLoaded || !consultation || !hasAccess || isInitializedRef.current) return;
    const statusUpper = consultation.status.toUpperCase();
    if (statusUpper !== 'CONFIRMED' && statusUpper !== 'IN_PROGRESS' && statusUpper !== 'PENDING' && statusUpper !== 'APPROVED') return;

    isInitializedRef.current = true;

    // Detect JaaS JWT configuration
    const isJaaS = !!consultation.jitsi_token && !!consultation.jitsi_app_id && consultation.jitsi_domain === '8x8.vc';
    const domain = isJaaS ? '8x8.vc' : (consultation.jitsi_domain || 'scoobykitchen.duckdns.org');
    const rawRoomName = consultation.meeting_room_id
      ? (consultation.meeting_room_id.startsWith('scooby-') ? consultation.meeting_room_id : `scooby-${consultation.meeting_room_id}`)
      : `scooby-consultation-${consultation.id}`;
    const roomName = isJaaS ? `${consultation.jitsi_app_id}/${rawRoomName}` : rawRoomName;

    const configOverwrite: any = {
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      prejoinPageEnabled: false,
      disableDeepLinking: true,
      enableClosePage: false,
      enableWelcomePage: false,
      logoClickUrl: window.location.origin + '/consultations',
      logoImageUrl: '',
      toolbarButtons: [
        'microphone', 'camera', 'closedcaptions', 'desktop', 'embedmeeting', 'fullscreen',
        'fodeviceselection', 'hangup', 'profile', 'chat', 'settings', 'videoquality',
        'tileview', 'select-background', 'participants-pane'
      ]
    };

    if (!isJaaS) {
      configOverwrite.focusUserJid = `focus@auth.${domain}`;
      configOverwrite.hosts = {
        domain: domain,
        muc: `conference.${domain}`,
        focus: `focus.${domain}`,
        authdomain: `auth.${domain}`
      };
    }

    // Create container and config options
    const options: any = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: isDoctor 
          ? `Dr. ${user?.first_name || ''} ${user?.last_name || ''}`.trim() 
          : `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        email: user?.email
      },
      configOverwrite,
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#121c17',
        DEFAULT_LOCAL_DISPLAY_NAME: 'Me'
      }
    };

    if (consultation.jitsi_token) {
      options.jwt = consultation.jitsi_token;
    }

    if (jitsiContainerRef.current) {
      jitsiContainerRef.current.innerHTML = '';
    }

    try {
      if (typeof (window as any).JitsiMeetExternalAPI !== 'function') {
        console.warn('JitsiMeetExternalAPI not ready yet, waiting for script...');
        isInitializedRef.current = false;
        return;
      }

      const api = new (window as any).JitsiMeetExternalAPI(domain, options);
      apiRef.current = api;
      setJitsiApi(api);

      // If doctor starts the call, update status to IN_PROGRESS in DB
      if (isDoctor && (consultation.status.toUpperCase() === 'CONFIRMED' || consultation.status.toUpperCase() === 'APPROVED')) {
        updateConsultationStatus(consultation.id, 'in_progress').catch(err => {
          console.warn('Failed to update session status to IN_PROGRESS:', err);
        });
      }

      // Telemetry Events
      api.addEventListener('videoConferenceJoined', () => {
        console.log('Successfully connected to WebRTC room');
      });

      const handleCallEnded = () => {
        if (isDoctor) {
          navigate('/doctor');
        } else {
          // Trigger customer rating popup
          setShowReviewModal(true);
        }
      };

      api.addEventListener('videoConferenceLeft', handleCallEnded);
      api.addEventListener('readyToClose', handleCallEnded);
    } catch (err) {
      console.error('Failed to construct JitsiMeetExternalAPI:', err);
      isInitializedRef.current = false;
    }
  }, [isScriptLoaded, consultation?.id, hasAccess]);

  // Clean up Jitsi API on component unmount
  useEffect(() => {
    return () => {
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing jitsi api:', e);
        }
        apiRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  // Session Time Expiration handler
  const handleSessionTimeExpired = async () => {
    alert('The consultation session slot duration has ended. The call will now close.');
    if (isDoctor && consultation) {
      try {
        await updateConsultationStatus(consultation.id, 'completed');
      } catch (err) {
        console.warn('Failed to auto-complete session on timeout:', err);
      }
    }
    if (jitsiApi) {
      jitsiApi.executeCommand('hangup');
    } else {
      navigate(isDoctor ? '/doctor' : '/consultations');
    }
  };

  // Submit doctor's notes and finish consultation
  const handleDoctorNotesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultation || !isDoctor) return;

    setIsSavingNotes(true);
    try {
      // 1. Create a detailed health record for the pet
      await createHealthRecord(consultation.pet_id, {
        pet_id: consultation.pet_id,
        consultation_id: consultation.id,
        record_type: 'diagnosis',
        title: `Video Consultation Log #${consultation.id}`,
        symptoms: consultation.reason,
        clinical_findings: clinicalFindings || null,
        diagnosis: diagnosis || null,
        treatment: treatment || null,
        medications: medications || null,
        follow_up_date: followUpDate || null,
        notes: `Vet review completed by Dr. ${user?.last_name}`
      });

      // 2. Transition consultation state to COMPLETED
      await updateConsultationStatus(consultation.id, 'completed');
      
      alert('Ledger session saved and marked as COMPLETED.');
      
      if (jitsiApi) {
        jitsiApi.executeCommand('hangup');
      } else {
        navigate('/doctor');
      }
    } catch (err: any) {
      alert(`Failed to save clinical notes: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Submit customer review
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    try {
      await submitDoctorReview(consultationId, {
        rating: reviewRating,
        comment: reviewComment || null
      });
      alert('Thank you for rating your specialist!');
      setShowReviewModal(false);
      navigate('/consultations');
    } catch (err: any) {
      alert(`Failed to submit review: ${err.response?.data?.detail || err.message}`);
      setShowReviewModal(false);
      navigate('/consultations');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // --- RENDERING FRIENDLY ERROR & STATUS GATES ---

  if (isLoadingConsult) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-body">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
          <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold">
            Verifying Room Security...
          </p>
        </div>
      </div>
    );
  }

  // 1. Access Denied (Not doctor or customer)
  if (!consultation || !hasAccess) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6 font-body">
        <div className="bg-paperLight border border-cardboard rounded-sm p-8 max-w-md w-full shadow-md space-y-5 text-center">
          <ShieldAlert className="w-12 h-12 text-paprika mx-auto stroke-1.5" />
          <div className="space-y-1">
            <h3 className="font-display font-bold text-lg text-ink">Verification Failed</h3>
            <p className="text-xs text-ink opacity-70">
              The credentials supplied do not match the assigned participants of this session.
            </p>
          </div>
          <button
            onClick={() => navigate(isDoctor ? '/doctor' : '/consultations')}
            className="w-full bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[10px] uppercase font-bold py-3 tracking-wider rounded-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 2. Waiting Room (Call starts in the future, more than 10 mins early)
  if (timeUntilStart && timeUntilStart > 600) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6 font-body">
        <div className="bg-paperLight border border-cardboard rounded-sm p-8 max-w-md w-full shadow-md space-y-6 text-center">
          <Clock className="w-12 h-12 text-turmeric mx-auto stroke-1.5 animate-pulse" />
          <div className="space-y-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-paprika font-bold block">Session Waiting Room</span>
            <h3 className="font-display font-bold text-xl text-ink">Doctor Consultation Waiting Room</h3>
            <p className="text-xs text-ink opacity-70">
              This session is scheduled for <span className="font-bold text-ink">{formatNaiveDateTime(consultation.scheduled_at).full}</span>. 
              The video consultation room opens 10 minutes prior to the start time.
            </p>
          </div>
          <div className="bg-paper py-4 rounded-sm border border-cardboard border-dashed">
            <span className="font-mono text-[10px] uppercase text-cardboard font-bold block mb-1">Time Remaining until Open</span>
            <span className="font-mono text-2xl font-black text-ink">{formatTimer(timeUntilStart)}</span>
          </div>
          <button
            onClick={() => navigate('/consultations')}
            className="w-full border border-cardboard hover:bg-paper text-ink font-mono text-[10px] uppercase font-bold py-3 tracking-wider rounded-sm transition-colors"
          >
            Back to Sessions Ledger
          </button>
        </div>
      </div>
    );
  }

  // 3. Status Gate: CANCELLED
  if (consultation.status.toUpperCase() === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6 font-body">
        <div className="bg-paperLight border border-cardboard rounded-sm p-8 max-w-md w-full shadow-md space-y-5 text-center">
          <ShieldAlert className="w-12 h-12 text-paprika mx-auto stroke-1.5" />
          <div className="space-y-1.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-paprika font-bold block">Status: Cancelled</span>
            <h3 className="font-display font-bold text-lg text-ink">Appointment Cancelled</h3>
            <p className="text-xs text-ink opacity-70">
              This clinical video session has been cancelled and the meeting link has been deactivated.
            </p>
          </div>
          <button
            onClick={() => navigate(isDoctor ? '/doctor' : '/consultations')}
            className="w-full bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[10px] uppercase font-bold py-3 tracking-wider rounded-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 4. Status Gate: COMPLETED (For Doctor)
  if (consultation.status.toUpperCase() === 'COMPLETED' && isDoctor) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6 font-body">
        <div className="bg-paperLight border border-cardboard rounded-sm p-8 max-w-md w-full shadow-md space-y-5 text-center">
          <CheckCircle className="w-12 h-12 text-herb mx-auto stroke-1.5" />
          <div className="space-y-1.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-herb font-bold block">Status: Completed</span>
            <h3 className="font-display font-bold text-lg text-ink">Consultation Completed</h3>
            <p className="text-xs text-ink opacity-70">
              This video session has been completed and marked finalized in the database ledger.
            </p>
          </div>
          <button
            onClick={() => navigate('/doctor')}
            className="w-full bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[10px] uppercase font-bold py-3 tracking-wider rounded-sm"
          >
            Return to Doctor Panel
          </button>
        </div>
      </div>
    );
  }

  // --- CORE CALL LAYOUT ---

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full h-screen overflow-hidden">
      
      {/* Top Header bar with Connection Telemetry & Clock */}
      <header className="bg-paperLight border-b border-cardboard px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3 text-left">
          <button
            onClick={() => navigate(isDoctor ? '/doctor' : '/consultations')}
            className="text-ink opacity-70 hover:opacity-100 p-1 rounded-sm transition-opacity"
            title="Leave Call Workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-herb font-bold">Telehealth Video Room</span>
            </div>
            <h1 className="font-display font-bold text-sm text-ink mt-0.5">
              {isDoctor 
                ? `Patient: ${consultation.pet?.name || 'Pet'} (${consultation.pet?.species})` 
                : `Specialist: ${consultation.doctor?.user?.first_name ? `Dr. ${consultation.doctor.user.first_name} ${consultation.doctor.user.last_name || ''}`.trim() : 'Veterinarian'}`}
            </h1>
          </div>
        </div>

        {/* Live Timer Countdown */}
        {timeLeft !== null && (
          <div className="flex items-center space-x-2 bg-paper border border-cardboard border-dashed px-3.5 py-1.5 rounded-sm font-mono text-xs text-ink">
            <Clock className="w-3.5 h-3.5 text-turmeric" />
            <span className="font-bold">SESSION TIME LEFT:</span>
            <span className={`font-black ${timeLeft < 180 ? 'text-paprika animate-pulse' : 'text-herb'}`}>
              {formatTimer(timeLeft)}
            </span>
          </div>
        )}
      </header>

      {/* Main Workspace Frame (WebRTC Grid + Control Bar + Sidebar) */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Side: WebRTC Jitsi Window */}
        <div className="flex-grow bg-[#121c17] relative flex flex-col items-center justify-center p-2">
          {!jitsiApi && (
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-4 bg-[#121c17] z-10 p-6 text-center">
              <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
              <p className="font-mono text-xs uppercase tracking-wider text-paperLight opacity-80">
                Connecting to video room ({domain})...
              </p>
              
              {directRoomUrl && (
                <div className="mt-3 p-4 bg-paper bg-opacity-10 rounded-sm border border-cardboard border-opacity-30 max-w-sm space-y-3">
                  <p className="text-xs font-body text-paperLight opacity-90 leading-relaxed">
                    On mobile phones, Chrome blocks cross-domain embedded iframes. Tap below to launch your call directly:
                  </p>
                  <a
                    href={directRoomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white font-body font-bold text-xs uppercase py-3 px-5 rounded-sm tracking-wide transition-colors shadow-lg w-full"
                  >
                    <Video className="w-4 h-4" />
                    <span>Launch Consultation Call Room 🎥</span>
                  </a>
                </div>
              )}
            </div>
          )}
          <div 
            ref={jitsiContainerRef} 
            className="w-full h-full rounded-sm overflow-hidden" 
            style={{ minHeight: '300px' }}
          />
        </div>

        {/* Right Side: Tabbed Information Panel Drawer */}
        <aside className="w-full md:w-96 border-t md:border-t-0 md:border-l border-cardboard bg-paperLight flex flex-col shrink-0 overflow-hidden text-left">
          
          {/* Tabs header */}
          <div className="flex border-b border-cardboard font-mono text-[9px] uppercase tracking-wider font-bold">
            <button
              onClick={() => setActiveTab('patient')}
              className={`flex-1 py-3 text-center transition-colors border-r border-cardboard cursor-pointer ${
                activeTab === 'patient' ? 'bg-paper text-paprika font-bold' : 'text-ink opacity-70 hover:bg-paper'
              }`}
            >
              🐾 Patient companion
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
                activeTab === 'notes' ? 'bg-paper text-paprika font-bold' : 'text-ink opacity-70 hover:bg-paper'
              }`}
            >
              📋 {isDoctor ? 'Add Diagnosis & Prescribe' : 'Clinical Ledger Summary'}
            </button>
          </div>

          {/* Panel Content Scrollable Area */}
          <div className="flex-grow overflow-y-auto p-5 space-y-5">
            
            {/* TAB 1: Patient Companion Details */}
            {activeTab === 'patient' && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <span className="font-mono text-[8px] uppercase text-cardboard font-bold block">Patient File Card</span>
                  <h4 className="font-display font-bold text-base text-ink">🐾 {consultation.pet?.name || 'Pet'}</h4>
                </div>

                <div className="border border-cardboard rounded-sm bg-paper bg-opacity-40 p-4 font-mono text-[10px] space-y-2 text-ink">
                  <div>
                    <span className="text-paprika font-bold uppercase block text-[8px]">SPECIES & BREED</span>
                    <span>{consultation.pet?.species} — {consultation.pet?.breed || 'Mixed'}</span>
                  </div>
                  <hr className="border-t border-dashed border-cardboard" />
                  <div>
                    <span className="text-paprika font-bold uppercase block text-[8px]">INQUIRY CONSULT REASON</span>
                    <span className="font-body text-xs font-normal text-opacity-80 block mt-1">"{consultation.reason}"</span>
                  </div>
                </div>

                {/* Patient Medical History Logs */}
                <div className="space-y-2">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Pet Health History</span>
                  {!petHistory || !petHistory.records || petHistory.records.length === 0 ? (
                    <p className="font-body text-[10px] text-ink opacity-60 italic">No past medical logs registered in this ledger.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {petHistory.records.map((record: any) => (
                        <div key={record.id} className="border border-cardboard border-dashed p-3 bg-paper rounded-xs text-[10px] font-mono">
                          <div className="flex justify-between items-center text-paprika font-bold text-[8px]">
                            <span>{record.record_type.toUpperCase()}</span>
                            <span>{new Date(record.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="font-bold font-body text-xs text-ink mt-0.5">{record.title}</div>
                          {record.diagnosis && <div className="mt-1"><strong>Diagnosis:</strong> {record.diagnosis}</div>}
                          {record.medications && <div className="mt-0.5"><strong>Rx:</strong> {record.medications}</div>}
                          {record.notes && <div className="mt-1 text-ink opacity-70 italic font-body text-[10px]">"{record.notes}"</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Clinical Notes & Prescriptions */}
            {activeTab === 'notes' && (
              <div className="space-y-4 animate-fade-in">
                {isDoctor ? (
                  // DOCTOR VIEW: Form to update and complete call
                  <form onSubmit={handleDoctorNotesSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <span className="font-mono text-[8px] uppercase text-cardboard font-bold block">Consultation Ledger</span>
                      <h4 className="font-display font-bold text-base text-ink">Update Medical Record</h4>
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Clinical Findings:</label>
                      <textarea
                        value={clinicalFindings}
                        onChange={(e) => setClinicalFindings(e.target.value)}
                        placeholder="Detail behavior, physical vitals, and symptoms observed..."
                        className="w-full min-h-[60px] p-2 border border-cardboard rounded-xs bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Diagnosis:</label>
                      <input
                        type="text"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="e.g. Mild dietary gastroenteritis"
                        className="w-full p-2 border border-cardboard rounded-xs bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Treatment Plan:</label>
                      <textarea
                        value={treatment}
                        onChange={(e) => setTreatment(e.target.value)}
                        placeholder="Hydration, dietary changes, recovery rest plan..."
                        className="w-full min-h-[60px] p-2 border border-cardboard rounded-xs bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Medication Prescription (Rx):</label>
                      <input
                        type="text"
                        value={medications}
                        onChange={(e) => setMedications(e.target.value)}
                        placeholder="e.g., Probiotics 1 cap daily for 5 days"
                        className="w-full p-2 border border-cardboard rounded-xs bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-mono text-[9px] uppercase font-bold text-paprika block">Follow-up Date:</label>
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full p-2 border border-cardboard rounded-xs bg-paper font-mono text-xs text-ink focus:outline-none focus:border-turmeric transition-colors cursor-pointer"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingNotes}
                      className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs uppercase py-3 rounded-sm tracking-wide text-center cursor-pointer transition-colors shadow-sm disabled:opacity-50 hover-bounce mt-2"
                    >
                      {isSavingNotes ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Complete Session & Close'}
                    </button>
                  </form>
                ) : (
                  // CUSTOMER VIEW: Summary info
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="font-mono text-[8px] uppercase text-cardboard font-bold block">Consultation Ledger</span>
                      <h4 className="font-display font-bold text-base text-ink">Diagnosis Summary</h4>
                    </div>
                    
                    <p className="text-xs text-ink opacity-80 font-body">
                      The veterinarian doctor will update the clinical findings, prescription ledger, and treatment logs here in real-time during your call.
                    </p>
                    
                    <div className="border border-cardboard border-dashed p-4 rounded-sm bg-paper bg-opacity-50 flex items-center justify-center py-8">
                      <div className="text-center space-y-2">
                        <FileText className="w-8 h-8 text-cardboard mx-auto stroke-1" />
                        <span className="font-mono text-[9px] uppercase text-cardboard font-bold block animate-pulse">
                          Waiting for doctor diagnosis entry...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* CUSTOMER POST-SESSION REVIEW GATING OVERLAY */}
      {showReviewModal && !isDoctor && (
        <div className="fixed inset-0 bg-ink bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm p-8 max-w-md w-full shadow-2xl space-y-5 animate-fade-in-up text-center relative text-left">
            <div className="space-y-1">
              <Eyebrow label="VETERINARIAN REVIEW FEEDBACK" />
              <h3 className="font-display font-bold text-xl text-ink">Consultation Concluded!</h3>
              <p className="text-xs text-ink opacity-70">
                Dr. {consultation.doctor?.user?.last_name || 'Specialist'} has concluded the video review session. 
                We hope your pet companion is doing well. Please take a second to rate your experience:
              </p>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              {/* Star Rating select */}
              <div className="flex justify-center space-x-2.5 py-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = star <= reviewRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star 
                        className={`w-8 h-8 ${isActive ? 'text-turmeric fill-turmeric' : 'text-cardboard opacity-40'}`} 
                      />
                    </button>
                  );
                })}
              </div>

              {/* Text review comment */}
              <div className="space-y-1.5 text-left">
                <label className="font-mono text-[9px] uppercase font-bold text-paprika tracking-wide">Review Remarks:</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Optional notes about the doctor's service, advice, or care..."
                  className="w-full min-h-[80px] p-3 border border-cardboard rounded-xs bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-body font-bold text-xs uppercase py-3.5 tracking-wider rounded-sm text-center shadow-sm disabled:opacity-50 hover-bounce"
              >
                {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Feedback & Close'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
