import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import { Header } from '../../components/Header';
import { 
  uploadDoctorDocument, 
  submitDoctorApplication, 
  fetchMyApplicationStatus 
} from '../../api/doctor_applications';
import { 
  Lock, CheckCircle2, Loader2, 
  AlertCircle, ArrowLeft, ArrowRight, Clock, Sparkles, Stethoscope, Trash2,
  User as UserIcon, FileText, Landmark, ShieldCheck 
} from 'lucide-react';
import { CollegeAutocomplete } from '../../components/CollegeAutocomplete';

const veterinaryDegrees = [
  "B.V.Sc & A.H",
  "M.V.Sc",
  "Ph.D (Veterinary Science)",
  "Diploma in Veterinary Science"
];

const vetSpecializations = [
  "Veterinary Medicine",
  "Veterinary Surgery & Radiology",
  "Veterinary Gynaecology & Obstetrics",
  "Veterinary Pathology",
  "Veterinary Microbiology",
  "Veterinary Parasitology",
  "Veterinary Pharmacology & Toxicology",
  "Veterinary Physiology",
  "Veterinary Anatomy",
  "Veterinary Biochemistry",
  "Animal Nutrition",
  "Animal Genetics & Breeding",
  "Livestock Production & Management",
  "Poultry Science",
  "Veterinary Public Health & Epidemiology",
  "Veterinary Extension Education",
  "Dairy Science"
];

export default function ApplyDoctorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Wizard state flow
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  // Form states
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('General Veterinarian');
  const [experienceYears, setExperienceYears] = useState<number | ''>('');
  const [consultationFee, setConsultationFee] = useState<number | ''>('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [bio, setBio] = useState('');
  const [nationality, setNationality] = useState('');

  interface EducationEntry {
    college_name: string;
    degree: string;
    major: string;
    start_year: number;
    end_year: number;
  }

  const [educationHistory, setEducationHistory] = useState<EducationEntry[]>([
    { college_name: '', degree: 'B.V.Sc & A.H', major: 'General Veterinary Practice', start_year: new Date().getFullYear() - 5, end_year: new Date().getFullYear() }
  ]);

  const handleEducationChange = (index: number, field: keyof EducationEntry, val: string | number) => {
    const updated = [...educationHistory];
    
    // When changing degree, auto-adjust major to prevent validation failures
    if (field === 'degree') {
      const isUGOrDip = ['B.V.Sc & A.H', 'Diploma in Veterinary Science'].includes(val as string);
      updated[index] = {
        ...updated[index],
        degree: val as string,
        major: isUGOrDip ? 'General Veterinary Practice' : 'Veterinary Medicine'
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: val
      } as any;
    }
    
    setEducationHistory(updated);
  };

  const addEducationEntry = () => {
    if (educationHistory.length < 3) {
      setEducationHistory([
        ...educationHistory,
        { college_name: '', degree: 'M.V.Sc', major: 'Veterinary Medicine', start_year: new Date().getFullYear() - 5, end_year: new Date().getFullYear() }
      ]);
    }
  };

  const removeEducationEntry = (index: number) => {
    if (educationHistory.length > 1) {
      setEducationHistory(educationHistory.filter((_, i) => i !== index));
    }
  };
  
  // Clinic states
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [clinicState, setClinicState] = useState('');

  // Upload URLs
  const [aadhaarUrl, setAadhaarUrl] = useState<string | null>(null);
  const [panUrl, setPanUrl] = useState<string | null>(null);
  const [certUrl, setCertUrl] = useState<string | null>(null);

  // Loading indicator for files
  const [uploadingAadhaar, setUploadingAadhaar] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  // Errors & success
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query status
  const { data: application, isLoading: isStatusLoading } = useQuery({
    queryKey: ['doctorApplicationStatus'],
    queryFn: fetchMyApplicationStatus,
    enabled: !!user,
  });

  // Pre-fill if rejected
  useEffect(() => {
    if (application && application.status === 'REJECTED') {
      setPhone(application.phone);
      setSpecialization(application.specialization);
      setExperienceYears(application.experience_years);
      setConsultationFee(parseFloat(application.consultation_fee));
      setLicenseNumber(application.license_number);
      setBio(application.bio || '');
      if (application.education_history) {
        try {
          const parsed = JSON.parse(application.education_history);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized = parsed.map(edu => {
              const degreeVal = edu.degree || 'B.V.Sc & A.H';
              const isUGOrDip = ['B.V.Sc & A.H', 'Diploma in Veterinary Science'].includes(degreeVal);
              return {
                college_name: edu.college_name || '',
                degree: degreeVal,
                major: edu.major || (isUGOrDip ? 'General Veterinary Practice' : 'Veterinary Medicine'),
                start_year: edu.start_year || new Date().getFullYear() - 5,
                end_year: edu.end_year || new Date().getFullYear()
              };
            });
            setEducationHistory(sanitized);
          }
        } catch (e) {
          console.error("Failed to parse education history:", e);
        }
      } else if (application.qualification) {
        setEducationHistory([
          {
            college_name: "Default College",
            degree: application.qualification,
            major: ['B.V.Sc & A.H', 'Diploma in Veterinary Science'].includes(application.qualification) ? 'General Veterinary Practice' : 'Veterinary Medicine',
            start_year: application.degree_start_year,
            end_year: application.degree_end_year
          }
        ]);
      }
      setNationality(application.nationality);
      setClinicName(application.clinic_name);
      setClinicAddress(application.clinic_address);
      setClinicCity(application.clinic_city);
      setClinicState(application.clinic_state);
      setAadhaarUrl(application.aadhaar_card_url);
      setPanUrl(application.pan_card_url);
      setCertUrl(application.medical_certificate_url);
    }
  }, [application]);

  // File upload handler
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: 'aadhaar' | 'pan' | 'cert'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit.");
      return;
    }

    if (docType === 'aadhaar') setUploadingAadhaar(true);
    if (docType === 'pan') setUploadingPan(true);
    if (docType === 'cert') setUploadingCert(true);

    try {
      const url = await uploadDoctorDocument(file);
      if (docType === 'aadhaar') setAadhaarUrl(url);
      if (docType === 'pan') setPanUrl(url);
      if (docType === 'cert') setCertUrl(url);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to upload document file.");
    } finally {
      if (docType === 'aadhaar') setUploadingAadhaar(false);
      if (docType === 'pan') setUploadingPan(false);
      if (docType === 'cert') setUploadingCert(false);
    }
  };

  // Step Nav validation
  const validateStep1 = () => {
    if (!phone.trim()) {
      setErrorMsg('Phone number is required.');
      return false;
    }
    if (!nationality.trim()) {
      setErrorMsg('Nationality is required.');
      return false;
    }
    if (!licenseNumber.trim()) {
      setErrorMsg('Medical License Number is required.');
      return false;
    }
    if (experienceYears === '' || experienceYears < 0) {
      setErrorMsg('Years of Experience is required and cannot be negative.');
      return false;
    }
    if (consultationFee === '' || consultationFee < 0) {
      setErrorMsg('Consultation Fee is required and cannot be negative.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep2 = () => {
    const isEduValid = educationHistory.every(edu => 
      edu.college_name.trim() && 
      edu.degree.trim() && 
      (!['M.V.Sc', 'Ph.D (Veterinary Science)'].includes(edu.degree) || edu.major.trim()) && 
      edu.start_year && 
      edu.end_year
    );
    if (!isEduValid) {
      setErrorMsg('All college names, degree choices, and specializations must be filled.');
      return false;
    }
    const isYearsValid = educationHistory.every(edu => edu.end_year >= edu.start_year + 3);
    if (!isYearsValid) {
      setErrorMsg('For each education entry, the end year must be at least 3 years after the start year.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const validateStep3 = () => {
    if (!clinicName.trim() || !clinicAddress.trim() || !clinicCity.trim() || !clinicState.trim()) {
      setErrorMsg('All clinic location parameters are required.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user) return;
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;
    if (!aadhaarUrl || !panUrl || !certUrl) {
      return setErrorMsg('Please upload all three verification documents (Aadhaar, PAN, and Certificate).');
    }

    setIsSubmitting(true);
    try {
      const primaryQual = educationHistory[0]?.degree || '';
      
      await submitDoctorApplication({
        first_name: user.first_name || 'Specialist',
        last_name: user.last_name || '',
        email: user.email,
        phone,
        specialization,
        qualification: primaryQual,
        experience_years: experienceYears === '' ? 0 : experienceYears,
        consultation_fee: consultationFee === '' ? 0 : consultationFee,
        license_number: licenseNumber,
        bio,
        degree_start_year: educationHistory[0].start_year,
        degree_end_year: educationHistory[0].end_year,
        nationality,
        clinic_name: clinicName,
        clinic_address: clinicAddress,
        clinic_city: clinicCity,
        clinic_state: clinicState,
        aadhaar_card_url: aadhaarUrl,
        pan_card_url: panUrl,
        medical_certificate_url: certUrl,
        education_history: JSON.stringify(educationHistory),
      });
      setIsSubmittedSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Return Auth Gate
  if (!user) {
    return (
      <div className="min-h-screen bg-paper flex flex-col justify-between">
        <Header />
        <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-16 flex items-center justify-center">
          <div className="max-w-md w-full border border-cardboard bg-paperLight p-12 rounded-sm text-center shadow-xs">
            <Lock className="w-12 h-12 text-cardboard mx-auto mb-4 stroke-1" />
            <h4 className="font-display font-black text-lg text-ink mb-2">AUTHENTICATION REQUIRED</h4>
            <p className="font-body text-xs text-ink opacity-70 mb-6">
              Please log in or register a customer account first before applying to join our veterinarian network.
            </p>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="bg-paprika text-paper font-body font-bold text-xs uppercase px-5 py-2.5 rounded-sm tracking-wide hover:opacity-90 cursor-pointer shadow-xs"
            >
              Sign In / Register
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 2. Return Success Celebration Splash Screen
  if (isSubmittedSuccess) {
    const leafParticles = Array.from({ length: 25 });
    return (
      <div className="min-h-screen bg-paper flex flex-col justify-between overflow-hidden relative">
        <style>{`
          @keyframes leafFall {
            0% { transform: translateY(-50px) rotate(0deg) translateX(0); opacity: 1; }
            50% { transform: translateY(50vh) rotate(180deg) translateX(30px); opacity: 0.8; }
            100% { transform: translateY(100vh) rotate(360deg) translateX(-30px); opacity: 0; }
          }
          .animate-leaf-fall {
            animation: leafFall 6s linear infinite;
          }
          @keyframes scaleUp {
            0% { transform: scale(0.6); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-scale-up {
            animation: scaleUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          @keyframes popIn {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          .animate-pop-in {
            animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        {/* Falling organic leaves */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {leafParticles.map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 5;
            const size = Math.random() * 14 + 8;
            const colors = ['bg-turmeric', 'bg-herb', 'bg-cardboard', 'bg-paprika'];
            const colorClass = colors[Math.floor(Math.random() * colors.length)];
            const opacity = Math.random() * 0.4 + 0.3;
            return (
              <div
                key={i}
                className={`absolute animate-leaf-fall rounded-full ${colorClass}`}
                style={{
                  left: `${left}%`,
                  animationDelay: `${delay}s`,
                  width: `${size}px`,
                  height: `${size}px`,
                  opacity: opacity,
                  filter: 'blur(0.5px)',
                }}
              />
            );
          })}
        </div>

        <Header />
        <main className="flex-grow max-w-2xl w-full mx-auto px-4 py-16 flex items-center justify-center relative z-10">
          <div className="border border-cardboard bg-paperLight p-12 rounded-sm text-center space-y-6 relative overflow-hidden animate-pop-in">
            <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-40"></div>
            
            <div className="w-20 h-20 bg-herb bg-opacity-20 rounded-full flex items-center justify-center mx-auto animate-scale-up">
              <CheckCircle2 className="w-10 h-10 text-paprika" />
            </div>

            <div className="space-y-2">
              <h2 className="font-display font-black text-3xl uppercase tracking-tight text-ink pt-2">
                Application Submitted!
              </h2>
              <p className="font-body text-xs text-ink opacity-80 leading-relaxed max-w-md mx-auto">
                Thank you for applying to join the veterinarian network. Your professional credentials, medical license, and uploaded verification documents are now securely logged and queued for audit.
              </p>
            </div>

            <hr className="border-t border-cardboard border-opacity-35 border-dashed" />

            <div className="bg-paper p-5 border border-cardboard border-dashed rounded-sm font-mono text-[10px] text-ink opacity-85 space-y-1 text-left max-w-sm mx-auto">
              <div>📄 STATUS: <span className="text-paprika font-bold">PENDING REVIEW</span></div>
              <div>⚡ DEPLOYMENT: VET NETWORK VERIFIER</div>
              <div>📅 LOGGED ON: {new Date().toLocaleDateString()}</div>
              <div className="pt-2 text-xs text-ink opacity-70 leading-normal">
                Audits typically resolve in 1-3 business days. We will upgrade your profile credentials and notify you once validated.
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['doctorApplicationStatus'] });
                  setIsSubmittedSuccess(false);
                }}
                className="bg-paprika text-paper font-body font-bold text-xs uppercase px-8 py-3.5 rounded-sm tracking-wider hover:opacity-90 shadow-md cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const stepsList = [
    { id: 1, label: "Profile", icon: UserIcon },
    { id: 2, label: "Academic", icon: Sparkles },
    { id: 3, label: "Clinical", icon: Landmark },
    { id: 4, label: "Verify", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between caret-turmeric">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        /* Custom scrollbar matching Cream Canvas design system */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F9F6F0;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #EBE0D0;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D09E6B;
        }
      `}</style>
      <Header />
      <main className="flex-grow max-w-4xl w-full mx-auto px-4 md:px-8 py-8">
        
        {/* Back Link */}
        <div className="mb-6 text-left">
          <button
            onClick={() => navigate('/consultations')}
            className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1 border-0 bg-transparent cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Consultations</span>
          </button>
        </div>

        {isStatusLoading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
            <p className="font-mono text-[10px] uppercase tracking-wider text-herb font-bold animate-pulse">
              Auditing credentials history...
            </p>
          </div>
        ) : application && application.status === 'PENDING' ? (
          // PENDING VIEW
          <div className="border border-cardboard bg-paperLight p-12 rounded-sm shadow-md text-center max-w-lg mx-auto space-y-6 relative overflow-hidden">
            <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-40"></div>
            <Clock className="w-14 h-14 text-turmeric mx-auto stroke-1 animate-pulse" />
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-paprika font-bold px-2.5 py-1 bg-paper border border-cardboard rounded-sm">
                APPLICATION RECEIVED
              </span>
              <h2 className="font-display font-black text-2xl text-ink pt-2">Verification Under Review</h2>
            </div>
            <p className="font-body text-xs text-ink opacity-80 leading-relaxed max-w-sm mx-auto">
              Your professional credentials, license number, and uploaded proof documents are currently being audited by our admin board.
            </p>
            <div className="bg-paper p-4 border border-cardboard border-dashed rounded-sm font-mono text-[10px] text-ink opacity-70">
              ⏱️ Application Audit ID: #{application.id} <br />
              📅 Submitted On: {new Date(application.created_at).toLocaleDateString()}
            </div>
            <p className="font-body text-xs text-ink opacity-70 italic">
              Verification typically completes in 1 to 3 business days. You will be notified once upgraded.
            </p>
          </div>
        ) : application && application.status === 'APPROVED' ? (
          // APPROVED VIEW
          <div className="border border-cardboard bg-paperLight p-12 rounded-sm shadow-md text-center max-w-lg mx-auto space-y-6 relative overflow-hidden">
            <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-40"></div>
            <CheckCircle2 className="w-14 h-14 text-herb mx-auto stroke-1" />
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-turmeric font-bold px-2.5 py-1 bg-paper border border-cardboard rounded-sm">
                STATUS ACTIVE
              </span>
              <h2 className="font-display font-black text-2xl text-ink pt-2">Upgraded to Vet Doctor</h2>
            </div>
            <p className="font-body text-xs text-ink opacity-80 leading-relaxed max-w-sm mx-auto">
              Congratulations! Your application has been approved. Your role has been elevated, giving you full access to configure your schedule register.
            </p>
            <button
              onClick={() => navigate('/doctor/dashboard')}
              className="bg-paprika text-paper font-body font-bold text-xs uppercase px-5 py-3 rounded-sm tracking-wide hover:opacity-90 cursor-pointer shadow-xs inline-flex items-center space-x-2"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Go to Doctor Panel</span>
            </button>
          </div>
        ) : (
          // FORM WIZARD VIEW (New or Rejected)
          <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-sm space-y-8 relative overflow-hidden text-left animate-slide-in">
            <div className="absolute left-1.5 top-0 bottom-0 border-l border-dashed border-cardboard opacity-40"></div>

            <div className="space-y-1 pl-4">
              <h2 className="font-display font-black text-3xl uppercase tracking-tight text-turmeric">
                Onboarding Credentials Form
              </h2>
              <p className="font-body text-xs text-ink opacity-70">
                Register your credentials and clinic details to unlock doctor schedule tools.
              </p>
            </div>

            {/* Stepper progress timeline indicator */}
            <div className="mb-6 pl-4">
              <div className="relative flex items-center justify-between w-full max-w-md mx-auto">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-cardboard z-0"></div>
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[1px] bg-paprika transition-all duration-300 z-0"
                  style={{ width: `${((currentStep - 1) / (stepsList.length - 1)) * 100}%` }}
                ></div>

                {stepsList.map((step) => {
                  const isCompleted = step.id < currentStep;
                  const isActive = step.id === currentStep;

                  return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center">
                      <button
                        type="button"
                        disabled={step.id > currentStep && !isCompleted}
                        onClick={() => {
                          if (step.id < currentStep) {
                            setCurrentStep(step.id);
                            setErrorMsg('');
                          }
                        }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center border font-mono text-[10px] font-bold transition-all duration-300 ${
                          isCompleted 
                            ? 'bg-herb border-herb text-paper cursor-pointer' 
                            : isActive 
                            ? 'bg-paprika border-paprika text-paper scale-110' 
                            : 'bg-paperLight border-cardboard text-ink opacity-60 cursor-not-allowed'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.id}
                      </button>
                      <span className={`mt-1.5 font-mono text-[10px] uppercase tracking-wider ${
                        isActive ? 'text-paprika font-bold' : 'text-ink opacity-70'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <hr className="border-t border-dashed border-cardboard pl-4" />

            {application?.status === 'REJECTED' && (
              <div className="p-4 bg-red-50 border border-turmeric border-opacity-30 rounded-sm space-y-1.5 ml-4 animate-slide-in">
                <span className="font-mono text-[9px] uppercase font-bold text-paprika block flex items-center">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  <span>Previous Application Rejected</span>
                </span>
                <p className="font-body text-sm text-ink opacity-80">
                  Please verify your credentials and license details, upload correct documentation if necessary, and submit an updated application.
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-turmeric border-opacity-30 rounded-sm text-xs font-body text-paprika ml-4 animate-slide-in">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 pl-4 font-body">
              
              {/* STEP 1: Profile & Credentials */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-slide-in">
                  <h3 className="font-display font-bold text-lg text-ink flex items-center space-x-1.5">
                    <UserIcon className="w-4 h-4 text-turmeric" />
                    <span>Personal & Professional info</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase text-paprika font-bold block">First Name:</label>
                      <input
                        type="text"
                        value={user.first_name || ''}
                        disabled
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper bg-opacity-40 font-body text-sm text-ink opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase text-paprika font-bold block">Last Name:</label>
                      <input
                        type="text"
                        value={user.last_name || ''}
                        disabled
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper bg-opacity-40 font-body text-sm text-ink opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[10px] uppercase text-paprika font-bold block">Email Address:</label>
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper bg-opacity-40 font-body text-sm text-ink opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="phone-input" className="font-mono text-[10px] uppercase text-paprika font-bold block">Phone Number:</label>
                      <input
                        type="text"
                        id="phone-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +919876543210"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="nationality-input" className="font-mono text-[10px] uppercase text-paprika font-bold block">Nationality:</label>
                      <input
                        type="text"
                        id="nationality-input"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        placeholder="e.g. Indian"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="spec-select" className="font-mono text-[10px] uppercase text-paprika font-bold block">Specialization:</label>
                      <select
                        id="spec-select"
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric cursor-pointer"
                      >
                        <option value="General Veterinarian">General Veterinarian</option>
                        <option value="veterinarian surgeon">Veterinarian Surgeon</option>
                        <option value="Pet Nutritionist">Pet Nutritionist</option>
                        <option value="Companion Dermatologist">Companion Dermatologist</option>
                        <option value="Emergency Care Specialist">Emergency Care Specialist</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="exp-years" className="font-mono text-[10px] uppercase text-paprika font-bold block">Years of Experience:</label>
                      <input
                        type="number"
                        id="exp-years"
                        value={experienceYears}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExperienceYears(val === '' ? '' : parseInt(val) || 0);
                        }}
                        min="0"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="license-no" className="font-mono text-[10px] uppercase text-paprika font-bold block">License Number:</label>
                      <input
                        type="text"
                        id="license-no"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="e.g. LIC-9812-VET"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="fee-input" className="font-mono text-[10px] uppercase text-paprika font-bold block">Consultation Fee ($):</label>
                      <input
                        type="number"
                        id="fee-input"
                        value={consultationFee}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConsultationFee(val === '' ? '' : parseFloat(val) || 0);
                        }}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="bio-input" className="font-mono text-[10px] uppercase text-paprika font-bold block">Short Biography & Expertise Details:</label>
                    <textarea
                      id="bio-input"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Provide details about your expertise, pets you treat, and credentials..."
                      rows={4}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors resize-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Academic History */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-slide-in">
                  <div className="flex justify-between items-center border-b border-cardboard border-opacity-25 pb-3">
                    <h3 className="font-display font-bold text-lg text-ink flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-turmeric" />
                      <span>Academic Education History</span>
                    </h3>
                    {educationHistory.length < 3 && (
                      <button
                        type="button"
                        onClick={addEducationEntry}
                        className="bg-paprika hover:opacity-90 text-paper font-mono text-[8px] uppercase px-3 py-1 font-bold rounded-sm cursor-pointer shadow-xs transition-opacity"
                      >
                        + Add Degree
                      </button>
                    )}
                  </div>

                  <div className="space-y-6 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                    {educationHistory.map((edu, idx) => (
                      <div key={idx} className="border border-cardboard bg-paper bg-opacity-20 p-4 rounded-sm space-y-4 relative">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => removeEducationEntry(idx)}
                            className="absolute top-2.5 right-2.5 p-1.5 text-paprika hover:bg-red-50 hover:bg-opacity-50 rounded-sm cursor-pointer transition-colors"
                            title="Remove degree"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block mb-1">
                          {idx === 0 ? "Primary Qualification / Bachelor's Degree" : `Additional Degree #${idx + 1}`}
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-5 space-y-1">
                            <label className="font-mono text-[10px] uppercase text-paprika font-bold block">College/University Name (Tamil Nadu):</label>
                            <CollegeAutocomplete
                              value={edu.college_name}
                              onChange={(val) => handleEducationChange(idx, 'college_name', val)}
                              required={true}
                            />
                          </div>

                          <div className="md:col-span-3 space-y-1">
                            <label className="font-mono text-[10px] uppercase text-paprika font-bold block">Degree Level:</label>
                            <select
                              value={edu.degree}
                              onChange={(e) => handleEducationChange(idx, 'degree', e.target.value)}
                              className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric cursor-pointer"
                            >
                              {veterinaryDegrees.map((deg) => (
                                <option key={deg} value={deg}>{deg}</option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-4 space-y-1">
                            {['M.V.Sc', 'Ph.D (Veterinary Science)'].includes(edu.degree) ? (
                              <>
                                <label className="font-mono text-[10px] uppercase text-paprika font-bold block">Specialization / Major:</label>
                                <select
                                  value={edu.major}
                                  onChange={(e) => handleEducationChange(idx, 'major', e.target.value)}
                                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric cursor-pointer animate-fade-in"
                                >
                                  {vetSpecializations.map((spec) => (
                                    <option key={spec} value={spec}>{spec}</option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <>
                                <label className="font-mono text-[10px] uppercase text-paprika font-bold block opacity-50">Specialization / Major:</label>
                                <div className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper bg-opacity-50 font-body text-xs text-cardboard cursor-not-allowed select-none leading-normal">
                                  Not applicable (UG Level)
                                </div>
                              </>
                            )}
                          </div>
                          
                          <div className="md:col-span-6 space-y-1">
                            <label className="font-mono text-[10px] uppercase text-paprika font-bold block">Start Year:</label>
                            <input
                              type="number"
                              value={edu.start_year || ''}
                              onChange={(e) => handleEducationChange(idx, 'start_year', parseInt(e.target.value) || 0)}
                              placeholder="YYYY"
                              className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                              required
                            />
                          </div>

                          <div className="md:col-span-6 space-y-1">
                            <label className="font-mono text-[10px] uppercase text-paprika font-bold block">End Year:</label>
                            <input
                              type="number"
                              value={edu.end_year || ''}
                              onChange={(e) => handleEducationChange(idx, 'end_year', parseInt(e.target.value) || 0)}
                              placeholder="YYYY"
                              className="w-full px-3 py-1.5 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: Clinical Setup */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-slide-in">
                  <h3 className="font-display font-bold text-lg text-ink flex items-center space-x-1.5">
                    <Landmark className="w-4 h-4 text-turmeric" />
                    <span>Clinic & Location Setup</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="clinic-name-input" className="font-mono text-[10px] uppercase text-paprika font-bold block">Clinic Name:</label>
                      <input
                        type="text"
                        id="clinic-name-input"
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                        placeholder="e.g. Chennai Central Clinic"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="clinic-city-input" className="font-mono text-[10px] uppercase text-paprika font-bold block">Clinic City:</label>
                      <input
                        type="text"
                        id="clinic-city-input"
                        value={clinicCity}
                        onChange={(e) => setClinicCity(e.target.value)}
                        placeholder="e.g. Chennai"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <label htmlFor="clinic-addr" className="font-mono text-[10px] uppercase text-paprika font-bold block">Clinic Address:</label>
                      <input
                        type="text"
                        id="clinic-addr"
                        value={clinicAddress}
                        onChange={(e) => setClinicAddress(e.target.value)}
                        placeholder="e.g. 12 Gandhi Road, Adyar"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="clinic-state-input" className="font-mono text-[10px] uppercase text-paprika font-bold block">Clinic State:</label>
                      <input
                        type="text"
                        id="clinic-state-input"
                        value={clinicState}
                        onChange={(e) => setClinicState(e.target.value)}
                        placeholder="e.g. Tamil Nadu"
                        className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-sm text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Document Verification */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-slide-in">
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-lg text-ink flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-turmeric" />
                      <span>Document Verification</span>
                    </h3>
                    <p className="font-body text-sm text-ink opacity-70">
                      Please upload high-quality scans or images of your credential certificates (PNG, JPG, max 5MB):
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Aadhaar File Card */}
                    <div className="border border-cardboard bg-paper p-4 rounded-sm flex flex-col justify-between space-y-4 relative">
                      <div className="space-y-1 text-center md:text-left">
                        <span className="font-mono text-[9px] uppercase font-bold text-herb block">1. Aadhaar Card:</span>
                        <p className="text-[10px] text-ink opacity-60">Identity verification card.</p>
                      </div>
                      {uploadingAadhaar ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="w-5 h-5 text-turmeric animate-spin" />
                        </div>
                      ) : aadhaarUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1 text-herb font-mono text-[9px] justify-center bg-emerald-50 py-2 border border-emerald-200 rounded-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-paprika" />
                            <span className="text-paprika font-bold">UPLOAD SUCCESS</span>
                          </div>
                          <label className="text-[9px] text-turmeric font-mono hover:underline cursor-pointer block text-center uppercase tracking-wide">
                            Change File
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, 'aadhaar')}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="bg-paperLight border border-cardboard hover:border-turmeric text-ink font-body font-bold text-[10px] py-2 px-3 rounded-sm uppercase tracking-wide text-center cursor-pointer block hover:bg-opacity-90 transition-all">
                          Select File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'aadhaar')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* PAN File Card */}
                    <div className="border border-cardboard bg-paper p-4 rounded-sm flex flex-col justify-between space-y-4 relative">
                      <div className="space-y-1 text-center md:text-left">
                        <span className="font-mono text-[9px] uppercase font-bold text-herb block">2. PAN Card:</span>
                        <p className="text-[10px] text-ink opacity-60">Tax ID proof details.</p>
                      </div>
                      {uploadingPan ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="w-5 h-5 text-turmeric animate-spin" />
                        </div>
                      ) : panUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1 text-herb font-mono text-[9px] justify-center bg-emerald-50 py-2 border border-emerald-200 rounded-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-paprika" />
                            <span className="text-paprika font-bold">UPLOAD SUCCESS</span>
                          </div>
                          <label className="text-[9px] text-turmeric font-mono hover:underline cursor-pointer block text-center uppercase tracking-wide">
                            Change File
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, 'pan')}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="bg-paperLight border border-cardboard hover:border-turmeric text-ink font-body font-bold text-[10px] py-2 px-3 rounded-sm uppercase tracking-wide text-center cursor-pointer block hover:bg-opacity-90 transition-all">
                          Select File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'pan')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Medical Certificate File Card */}
                    <div className="border border-cardboard bg-paper p-4 rounded-sm flex flex-col justify-between space-y-4 relative">
                      <div className="space-y-1 text-center md:text-left">
                        <span className="font-mono text-[9px] uppercase font-bold text-herb block">3. Medical Cert:</span>
                        <p className="text-[10px] text-ink opacity-60">Certified practitioner degree.</p>
                      </div>
                      {uploadingCert ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="w-5 h-5 text-turmeric animate-spin" />
                        </div>
                      ) : certUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1 text-herb font-mono text-[9px] justify-center bg-emerald-50 py-2 border border-emerald-200 rounded-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-paprika" />
                            <span className="text-paprika font-bold">UPLOAD SUCCESS</span>
                          </div>
                          <label className="text-[9px] text-turmeric font-mono hover:underline cursor-pointer block text-center uppercase tracking-wide">
                            Change File
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, 'cert')}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="bg-paperLight border border-cardboard hover:border-turmeric text-ink font-body font-bold text-[10px] py-2 px-3 rounded-sm uppercase tracking-wide text-center cursor-pointer block hover:bg-opacity-90 transition-all">
                          Select File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, 'cert')}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Step Navigation buttons */}
              <div className="pt-6 border-t border-dashed border-cardboard flex justify-between">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(prev => prev - 1);
                      setErrorMsg('');
                    }}
                    className="bg-paper border border-cardboard text-ink font-body font-bold text-xs uppercase px-6 py-2.5 rounded-sm tracking-wider hover:bg-cardboard hover:bg-opacity-40 transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 1 && validateStep1()) setCurrentStep(2);
                      else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
                      else if (currentStep === 3 && validateStep3()) setCurrentStep(4);
                    }}
                    className="bg-paprika text-paper font-body font-bold text-xs uppercase px-6 py-2.5 rounded-sm tracking-wider hover:opacity-90 transition-opacity flex items-center space-x-1.5 cursor-pointer"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || uploadingAadhaar || uploadingPan || uploadingCert}
                    className="bg-paprika text-paper font-body font-bold text-xs uppercase px-8 py-3 rounded-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Submit Verification File</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
