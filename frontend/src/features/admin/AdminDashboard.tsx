import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { CartDrawer } from '../../components/CartDrawer';
import { Eyebrow } from '../../components/Eyebrow';
import { logoutUser } from '../../api/auth';
import { 
  fetchAdminOrders, 
  updateAdminOrderStatus, 
  createOrderShipment, 
  fetchAdminClinics, 
  createAdminClinic, 
  fetchAdminDoctors, 
  createAdminDoctor, 
  verifyAdminDoctor, 
  updateAdminDoctorStatus,
  updateAdminClinicStatus,
  cleanupUnverifiedUsers,
  updateAdminDoctor,
  fetchAdminConsultations,
  updateAdminConsultationStatus
} from '../../api/admin';
import { fetchProducts, fetchCategories } from '../../api/products';
import { 
  createProduct, 
  deactivateProduct, 
  createCategory,
  deleteCategory,
  uploadProductImage,
  deleteProductImage,
  updateProduct,
  updateInventory
} from '../../api/productsAdmin';
import type { CreateProductData, InventoryUpdate } from '../../api/productsAdmin';
import { fetchRAGDocuments, uploadRAGDocument, deleteRAGDocument } from '../../api/chatbot';
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  ClipboardList, 
  Hospital, 
  Calendar,
  BookOpen, 
  Truck, 
  PawPrint,
  ShoppingCart,
  LogOut,
  User,
  Boxes,
  Sparkles,
  Trash2,
  FileText,
  Terminal
} from 'lucide-react';

const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['processing'],
  processing: ['packed', 'shipped'],
  packed: ['shipped'],
  shipped: ['in_transit', 'delivered', 'returned', 'delivery_failed'],
  in_transit: ['out_for_delivery', 'delivered', 'returned', 'delivery_failed'],
  out_for_delivery: ['delivered', 'returned', 'delivery_failed'],
  delivered: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<'orders' | 'clinics_doctors' | 'recipes' | 'inventory' | 'knowledge_agent' | 'api_docs' | 'consultations'>('orders');
  const [apiDocsSubTab, setApiDocsSubTab] = useState<'public' | 'doctor' | 'admin'>('public');
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  
  // Form States - AI Knowledge Base
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [ragTitle, setRagTitle] = useState('');
  const [ragCategory, setRagCategory] = useState('general');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartItems = useCartStore((state) => state.items);
  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Form States - Recipe Catalog
  const [recipeName, setRecipeName] = useState('');
  const [recipeDesc, setRecipeDesc] = useState('');
  const [recipeSku, setRecipeSku] = useState('');
  const [recipePrice, setRecipePrice] = useState('');
  const [recipeStock, setRecipeStock] = useState('20');
  const [recipeCategoryId, setRecipeCategoryId] = useState('');
  const [recipeImgUrl, setRecipeImgUrl] = useState('');

  // Form States - New Category
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Form States - Shipping
  const [shippingOrderId, setShippingOrderId] = useState<number | null>(null);

  // Form States - Quick Edit Modal
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  // Form States - Alert Threshold Modal
  const [editingThresholdProduct, setEditingThresholdProduct] = useState<any | null>(null);
  const [editThreshold, setEditThreshold] = useState('');

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
  const [editDocExp, setEditDocExp] = useState('');
  const [editDocFee, setEditDocFee] = useState('');
  const [editDocLicense, setEditDocLicense] = useState('');
  const [editDocBio, setEditDocBio] = useState('');
  const [editDocClinicId, setEditDocClinicId] = useState('');
  const [editDocLat, setEditDocLat] = useState('');
  const [editDocLng, setEditDocLng] = useState('');

  // Queries
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['adminOrders'],
    queryFn: () => fetchAdminOrders(),
  });

  const { data: clinicsData, isLoading: clinicsLoading } = useQuery({
    queryKey: ['adminClinics'],
    queryFn: () => fetchAdminClinics(),
  });

  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ['adminDoctors'],
    queryFn: () => fetchAdminDoctors(),
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['adminProducts'],
    queryFn: () => fetchProducts({ limit: 100 }),
  });

  const { data: categories } = useQuery({
    queryKey: ['adminCategories'],
    queryFn: fetchCategories,
  });

  const { data: ragDocuments, isLoading: ragDocumentsLoading } = useQuery({
    queryKey: ['adminRAGDocuments'],
    queryFn: () => fetchRAGDocuments(),
    enabled: activeTab === 'knowledge_agent',
  });

  const { data: adminConsultationsData, isLoading: adminConsultationsLoading } = useQuery({
    queryKey: ['adminConsultations'],
    queryFn: () => fetchAdminConsultations(1, 100),
    enabled: activeTab === 'consultations',
  });
  const adminConsultations = adminConsultationsData?.items || [];

  const clinics = clinicsData?.items || [];
  const doctors = doctorsData?.items || [];
  const products = productsData?.items || [];



  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) => 
      updateAdminOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
    }
  });

  const addShipmentMutation = useMutation({
    mutationFn: ({ orderId, carrier, tracking }: { orderId: number; carrier: string; tracking: string }) => 
      createOrderShipment(orderId, carrier, tracking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      setShippingOrderId(null);
      setCarrier('');
      setTrackingNumber('');
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
  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setRecipeName('');
      setRecipeDesc('');
      setRecipeSku('');
      setRecipePrice('');
      setRecipeImgUrl('');
    }
  });

  const deactivateProductMutation = useMutation({
    mutationFn: deactivateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      setCategoryName('');
      setCategoryDesc('');
      setShowCategoryForm(false);
    }
  });

  const toggleClinicActiveMutation = useMutation({
    mutationFn: ({ clinicId, isActive }: { clinicId: number; isActive: boolean }) => 
      updateAdminClinicStatus(clinicId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminClinics'] });
    }
  });

  const cleanupUsersMutation = useMutation({
    mutationFn: (maxAge: number) => cleanupUnverifiedUsers(maxAge),
    onSuccess: (data) => {
      alert(data.message || `Cleaned up unverified accounts successfully.`);
    },
    onError: (err: any) => {
      alert(`Cleanup failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
    },
    onError: (err: any) => {
      alert(`Delete category failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ productId, productData }: { productId: number; productData: Partial<CreateProductData> }) => 
      updateProduct(productId, productData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      alert('Product updated successfully!');
    },
    onError: (err: any) => {
      alert(`Update failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const updateInventoryMutation = useMutation({
    mutationFn: ({ inventoryId, inventoryData }: { inventoryId: number; inventoryData: InventoryUpdate }) => 
      updateInventory(inventoryId, inventoryData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      alert('Alert threshold updated successfully!');
    },
    onError: (err: any) => {
      alert(`Update threshold failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const uploadProductImageMutation = useMutation({
    mutationFn: ({ productId, file }: { productId: number; file: File }) => 
      uploadProductImage(productId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      alert('Product image uploaded successfully!');
    },
    onError: (err: any) => {
      alert(`Upload failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const deleteProductImageMutation = useMutation({
    mutationFn: deleteProductImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      alert('Product image removed successfully!');
    },
    onError: (err: any) => {
      alert(`Remove failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const uploadRAGDocumentMutation = useMutation({
    mutationFn: ({ file, title, category }: { file: File; title?: string; category?: string }) => 
      uploadRAGDocument(file, title, category),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRAGDocuments'] });
      alert(data.message || 'Successfully uploaded and indexed document!');
      setRagFile(null);
      setRagTitle('');
      setRagCategory('general');
      const fileInput = document.getElementById('rag-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    },
    onError: (err: any) => {
      alert(`Upload failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const deleteRAGDocumentMutation = useMutation({
    mutationFn: deleteRAGDocument,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRAGDocuments'] });
      alert(data.message || 'Document deleted from vector store.');
    },
    onError: (err: any) => {
      alert(`Deletion failed: ${err?.response?.data?.detail || err.message}`);
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

  const renderEndpointCard = (ep: {
    method: string;
    path: string;
    desc: string;
    auth: string;
    params?: string;
    body?: string;
    response: string;
  }, index: number) => {
    const isExpanded = expandedEndpoint === `${apiDocsSubTab}_${index}`;
    const badgeColors: Record<string, string> = {
      GET: 'bg-herb bg-opacity-10 text-herb border border-herb border-opacity-30',
      POST: 'bg-turmeric bg-opacity-15 text-ink border border-turmeric border-opacity-40',
      PATCH: 'bg-blue-50 text-blue-800 border border-blue-200',
      PUT: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
      DELETE: 'bg-paprika bg-opacity-10 text-paprika border border-paprika border-opacity-30',
    };

    return (
      <div 
        key={index} 
        className="border border-cardboard bg-paperLight rounded-sm overflow-hidden transition-all duration-200 shadow-sm"
      >
        <button
          onClick={() => setExpandedEndpoint(isExpanded ? null : `${apiDocsSubTab}_${index}`)}
          className="w-full flex items-center justify-between p-4 hover:bg-paper transition-colors text-left"
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0 ${badgeColors[ep.method] || 'bg-cardboard'}`}>
              {ep.method}
            </span>
            <span className="font-mono text-xs text-ink font-bold overflow-x-auto select-all">
              {ep.path}
            </span>
          </div>
          <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block ml-3 shrink-0">
            {isExpanded ? 'Collapse ▲' : 'Inspect ▼'}
          </span>
        </button>

        {isExpanded && (
          <div className="border-t border-cardboard border-dashed p-4 space-y-4 bg-paper bg-opacity-20 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div>
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Description:</span>
                  <p className="font-body text-xs text-ink mt-0.5">{ep.desc}</p>
                </div>
                <div>
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Access Permissions:</span>
                  <span className="inline-block mt-0.5 font-body text-[10px] bg-paperLight px-2 py-0.5 rounded-sm border border-cardboard text-ink opacity-80">
                    🔐 {ep.auth}
                  </span>
                </div>
                {ep.params && (
                  <div>
                    <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Query Parameters:</span>
                    <pre className="font-mono text-[10px] text-ink opacity-85 bg-paperLight p-2 rounded-sm border border-cardboard mt-1 leading-relaxed whitespace-pre-wrap">
                      {ep.params}
                    </pre>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {ep.body && (
                  <div>
                    <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Request Body Pattern:</span>
                    <pre className="font-mono text-[10px] text-ink bg-paperLight p-2.5 rounded-sm border border-cardboard mt-1 overflow-x-auto max-h-40 leading-normal">
                      {ep.body}
                    </pre>
                  </div>
                )}
                <div>
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Response Pattern (200 OK):</span>
                  <pre className="font-mono text-[10px] text-ink bg-paperLight p-2.5 rounded-sm border border-cardboard mt-1 overflow-x-auto max-h-40 leading-normal">
                    {ep.response}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
            <button onClick={() => navigate('/consultations')} className="hover:text-turmeric transition-colors pb-1">Vet Consults</button>
            <button onClick={() => navigate('/orders')} className="hover:text-turmeric transition-colors pb-1">My Orders</button>
            <button onClick={() => navigate('/assistant')} className="hover:text-turmeric transition-colors pb-1">AI Assistant 🐾</button>
            <button onClick={() => navigate('/profile')} className="hover:text-turmeric transition-colors pb-1">My Profile</button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="hover:text-turmeric text-turmeric transition-colors pb-1 font-bold border-b-2 border-turmeric">Admin Panel 🛠️</button>
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

      {/* Main Content Dashboard */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        
        {/* Back Link */}
        <div className="mb-8 text-left">
          <button
            onClick={() => navigate('/shop')}
            className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Return to Product Ledger</span>
          </button>
        </div>

        {/* Header Title */}
        <div className="mb-10 text-left border-b border-cardboard pb-6">
          <Eyebrow label="VETERINARY COMMERCE ADMINISTRATIVE CORE" />
          <h2 className="font-display font-bold text-4xl text-ink mt-1">
            Kitchen Administration Panel
          </h2>
          <p className="font-body text-xs text-ink opacity-70 mt-1.5 max-w-2xl">
            Control recipe items, veterinary profiles, clinic slots, and platform order shipment cycles.
          </p>

          {/* Quick System Cleanup Panel */}
          <div className="mt-6 p-4 bg-paper border border-cardboard rounded-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">System Maintenance Tools:</span>
              <p className="text-[11px] text-ink opacity-70 mt-0.5">Cleanup unverified user accounts created during signup tests.</p>
            </div>
            <button
              onClick={() => {
                if (confirm('Delete all unverified user accounts older than 24 hours?')) {
                  cleanupUsersMutation.mutate(24);
                }
              }}
              disabled={cleanupUsersMutation.isPending}
              className="bg-paprika hover:bg-opacity-95 text-paperLight font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50 shrink-0"
            >
              {cleanupUsersMutation.isPending ? 'Cleaning...' : '🧹 Cleanup Unverified Accounts'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-cardboard mb-10 overflow-x-auto space-x-8 text-left">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Sourced Orders</span>
          </button>
          
          <button
            onClick={() => setActiveTab('clinics_doctors')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'clinics_doctors'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <Hospital className="w-4 h-4" />
            <span>Clinics & Doctors</span>
          </button>

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
            onClick={() => setActiveTab('recipes')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'recipes'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Recipe Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'inventory'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Inventory & Stock</span>
          </button>

          <button
            onClick={() => setActiveTab('knowledge_agent')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'knowledge_agent'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Knowledge Base</span>
          </button>

          <button
            onClick={() => setActiveTab('api_docs')}
            className={`flex items-center space-x-2 font-body text-xs font-bold uppercase tracking-wider pb-4 border-b-2 transition-colors ${
              activeTab === 'api_docs'
                ? 'border-paprika text-paprika'
                : 'border-transparent text-ink opacity-70 hover:opacity-100'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>API Reference</span>
          </button>
        </div>

        {/* Tab 1: Orders Registry */}
        {activeTab === 'orders' && (
          <div className="space-y-8 text-left">
            <h3 className="font-display font-bold text-xl text-ink">Active Platform Orders</h3>
            
            {ordersLoading ? (
              <div className="flex items-center space-x-2 text-ink opacity-60">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-mono text-xs uppercase">Loading Sourced Orders...</span>
              </div>
            ) : orders?.length === 0 ? (
              <p className="font-body text-xs text-ink opacity-70">No orders registered in system.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {orders?.map((order) => (
                  <div key={order.id} className="border border-cardboard bg-paperLight p-6 rounded-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-cardboard border-dashed pb-4">
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
                          ORDER RECORD #{order.id}
                        </div>
                        <div className="font-body text-xs text-ink opacity-75 mt-0.5">
                          Placed: {new Date(order.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold ${
                          order.status.toUpperCase() === 'COMPLETED' || order.status.toLowerCase() === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : order.status.toUpperCase() === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status}
                        </span>
                        
                        {/* Status Transition Options */}
                        <select
                          value={order.status}
                          disabled={updateOrderStatusMutation.isPending}
                          onChange={(e) => updateOrderStatusMutation.mutate({ orderId: order.id, status: e.target.value })}
                          className="bg-paper border border-cardboard font-mono text-[9px] uppercase px-2 py-1 rounded-sm text-ink outline-none disabled:opacity-50"
                        >
                          <option value={order.status} disabled>{order.status} (Current)</option>
                          <option value="PENDING" disabled={!VALID_ORDER_TRANSITIONS[order.status]?.includes('PENDING')}>Set Pending</option>
                          <option value="CONFIRMED" disabled={!VALID_ORDER_TRANSITIONS[order.status]?.includes('CONFIRMED')}>Confirm Order</option>
                          <option value="processing" disabled={!VALID_ORDER_TRANSITIONS[order.status]?.includes('processing')}>Process Order</option>
                          <option value="shipped" disabled={!VALID_ORDER_TRANSITIONS[order.status]?.includes('shipped')}>Ship Order</option>
                          <option value="delivered" disabled={!VALID_ORDER_TRANSITIONS[order.status]?.includes('delivered')}>Set Delivered</option>
                          <option value="COMPLETED" disabled={!VALID_ORDER_TRANSITIONS[order.status]?.includes('COMPLETED')}>Complete Order</option>
                          <option value="CANCELLED" disabled={!VALID_ORDER_TRANSITIONS[order.status]?.includes('CANCELLED')}>Cancel Order</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                      {/* Left: Items & Total */}
                      <div className="space-y-3">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-60">Sourced Recipe Items:</div>
                        <ul className="divide-y divide-cardboard divide-dashed">
                          {order.items.map((item) => (
                            <li key={item.id} className="py-2 flex justify-between">
                              <span className="font-body font-bold text-ink">{item.product_name} <span className="opacity-60 font-normal">x{item.quantity}</span></span>
                              <span className="font-mono text-ink">₹{Number(item.price).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="border-t border-cardboard pt-2 flex justify-between font-bold text-ink text-sm">
                          <span>Total Amount Paid:</span>
                          <span className="font-mono">₹{Number(order.total_amount).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Right: Shipping & Tracking */}
                      <div className="space-y-4 border-l border-cardboard border-dashed pl-0 md:pl-6">
                        <div className="space-y-1">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-60">Sourcing Recipient:</div>
                          <div className="font-body text-ink font-semibold">{order.shipping_address}</div>
                          <div className="font-body text-ink opacity-70">City: {order.shipping_city} | Ph: {order.shipping_phone}</div>
                        </div>

                        {order.tracking_number ? (
                          <div className="p-3 border border-cardboard rounded-sm bg-paper space-y-1">
                            <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold flex items-center space-x-1">
                              <Truck className="w-3.5 h-3.5" />
                              <span>Active Shipment tracking</span>
                            </div>
                            <div className="font-body text-[11px] text-ink">
                              Carrier: <strong className="uppercase">{order.carrier}</strong>
                            </div>
                            <div className="font-mono text-[10px] text-ink">
                              Tracking No: <strong>{order.tracking_number}</strong>
                            </div>
                          </div>
                        ) : order.status === 'shipped' || order.status === 'processing' ? (
                          <div className="space-y-2.5">
                            {shippingOrderId === order.id ? (
                              <div className="p-3 border border-dashed border-cardboard rounded-sm space-y-2">
                                <div className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70">Assign Courier Tracker:</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    placeholder="Carrier (e.g. BlueDart)"
                                    value={carrier}
                                    onChange={(e) => setCarrier(e.target.value)}
                                    className="bg-paper border border-cardboard p-1.5 text-xs text-ink outline-none"
                                  />
                                  <input
                                    placeholder="Tracking Number"
                                    value={trackingNumber}
                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                    className="bg-paper border border-cardboard p-1.5 text-xs text-ink outline-none"
                                  />
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => addShipmentMutation.mutate({ orderId: order.id, carrier, tracking: trackingNumber })}
                                    disabled={addShipmentMutation.isPending}
                                    className="bg-paprika text-paperLight font-mono text-[9px] uppercase px-3 py-1 font-bold rounded-sm disabled:opacity-50 flex items-center space-x-1.5"
                                  >
                                    {addShipmentMutation.isPending ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Saving...</span>
                                      </>
                                    ) : (
                                      <span>Save Tracking</span>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setShippingOrderId(null)}
                                    disabled={addShipmentMutation.isPending}
                                    className="border border-cardboard font-mono text-[9px] uppercase px-3 py-1 font-bold rounded-sm text-ink disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShippingOrderId(order.id)}
                                className="border border-cardboard hover:bg-paper font-mono text-[9px] uppercase px-3 py-1.5 font-bold rounded-sm text-ink flex items-center space-x-1.5"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Register Shipment Carrier</span>
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Clinics & Doctors */}
        {activeTab === 'clinics_doctors' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">
            
            {/* Left: Vet Clinics Directory */}
            <div className="lg:col-span-6 space-y-6">
              <h3 className="font-display font-bold text-xl text-ink">Clinics Directory</h3>

              {/* Add Clinic Form */}
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
                  }
                }}
                className="border border-cardboard border-dashed p-4 rounded-sm space-y-3"
              >
                <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">Register New Clinic Profile</div>
                <input
                  placeholder="Clinic Name"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="bg-paperLight border border-cardboard w-full p-2 text-xs text-ink outline-none"
                />
                <input
                  placeholder="Clinic Address"
                  required
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  className="bg-paperLight border border-cardboard w-full p-2 text-xs text-ink outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="City"
                    required
                    value={clinicCity}
                    onChange={(e) => setClinicCity(e.target.value)}
                    className="bg-paperLight border border-cardboard p-2 text-xs text-ink outline-none"
                  />
                  <input
                    placeholder="State"
                    required
                    value={clinicState}
                    onChange={(e) => setClinicState(e.target.value)}
                    className="bg-paperLight border border-cardboard p-2 text-xs text-ink outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Postal Code"
                    required
                    value={clinicPostalCode}
                    onChange={(e) => setClinicPostalCode(e.target.value)}
                    className="bg-paperLight border border-cardboard p-2 text-xs text-ink outline-none"
                  />
                  <input
                    placeholder="Contact Phone"
                    required
                    value={clinicPhone}
                    onChange={(e) => setClinicPhone(e.target.value)}
                    className="bg-paperLight border border-cardboard p-2 text-xs text-ink outline-none"
                  />
                </div>
                {createClinicMutation.isError && (
                  <div className="p-2 bg-red-50 border border-paprika border-opacity-40 rounded-sm text-[10px] text-paprika font-mono font-bold">
                    ⚠️ {(createClinicMutation.error as any)?.response?.data?.detail || 'Failed to create clinic profile'}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={createClinicMutation.isPending}
                  className="bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-2 font-bold rounded-sm w-full flex items-center justify-center space-x-1.5"
                >
                  {createClinicMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Create Clinic Entry</span>
                    </>
                  )}
                </button>
              </form>

              {/* Clinics List */}
              <div className="space-y-4">
                {clinicsLoading ? (
                  <Loader2 className="w-4 h-4 text-turmeric animate-spin" />
                ) : clinics.length === 0 ? (
                  <p className="font-body text-xs text-ink opacity-60">No clinics registered.</p>
                ) : (
                  <div className="divide-y divide-cardboard divide-dashed border-t border-cardboard">
                    {clinics.map((clinic) => (
                      <div key={clinic.id} className="py-3 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-body font-bold text-ink">{clinic.name}</div>
                          <div className="text-ink opacity-70 font-mono text-[9px] mt-0.5">{clinic.address}, {clinic.city}</div>
                          <div className="text-ink opacity-70 font-mono text-[9px]">Phone: {clinic.phone}</div>
                        </div>
                        <div className="flex flex-col items-end space-y-1.5">
                          <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold ${
                            clinic.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {clinic.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => toggleClinicActiveMutation.mutate({ clinicId: clinic.id, isActive: !clinic.is_active })}
                            disabled={toggleClinicActiveMutation.isPending}
                            className="border border-cardboard hover:bg-paper font-mono text-[8px] uppercase px-2 py-0.5 font-bold rounded-sm text-ink disabled:opacity-50"
                          >
                            {clinic.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Veterinarian Doctors Management */}
            <div className="lg:col-span-6 space-y-6 border-l border-cardboard border-dashed pl-0 lg:pl-8">
              <h3 className="font-display font-bold text-xl text-ink">Veterinarians Directory</h3>

              {/* Add Doctor Form */}
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
                  }
                }}
                className="border border-cardboard border-dashed p-4 rounded-sm space-y-3"
              >
                <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">Register New Veterinarian</div>
                <input
                  placeholder="Doctor User Account Email Address"
                  type="email"
                  required
                  value={docEmail}
                  onChange={(e) => setDocEmail(e.target.value)}
                  className="bg-paperLight border border-cardboard w-full p-2 text-xs text-ink outline-none"
                />
                <input
                  placeholder="Specialization (e.g. Canine Nutritionist)"
                  required
                  value={docSpec}
                  onChange={(e) => setDocSpec(e.target.value)}
                  className="bg-paperLight border border-cardboard w-full p-2 text-xs text-ink outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Medical License No"
                    required
                    value={docLicense}
                    onChange={(e) => setDocLicense(e.target.value)}
                    className="bg-paperLight border border-cardboard p-2 text-xs text-ink outline-none"
                  />
                  <select
                    required
                    value={docClinicId}
                    onChange={(e) => setDocClinicId(e.target.value)}
                    className="bg-paperLight border border-cardboard p-2 text-xs text-ink outline-none"
                  >
                    <option value="">Select Clinic</option>
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <input
                  placeholder="Consultation Fee (INR)"
                  type="number"
                  required
                  value={docFee}
                  onChange={(e) => setDocFee(e.target.value)}
                  className="bg-paperLight border border-cardboard w-full p-2 text-xs text-ink outline-none"
                />
                {createDoctorMutation.isError && (
                  <div className="p-2 bg-red-50 border border-paprika border-opacity-40 rounded-sm text-[10px] text-paprika font-mono font-bold">
                    ⚠️ {(createDoctorMutation.error as any)?.response?.data?.detail || 'Failed to create doctor profile'}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={createDoctorMutation.isPending}
                  className="bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-2 font-bold rounded-sm w-full flex items-center justify-center space-x-1.5"
                >
                  {createDoctorMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Create Doctor Entry</span>
                    </>
                  )}
                </button>
              </form>

              {/* Doctors List */}
              <div className="space-y-4">
                {doctorsLoading ? (
                  <Loader2 className="w-4 h-4 text-turmeric animate-spin" />
                ) : doctors.length === 0 ? (
                  <p className="font-body text-xs text-ink opacity-60">No veterinarians registered.</p>
                ) : (
                  <div className="divide-y divide-cardboard divide-dashed border-t border-cardboard">
                    {doctors.map((doc) => (
                      <div key={doc.id} className="py-4 space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-body font-bold text-ink">
                              Dr. {doc.first_name || ''} {doc.last_name || 'Veterinarian'}
                            </div>
                            <div className="text-ink opacity-70 font-mono text-[9px] mt-0.5">{doc.specialization}</div>
                            <div className="text-ink opacity-70 font-mono text-[9px]">License: {doc.license_number}</div>
                            <div className="text-ink opacity-75 mt-1 font-semibold">Clinic: {doc.clinic?.name || `ID ${doc.clinic_id}`}</div>
                          </div>
                          <div className="flex flex-col items-end space-y-2">
                            <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold ${
                              doc.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-850'
                            }`}>
                              {doc.is_verified ? 'Verified ✓' : 'Unverified'}
                            </span>
                            <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold ${
                              doc.is_active ? 'bg-green-550 text-green-700' : 'bg-red-100 text-red-800'
                            }`}>
                              {doc.is_active ? 'Available' : 'Suspended'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2 pt-1">
                          <button
                            onClick={() => verifyDoctorMutation.mutate({ docId: doc.id, isVerified: !doc.is_verified })}
                            className="border border-cardboard hover:bg-paper font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm text-ink"
                          >
                            {doc.is_verified ? 'Revoke Verification' : 'Verify Credentials'}
                          </button>
                          <button
                            onClick={() => toggleDoctorActiveMutation.mutate({ docId: doc.id, isActive: !doc.is_active })}
                            className="border border-cardboard hover:bg-paper font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm text-ink"
                          >
                            {doc.is_active ? 'Deactivate Doctor' : 'Activate Doctor'}
                          </button>
                          <button
                            onClick={() => {
                              if (expandedDoctorId === doc.id) {
                                setExpandedDoctorId(null);
                                setEditingDoctorId(null);
                              } else {
                                setExpandedDoctorId(doc.id);
                                setEditingDoctorId(null);
                              }
                            }}
                            className="border border-cardboard hover:bg-paper font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm text-ink"
                          >
                            {expandedDoctorId === doc.id ? 'Close Details' : 'Inspect / Edit'}
                          </button>
                        </div>

                        {expandedDoctorId === doc.id && (
                          <div className="border border-cardboard border-dashed p-3 mt-2 bg-paperLight space-y-2 rounded-sm text-[11px]">
                            {editingDoctorId !== doc.id ? (
                              <div className="space-y-2 text-left">
                                <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold border-b border-cardboard pb-1 mb-1">
                                  🩺 Doctor Credentials Ledger
                                </div>
                                <div className="grid grid-cols-2 gap-2 font-body text-ink">
                                  <div><span className="font-semibold text-ink opacity-70">Qualification:</span> {doc.qualification || 'Not specified'}</div>
                                  <div><span className="font-semibold text-ink opacity-70">Experience:</span> {doc.experience_years !== null ? `${doc.experience_years} years` : 'Not specified'}</div>
                                  <div><span className="font-semibold text-ink opacity-70">Specialization:</span> {doc.specialization || 'Not specified'}</div>
                                  <div><span className="font-semibold text-ink opacity-70">Consultation Fee:</span> ₹{doc.consultation_fee || '0'}</div>
                                  <div><span className="font-semibold text-ink opacity-70">License Number:</span> {doc.license_number || 'N/A'}</div>
                                  <div><span className="font-semibold text-ink opacity-70">Location Coordinates:</span> Lat: {doc.latitude ?? 'N/A'}, Lng: {doc.longitude ?? 'N/A'}</div>
                                </div>
                                {doc.bio && (
                                  <div className="pt-1.5 border-t border-cardboard border-dotted">
                                    <span className="font-semibold text-ink opacity-70 block mb-0.5">Professional Bio:</span>
                                    <p className="italic text-ink opacity-85 leading-relaxed">{doc.bio}</p>
                                  </div>
                                )}
                                
                                {doc.clinic && (
                                  <div className="pt-2 border-t border-cardboard border-dotted space-y-1">
                                    <span className="font-semibold text-herb font-mono text-[9px] uppercase tracking-wider block">🏢 Associated Clinic Details</span>
                                    <div className="font-body text-ink">
                                      <div className="font-bold">{doc.clinic.name}</div>
                                      <div className="opacity-75">{doc.clinic.address}, {doc.clinic.city}, {doc.clinic.state} {doc.clinic.postal_code}</div>
                                      <div className="opacity-75 font-mono text-[10px]">Phone: {doc.clinic.phone}</div>
                                    </div>
                                  </div>
                                )}

                                <button
                                  onClick={() => {
                                    setEditingDoctorId(doc.id);
                                    setEditDocSpec(doc.specialization || '');
                                    setEditDocQual(doc.qualification || '');
                                    setEditDocExp(doc.experience_years !== null && doc.experience_years !== undefined ? doc.experience_years.toString() : '');
                                    setEditDocFee(doc.consultation_fee ? doc.consultation_fee.toString() : '');
                                    setEditDocLicense(doc.license_number || '');
                                    setEditDocBio(doc.bio || '');
                                    setEditDocClinicId(doc.clinic_id ? doc.clinic_id.toString() : '');
                                    setEditDocLat(doc.latitude !== null && doc.latitude !== undefined ? doc.latitude.toString() : '');
                                    setEditDocLng(doc.longitude !== null && doc.longitude !== undefined ? doc.longitude.toString() : '');
                                  }}
                                  className="bg-turmeric text-ink font-mono text-[9px] uppercase px-3 py-1 font-bold rounded-sm hover:opacity-90 transition-opacity"
                                >
                                  Modify Credentials
                                </button>
                              </div>
                            ) : (
                              <form 
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  updateDoctorMutation.mutate({
                                    docId: doc.id,
                                    data: {
                                      specialization: editDocSpec || null,
                                      qualification: editDocQual || null,
                                      experience_years: editDocExp ? parseInt(editDocExp) : null,
                                      consultation_fee: editDocFee ? parseFloat(editDocFee) : null,
                                      license_number: editDocLicense || null,
                                      bio: editDocBio || null,
                                      clinic_id: editDocClinicId ? parseInt(editDocClinicId) : null,
                                      latitude: editDocLat ? parseFloat(editDocLat) : null,
                                      longitude: editDocLng ? parseFloat(editDocLng) : null,
                                    }
                                  });
                                }}
                                className="space-y-2 text-left"
                              >
                                <div className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold border-b border-cardboard pb-1 mb-1">
                                  ✏️ Edit Doctor Profile Settings
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold text-herb block">Specialization</label>
                                    <input
                                      value={editDocSpec}
                                      onChange={(e) => setEditDocSpec(e.target.value)}
                                      className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none"
                                      placeholder="Specialization"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold text-herb block">Qualification</label>
                                    <input
                                      value={editDocQual}
                                      onChange={(e) => setEditDocQual(e.target.value)}
                                      className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none"
                                      placeholder="Qualification"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold text-herb block">Experience (Years)</label>
                                    <input
                                      type="number"
                                      value={editDocExp}
                                      onChange={(e) => setEditDocExp(e.target.value)}
                                      className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none"
                                      placeholder="Years"
                                      min="0"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold text-herb block">Consultation Fee (INR)</label>
                                    <input
                                      type="number"
                                      value={editDocFee}
                                      onChange={(e) => setEditDocFee(e.target.value)}
                                      className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none"
                                      placeholder="Fee"
                                      min="0"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold text-herb block">License Number</label>
                                    <input
                                      value={editDocLicense}
                                      onChange={(e) => setEditDocLicense(e.target.value)}
                                      className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none"
                                      placeholder="License"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold text-herb block">Clinic Affiliation</label>
                                    <select
                                      value={editDocClinicId}
                                      onChange={(e) => setEditDocClinicId(e.target.value)}
                                      className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none"
                                    >
                                      <option value="">No Clinic / Independent</option>
                                      {clinics.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold text-herb block">Latitude</label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={editDocLat}
                                      onChange={(e) => setEditDocLat(e.target.value)}
                                      className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none"
                                      placeholder="e.g. 13.0827"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-mono font-bold text-herb block">Longitude</label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={editDocLng}
                                      onChange={(e) => setEditDocLng(e.target.value)}
                                      className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none"
                                      placeholder="e.g. 80.2707"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-mono font-bold text-herb block">Biography</label>
                                  <textarea
                                    value={editDocBio}
                                    onChange={(e) => setEditDocBio(e.target.value)}
                                    rows={3}
                                    className="bg-paper border border-cardboard w-full p-1.5 text-xs text-ink outline-none resize-none"
                                    placeholder="Enter professional bio..."
                                  />
                                </div>
                                <div className="flex space-x-2 pt-1">
                                  <button
                                    type="submit"
                                    disabled={updateDoctorMutation.isPending}
                                    className="bg-paprika text-paperLight font-mono text-[9px] uppercase px-3 py-1.5 font-bold rounded-sm flex items-center space-x-1"
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

        {/* Tab: Consultations Ledger */}
        {activeTab === 'consultations' && (
          <div className="space-y-6 text-left w-full">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-xl text-ink">Consultations Ledger</h3>
                <p className="font-body text-xs text-ink opacity-70 mt-1">
                  View and manage all companion vet consultations booked on the platform.
                </p>
              </div>
            </div>

            {adminConsultationsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin" />
              </div>
            ) : adminConsultations.length === 0 ? (
              <div className="border border-cardboard border-dashed p-8 text-center rounded-sm">
                <p className="font-body text-xs text-ink opacity-60">No consultations have been booked yet.</p>
              </div>
            ) : (
              <div className="bg-paperLight border border-cardboard rounded-sm overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-cardboard bg-paper font-mono text-[9px] uppercase tracking-wider text-herb">
                        <th className="p-3">ID</th>
                        <th className="p-3">Patient Companion</th>
                        <th className="p-3">Specialist Vet</th>
                        <th className="p-3">Scheduled Date/Time</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cardboard divide-dashed font-body text-ink">
                      {adminConsultations.map((consult: any) => {
                        const statusColors: Record<string, string> = {
                          PENDING: 'bg-yellow-50 text-yellow-800 border-yellow-200',
                          CONFIRMED: 'bg-blue-50 text-blue-800 border-blue-200',
                          IN_PROGRESS: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                          COMPLETED: 'bg-green-50 text-green-800 border-green-200',
                          CANCELLED: 'bg-red-50 text-red-800 border-red-200',
                        };
                        const currentStatus = consult.status ? consult.status.toUpperCase() : 'PENDING';
                        const statusClass = statusColors[currentStatus] || 'bg-gray-50 text-gray-800 border-gray-200';

                        return (
                          <tr key={consult.id} className="hover:bg-paper transition-colors">
                            <td className="p-3 font-mono text-[10px] text-ink opacity-80">#{consult.id}</td>
                            <td className="p-3">
                              <div className="font-bold">{consult.pet?.name || 'Unknown Pet'}</div>
                              <div className="text-[10px] opacity-70 font-mono">{consult.pet?.species || 'N/A'} {consult.pet?.breed ? `(${consult.pet.breed})` : ''}</div>
                              <div className="text-[9px] opacity-60">Owner ID: {consult.customer_id}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold">
                                {consult.doctor?.first_name || consult.doctor?.last_name 
                                  ? `Dr. ${consult.doctor.first_name || ''} ${consult.doctor.last_name || ''}` 
                                  : `Doctor ID ${consult.doctor_id}`}
                              </div>
                              <div className="text-[10px] opacity-70 font-mono">{consult.doctor?.specialization || 'Veterinarian'}</div>
                            </td>
                            <td className="p-3 font-mono text-[10px]">
                              {new Date(consult.scheduled_at).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="p-3 max-w-[200px] truncate" title={consult.reason}>
                              <div>{consult.reason}</div>
                              {consult.customer_notes && (
                                <div className="text-[10px] italic opacity-70 truncate" title={consult.customer_notes}>
                                  Note: {consult.customer_notes}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${statusClass}`}>
                                {currentStatus}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end space-x-1.5">
                                {currentStatus === 'PENDING' && (
                                                                  <>
                                    <button
                                      onClick={() => updateAdminConsultationStatusMutation.mutate({ id: consult.id, status: 'confirmed' })}
                                      disabled={updateAdminConsultationStatusMutation.isPending}
                                      className="bg-green-100 hover:bg-green-200 text-green-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-green-300 disabled:opacity-50"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => updateAdminConsultationStatusMutation.mutate({ id: consult.id, status: 'cancelled' })}
                                      disabled={updateAdminConsultationStatusMutation.isPending}
                                      className="bg-red-100 hover:bg-red-200 text-red-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-red-300 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}

                                {currentStatus === 'CONFIRMED' && (
                                  <>
                                    <button
                                      onClick={() => updateAdminConsultationStatusMutation.mutate({ id: consult.id, status: 'in_progress' })}
                                      disabled={updateAdminConsultationStatusMutation.isPending}
                                      className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-indigo-300 disabled:opacity-50"
                                    >
                                      Start
                                    </button>
                                    <button
                                      onClick={() => updateAdminConsultationStatusMutation.mutate({ id: consult.id, status: 'cancelled' })}
                                      disabled={updateAdminConsultationStatusMutation.isPending}
                                      className="bg-red-100 hover:bg-red-200 text-red-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-red-300 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}

                                {currentStatus === 'IN_PROGRESS' && (
                                  <button
                                    onClick={() => updateAdminConsultationStatusMutation.mutate({ id: consult.id, status: 'completed' })}
                                    disabled={updateAdminConsultationStatusMutation.isPending}
                                    className="bg-green-100 hover:bg-green-200 text-green-800 font-mono text-[8px] uppercase px-2 py-1 font-bold rounded-sm border border-green-300 disabled:opacity-50"
                                  >
                                    Complete
                                  </button>
                                )}

                                {['COMPLETED', 'CANCELLED'].includes(currentStatus) && (
                                  <span className="text-[10px] text-ink opacity-40 font-mono italic">Archived</span>
                                )}
                              </div>
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
        )}

        {/* Tab 3: Recipe Catalog */}
        {activeTab === 'recipes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">
            
            {/* Left: Recipe Catalog Creation */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-bold text-xl text-ink">Add New Recipe Item</h3>
                <button
                  onClick={() => setShowCategoryForm(!showCategoryForm)}
                  className="font-mono text-[9px] uppercase font-bold tracking-wider text-herb underline hover:text-ink"
                >
                  {showCategoryForm ? 'Show Product Form' : '+ New Category'}
                </button>
              </div>

              {showCategoryForm ? (
                <div className="space-y-6">
                  {/* Category creation form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (categoryName && categoryDesc) {
                        createCategoryMutation.mutate({ name: categoryName, description: categoryDesc });
                      }
                    }}
                    className="border border-cardboard border-dashed p-5 rounded-sm space-y-4 bg-paperLight"
                  >
                    <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
                      Create Product Category
                    </div>
                    <input
                      placeholder="Category Name (e.g. Dog Kibble)"
                      required
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      className="bg-paper border border-cardboard w-full p-2.5 text-xs text-ink outline-none"
                    />
                    <textarea
                      placeholder="Category Description"
                      required
                      value={categoryDesc}
                      onChange={(e) => setCategoryDesc(e.target.value)}
                      rows={3}
                      className="bg-paper border border-cardboard w-full p-2.5 text-xs text-ink outline-none font-body"
                    />
                    <button
                      type="submit"
                      disabled={createCategoryMutation.isPending}
                      className="bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-2 font-bold rounded-sm w-full flex items-center justify-center space-x-1.5 hover-bounce"
                    >
                      {createCategoryMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>Add Category</span>
                      )}
                    </button>
                  </form>

                  {/* Existing Categories List with Deletion option */}
                  <div className="p-5 border border-cardboard rounded-sm bg-paperLight space-y-4">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
                      Manage Categories
                    </div>
                    {categories && categories.length > 0 ? (
                      <div className="divide-y divide-cardboard divide-dashed">
                        {categories.map((cat) => (
                          <div key={cat.id} className="py-2.5 flex justify-between items-center text-xs">
                            <div>
                              <strong className="text-ink text-sm">{cat.name}</strong>
                              <p className="text-[11px] text-ink opacity-70 mt-0.5">{cat.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete category "${cat.name}"? This will delete all products under it.`)) {
                                  deleteCategoryMutation.mutate(cat.id);
                                }
                              }}
                              disabled={deleteCategoryMutation.isPending}
                              className="font-mono text-[8px] uppercase font-bold text-paprika hover:underline disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-ink opacity-65">No categories registered.</p>
                    )}
                  </div>
                </div>
              ) : (
                /* Recipe creation form */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (recipeName && recipeSku && recipePrice && recipeCategoryId) {
                      createProductMutation.mutate({
                        name: recipeName,
                        description: recipeDesc,
                        sku: recipeSku,
                        price: recipePrice,
                        available_stock: Number(recipeStock),
                        category_id: Number(recipeCategoryId),
                        image_url: recipeImgUrl || undefined
                      });
                    }
                  }}
                  className="border border-cardboard border-dashed p-5 rounded-sm space-y-4 bg-paperLight"
                >
                  <div className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
                    Create Recipe Listing
                  </div>
                  
                  <input
                    placeholder="Recipe Item Name (e.g. Organic Chicken Mash)"
                    required
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    className="bg-paper border border-cardboard w-full p-2.5 text-xs text-ink outline-none"
                  />

                  <textarea
                    placeholder="Recipe description details & sizing contents..."
                    value={recipeDesc}
                    onChange={(e) => setRecipeDesc(e.target.value)}
                    rows={4}
                    className="bg-paper border border-cardboard w-full p-2.5 text-xs text-ink outline-none font-body"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="SKU Code"
                      required
                      value={recipeSku}
                      onChange={(e) => setRecipeSku(e.target.value)}
                      className="bg-paper border border-cardboard p-2.5 text-xs text-ink outline-none font-mono"
                    />
                    <input
                      placeholder="Price (INR)"
                      type="number"
                      required
                      value={recipePrice}
                      onChange={(e) => setRecipePrice(e.target.value)}
                      className="bg-paper border border-cardboard p-2.5 text-xs text-ink outline-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Stock Level"
                      type="number"
                      required
                      value={recipeStock}
                      onChange={(e) => setRecipeStock(e.target.value)}
                      className="bg-paper border border-cardboard p-2.5 text-xs text-ink outline-none font-mono"
                    />
                    <select
                      required
                      value={recipeCategoryId}
                      onChange={(e) => setRecipeCategoryId(e.target.value)}
                      className="bg-paper border border-cardboard p-2.5 text-xs text-ink outline-none"
                    >
                      <option value="">Category Tag</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <input
                    placeholder="Image URL link (optional)"
                    value={recipeImgUrl}
                    onChange={(e) => setRecipeImgUrl(e.target.value)}
                    className="bg-paper border border-cardboard w-full p-2.5 text-xs text-ink outline-none font-mono"
                  />

                  <button
                    type="submit"
                    disabled={createProductMutation.isPending}
                    className="bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm w-full flex items-center justify-center space-x-1.5"
                  >
                    {createProductMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Register Sourced Recipe</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Right: Recipe Listing Catalog view */}
            <div className="lg:col-span-7 space-y-6 border-l border-cardboard border-dashed pl-0 lg:pl-8">
              <h3 className="font-display font-bold text-xl text-ink">Product Registry Catalog</h3>

              {productsLoading ? (
                <Loader2 className="w-4 h-4 text-turmeric animate-spin" />
              ) : products.length === 0 ? (
                <p className="font-body text-xs text-ink opacity-60">No products registered in system.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {products.map((prod) => (
                    <div key={prod.id} className="border border-cardboard p-4 rounded-sm flex flex-col sm:flex-row sm:items-start sm:justify-between bg-paperLight gap-4">
                      <div className="space-y-1 text-xs flex-grow">
                        <div className="flex items-center space-x-2">
                          <span className="font-body font-bold text-ink text-sm">{prod.name}</span>
                          <span className="font-mono text-[8px] uppercase tracking-wider bg-paper border border-cardboard px-1 rounded-sm text-herb">
                            {prod.category?.name || 'Sourced Item'}
                          </span>
                        </div>
                        <p className="font-body text-sm text-ink opacity-70 line-clamp-2 pr-6">{prod.description || 'No description provided.'}</p>
                        <div className="font-mono text-[9px] text-ink flex flex-wrap gap-4 pt-1">
                          <span>Price: <strong>₹{Number(prod.price).toFixed(2)}</strong></span>
                          <span>Stock: <strong>{prod.available_stock ?? 'Unlimited'}</strong></span>
                          <span>SKU: <strong>{prod.sku}</strong></span>
                        </div>

                        {/* Image file upload and removal block */}
                        <div className="mt-2.5 flex items-center space-x-3">
                          <label className="font-mono text-[8px] uppercase font-bold tracking-wider bg-paper border border-cardboard px-2 py-1 rounded-sm cursor-pointer hover:bg-paperLight">
                            Upload Image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadProductImageMutation.mutate({ productId: prod.id, file });
                                }
                              }}
                            />
                          </label>
                          {prod.image_url && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to remove the image?')) {
                                  deleteProductImageMutation.mutate(prod.id);
                                }
                              }}
                              className="font-mono text-[8px] uppercase font-bold tracking-wider text-paprika hover:underline"
                            >
                              Remove Image
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-3 shrink-0">
                        <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold ${
                          prod.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {prod.is_active ? 'Active' : 'Inactive'}
                        </span>
                        
                        {prod.is_active && (
                          <div className="flex flex-row sm:flex-col items-end gap-2">
                            <button
                              onClick={() => {
                                setEditingProduct(prod);
                                setEditPrice(prod.price);
                                setEditStock(String(prod.available_stock ?? ''));
                              }}
                              className="font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:underline"
                            >
                              Quick Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Deactivate recipe "${prod.name}"?`)) {
                                  deactivateProductMutation.mutate(prod.id);
                                }
                              }}
                              className="font-mono text-[9px] uppercase font-bold tracking-wider text-paprika hover:underline"
                            >
                              Deactivate
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Tab 4: Inventory & Stock Management */}
        {activeTab === 'inventory' && (
          <div className="space-y-8 text-left">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-display font-bold text-xl text-ink">Warehouse Inventory Registry</h3>
                <p className="font-body text-xs text-ink opacity-70 mt-0.5">Audit physical counts, reserved order holdings, and configure stock alert thresholds.</p>
              </div>
            </div>

            {/* Inventory Overview Stats Row */}
            {productsLoading ? (
              <Loader2 className="w-4 h-4 text-turmeric animate-spin" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-cardboard bg-paperLight p-4 rounded-sm">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block">Total Catalog Items</span>
                  <span className="font-display font-bold text-2xl text-ink mt-1 block">{products.length}</span>
                </div>
                <div className="border border-cardboard bg-paperLight p-4 rounded-sm">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block">Low Stock Alert Count</span>
                  <span className="font-display font-bold text-2xl text-paprika mt-1 block">
                    {products.filter(p => p.is_active && (p.available_stock ?? 0) <= (p.low_stock_threshold ?? 5)).length}
                  </span>
                </div>
                <div className="border border-cardboard bg-paperLight p-4 rounded-sm">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-herb font-bold block">Held/Reserved Quantity</span>
                  <span className="font-display font-bold text-2xl text-ink mt-1 block">
                    {products.reduce((sum, p) => sum + (p.reserved_stock ?? 0), 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Main Inventory Grid */}
            {productsLoading ? (
              <div className="flex items-center space-x-2 text-ink opacity-60">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-mono text-xs uppercase">Loading Stock Logbooks...</span>
              </div>
            ) : products.length === 0 ? (
              <p className="font-body text-xs text-ink opacity-70">No products registered in database.</p>
            ) : (
              <div className="border border-cardboard bg-paperLight rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-body text-ink border-collapse">
                    <thead>
                      <tr className="bg-paper border-b border-cardboard font-mono text-[9px] uppercase tracking-wider text-herb text-left">
                        <th className="p-4 font-bold">Recipe Name</th>
                        <th className="p-4 font-bold">SKU</th>
                        <th className="p-4 font-bold text-right">Physical Stock</th>
                        <th className="p-4 font-bold text-right">Reserved Count</th>
                        <th className="p-4 font-bold text-right">Available to Buy</th>
                        <th className="p-4 font-bold text-right">Alert Threshold</th>
                        <th className="p-4 font-bold text-center">Stock Health</th>
                        <th className="p-4 font-bold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cardboard divide-dashed">
                      {products.map((prod) => {
                        const lowStock = prod.is_active && (prod.available_stock ?? 0) <= (prod.low_stock_threshold ?? 5);
                        const physicalStock = (prod.available_stock ?? 0) + (prod.reserved_stock ?? 0);
                        return (
                          <tr key={prod.id} className="hover:bg-paper transition-colors">
                            <td className="p-4 font-bold">{prod.name}</td>
                            <td className="p-4 font-mono text-[10px]">{prod.sku}</td>
                            <td className="p-4 text-right font-mono font-bold">{physicalStock}</td>
                            <td className="p-4 text-right font-mono text-paprika">{prod.reserved_stock ?? 0}</td>
                            <td className="p-4 text-right font-mono font-bold text-herb">{prod.available_stock ?? 0}</td>
                            <td className="p-4 text-right font-mono">{prod.low_stock_threshold ?? 5}</td>
                            <td className="p-4 text-center">
                              <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold ${
                                !prod.is_active
                                  ? 'bg-red-100 text-red-800'
                                  : lowStock
                                  ? 'bg-yellow-100 text-yellow-800 animate-pulse'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {!prod.is_active ? 'Inactive' : lowStock ? '⚠️ Low Stock' : '✅ Good'}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center space-x-3">
                                <button
                                  onClick={() => {
                                    setEditingProduct(prod);
                                    setEditPrice(prod.price);
                                    setEditStock(String(prod.available_stock ?? ''));
                                  }}
                                  className="font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:underline"
                                >
                                  Edit Stock
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingThresholdProduct(prod);
                                    setEditThreshold(String(prod.low_stock_threshold ?? 5));
                                  }}
                                  className="font-mono text-[9px] uppercase font-bold tracking-wider text-turmeric hover:underline"
                                >
                                  Set Alert
                                </button>
                              </div>
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
        )}

        {/* Tab 5: AI Knowledge Base & RAG Management */}
        {activeTab === 'knowledge_agent' && (
          <div className="space-y-8 text-left">
            <div>
              <h3 className="font-display font-bold text-xl text-ink">AI Knowledge Base (RAG)</h3>
              <p className="font-body text-xs text-ink opacity-70 mt-0.5">
                Manage reference documents that Scooby's AI Help Assistant uses to answer customer queries.
              </p>
            </div>

            {/* Split screen: Ingest Document form on the left, active document index on the right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Form Card */}
              <div className="lg:col-span-4 border border-cardboard bg-paperLight p-6 rounded-none space-y-5">
                <div className="border-b border-cardboard border-dashed pb-3">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Vector Ingestion Pipeline</span>
                  <h4 className="font-display font-bold text-sm text-ink mt-0.5">Index New Document</h4>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!ragFile) {
                      alert('Please select a document file to upload.');
                      return;
                    }
                    uploadRAGDocumentMutation.mutate({
                      file: ragFile,
                      title: ragTitle || undefined,
                      category: ragCategory,
                    });
                  }}
                  className="space-y-4"
                >
                  {/* File Upload Input */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Select Document File:
                    </label>
                    <input
                      id="rag-file-input"
                      type="file"
                      required
                      accept=".txt,.pdf,.docx,.doc,.md"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setRagFile(e.target.files[0]);
                          if (!ragTitle) {
                            const baseName = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                            setRagTitle(baseName);
                          }
                        }
                      }}
                      className="w-full text-xs font-body text-ink file:mr-4 file:py-2 file:px-4 file:rounded-none file:border file:border-cardboard file:text-[9px] file:font-mono file:uppercase file:font-bold file:bg-paper file:text-ink hover:file:bg-paperLight cursor-pointer"
                    />
                    <p className="font-body text-[9px] text-ink opacity-60">Supports PDF, DOCX, TXT, MD up to 10MB.</p>
                  </div>

                  {/* Custom Title */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Custom Title (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Shipping Lead Times 2026"
                      value={ragTitle}
                      onChange={(e) => setRagTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Knowledge Category:
                    </label>
                    <select
                      value={ragCategory}
                      onChange={(e) => setRagCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric transition-colors"
                    >
                      <option value="general">General Help & Policies</option>
                      <option value="products">Recipe Ingredients & Stock</option>
                      <option value="shipping">Shiprocket & Delivery Status</option>
                      <option value="vets">Clinics, Consultations & Bookings</option>
                    </select>
                  </div>

                  {/* Submit Ingest Button */}
                  <button
                    type="submit"
                    disabled={uploadRAGDocumentMutation.isPending}
                    className="w-full bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-3 font-bold rounded-sm hover-bounce disabled:opacity-50 flex items-center justify-center space-x-1.5"
                  >
                    {uploadRAGDocumentMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Indexing Vectors...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ingest Document</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Document List Ledger on the right */}
              <div className="lg:col-span-8 border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                <div className="border-b border-cardboard border-dashed pb-3">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Pinecone Vector Registry</span>
                  <h4 className="font-display font-bold text-sm text-ink mt-0.5">Active Reference Documents</h4>
                </div>

                {ragDocumentsLoading ? (
                  <div className="flex items-center space-x-2 text-ink opacity-60 py-10 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-turmeric" />
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Retrieving Vector Index...</span>
                  </div>
                ) : !ragDocuments || ragDocuments.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-cardboard rounded-sm bg-paper bg-opacity-35">
                    <FileText className="w-8 h-8 text-cardboard mx-auto stroke-1 mb-2" />
                    <h5 className="font-display font-bold text-ink text-xs">Vector Index Empty</h5>
                    <p className="font-body text-[10px] text-ink opacity-70 max-w-[240px] mx-auto mt-1">
                      No customer-facing knowledge docs are currently embedded. Use the ingestion form to parse your first file.
                    </p>
                  </div>
                ) : (
                  <div className="border border-cardboard bg-paperLight overflow-hidden rounded-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-body text-ink border-collapse">
                        <thead>
                          <tr className="bg-paper border-b border-cardboard font-mono text-[9px] uppercase tracking-wider text-herb text-left">
                            <th className="p-4 font-bold">Document ID</th>
                            <th className="p-4 font-bold">Document Title</th>
                            <th className="p-4 font-bold">Category</th>
                            <th className="p-4 font-bold text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cardboard divide-dashed">
                          {ragDocuments.map((doc) => (
                            <tr key={doc.doc_id} className="hover:bg-paper transition-colors">
                              <td className="p-4 font-mono text-[10px] text-ink opacity-80">{doc.doc_id}</td>
                              <td className="p-4 font-bold">{doc.title}</td>
                              <td className="p-4">
                                <span className="font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold bg-green-100 text-green-800">
                                  {doc.category}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to purge document "${doc.title}" (ID: ${doc.doc_id}) from the vector store?`)) {
                                      deleteRAGDocumentMutation.mutate(doc.doc_id);
                                    }
                                  }}
                                  disabled={deleteRAGDocumentMutation.isPending}
                                  className="font-mono text-[9px] uppercase font-bold tracking-wider text-paprika hover:underline flex items-center justify-center space-x-1 mx-auto disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Purge Index</span>
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
          </div>
        )}

        {activeTab === 'api_docs' && (
          <div className="space-y-8 animate-fade-in-up text-left">
            <div className="border-b border-cardboard border-dashed pb-4">
              <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Developer Center</span>
              <h2 className="font-display font-bold text-2xl text-ink mt-1">API Endpoint Directory</h2>
              <p className="font-body text-xs text-ink opacity-70 mt-1">
                Full reference of platform router endpoints, request payloads, and response schemas categorized by user access role.
              </p>
            </div>

            {/* Sub-tabs */}
            <div className="flex border border-cardboard rounded-sm bg-paperLight overflow-hidden max-w-md">
              <button
                onClick={() => { setApiDocsSubTab('public'); setExpandedEndpoint(null); }}
                className={`flex-1 py-2 text-center font-mono text-[9px] uppercase font-bold tracking-wider border-r border-cardboard transition-colors ${
                  apiDocsSubTab === 'public'
                    ? 'bg-turmeric text-ink'
                    : 'bg-paperLight text-ink opacity-75 hover:bg-paper'
                }`}
              >
                🌐 Public Discovery
              </button>
              <button
                onClick={() => { setApiDocsSubTab('doctor'); setExpandedEndpoint(null); }}
                className={`flex-1 py-2 text-center font-mono text-[9px] uppercase font-bold tracking-wider border-r border-cardboard transition-colors ${
                  apiDocsSubTab === 'doctor'
                    ? 'bg-turmeric text-ink'
                    : 'bg-paperLight text-ink opacity-75 hover:bg-paper'
                }`}
              >
                🩺 Doctor Portal
              </button>
              <button
                onClick={() => { setApiDocsSubTab('admin'); setExpandedEndpoint(null); }}
                className={`flex-1 py-2 text-center font-mono text-[9px] uppercase font-bold tracking-wider transition-colors ${
                  apiDocsSubTab === 'admin'
                    ? 'bg-turmeric text-ink'
                    : 'bg-paperLight text-ink opacity-75 hover:bg-paper'
                }`}
              >
                🔑 Admin Management
              </button>
            </div>

            {/* Endpoints Lists */}
            <div className="space-y-4">
              {/* Render Public Endpoints */}
              {apiDocsSubTab === 'public' && [
                {
                  method: 'GET',
                  path: '/doctors',
                  desc: 'List verified and active veterinarians with optional specialization, city or clinic filtering.',
                  auth: 'Guest / Customer',
                  params: 'page (default: 1)\nlimit (default: 20)\nsearch (optional string)\nspecialization (optional string)\nclinic_id (optional int)\ncity (optional string)',
                  response: '{\n  "items": [\n    {\n      "id": 1,\n      "user_id": 5,\n      "specialization": "Canine Surgeon",\n      "qualification": "B.V.Sc",\n      "experience_years": 8,\n      "consultation_fee": "800.00",\n      "is_available": true\n    }\n  ],\n  "total_items": 1,\n  "total_pages": 1,\n  "page": 1,\n  "limit": 20\n}'
                },
                {
                  method: 'GET',
                  path: '/doctors/{doctor_id}/slots',
                  desc: 'Fetch 30-minute booking slots available for a veterinarian on a target date.',
                  auth: 'Guest / Customer',
                  params: 'date (YYYY-MM-DD, query param, required)',
                  response: '{\n  "doctor_id": 1,\n  "date": "2026-08-25",\n  "slots": ["09:00", "09:30", "10:00", "11:30"]\n}'
                },
                {
                  method: 'POST',
                  path: '/consultations',
                  desc: 'Book a new consultation session for a pet.',
                  auth: 'Customer (Authenticated)',
                  body: '{\n  "doctor_id": 1,\n  "pet_id": 2,\n  "consultation_date": "2026-08-25",\n  "consultation_time": "09:30"\n}',
                  response: '{\n  "id": 12,\n  "customer_id": 6,\n  "doctor_id": 1,\n  "pet_id": 2,\n  "consultation_date": "2026-08-25",\n  "consultation_time": "09:30",\n  "status": "scheduled"\n}'
                },
                {
                  method: 'GET',
                  path: '/consultations',
                  desc: 'Retrieve booked consultation history for the logged-in customer.',
                  auth: 'Customer (Authenticated)',
                  response: '{\n  "items": [\n    {\n      "id": 12,\n      "doctor_id": 1,\n      "consultation_date": "2026-08-25",\n      "status": "scheduled"\n    }\n  ],\n  "total_items": 1,\n  "total_pages": 1,\n  "page": 1,\n  "limit": 20\n}'
                },
                {
                  method: 'PATCH',
                  path: '/consultations/{consultation_id}/cancel',
                  desc: 'Request consultation cancellation.',
                  auth: 'Customer / Doctor',
                  response: '{\n  "id": 12,\n  "status": "cancelled"\n}'
                }
              ].map((ep, idx) => renderEndpointCard(ep, idx))}

              {/* Render Doctor Endpoints */}
              {apiDocsSubTab === 'doctor' && [
                {
                  method: 'GET',
                  path: '/doctor/test',
                  desc: 'Verify if the active session matches a valid doctor/admin role account.',
                  auth: 'Doctor / Admin',
                  response: '{\n  "status": "ok",\n  "message": "Doctor endpoint is accessible!"\n}'
                },
                {
                  method: 'GET',
                  path: '/doctor/profile',
                  desc: 'Fetch current profile data of the logged-in doctor.',
                  auth: 'Doctor (Authenticated)',
                  response: '{\n  "id": 1,\n  "user_id": 5,\n  "specialization": "veterinarian surgeon",\n  "qualification": "Degree in Veterinary Medicine",\n  "experience_years": 10,\n  "consultation_fee": "800.00",\n  "license_number": "da54f32",\n  "is_available": true\n}'
                },
                {
                  method: 'PATCH',
                  path: '/doctor/profile',
                  desc: 'Update logged-in doctor profile parameters.',
                  auth: 'Doctor (Authenticated)',
                  body: '{\n  "qualification": "M.V.Sc (Surgeon)",\n  "experience_years": 12,\n  "consultation_fee": "1200.00"\n}',
                  response: '{\n  "id": 1,\n  "qualification": "M.V.Sc (Surgeon)",\n  "experience_years": 12,\n  "consultation_fee": "1200.00",\n  "is_available": true\n}'
                },
                {
                  method: 'GET',
                  path: '/doctor/availabilities',
                  desc: 'Retrieve weekly schedule ranges and time grids set up by this doctor.',
                  auth: 'Doctor (Authenticated)',
                  response: '[\n  {\n    "id": 15,\n    "doctor_id": 1,\n    "day_of_week": "Monday",\n    "start_time": "09:00:00",\n    "end_time": "17:00:00"\n  }\n]'
                },
                {
                  method: 'POST',
                  path: '/doctor/availabilities',
                  desc: 'Add a new day availability slot configuration block.',
                  auth: 'Doctor (Authenticated)',
                  body: '{\n  "day_of_week": "Wednesday",\n  "start_time": "10:00",\n  "end_time": "15:00"\n}',
                  response: '{\n  "id": 18,\n  "day_of_week": "Wednesday",\n  "start_time": "10:00:00",\n  "end_time": "15:00:00"\n}'
                },
                {
                  method: 'PUT',
                  path: '/doctor/availabilities/{availability_id}',
                  desc: 'Replace details of an existing day availability schedule range.',
                  auth: 'Doctor (Authenticated)',
                  body: '{\n  "day_of_week": "Wednesday",\n  "start_time": "09:00",\n  "end_time": "12:00"\n}',
                  response: '{\n  "id": 18,\n  "day_of_week": "Wednesday",\n  "start_time": "09:00:00",\n  "end_time": "12:00:00"\n}'
                },
                {
                  method: 'PATCH',
                  path: '/doctor/availabilities/{availability_id}',
                  desc: 'Partially adjust fields of a weekly availability slot.',
                  auth: 'Doctor (Authenticated)',
                  body: '{\n  "start_time": "08:30"\n}',
                  response: '{\n  "id": 18,\n  "start_time": "08:30:00"\n}'
                },
                {
                  method: 'DELETE',
                  path: '/doctor/availabilities/{availability_id}',
                  desc: 'Delete an availability slot from the active booking pool.',
                  auth: 'Doctor (Authenticated)',
                  response: '{\n  "message": "Availability slot successfully deleted."\n}'
                },
                {
                  method: 'GET',
                  path: '/doctor/consultations',
                  desc: 'View all appointments booked with this doctor.',
                  auth: 'Doctor (Authenticated)',
                  response: '[\n  {\n    "id": 12,\n    "pet": {\n      "name": "Scooby",\n      "breed": "Labrador"\n    },\n    "consultation_date": "2026-08-25",\n    "status": "scheduled"\n  }\n]'
                },
                {
                  method: 'PATCH',
                  path: '/doctor/consultations/{consultation_id}/status',
                  desc: 'Update consultation status (e.g. mark as completed or add doctor notes).',
                  auth: 'Doctor (Authenticated)',
                  body: '{\n  "status": "completed"\n}',
                  response: '{\n  "id": 12,\n  "status": "completed"\n}'
                }
              ].map((ep, idx) => renderEndpointCard(ep, idx))}

              {/* Render Admin Endpoints */}
              {apiDocsSubTab === 'admin' && [
                {
                  method: 'GET',
                  path: '/admin/clinics',
                  desc: 'Fetch full directory list of all registered pet clinics.',
                  auth: 'Admin',
                  response: '{\n  "items": [\n    {\n      "id": 3,\n      "name": "Scooby Kitchen Vet",\n      "city": "Chennai",\n      "is_active": true\n    }\n  ],\n  "total_items": 1\n}'
                },
                {
                  method: 'POST',
                  path: '/admin/clinics',
                  desc: 'Create a new physical pet clinic profile.',
                  auth: 'Admin',
                  body: '{\n  "name": "Scooby Vet Center",\n  "address": "45 Green Street",\n  "city": "Chennai",\n  "state": "Tamil Nadu",\n  "postal_code": "600001",\n  "phone": "+91 99999 88888"\n}',
                  response: '{\n  "id": 4,\n  "name": "Scooby Vet Center",\n  "is_active": true\n}'
                },
                {
                  method: 'PATCH',
                  path: '/admin/clinics/{clinicId}',
                  desc: 'Deactivate, activate, or update details of a registered clinic.',
                  auth: 'Admin',
                  body: '{\n  "is_active": false\n}',
                  response: '{\n  "id": 4,\n  "is_active": false\n}'
                },
                {
                  method: 'GET',
                  path: '/admin/doctors',
                  desc: 'List registered veterinarians and review active doctor profiles (paginated).',
                  auth: 'Admin',
                  response: '{\n  "items": [\n    {\n      "id": 1,\n      "license_number": "dafadfaadad",\n      "is_verified": false\n    }\n  ]\n}'
                },
                {
                  method: 'POST',
                  path: '/admin/doctors',
                  desc: 'Create a new doctor profile mapped directly to a registered user account email address.',
                  auth: 'Admin',
                  body: '{\n  "user_email": "doctor@gmail.com",\n  "specialization": "veterinary surgeon",\n  "license_number": "v-12903",\n  "clinic_id": 3,\n  "consultation_fee": "800.00"\n}',
                  response: '{\n  "id": 1,\n  "user_id": 5,\n  "license_number": "v-12903",\n  "is_verified": false\n}'
                },
                {
                  method: 'PATCH',
                  path: '/admin/doctors/{doctorId}/verify',
                  desc: 'Approve doctor license credentials and toggle verification status.',
                  auth: 'Admin',
                  body: '{\n  "is_verified": true\n}',
                  response: '{\n  "id": 1,\n  "is_verified": true\n}'
                },
                {
                  method: 'PATCH',
                  path: '/admin/doctors/{doctorId}/status',
                  desc: 'Deactivate/activate doctor profiles.',
                  auth: 'Admin',
                  body: '{\n  "is_active": false\n}',
                  response: '{\n  "id": 1,\n  "is_active": false\n}'
                }
              ].map((ep, idx) => renderEndpointCard(ep, idx))}
            </div>
          </div>
        )}
      </main>

      {/* Custom Quick Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-md shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in-up relative text-left">
            <div className="flex justify-between items-start border-b border-cardboard pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">Quick Catalog Edit</span>
                <h4 className="font-display font-bold text-lg text-ink mt-0.5">{editingProduct.name}</h4>
              </div>
              <button 
                onClick={() => setEditingProduct(null)}
                className="text-ink opacity-50 hover:opacity-100 font-bold"
              >
                ✕
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updateProductMutation.mutate({
                  productId: editingProduct.id,
                  productData: {
                    price: editPrice || undefined,
                    available_stock: editStock ? Number(editStock) : undefined
                  }
                });
                setEditingProduct(null);
              }} 
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Price (INR):
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Stock Level:
                </label>
                <input
                  type="number"
                  required
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="flex-grow bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50"
                >
                  {updateProductMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="border border-cardboard font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm text-ink hover-bounce"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Configure Alert Threshold Modal */}
      {editingThresholdProduct && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-md shadow-xl max-w-sm w-full p-6 space-y-4 animate-fade-in-up relative text-left">
            <div className="flex justify-between items-start border-b border-cardboard pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">Configure Alert Levels</span>
                <h4 className="font-display font-bold text-md text-ink mt-0.5">{editingThresholdProduct.name}</h4>
              </div>
              <button 
                onClick={() => setEditingThresholdProduct(null)}
                className="text-ink opacity-50 hover:opacity-100 font-bold"
              >
                ✕
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (editingThresholdProduct.inventory_id) {
                  updateInventoryMutation.mutate({
                    inventoryId: editingThresholdProduct.inventory_id,
                    inventoryData: {
                      low_stock_threshold: Number(editThreshold)
                    }
                  });
                } else {
                  alert('This product does not have an active database inventory registry. Set stock first in edit stock dialog!');
                }
                setEditingThresholdProduct(null);
              }} 
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Low Stock Threshold:
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editThreshold}
                  onChange={(e) => setEditThreshold(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                />
                <p className="font-body text-[10px] text-ink opacity-60">The dashboard will display a warning badge when the available stock falls to or below this level.</p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={updateInventoryMutation.isPending}
                  className="flex-grow bg-paprika text-paperLight font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50"
                >
                  {updateInventoryMutation.isPending ? 'Saving...' : 'Update Threshold'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingThresholdProduct(null)}
                  className="border border-cardboard font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm text-ink hover-bounce"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
