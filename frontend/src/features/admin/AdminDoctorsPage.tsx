import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Eyebrow } from '../../components/Eyebrow';
import { Header } from '../../components/Header';
import { 
  fetchAdminClinics, 
  createAdminClinic, 
  fetchAdminDoctors, 
  createAdminDoctor, 
  verifyAdminDoctor, 
  updateAdminDoctorStatus,
  updateAdminClinicStatus,
  updateAdminDoctor,
  fetchAdminConsultations,
  updateAdminConsultationStatus
} from '../../api/admin';
import { 
  fetchDoctorApplications, 
  updateApplicationStatus, 
  exportDoctorApplicationsCsv, 
  importDoctorApplicationsCsv 
} from '../../api/doctor_applications';
import { 
  Loader2, 
  ClipboardList, 
  Hospital, 
  Calendar,
  User,
  ShoppingBag
} from 'lucide-react';

export const AdminDoctorsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'applications' | 'vets' | 'clinics' | 'consultations'>('applications');

  // Form States - Doctor Onboarding Applications
  const [appStatusFilter, setAppStatusFilter] = useState<string>('');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');
  const [csvUploadFile, setCsvUploadFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; warnings: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Form States - Clinic
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [clinicState, setClinicState] = useState('');
  const [clinicPostalCode, setClinicPostalCode] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');

  // Form States - Doctor
  const [docEmail, setDocEmail] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docLicense, setDocLicense] = useState('');
  const [docClinicId, setDocClinicId] = useState('');
  const [docFee, setDocFee] = useState('500');

  // Form States - Doctor Edit/Inspect
  const [expandedDoctorId, setExpandedDoctorId] = useState<number | null>(null);
  const [editingDoctorId, setEditingDoctorId] = useState<number | null>(null);
  const [editDocSpec, setEditDocSpec] = useState('');
  const [editDocQual, setEditDocQual] = useState('');
  const [editDocExp, setEditDocExp] = useState('0');
  const [editDocFee, setEditDocFee] = useState('0');
  const [editDocLicense, setEditDocLicense] = useState('');
  const [editDocClinicId, setEditDocClinicId] = useState('');

  // Queries
  const { data: clinicsData, isLoading: clinicsLoading } = useQuery({
    queryKey: ['adminClinics'],
    queryFn: () => fetchAdminClinics(),
  });

  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ['adminDoctors'],
    queryFn: () => fetchAdminDoctors(),
  });

  const { data: adminConsultationsData, isLoading: adminConsultationsLoading } = useQuery({
    queryKey: ['adminConsultations'],
    queryFn: () => fetchAdminConsultations(1, 100),
  });

  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['adminDoctorApplications', appStatusFilter],
    queryFn: () => fetchDoctorApplications(appStatusFilter),
    enabled: activeTab === 'applications',
  });

  const adminConsultations = adminConsultationsData?.items || [];
  const clinics = clinicsData?.items || [];
  const doctors = doctorsData?.items || [];

  // Mutations
  const updateAppStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'APPROVED' | 'REJECTED' }) => 
      updateApplicationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDoctorApplications'] });
      queryClient.invalidateQueries({ queryKey: ['adminDoctors'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to update application status.');
    }
  });

  const importCsvMutation = useMutation({
    mutationFn: (file: File) => importDoctorApplicationsCsv(file),
    onMutate: () => {
      setIsImporting(true);
      setImportResult(null);
    },
    onSuccess: (res) => {
      setImportResult({ success: res.success_count, warnings: res.warnings });
      setCsvUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ['adminDoctorApplications'] });
      queryClient.invalidateQueries({ queryKey: ['adminDoctors'] });
      queryClient.invalidateQueries({ queryKey: ['adminClinics'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to import CSV file.');
    },
    onSettled: () => {
      setIsImporting(false);
    }
  });

  const createClinicMutation = useMutation({
    mutationFn: createAdminClinic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminClinics'] });
      setClinicName('');
      setClinicAddress('');
      setClinicCity('');
      setClinicState('');
      setClinicPostalCode('');
      setClinicPhone('');
      alert('Clinic registered successfully!');
    }
  });

  const createDoctorMutation = useMutation({
    mutationFn: createAdminDoctor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDoctors'] });
      setDocEmail('');
      setDocSpec('');
      setDocLicense('');
      setDocClinicId('');
      setDocFee('500');
      alert('Doctor profile linked successfully!');
    },
    onError: (err: any) => {
      alert(`Failed to register doctor: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const verifyDoctorMutation = useMutation({
    mutationFn: ({ docId, isVerified }: { docId: number; isVerified: boolean }) => 
      verifyAdminDoctor(docId, isVerified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDoctors'] });
    }
  });

  const toggleDoctorActiveMutation = useMutation({
    mutationFn: ({ docId, isActive }: { docId: number; isActive: boolean }) => 
      updateAdminDoctorStatus(docId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDoctors'] });
    }
  });

  const toggleClinicActiveMutation = useMutation({
    mutationFn: ({ clinicId, isActive }: { clinicId: number; isActive: boolean }) => 
      updateAdminClinicStatus(clinicId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminClinics'] });
    }
  });

  const updateDoctorMutation = useMutation({
    mutationFn: ({ docId, data }: { docId: number; data: any }) => 
      updateAdminDoctor(docId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDoctors'] });
      setEditingDoctorId(null);
      alert('Doctor profile updated successfully!');
    },
    onError: (err: any) => {
      alert(`Update failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const updateAdminConsultationStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      updateAdminConsultationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminConsultations'] });
      alert('Consultation status updated successfully!');
    },
    onError: (err: any) => {
      alert(`Failed to update status: ${err?.response?.data?.detail || err.message}`);
    }
  });

  // Pre-fill doctor editing details
  const startEditingDoctor = (doc: any) => {
    setEditingDoctorId(doc.id);
    setEditDocSpec(doc.specialization);
    setEditDocQual(doc.qualification);
    setEditDocExp(String(doc.experience_years));
    setEditDocFee(String(doc.consultation_fee));
    setEditDocLicense(doc.license_number);
    setEditDocClinicId(String(doc.clinic_id || ''));
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between">
      <Header />
      
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        
        {/* Breadcrumb Eyebrow and Page Heading */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 text-left">
          <div>
            <Eyebrow label="VETERINARIAN PORTAL ADMINISTRATIVE SERVICE" />
            <h2 className="font-display font-black text-3xl uppercase tracking-tight text-ink mt-1">
              Clinics & Doctors Console
            </h2>
            <p className="font-body text-xs text-ink opacity-70">
              Audit applications, coordinate vet scheduling parameters, and monitor clinic networks.
            </p>
          </div>

          {/* Redirection Switch back to E-Commerce */}
          <button
            onClick={() => navigate('/admin')}
            className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-5 py-3 rounded-sm tracking-wide hover-bounce cursor-pointer shadow-xs flex items-center space-x-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Manage Store & Orders</span>
          </button>
        </div>

        {/* Horizontal Notebook Spine Binder Tabs */}
        <div className="flex overflow-x-auto flex-nowrap border-b border-cardboard gap-1 mb-8 scrollbar-none scroll-smooth">
          {(() => {
            const items = [
              { id: 'applications', label: 'Onboarding Applications', icon: ClipboardList },
              { id: 'vets', label: 'Active Vets', icon: User },
              { id: 'clinics', label: 'Clinics Directory', icon: Hospital },
              { id: 'consultations', label: 'Consultations Ledger', icon: Calendar },
            ];

            return items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center space-x-2 px-5 py-3.5 text-[10px] font-mono font-bold uppercase tracking-wider border-t border-x transition-all duration-150 shrink-0 ${
                    isActive
                      ? 'bg-paperLight border-cardboard border-t-turmeric border-t-2 text-ink -mb-[1px] relative z-10 font-bold'
                      : 'bg-transparent border-transparent text-ink opacity-70 hover:opacity-100 hover:bg-paperLight hover:border-cardboard cursor-pointer font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-turmeric' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            });
          })()}
        </div>

        {/* Viewport Core Layout */}
        <div className="w-full relative pl-4 md:pl-6">
          {/* Vertical Binder line Spine Motif */}
          <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>

          <div className="w-full pl-6">

            {/* TAB 1: APPLICATIONS */}
            {activeTab === 'applications' && (
              <div className="space-y-6 text-left w-full animate-fade-in-up">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-display font-bold text-xl text-ink">Vet Onboarding Applications</h3>
                    <p className="font-body text-xs text-ink opacity-70 mt-1">
                      Review applicant profile submissions, download CSV registers, or import verified profiles in bulk.
                    </p>
                  </div>
                </div>

                <hr className="border-t border-dashed border-cardboard" />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* CSV Bulk Import Panel */}
                  <div className="lg:col-span-6 border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                    <div className="border-b border-cardboard border-dashed pb-3">
                      <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Verifications Pipeline</span>
                      <h4 className="font-display font-bold text-sm text-ink mt-0.5">Bulk Import Verified Doctors</h4>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!csvUploadFile) {
                          alert('Please select a CSV file first.');
                          return;
                        }
                        importCsvMutation.mutate(csvUploadFile);
                      }}
                      className="space-y-4 font-body text-xs"
                    >
                      <div className="space-y-1.5">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                          Select Doctor CSV File:
                        </label>
                        <input
                          type="file"
                          required
                          accept=".csv"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setCsvUploadFile(e.target.files[0]);
                            }
                          }}
                          className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isImporting || !csvUploadFile}
                        className="w-full bg-turmeric text-ink font-mono text-[10px] uppercase py-3 font-bold rounded-sm tracking-wider hover-bounce disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Processing import registry...</span>
                          </>
                        ) : (
                          <span>Upload & Verify Doctors</span>
                        )}
                      </button>
                    </form>

                    {importResult && (
                      <div className="p-3 bg-paper border border-cardboard border-dashed rounded-sm font-mono text-[10px] text-ink space-y-2">
                        <div className="text-herb font-bold">Import Complete: {importResult.success} doctor(s) successfully verified!</div>
                        {importResult.warnings.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-paprika font-bold">Warnings:</div>
                            <ul className="list-disc pl-4 text-ink opacity-80 max-h-32 overflow-y-auto">
                              {importResult.warnings.map((warn, i) => (
                                <li key={i}>{warn}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CSV Export Panel */}
                  <div className="lg:col-span-6 border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                    <div className="border-b border-cardboard border-dashed pb-3">
                      <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Data Ledger Extraction</span>
                      <h4 className="font-display font-bold text-sm text-ink mt-0.5">Export Applications CSV</h4>
                    </div>

                    <div className="space-y-4 font-body text-xs">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-mono text-[9px] uppercase text-herb font-bold block">Start Date:</label>
                          <input
                            type="date"
                            value={exportStartDate}
                            onChange={(e) => setExportStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-mono text-[9px] uppercase text-herb font-bold block">End Date:</label>
                          <input
                            type="date"
                            value={exportEndDate}
                            onChange={(e) => setExportEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const blob = await exportDoctorApplicationsCsv(exportStartDate, exportEndDate);
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `doctor_applications_${new Date().toISOString().split('T')[0]}.csv`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            alert('Failed to export CSV file.');
                          }
                        }}
                        className="w-full bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[10px] uppercase py-3 font-bold rounded-sm tracking-wider cursor-pointer text-center"
                      >
                        Download CSV Ledger
                      </button>
                    </div>
                  </div>
                </div>

                {/* Applications Table Ledger */}
                <div className="border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                  <div className="flex justify-between items-center border-b border-cardboard border-dashed pb-3">
                    <h4 className="font-display font-bold text-md text-ink">Applicant Ledger Register</h4>
                    <div className="flex items-center space-x-2">
                      <label htmlFor="filter-app-select-dashboard" className="font-mono text-[8px] uppercase text-herb font-bold">Filter Status:</label>
                      <select
                        id="filter-app-select-dashboard"
                        value={appStatusFilter}
                        onChange={(e) => setAppStatusFilter(e.target.value)}
                        className="px-2 py-1 border border-cardboard rounded-sm bg-paper font-mono text-[9px] cursor-pointer"
                      >
                        <option value="">All Applications</option>
                        <option value="PENDING">Pending Audit</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                  </div>

                  {applicationsLoading ? (
                    <div className="py-12 text-center space-y-3">
                      <Loader2 className="w-6 h-6 text-turmeric animate-spin mx-auto" />
                      <span className="font-mono text-[9px] uppercase text-herb font-bold">Scanning Applicant ledger...</span>
                    </div>
                  ) : !applications || applications.length === 0 ? (
                    <div className="py-12 text-center text-xs text-cardboard font-mono uppercase">
                      No applications recorded in this category.
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left font-body text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-cardboard font-mono text-[11px] uppercase tracking-wider text-ink font-bold">
                            <th className="py-3 px-2">Applicant</th>
                            <th className="py-3 px-2">Credentials</th>
                            <th className="py-3 px-2">Clinic Information</th>
                            <th className="py-3 px-2">Documents</th>
                            <th className="py-3 px-2">Status</th>
                            <th className="py-3 px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cardboard divide-opacity-30">
                          {applications.map((app) => (
                            <tr key={app.id} className="hover:bg-paper hover:bg-opacity-20 transition-colors">
                              <td className="py-4 px-2 space-y-1">
                                <span className="font-display font-black text-ink text-sm block">{app.first_name} {app.last_name}</span>
                                <span className="text-xs text-ink text-opacity-80 block font-mono">{app.email}</span>
                                <span className="text-xs text-ink text-opacity-80 block font-mono">{app.phone}</span>
                                <span className="text-[10px] px-2 py-0.5 bg-paper border border-cardboard rounded-sm font-mono text-ink inline-block">{app.nationality}</span>
                              </td>
                              <td className="py-4 px-2 space-y-1 font-mono text-xs">
                                <span className="font-bold text-paprika block uppercase text-xs">{app.specialization}</span>
                                {app.education_history ? (
                                  (() => {
                                    try {
                                      const history = JSON.parse(app.education_history);
                                      if (Array.isArray(history)) {
                                        return history.map((edu: any, i: number) => (
                                          <span key={i} className="text-ink block leading-relaxed">
                                            🎓 {edu.degree} @ {edu.college_name} ({edu.start_year} - {edu.end_year})
                                          </span>
                                        ));
                                      }
                                    } catch (e) {}
                                    return <span className="text-ink block leading-relaxed">Degree: {app.qualification} ({app.degree_start_year} - {app.degree_end_year})</span>;
                                  })()
                                ) : (
                                  <span className="text-ink block leading-relaxed">Degree: {app.qualification} ({app.degree_start_year} - {app.degree_end_year})</span>
                                )}
                                <span className="text-ink block">License: {app.license_number}</span>
                                <span className="text-turmeric block font-bold">Fee: ${parseFloat(app.consultation_fee).toFixed(2)}</span>
                                <span className="text-ink block">Exp: {app.experience_years} Years</span>
                              </td>
                              <td className="py-4 px-2 space-y-1">
                                <span className="font-bold text-ink block text-sm">{app.clinic_name}</span>
                                <span className="text-xs text-ink opacity-80 block">{app.clinic_address}</span>
                                <span className="text-xs font-mono text-ink text-opacity-85 block">{app.clinic_city}, {app.clinic_state}</span>
                              </td>
                              <td className="py-4 px-2 space-y-2 font-mono text-xs">
                                {app.aadhaar_card_url && (
                                  <a href={app.aadhaar_card_url} target="_blank" rel="noreferrer" className="text-paprika hover:underline block font-bold">
                                    🪪 Aadhaar Card Image
                                  </a>
                                )}
                                {app.pan_card_url && (
                                  <a href={app.pan_card_url} target="_blank" rel="noreferrer" className="text-paprika hover:underline block font-bold">
                                    💳 PAN Card Image
                                  </a>
                                )}
                                {app.medical_certificate_url && (
                                  <a href={app.medical_certificate_url} target="_blank" rel="noreferrer" className="text-paprika hover:underline block font-bold">
                                    🩺 Medical Certificate
                                  </a>
                                )}
                              </td>
                              <td className="py-4 px-2">
                                <span className={`px-2.5 py-1 rounded-sm font-mono text-[10px] font-bold uppercase border ${
                                  app.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-250 text-paprika' :
                                  app.status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-700' :
                                  'bg-amber-50 border-amber-200 text-amber-800 animate-pulse'
                                }`}>
                                  {app.status}
                                </span>
                              </td>
                              <td className="py-4 px-2 text-right">
                                {app.status === 'PENDING' && (
                                  <div className="inline-flex space-x-1.5">
                                    <button
                                      type="button"
                                      onClick={() => updateAppStatusMutation.mutate({ id: app.id, status: 'APPROVED' })}
                                      disabled={updateAppStatusMutation.isPending}
                                      className="bg-herb hover:bg-opacity-95 text-paperLight font-mono text-[11px] uppercase px-3 py-2 font-bold rounded-sm cursor-pointer shadow-xs disabled:opacity-50"
                                    >
                                      Approve & Upgrade
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateAppStatusMutation.mutate({ id: app.id, status: 'REJECTED' })}
                                      disabled={updateAppStatusMutation.isPending}
                                      className="bg-paprika hover:bg-opacity-95 text-paperLight font-mono text-[11px] uppercase px-3 py-2 font-bold rounded-sm cursor-pointer shadow-xs disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: VETS DIRECTORY */}
            {activeTab === 'vets' && (
              <div className="space-y-8 text-left w-full animate-fade-in-up">
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Register New Doctor Profile */}
                  <div className="lg:col-span-4 border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                    <div className="border-b border-cardboard border-dashed pb-3">
                      <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Manual Linkage</span>
                      <h4 className="font-display font-bold text-sm text-ink mt-0.5">Register Doctor Profile</h4>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (docEmail && docSpec && docLicense && docClinicId) {
                          createDoctorMutation.mutate({
                            user_email: docEmail,
                            specialization: docSpec,
                            license_number: docLicense,
                            clinic_id: Number(docClinicId),
                            consultation_fee: docFee
                          });
                        } else {
                          alert('Please verify all inputs.');
                        }
                      }}
                      className="space-y-4 font-body text-xs"
                    >
                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">User Email:</label>
                        <input
                          placeholder="e.g. vet@example.com"
                          required
                          value={docEmail}
                          onChange={(e) => setDocEmail(e.target.value)}
                          className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Specialization:</label>
                        <input
                          placeholder="e.g. Surgeon"
                          required
                          value={docSpec}
                          onChange={(e) => setDocSpec(e.target.value)}
                          className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">License Number:</label>
                        <input
                          placeholder="e.g. LIC-981-VET"
                          required
                          value={docLicense}
                          onChange={(e) => setDocLicense(e.target.value)}
                          className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Clinic Association:</label>
                        <select
                          required
                          value={docClinicId}
                          onChange={(e) => setDocClinicId(e.target.value)}
                          className="bg-paperLight border border-cardboard w-full p-2 outline-none cursor-pointer"
                        >
                          <option value="">Select Clinic</option>
                          {clinics.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Consultation Fee ($):</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={docFee}
                          onChange={(e) => setDocFee(e.target.value)}
                          className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={createDoctorMutation.isPending}
                        className="w-full bg-turmeric text-ink font-mono text-[10px] uppercase py-3 font-bold rounded-sm tracking-wider hover-bounce disabled:opacity-50 cursor-pointer"
                      >
                        {createDoctorMutation.isPending ? 'Registering...' : 'Register Profile'}
                      </button>
                    </form>
                  </div>

                  {/* Doctor Directory Grid */}
                  <div className="lg:col-span-8 border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                    <div className="border-b border-cardboard border-dashed pb-3">
                      <h4 className="font-display font-bold text-md text-ink">Active Veterinarians Register</h4>
                    </div>

                    {doctorsLoading ? (
                      <div className="py-12 text-center">
                        <Loader2 className="w-6 h-6 text-turmeric animate-spin mx-auto" />
                      </div>
                    ) : doctors.length === 0 ? (
                      <div className="py-12 text-center text-xs text-cardboard font-mono uppercase">
                        No registered vet profiles.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {doctors.map((doc: any) => (
                          <div key={doc.id} className="border border-cardboard bg-paper p-4 rounded-sm space-y-3 text-xs">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-mono text-[10px] uppercase font-bold text-ink tracking-wider px-2 py-0.5 bg-paperLight border border-cardboard rounded-sm mr-2 inline-block">
                                  ID #{doc.id}
                                </span>
                                <span className="font-display font-black text-ink text-sm">{doc.user?.first_name} {doc.user?.last_name || ''}</span>
                                <span className="text-xs text-ink text-opacity-80 block font-mono">{doc.user?.email}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2.5 py-1 rounded-sm font-mono text-[10px] font-bold uppercase border ${
                                  doc.is_verified ? 'bg-emerald-50 border-emerald-250 text-paprika' : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}>
                                  {doc.is_verified ? 'VERIFIED' : 'UNVERIFIED'}
                                </span>
                                <span className={`px-2.5 py-1 rounded-sm font-mono text-[10px] font-bold uppercase border ${
                                  doc.is_active ? 'bg-emerald-50 border-emerald-250 text-paprika' : 'bg-red-50 border-red-200 text-red-700'
                                }`}>
                                  {doc.is_active ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 font-mono text-xs bg-paperLight p-3.5 border border-cardboard border-dashed rounded-sm text-ink">
                              <div><strong>Specialization:</strong> {doc.specialization}</div>
                              <div><strong>License:</strong> {doc.license_number}</div>
                              <div><strong>Consultation Fee:</strong> ${parseFloat(doc.consultation_fee).toFixed(2)}</div>
                              <div><strong>Clinic:</strong> {doc.clinic?.name || 'Private Practice'}</div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-between items-center pt-2">
                              <button
                                onClick={() => setExpandedDoctorId(expandedDoctorId === doc.id ? null : doc.id)}
                                className="font-mono text-[11px] uppercase text-turmeric hover:underline cursor-pointer border-0 bg-transparent font-bold"
                              >
                                {expandedDoctorId === doc.id ? 'Close details' : 'Manage Profile details'}
                              </button>
                            </div>

                            {expandedDoctorId === doc.id && (
                              <div className="border-t border-cardboard border-dashed pt-3 mt-3 space-y-3 animate-fade-in-up">
                                {editingDoctorId === doc.id ? (
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      updateDoctorMutation.mutate({
                                        docId: doc.id,
                                        data: {
                                          specialization: editDocSpec,
                                          qualification: editDocQual,
                                          experience_years: Number(editDocExp),
                                          consultation_fee: Number(editDocFee),
                                          license_number: editDocLicense,
                                          clinic_id: editDocClinicId ? Number(editDocClinicId) : null
                                        }
                                      });
                                    }}
                                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                                  >
                                    <div className="space-y-1">
                                      <label htmlFor="edit-spec" className="font-mono text-[8px] uppercase text-herb font-bold block">Specialization:</label>
                                      <input
                                        id="edit-spec"
                                        required
                                        value={editDocSpec}
                                        onChange={(e) => setEditDocSpec(e.target.value)}
                                        className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label htmlFor="edit-qual" className="font-mono text-[8px] uppercase text-herb font-bold block">Qualification:</label>
                                      <input
                                        id="edit-qual"
                                        required
                                        value={editDocQual}
                                        onChange={(e) => setEditDocQual(e.target.value)}
                                        className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label htmlFor="edit-exp" className="font-mono text-[8px] uppercase text-herb font-bold block">Experience (Years):</label>
                                      <input
                                        id="edit-exp"
                                        type="number"
                                        required
                                        value={editDocExp}
                                        onChange={(e) => setEditDocExp(e.target.value)}
                                        className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label htmlFor="edit-fee" className="font-mono text-[8px] uppercase text-herb font-bold block">Consultation Fee ($):</label>
                                      <input
                                        id="edit-fee"
                                        type="number"
                                        required
                                        value={editDocFee}
                                        onChange={(e) => setEditDocFee(e.target.value)}
                                        className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label htmlFor="edit-license" className="font-mono text-[8px] uppercase text-herb font-bold block">License Number:</label>
                                      <input
                                        id="edit-license"
                                        required
                                        value={editDocLicense}
                                        onChange={(e) => setEditDocLicense(e.target.value)}
                                        className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label htmlFor="edit-clinic" className="font-mono text-[8px] uppercase text-herb font-bold block">Clinic Association:</label>
                                      <select
                                        id="edit-clinic"
                                        value={editDocClinicId}
                                        onChange={(e) => setEditDocClinicId(e.target.value)}
                                        className="bg-paperLight border border-cardboard w-full p-2 outline-none cursor-pointer"
                                      >
                                        <option value="">Private Practice (No Clinic)</option>
                                        {clinics.map((c: any) => (
                                          <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="md:col-span-2 pt-2 flex space-x-2">
                                      <button
                                        type="submit"
                                        disabled={updateDoctorMutation.isPending}
                                        className="bg-turmeric text-ink font-mono text-[9px] uppercase px-3 py-1.5 font-bold rounded-sm flex items-center space-x-1"
                                      >
                                        {updateDoctorMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                        <span>Save Changes</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingDoctorId(null)}
                                        className="border border-cardboard hover:bg-paper font-mono text-[9px] uppercase px-3 py-1.5 font-bold rounded-sm text-ink"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    <button
                                      onClick={() => startEditingDoctor(doc)}
                                      className="bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase px-2.5 py-1.5 font-bold rounded-sm cursor-pointer"
                                    >
                                      Edit profile parameters
                                    </button>
                                    <button
                                      onClick={() => verifyDoctorMutation.mutate({ docId: doc.id, isVerified: !doc.is_verified })}
                                      className="border border-cardboard text-ink font-mono text-[9px] uppercase px-2.5 py-1.5 font-bold rounded-sm cursor-pointer"
                                    >
                                      {doc.is_verified ? 'Revoke Verification' : 'Verify Credentials'}
                                    </button>
                                    <button
                                      onClick={() => toggleDoctorActiveMutation.mutate({ docId: doc.id, isActive: !doc.is_active })}
                                      className="border border-cardboard text-ink font-mono text-[9px] uppercase px-2.5 py-1.5 font-bold rounded-sm cursor-pointer"
                                    >
                                      {doc.is_active ? 'Deactivate Doctor' : 'Activate Doctor'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CLINICS DIRECTORY */}
            {activeTab === 'clinics' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left w-full animate-fade-in-up">
                
                {/* Add Clinic Form */}
                <div className="lg:col-span-4 border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                  <div className="border-b border-cardboard border-dashed pb-3">
                    <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Network Growth</span>
                    <h4 className="font-display font-bold text-sm text-ink mt-0.5">Register New Clinic Profile</h4>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (clinicName && clinicAddress && clinicCity && clinicState && clinicPostalCode && clinicPhone) {
                        createClinicMutation.mutate({
                          name: clinicName,
                          address: clinicAddress,
                          city: clinicCity,
                          state: clinicState,
                          postal_code: clinicPostalCode,
                          phone: clinicPhone
                        });
                      } else {
                        alert('All fields are required.');
                      }
                    }}
                    className="space-y-3 font-body text-xs"
                  >
                    <input
                      placeholder="Clinic Name"
                      required
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                    />
                    <input
                      placeholder="Clinic Address"
                      required
                      value={clinicAddress}
                      onChange={(e) => setClinicAddress(e.target.value)}
                      className="bg-paperLight border border-cardboard w-full p-2 outline-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="City"
                        required
                        value={clinicCity}
                        onChange={(e) => setClinicCity(e.target.value)}
                        className="bg-paperLight border border-cardboard p-2 outline-none"
                      />
                      <input
                        placeholder="State"
                        required
                        value={clinicState}
                        onChange={(e) => setClinicState(e.target.value)}
                        className="bg-paperLight border border-cardboard p-2 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="Postal Code"
                        required
                        value={clinicPostalCode}
                        onChange={(e) => setClinicPostalCode(e.target.value)}
                        className="bg-paperLight border border-cardboard p-2 outline-none"
                      />
                      <input
                        placeholder="Contact Phone"
                        required
                        value={clinicPhone}
                        onChange={(e) => setClinicPhone(e.target.value)}
                        className="bg-paperLight border border-cardboard p-2 outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={createClinicMutation.isPending}
                      className="w-full bg-turmeric text-ink font-mono text-[10px] uppercase py-3 font-bold rounded-sm tracking-wider hover-bounce disabled:opacity-50 cursor-pointer"
                    >
                      {createClinicMutation.isPending ? 'Registering...' : 'Register Clinic'}
                    </button>
                  </form>
                </div>

                {/* Clinics Directory List */}
                <div className="lg:col-span-8 border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                  <div className="border-b border-cardboard border-dashed pb-3">
                    <h4 className="font-display font-bold text-md text-ink">Active Clinic Locations</h4>
                  </div>

                  {clinicsLoading ? (
                    <div className="py-12 text-center">
                      <Loader2 className="w-6 h-6 text-turmeric animate-spin mx-auto" />
                    </div>
                  ) : clinics.length === 0 ? (
                    <div className="py-12 text-center text-xs text-cardboard font-mono uppercase">
                      No clinics registered.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {clinics.map((c: any) => (
                        <div key={c.id} className="border border-cardboard bg-paper p-4 rounded-sm flex flex-col justify-between space-y-3 text-xs">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="font-display font-black text-ink text-sm block">{c.name}</span>
                              <span className={`px-2.5 py-1 rounded-sm font-mono text-[10px] font-bold uppercase border ${
                                c.is_active ? 'bg-emerald-50 border-emerald-250 text-paprika' : 'bg-red-50 border-red-200 text-red-700'
                              }`}>
                                {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </div>
                            <span className="text-xs text-ink text-opacity-85 block mt-1">{c.address}</span>
                            <span className="text-xs text-ink text-opacity-85 block font-mono">{c.city}, {c.state} - {c.postal_code}</span>
                            <span className="text-xs text-ink text-opacity-85 block mt-1">📞 {c.phone}</span>
                          </div>
                          
                          <div className="border-t border-cardboard border-dashed pt-2 flex justify-between items-center">
                            <span className="font-mono text-xs text-ink opacity-60">Clinic ID: #{c.id}</span>
                            <button
                              onClick={() => toggleClinicActiveMutation.mutate({ clinicId: c.id, isActive: !c.is_active })}
                              className="text-turmeric hover:underline font-mono text-[11px] uppercase font-bold cursor-pointer border-0 bg-transparent"
                            >
                              {c.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: CONSULTATIONS LEDGER */}
            {activeTab === 'consultations' && (
              <div className="space-y-6 text-left w-full animate-fade-in-up">
                <div className="border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                  <div className="border-b border-cardboard border-dashed pb-3">
                    <h4 className="font-display font-bold text-md text-ink">Consultations Ledger Book</h4>
                  </div>

                  {adminConsultationsLoading ? (
                    <div className="py-12 text-center">
                      <Loader2 className="w-6 h-6 text-turmeric animate-spin mx-auto" />
                    </div>
                  ) : adminConsultations.length === 0 ? (
                    <div className="py-12 text-center text-xs text-cardboard font-mono uppercase">
                      No booked consultations found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left font-body text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-cardboard font-mono text-[11px] uppercase tracking-wider text-ink font-bold">
                            <th className="py-3 px-2">Consultation ID</th>
                            <th className="py-3 px-2">Scheduled At</th>
                            <th className="py-3 px-2">Doctor Info</th>
                            <th className="py-3 px-2">Reason</th>
                            <th className="py-3 px-2">Status</th>
                            <th className="py-3 px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cardboard divide-opacity-30">
                          {adminConsultations.map((con: any) => {
                            const currentStatus = con.status ? con.status.toUpperCase() : 'PENDING';
                            return (
                              <tr key={con.id} className="hover:bg-paper hover:bg-opacity-20 transition-colors">
                                <td className="py-4 px-2 font-mono font-bold text-ink text-xs">#{con.id}</td>
                                <td className="py-4 px-2 font-mono text-xs">
                                  <span className="block text-ink">{new Date(con.scheduled_at).toLocaleDateString()}</span>
                                  <span className="block text-xs text-ink text-opacity-80">{new Date(con.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </td>
                                <td className="py-4 px-2">
                                  <span className="font-display font-black text-ink block text-xs">
                                    Dr. {con.doctor?.user?.first_name || con.doctor?.user?.last_name 
                                      ? `${con.doctor.user.first_name || ''} ${con.doctor.user.last_name || ''}`.trim() 
                                      : `Vet #${con.doctor_id}`}
                                  </span>
                                  <span className="text-xs text-ink text-opacity-85 block font-mono">{con.doctor?.specialization}</span>
                                </td>
                                <td className="py-4 px-2 text-ink italic font-body text-xs">"{con.reason || 'Routine Checkup'}"</td>
                                <td className="py-4 px-2">
                                  <span className={`px-2.5 py-1 rounded-sm font-mono text-[10px] font-bold uppercase border ${
                                    currentStatus === 'COMPLETED' ? 'bg-emerald-50 border-emerald-250 text-paprika' :
                                    currentStatus === 'CONFIRMED' ? 'bg-blue-50 border-blue-250 text-sky-800' :
                                    currentStatus === 'CANCELLED' ? 'bg-red-50 border-red-200 text-red-700' :
                                    'bg-amber-50 border-amber-200 text-amber-800 animate-pulse'
                                  }`}>
                                    {currentStatus}
                                  </span>
                                </td>
                                <td className="py-4 px-2 text-right">
                                  <div className="flex justify-end space-x-1.5">
                                    {currentStatus === 'PENDING' && (
                                      <>
                                        <button
                                          onClick={() => updateAdminConsultationStatusMutation.mutate({ id: con.id, status: 'confirmed' })}
                                          className="bg-herb hover:bg-opacity-95 text-paperLight font-mono text-[11px] uppercase px-3 py-2 font-bold rounded-sm cursor-pointer"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={() => updateAdminConsultationStatusMutation.mutate({ id: con.id, status: 'cancelled' })}
                                          className="bg-paprika hover:bg-opacity-95 text-paperLight font-mono text-[11px] uppercase px-3 py-2 font-bold rounded-sm cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    {currentStatus === 'CONFIRMED' && (
                                      <>
                                        <button
                                          onClick={() => updateAdminConsultationStatusMutation.mutate({ id: con.id, status: 'in_progress' })}
                                          className="bg-turmeric text-ink font-mono text-[11px] uppercase px-3 py-2 font-bold rounded-sm cursor-pointer"
                                        >
                                          Start
                                        </button>
                                        <button
                                          onClick={() => updateAdminConsultationStatusMutation.mutate({ id: con.id, status: 'cancelled' })}
                                          className="bg-paprika hover:bg-opacity-95 text-paperLight font-mono text-[11px] uppercase px-3 py-2 font-bold rounded-sm cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    {currentStatus === 'IN_PROGRESS' && (
                                      <button
                                        onClick={() => updateAdminConsultationStatusMutation.mutate({ id: con.id, status: 'completed' })}
                                        className="bg-ink hover:bg-opacity-95 text-paperLight font-mono text-[11px] uppercase px-3 py-2 font-bold rounded-sm cursor-pointer"
                                      >
                                        Mark Completed
                                      </button>
                                    )}
                                    {['COMPLETED', 'CANCELLED'].includes(currentStatus) && (
                                      <span className="text-xs text-ink opacity-40 font-mono italic">Archived</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};
