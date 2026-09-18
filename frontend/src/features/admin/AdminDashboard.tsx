import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CartDrawer } from '../../components/CartDrawer';
import { Eyebrow } from '../../components/Eyebrow';
import { Header } from '../../components/Header';
import { 
  fetchAdminOrders, 
  fetchAdminConsultations,
  fetchAdminDoctors
} from '../../api/admin';
import { fetchProducts, fetchCategories, fetchCategoryById } from '../../api/products';
import { 
  createProduct, 
  deactivateProduct, 
  createCategory,
  updateCategory,
  deleteCategory,
  uploadProductImage,
  deleteProductImage,
  uploadProductGallery,
  deleteProductGalleryImage,
  updateProduct,
  updateInventory,
  fetchProductInventory,
  createInventorySlot
} from '../../api/productsAdmin';
import type { CreateProductData, InventoryUpdate } from '../../api/productsAdmin';
import { fetchRAGDocuments, uploadRAGDocument, deleteRAGDocument } from '../../api/chatbot';
import { fetchAllBanners, createBanner, updateBanner, deleteBanner } from '../../api/banners';
import { fetchAdminFeatures, updateAdminFeature } from '../../api/features';
import { 
  fetchAdminCoupons, 
  createAdminCoupon, 
  updateAdminCoupon, 
  deleteAdminCoupon 
} from '../../api/coupons';
import type { CouponCreatePayload, CouponResponse } from '../../api/coupons';
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  ClipboardList, 
  Hospital, 
  BookOpen, 
  Truck, 
  PawPrint, 
  User, 
  Boxes, 
  Sparkles, 
  Trash2, 
  FileText, 
  BarChart3, 
  TrendingUp, 
  Image, 
  Sliders, 
  ShieldCheck, 
  CheckCircle2,
  Tag,
  ChevronDown,
  ChevronUp,
  Package
} from 'lucide-react';



export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'analytics' | 'orders' | 'recipes' | 'inventory' | 'knowledge_agent' | 'banners' | 'features' | 'coupons'>('analytics');
  
  // Feature Flags Management State
  const [featureCategoryFilter, setFeatureCategoryFilter] = useState<string>('all');
  const [featureSearchQuery, setFeatureSearchQuery] = useState<string>('');
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // Form States - Coupons
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDesc, setNewCouponDesc] = useState('');
  const [newCouponType, setNewCouponType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');
  const [newCouponValue, setNewCouponValue] = useState('');
  const [newCouponMinOrder, setNewCouponMinOrder] = useState('0');
  const [newCouponMaxDiscount, setNewCouponMaxDiscount] = useState('');
  const [newCouponExpiry, setNewCouponExpiry] = useState('');
  const [newCouponUsageLimit, setNewCouponUsageLimit] = useState('');
  const [couponFormError, setCouponFormError] = useState<string | null>(null);

  const resetCouponForm = () => {
    setNewCouponCode('');
    setNewCouponDesc('');
    setNewCouponType('PERCENTAGE');
    setNewCouponValue('');
    setNewCouponMinOrder('0');
    setNewCouponMaxDiscount('');
    setNewCouponExpiry('');
    setNewCouponUsageLimit('');
    setCouponFormError(null);
  };
  
  // Form States - AI Knowledge Base
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [ragTitle, setRagTitle] = useState('');
  const [ragCategory, setRagCategory] = useState('general');
  const [isCartOpen, setIsCartOpen] = useState(false);


  // Form States - Recipe Catalog
  const [recipeName, setRecipeName] = useState('');
  const [recipeDesc, setRecipeDesc] = useState('');
  const [recipeSku, setRecipeSku] = useState('');
  const [recipePrice, setRecipePrice] = useState('');
  const [recipeStock, setRecipeStock] = useState('20');
  const [recipeCategoryId, setRecipeCategoryId] = useState('');
  const [recipeImgUrl, setRecipeImgUrl] = useState('');
  const [recipeWeightsInput, setRecipeWeightsInput] = useState('');
  const [recipeInSlider, setRecipeInSlider] = useState(false);

  // Form States - New Category
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Form States - Edit Category
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryDesc, setEditingCategoryDesc] = useState('');

  // Form States - Banners
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerLinkUrl, setBannerLinkUrl] = useState('');
  const [bannerDisplayOrder, setBannerDisplayOrder] = useState('0');
  const [bannerIsActive, setBannerIsActive] = useState(true);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // Edit State - Banners
  const [editingBannerId, setEditingBannerId] = useState<number | null>(null);
  const [editBannerTitle, setEditBannerTitle] = useState('');
  const [editBannerSubtitle, setEditBannerSubtitle] = useState('');
  const [editBannerLinkUrl, setEditBannerLinkUrl] = useState('');
  const [editBannerDisplayOrder, setEditBannerDisplayOrder] = useState('0');
  const [editBannerIsActive, setEditBannerIsActive] = useState(true);
  const [editBannerFile, setEditBannerFile] = useState<File | null>(null);

  const resetBannerForm = () => {
    setBannerTitle('');
    setBannerSubtitle('');
    setBannerLinkUrl('');
    setBannerDisplayOrder('0');
    setBannerIsActive(true);
    setBannerFile(null);
    const fileInput = document.getElementById('banner-file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // Form States - Quick Edit Modal
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editWeightsInput, setEditWeightsInput] = useState('');
  const [editInSlider, setEditInSlider] = useState(false);
  // Form States - Alert Threshold Modal
  const [editingThresholdProduct, setEditingThresholdProduct] = useState<any | null>(null);
  const [editThreshold, setEditThreshold] = useState('');

  // Form States - Warehouse Inventory Details & Slot Registry
  const [selectedInventoryProductId, setSelectedInventoryProductId] = useState<number | null>(null);
  const [registeringInventoryProduct, setRegisteringInventoryProduct] = useState<any | null>(null);
  const [regStock, setRegStock] = useState('10');
  const [regThreshold, setRegThreshold] = useState('5');
  const [expandedProductRowId, setExpandedProductRowId] = useState<number | null>(null);



  // Queries
  const { data: orders } = useQuery({
    queryKey: ['adminOrders'],
    queryFn: () => fetchAdminOrders(),
  });



  const { data: doctorsData } = useQuery({
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

  const { data: adminConsultationsData } = useQuery({
    queryKey: ['adminConsultations'],
    queryFn: () => fetchAdminConsultations(1, 100),
    enabled: activeTab === 'analytics',
  });
  const adminConsultations = adminConsultationsData?.items || [];


  const doctors = doctorsData?.items || [];
  const products = productsData?.items || [];

  // Analytics Computations
  const completedOrdersList = orders?.filter((o: any) => 
    ['COMPLETED', 'PAID', 'DELIVERED', 'SHIPPED', 'IN_TRANSIT', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY'].includes(o.status?.toUpperCase())
  ) || [];
  
  const totalSalesRevenue = completedOrdersList.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
  
  const completedConsultationsList = adminConsultations?.filter((c: any) => 
    c.status?.toUpperCase() === 'COMPLETED'
  ) || [];
  
  const totalConsultationFeesRevenue = completedConsultationsList.reduce((sum: number, c: any) => 
    sum + (Number(c.doctor?.consultation_fee) || 500), 0
  );

  const totalRegisteredPets = completedConsultationsList.length + 5; 

  const verifiedDoctorsCount = doctors.filter((d: any) => d.is_verified).length;
  const pendingDoctorsCount = doctors.filter((d: any) => !d.is_verified).length;

  const recipeSalesQuantities: Record<string, number> = {};
  completedOrdersList.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(item => {
        const name = item.product_name || 'Recipe';
        recipeSalesQuantities[name] = (recipeSalesQuantities[name] || 0) + (item.quantity || 0);
      });
    }
  });

  const topRecipesSold = Object.entries(recipeSalesQuantities)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const consultationStatuses = adminConsultations.reduce((acc: Record<string, number>, c: any) => {
    const status = c.status?.toUpperCase() || 'PENDING';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const pendingConsultationsCount = consultationStatuses['PENDING'] || 0;
  const activeConsultationsCount = (consultationStatuses['IN_PROGRESS'] || 0) + (consultationStatuses['CONFIRMED'] || 0);
  const resolvedConsultationsCount = consultationStatuses['COMPLETED'] || 0;






  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setRecipeName('');
      setRecipeDesc('');
      setRecipeSku('');
      setRecipePrice('');
      setRecipeImgUrl('');
      setRecipeWeightsInput('');
      setRecipeInSlider(false);
    }
  });

  const deactivateProductMutation = useMutation({
    mutationFn: deactivateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  const activateProductMutation = useMutation({
    mutationFn: (productId: number) => updateProduct(productId, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
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

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: number; name: string; description: string }) =>
      updateCategory(id, { name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setEditingCategoryId(null);
      alert('Category updated successfully!');
    },
    onError: (err: any) => {
      alert(`Update category failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ productId, productData }: { productId: number; productData: Partial<CreateProductData> }) => 
      updateProduct(productId, productData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
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

  const { data: productInventoryDetails, isLoading: productInventoryDetailsLoading } = useQuery({
    queryKey: ['productInventoryDetails', selectedInventoryProductId],
    queryFn: () => fetchProductInventory(selectedInventoryProductId!),
    enabled: selectedInventoryProductId !== null,
  });

  const createInventorySlotMutation = useMutation({
    mutationFn: createInventorySlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setRegisteringInventoryProduct(null);
      alert('Inventory registry tracking slot created successfully!');
    },
    onError: (err: any) => {
      alert(`Slot registration failed: ${err?.response?.data?.detail || err.message}`);
    }
  });
  const { data: categoryDetails, isLoading: categoryDetailsLoading } = useQuery({
    queryKey: ['adminCategoryDetails', editingCategoryId],
    queryFn: () => fetchCategoryById(editingCategoryId!),
    enabled: editingCategoryId !== null,
  });

  useEffect(() => {
    if (categoryDetails && editingCategoryId !== null) {
      setEditingCategoryName(categoryDetails.name);
      setEditingCategoryDesc(categoryDetails.description || '');
    }
  }, [categoryDetails, editingCategoryId]);
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

  const uploadProductGalleryMutation = useMutation({
    mutationFn: ({ productId, files }: { productId: number; files: File[] }) => 
      uploadProductGallery(productId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      alert('Gallery images uploaded successfully!');
    },
    onError: (err: any) => {
      alert(`Gallery upload failed: ${err?.response?.data?.detail || err.message}`);
    }
  });

  const deleteProductGalleryImageMutation = useMutation({
    mutationFn: ({ productId, imageId }: { productId: number; imageId: number }) => 
      deleteProductGalleryImage(productId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      alert('Gallery image removed successfully!');
    },
    onError: (err: any) => {
      alert(`Gallery image remove failed: ${err?.response?.data?.detail || err.message}`);
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

  const { data: banners = [], isLoading: bannersLoading } = useQuery({
    queryKey: ['adminBanners'],
    queryFn: fetchAllBanners,
    enabled: activeTab === 'banners',
  });

  // Feature Flags Query & Mutation
  const { data: adminFeatures = [], isLoading: isLoadingFeatures } = useQuery({
    queryKey: ['adminFeatures'],
    queryFn: fetchAdminFeatures,
    enabled: activeTab === 'features',
  });

  // Coupons Query & Mutations
  const { data: adminCoupons = [], isLoading: isLoadingCoupons } = useQuery({
    queryKey: ['adminCoupons'],
    queryFn: () => fetchAdminCoupons(),
    enabled: activeTab === 'coupons',
  });

  const createCouponMutation = useMutation({
    mutationFn: (data: CouponCreatePayload) => createAdminCoupon(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] });
      setShowCouponModal(false);
      resetCouponForm();
    },
    onError: (err: any) => {
      setCouponFormError(err.response?.data?.detail || 'Failed to create promo code.');
    },
  });

  const toggleCouponMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateAdminCoupon(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] });
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (id: number) => deleteAdminCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] });
    },
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: ({ key, is_enabled }: { key: string; is_enabled: boolean }) =>
      updateAdminFeature(key, is_enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFeatures'] });
      queryClient.invalidateQueries({ queryKey: ['featureFlags'] });
    },
    onSettled: () => {
      setTogglingKey(null);
    },
  });

  const createBannerMutation = useMutation({
    mutationFn: createBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['active-banners'] });
      resetBannerForm();
      alert('Banner created successfully!');
    },
    onError: (err: any) => {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to create banner.');
    }
  });

  const updateBannerMutation = useMutation({
    mutationFn: ({ id, formData }: { id: number, formData: FormData }) => updateBanner(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['active-banners'] });
      setEditingBannerId(null);
      alert('Banner updated successfully!');
    },
    onError: (err: any) => {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to update banner.');
    }
  });

  const deleteBannerMutation = useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      queryClient.invalidateQueries({ queryKey: ['active-banners'] });
      alert('Banner deleted successfully!');
    },
    onError: (err: any) => {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to delete banner.');
    }
  });

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="admin" onCartToggle={() => setIsCartOpen(true)} />

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
        <div className="mb-10 text-left border-b border-cardboard pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Eyebrow label="VETERINARY COMMERCE ADMINISTRATIVE CORE" />
            <h2 className="font-display font-bold text-4xl text-ink mt-1">
              Kitchen Administration Panel
            </h2>
            <p className="font-body text-xs text-ink opacity-70 mt-1.5 max-w-2xl">
              Control recipe items, platform catalog, and order shipment cycles.
            </p>
          </div>

          <button
            onClick={() => navigate('/admin/doctors')}
            className="bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-5 py-3 rounded-sm tracking-wide hover-bounce cursor-pointer shadow-xs flex items-center space-x-1.5 shrink-0"
          >
            <Hospital className="w-4 h-4" />
            <span>Manage Vets & Clinics</span>
          </button>
        </div>

        {/* Horizontal Ledger Binder Tabs */}
        <div className="flex overflow-x-auto flex-nowrap border-b border-cardboard gap-1 mb-8 scrollbar-none scroll-smooth">
          {(() => {
            const items = [
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'orders', label: 'Orders', icon: ClipboardList },
              { id: 'recipes', label: 'Recipes', icon: BookOpen },
              { id: 'coupons', label: 'Coupons & Offers', icon: Tag },
              { id: 'inventory', label: 'Inventory', icon: Boxes },
              { id: 'knowledge_agent', label: 'AI Knowledge', icon: Sparkles },
              { id: 'banners', label: 'Banners', icon: Image },
              { id: 'features', label: 'Feature Flags', icon: Sliders },
            ];

            return items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'orders') {
                      navigate('/admin/orders');
                    } else {
                      setActiveTab(item.id as any);
                    }
                  }}
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

        {/* Dashboard Viewport Core */}
        <div className="w-full relative pl-4 md:pl-6">
          {/* Notebook Spine binding dashed tab motif */}
          <div className="absolute top-0 bottom-0 left-1 border-l border-dashed border-cardboard opacity-35"></div>

          {/* Right Viewport Content */}
          <div className="w-full pl-6">

        {/* Tab 0: Analytics Overview */}
        {activeTab === 'analytics' && (
          <div className="space-y-10 text-left animate-fade-in-up">
            <div>
              <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Metrics Dashboard</span>
              <h3 className="font-display font-bold text-xl text-ink mt-0.5">Platform Performance Analytics</h3>
            </div>

            {/* Metrics Card Deck */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Sales Revenue */}
              <div className="border border-cardboard bg-paperLight p-6 rounded-none relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Paid Orders Sales</span>
                  <h4 className="font-display font-bold text-2xl text-ink tracking-tight">
                    ₹{totalSalesRevenue.toLocaleString()}
                  </h4>
                </div>
                <div className="flex items-center space-x-1.5 text-herb font-mono text-[9px] uppercase font-bold mt-4 pt-3 border-t border-cardboard border-dashed">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Recipe sales volume</span>
                </div>
              </div>

              {/* Card 2: Consultation Volume */}
              <div className="border border-cardboard bg-paperLight p-6 rounded-none relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Consultation Volume</span>
                  <h4 className="font-display font-bold text-2xl text-ink tracking-tight">
                    ₹{totalConsultationFeesRevenue.toLocaleString()}
                  </h4>
                </div>
                <div className="flex items-center space-x-1.5 text-turmeric font-mono text-[9px] uppercase font-bold mt-4 pt-3 border-t border-cardboard border-dashed">
                  <Hospital className="w-3.5 h-3.5" />
                  <span>Vet session billing</span>
                </div>
              </div>

              {/* Card 3: Active Doctors */}
              <div className="border border-cardboard bg-paperLight p-6 rounded-none relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Active Veterinarians</span>
                  <h4 className="font-display font-bold text-2xl text-ink tracking-tight">
                    {verifiedDoctorsCount} / {doctors.length}
                  </h4>
                </div>
                <div className="flex items-center space-x-1.5 text-ink opacity-70 font-mono text-[9px] uppercase font-bold mt-4 pt-3 border-t border-cardboard border-dashed">
                  <User className="w-3.5 h-3.5" />
                  <span>{pendingDoctorsCount} pending verification</span>
                </div>
              </div>

              {/* Card 4: Registered Pets */}
              <div className="border border-cardboard bg-paperLight p-6 rounded-none relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">Registered Companions</span>
                  <h4 className="font-display font-bold text-2xl text-ink tracking-tight">
                    {totalRegisteredPets}
                  </h4>
                </div>
                <div className="flex items-center space-x-1.5 text-turmeric font-mono text-[9px] uppercase font-bold mt-4 pt-3 border-t border-cardboard border-dashed">
                  <PawPrint className="w-3.5 h-3.5" />
                  <span>React registry active</span>
                </div>
              </div>
            </div>

            {/* Visual Charts Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart 1: Recipe Sales Bar Chart */}
              <div className="border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                <div className="border-b border-cardboard border-dashed pb-3">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Item Popularity</span>
                  <h3 className="font-display font-bold text-lg text-ink mt-0.5">Top-Selling Recipes</h3>
                </div>

                {topRecipesSold.length === 0 ? (
                  <div className="text-center py-16 text-ink opacity-65 font-body text-xs">
                    No orders have been placed yet to compute sales breakdown.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Handcrafted Responsive SVG Bar Chart */}
                    <div className="w-full overflow-x-auto">
                      <svg viewBox="0 0 500 240" className="w-full h-auto min-w-[400px]">
                        {/* Background Grid Lines */}
                        <line x1="50" y1="30" x2="480" y2="30" stroke="#EBE0D0" strokeDasharray="4" />
                        <line x1="50" y1="80" x2="480" y2="80" stroke="#EBE0D0" strokeDasharray="4" />
                        <line x1="50" y1="130" x2="480" y2="130" stroke="#EBE0D0" strokeDasharray="4" />
                        <line x1="50" y1="180" x2="480" y2="180" stroke="#EBE0D0" strokeDasharray="4" />
                        
                        {/* Y-Axis scale text */}
                        <text x="40" y="34" className="font-mono text-[9px] fill-ink opacity-50" textAnchor="end">Max</text>
                        <text x="40" y="84" className="font-mono text-[9px] fill-ink opacity-50" textAnchor="end">50%</text>
                        <text x="40" y="134" className="font-mono text-[9px] fill-ink opacity-50" textAnchor="end">25%</text>
                        <text x="40" y="184" className="font-mono text-[9px] fill-ink opacity-50" textAnchor="end">0%</text>

                        {/* Rendering Bars */}
                        {(() => {
                          const maxQty = Math.max(...topRecipesSold.map(r => r.qty), 1);
                          return topRecipesSold.map((r, index) => {
                            const x = 70 + index * 85;
                            const height = (r.qty / maxQty) * 140;
                            const y = 180 - height;
                            
                            return (
                              <g key={r.name} className="group">
                                {/* Interactive Bar */}
                                <rect
                                  x={x}
                                  y={y}
                                  width="45"
                                  height={height}
                                  fill="#D4AF37"
                                  fillOpacity="0.25"
                                  stroke="#2E2418"
                                  strokeWidth="1.5"
                                  className="transition-all duration-300 hover:fill-opacity-45 cursor-pointer"
                                />
                                {/* Value popup */}
                                <text
                                  x={x + 22.5}
                                  y={y - 8}
                                  className="font-mono text-[9px] fill-paprika font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                  textAnchor="middle"
                                >
                                  {r.qty} sold
                                </text>
                                {/* X-Axis name labels */}
                                <text
                                  x={x + 22.5}
                                  y="200"
                                  className="font-body text-[8px] fill-ink font-bold"
                                  textAnchor="middle"
                                >
                                  {r.name.length > 10 ? `${r.name.substring(0, 10)}...` : r.name}
                                </text>
                              </g>
                            );
                          });
                        })()}
                        
                        {/* X-Axis baseline */}
                        <line x1="50" y1="180" x2="480" y2="180" stroke="#2E2418" strokeWidth="1.5" />
                      </svg>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 border-t border-cardboard border-dashed pt-4">
                      {topRecipesSold.map((r, idx) => (
                        <div key={idx} className="bg-paper p-2 rounded-none text-center border border-cardboard border-opacity-35">
                          <span className="font-mono text-[8px] uppercase tracking-wider block text-herb font-bold">TOP {idx + 1}</span>
                          <span className="font-display font-bold text-xs text-ink block truncate">{r.name}</span>
                          <span className="font-mono text-[10px] text-paprika font-bold">{r.qty} units</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chart 2: Consultations status donut/pie chart */}
              <div className="border border-cardboard bg-paperLight p-6 rounded-none space-y-4">
                <div className="border-b border-cardboard border-dashed pb-3">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Session Traffic</span>
                  <h3 className="font-display font-bold text-lg text-ink mt-0.5">Consultation Ledger Status</h3>
                </div>

                {adminConsultations.length === 0 ? (
                  <div className="text-center py-16 text-ink opacity-65 font-body text-xs">
                    No consultations booked to evaluate load statistics.
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-around gap-6">
                      {/* SVG Pie Chart / Stacked circular segments */}
                      <svg width="140" height="140" viewBox="0 0 36 36" className="shrink-0">
                        {/* Background circle */}
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#EBE0D0" strokeWidth="3" />
                        
                        {/* Completed segment */}
                        {(() => {
                          const total = adminConsultations.length || 1;
                          const completedPct = (resolvedConsultationsCount / total) * 100;
                          const activePct = (activeConsultationsCount / total) * 100;
                          const pendingPct = (pendingConsultationsCount / total) * 100;
                          
                          let strokeOffset = 100;
                          
                          // completed
                          const stroke1 = completedPct;
                          const offset1 = strokeOffset;
                          strokeOffset -= completedPct;
                          
                          // active
                          const stroke2 = activePct;
                          const offset2 = strokeOffset;
                          strokeOffset -= activePct;
                          
                          // pending
                          const stroke3 = pendingPct;
                          const offset3 = strokeOffset;
                          
                          return (
                            <>
                              {completedPct > 0 && (
                                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#2A5C3A" strokeWidth="3.2" 
                                  strokeDasharray={`${stroke1} ${100 - stroke1}`} strokeDashoffset={offset1} />
                              )}
                              {activePct > 0 && (
                                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#D4AF37" strokeWidth="3.2" 
                                  strokeDasharray={`${stroke2} ${100 - stroke2}`} strokeDashoffset={offset2} />
                              )}
                              {pendingPct > 0 && (
                                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#A63A2B" strokeWidth="3.2" 
                                  strokeDasharray={`${stroke3} ${100 - stroke3}`} strokeDashoffset={offset3} />
                              )}
                            </>
                          );
                        })()}
                        
                        {/* Centered label */}
                        <g className="font-display font-bold">
                          <text x="18" y="18.5" className="text-[6px] fill-ink font-bold" textAnchor="middle">
                            {adminConsultations.length}
                          </text>
                          <text x="18" y="23.5" className="text-[3px] fill-ink opacity-60 uppercase font-mono font-bold" textAnchor="middle">
                            Total
                          </text>
                        </g>
                      </svg>

                      {/* Legend details */}
                      <div className="space-y-3 flex-grow text-left">
                        <div className="flex items-center justify-between border-b border-cardboard border-dashed pb-1.5">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-herb"></div>
                            <span className="font-body text-xs font-bold">Completed Ledger:</span>
                          </div>
                          <span className="font-mono text-xs font-bold text-ink">{resolvedConsultationsCount}</span>
                        </div>

                        <div className="flex items-center justify-between border-b border-cardboard border-dashed pb-1.5">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-turmeric"></div>
                            <span className="font-body text-xs font-bold">Active / Confirmed:</span>
                          </div>
                          <span className="font-mono text-xs font-bold text-ink">{activeConsultationsCount}</span>
                        </div>

                        <div className="flex items-center justify-between pb-1.5">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-paprika"></div>
                            <span className="font-body text-xs font-bold">Pending Booking:</span>
                          </div>
                          <span className="font-mono text-xs font-bold text-ink">{pendingConsultationsCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-paper p-3.5 rounded-none border border-cardboard border-dashed font-body text-[11px] text-ink opacity-85 leading-relaxed">
                      💡 **Insight Summary**: Total consultation sessions booked stand at **{adminConsultations.length}**. Currently **{activeConsultationsCount}** consultations are processing in-progress with specialists. Ensure all pending items are assigned quickly.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Orders Registry (Redirect Card) */}
        {activeTab === 'orders' && (
          <div className="border border-cardboard border-dashed bg-paperLight p-8 text-center rounded-sm max-w-xl mx-auto my-12 animate-fade-in-up">
            <ClipboardList className="w-12 h-12 text-turmeric mx-auto mb-4" />
            <Eyebrow label="VETERINARY COMMERCE ADMINISTRATIVE CORE" />
            <h4 className="font-display font-bold text-xl text-ink mt-2">Dedicated Orders Workspace</h4>
            <p className="font-body text-xs text-ink opacity-70 mt-2 leading-relaxed">
              Order processing, status confirmations, tracking carrier assignments, and shipping ledgers have migrated to a dedicated full-screen pipeline workspace.
            </p>
            <button
              onClick={() => navigate('/admin/orders')}
              className="mt-6 bg-turmeric text-ink hover:bg-opacity-95 font-body font-bold text-xs uppercase px-6 py-3 rounded-sm tracking-wide hover-bounce cursor-pointer shadow-xs flex items-center space-x-1.5 mx-auto"
            >
              <Truck className="w-4 h-4" />
              <span>Open Orders Center</span>
            </button>
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
                      className="bg-turmeric text-ink font-mono text-[9px] uppercase px-4 py-2 font-bold rounded-sm w-full flex items-center justify-center space-x-1.5 hover-bounce"
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
                        {categories.map((cat) => {
                          const isEditing = editingCategoryId === cat.id;
                          return (
                            <div key={cat.id} className="py-2.5 flex flex-col text-xs">
                              {isEditing ? (
                                <div className="space-y-2.5 w-full bg-paper p-3 border border-cardboard border-dashed my-1 relative">
                                  {categoryDetailsLoading ? (
                                    <div className="py-6 text-center space-y-1.5">
                                      <Loader2 className="w-4 h-4 text-turmeric animate-spin mx-auto" />
                                      <span className="font-mono text-[8px] uppercase tracking-wider text-ink opacity-65 block">Retrieving latest record...</span>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="space-y-1">
                                        <label className="font-mono text-[8px] uppercase font-bold text-herb block">Edit Category Name:</label>
                                        <input
                                          type="text"
                                          value={editingCategoryName}
                                          onChange={(e) => setEditingCategoryName(e.target.value)}
                                          className="bg-paperLight border border-cardboard w-full p-2 text-xs text-ink outline-none font-body rounded-sm"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="font-mono text-[8px] uppercase font-bold text-herb block">Edit Description:</label>
                                        <textarea
                                          value={editingCategoryDesc}
                                          onChange={(e) => setEditingCategoryDesc(e.target.value)}
                                          rows={2}
                                          className="bg-paperLight border border-cardboard w-full p-2 text-xs text-ink outline-none font-body rounded-sm"
                                        />
                                      </div>
                                      <div className="flex space-x-2 justify-end pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setEditingCategoryId(null)}
                                          className="px-2.5 py-1 text-[9px] font-mono uppercase bg-paper border border-cardboard text-ink font-bold hover:bg-paperLight rounded-sm"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={updateCategoryMutation.isPending}
                                          onClick={() => {
                                            if (editingCategoryName.trim() === '') {
                                              alert('Category name cannot be empty.');
                                              return;
                                            }
                                            updateCategoryMutation.mutate({
                                              id: cat.id,
                                              name: editingCategoryName,
                                              description: editingCategoryDesc
                                            });
                                          }}
                                          className="px-2.5 py-1 text-[9px] font-mono uppercase bg-turmeric text-paperLight font-bold hover:bg-opacity-95 rounded-sm flex items-center space-x-1"
                                        >
                                          {updateCategoryMutation.isPending ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <span>Save</span>
                                          )}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="flex justify-between items-center w-full">
                                  <div>
                                    <strong className="text-ink text-sm">{cat.name}</strong>
                                    <p className="text-[11px] text-ink opacity-70 mt-0.5">{cat.description}</p>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCategoryId(cat.id);
                                        setEditingCategoryName(cat.name);
                                        setEditingCategoryDesc(cat.description || '');
                                      }}
                                      className="font-mono text-[8px] uppercase font-bold text-herb hover:underline"
                                    >
                                      Edit
                                    </button>
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
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                      const parsedOptions = recipeWeightsInput ? recipeWeightsInput.split(',').map(part => {
                        const pieces = part.split(':').map(s => s.trim());
                        const w = pieces[0] || '';
                        const p = pieces[1] ? parseFloat(pieces[1]) : (parseFloat(recipePrice) || 0);
                        const s = pieces[2] !== undefined && pieces[2] !== '' ? parseInt(pieces[2], 10) : (recipeStock ? parseInt(recipeStock, 10) : undefined);
                        return {
                          weight: w,
                          price: p,
                          ...(s !== undefined && !isNaN(s) ? { stock: s, reserved: 0 } : {})
                        };
                      }).filter(opt => opt.weight !== '') : undefined;

                      // Default weight option: if no custom weights are specified, provide default 500g pack
                      const finalWeightOptions = parsedOptions && parsedOptions.length > 0
                        ? parsedOptions
                        : [{ weight: '500g', price: parseFloat(recipePrice) || 0, stock: Number(recipeStock) || 10, reserved: 0 }];

                      const totalStock = finalWeightOptions.some(opt => opt.stock !== undefined)
                        ? finalWeightOptions.reduce((sum, opt) => sum + (opt.stock || 0), 0)
                        : Number(recipeStock);

                      createProductMutation.mutate({
                        name: recipeName,
                        description: recipeDesc,
                        sku: recipeSku,
                        price: recipePrice,
                        available_stock: totalStock,
                        category_id: Number(recipeCategoryId),
                        image_url: recipeImgUrl || undefined,
                        weight_options: finalWeightOptions,
                        in_slider: recipeInSlider
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
                    placeholder="Custom Weight Options (e.g. 500g: 350: 20, 1kg: 650: 10, 5kg: 2800: 3)"
                    value={recipeWeightsInput}
                    onChange={(e) => setRecipeWeightsInput(e.target.value)}
                    className="bg-paper border border-cardboard w-full p-2.5 text-xs text-ink outline-none font-mono"
                  />

                  <input
                    placeholder="Image URL link (optional)"
                    value={recipeImgUrl}
                    onChange={(e) => setRecipeImgUrl(e.target.value)}
                    className="bg-paper border border-cardboard w-full p-2.5 text-xs text-ink outline-none font-mono"
                  />

                  <div className="flex items-center space-x-2 py-1 select-none">
                    <input
                      type="checkbox"
                      id="recipeInSlider"
                      checked={recipeInSlider}
                      onChange={(e) => setRecipeInSlider(e.target.checked)}
                      className="w-3.5 h-3.5 border border-cardboard rounded-none bg-paper accent-turmeric cursor-pointer"
                    />
                    <label htmlFor="recipeInSlider" className="font-mono text-[9px] uppercase font-bold text-herb cursor-pointer">
                      Include in Homepage Slider
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={createProductMutation.isPending}
                    className="bg-turmeric text-ink font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm w-full flex items-center justify-center space-x-1.5"
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
                          {prod.in_slider && (
                            <span className="font-mono text-[8px] uppercase tracking-wider bg-turmeric text-ink px-1 rounded-sm font-bold">
                              ✨ Slider
                            </span>
                          )}
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

                        {/* Multiple Gallery Images section */}
                        <div className="mt-4 pt-3 border-t border-cardboard border-dashed space-y-2">
                          <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-wider block">Product Gallery</span>
                          
                          {/* File input for multiple gallery files */}
                          <div className="flex items-center space-x-3">
                            <label className="font-mono text-[8px] uppercase font-bold tracking-wider bg-paper border border-cardboard px-2.5 py-1.5 rounded-sm cursor-pointer hover:bg-paperLight">
                              Add Gallery Images
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const files = e.target.files ? Array.from(e.target.files) : [];
                                  if (files.length > 0) {
                                    uploadProductGalleryMutation.mutate({ productId: prod.id, files });
                                  }
                                }}
                              />
                            </label>
                          </div>

                          {/* Gallery Thumbnail Grid */}
                          {prod.images && prod.images.length > 0 && (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1.5">
                              {prod.images.map((img) => (
                                <div key={img.id} className="relative group aspect-square border border-cardboard bg-paper rounded-sm overflow-hidden shadow-xs hover:scale-105 transition-transform duration-150">
                                  <img 
                                    src={img.image_url} 
                                    alt="Gallery item" 
                                    className="w-full h-full object-cover"
                                  />
                                  {/* Trash Icon Button - overlays on hover */}
                                  <button
                                    onClick={() => {
                                      if (confirm('Delete this gallery image?')) {
                                        deleteProductGalleryImageMutation.mutate({ productId: prod.id, imageId: img.id });
                                      }
                                    }}
                                    className="absolute inset-0 bg-ink bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-paperLight hover:text-paprika cursor-pointer"
                                    title="Remove Image"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-3 shrink-0">
                        <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-bold ${
                          prod.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {prod.is_active ? 'Active' : 'Inactive'}
                        </span>
                        
                        <div className="flex flex-row sm:flex-col items-end gap-2">
                          {prod.is_active ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingProduct(prod);
                                  setEditPrice(prod.price);
                                  setEditStock(String(prod.available_stock ?? ''));
                                  setEditWeightsInput(prod.weight_options ? prod.weight_options.map((opt: any) => `${opt.weight}: ${opt.price}`).join(', ') : '');
                                  setEditInSlider(prod.in_slider ?? false);
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
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                if (confirm(`Activate recipe "${prod.name}"?`)) {
                                  activateProductMutation.mutate(prod.id);
                                }
                              }}
                              className="font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:underline"
                            >
                              Activate
                            </button>
                          )}
                        </div>
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
                        const isRegistered = prod.inventory_id !== null && prod.available_stock !== null;
                        const lowStock = isRegistered && prod.is_active && (prod.available_stock ?? 0) <= (prod.low_stock_threshold ?? 5);
                        const physicalStock = isRegistered ? (prod.available_stock ?? 0) + (prod.reserved_stock ?? 0) : 0;
                        const hasVariants = prod.weight_options && prod.weight_options.length > 0;
                        const isExpanded = expandedProductRowId === prod.id;

                        return (
                          <React.Fragment key={prod.id}>
                            <tr className={`hover:bg-paper transition-colors ${isExpanded ? 'bg-paper/40' : ''}`}>
                              <td className="p-4 align-top">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-ink">{prod.name}</span>
                                  {hasVariants && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedProductRowId(isExpanded ? null : prod.id)}
                                      className="p-1 hover:bg-cardboard/30 rounded text-herb hover:text-ink transition-colors inline-flex items-center gap-0.5 text-[9px] font-mono uppercase font-bold"
                                      title="Toggle variant breakdown"
                                    >
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      <span>{isExpanded ? 'Hide Sizes' : 'Sizes'}</span>
                                    </button>
                                  )}
                                </div>

                                {/* Weight-Wise Pouch Stock Chips */}
                                {hasVariants ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                                    <span className="font-mono text-[8px] uppercase tracking-wider text-ink/45 font-bold">
                                      Pouch Stock:
                                    </span>
                                    {prod.weight_options!.map((opt: any) => {
                                      const vStock = opt.stock !== undefined ? Number(opt.stock) : null;
                                      const vRes = Number(opt.reserved ?? 0);
                                      const vAvail = vStock !== null ? Math.max(0, vStock - vRes) : null;
                                      const isOos = vAvail === 0;
                                      const isLow = vAvail !== null && vAvail > 0 && vAvail <= 3;

                                      return (
                                        <span
                                          key={opt.weight}
                                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border font-mono text-[10px] ${
                                            isOos
                                              ? 'bg-red-50 text-red-700 border-red-200 font-bold'
                                              : isLow
                                              ? 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                                              : 'bg-paper text-ink border-cardboard'
                                          }`}
                                          title={`${opt.weight} (₹${opt.price}): ${vStock ?? '—'} physical, ${vRes} reserved, ${vAvail ?? '—'} available to buy`}
                                        >
                                          <span className="font-bold text-herb">{opt.weight}</span>
                                          <span className="text-ink/20">|</span>
                                          <span className={isOos ? 'text-red-600 font-bold' : isLow ? 'text-amber-700 font-bold' : 'text-ink font-semibold'}>
                                            {vAvail !== null ? `${vAvail} left` : 'untracked'}
                                          </span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] text-ink/50">
                                    <span className="px-1.5 py-0.5 rounded-sm bg-paper border border-cardboard/70">
                                      Single SKU format {prod.sku.toLowerCase().includes('5kg') || prod.name.toLowerCase().includes('5kg') ? '(Fixed 5 kg)' : ''}
                                    </span>
                                  </div>
                                )}
                              </td>

                              <td className="p-4 font-mono text-[10px] align-top">{prod.sku}</td>

                              <td className="p-4 text-right font-mono align-top">
                                <span className="font-bold text-sm text-ink block">
                                  {isRegistered ? physicalStock : <span className="opacity-45">—</span>}
                                </span>
                                {hasVariants && (
                                  <span className="text-[8px] text-ink/50 block font-normal uppercase">
                                    {prod.weight_options!.length} sizes total
                                  </span>
                                )}
                              </td>

                              <td className="p-4 text-right font-mono text-paprika align-top">
                                <span className="font-bold text-sm block">
                                  {isRegistered ? (prod.reserved_stock ?? 0) : <span className="opacity-45">—</span>}
                                </span>
                              </td>

                              <td className="p-4 text-right font-mono text-herb align-top">
                                <span className="font-bold text-sm block">
                                  {isRegistered ? (prod.available_stock ?? 0) : <span className="opacity-45">—</span>}
                                </span>
                                {hasVariants && (
                                  <span className="text-[8px] text-herb/70 block font-normal uppercase">
                                    all sizes net
                                  </span>
                                )}
                              </td>

                              <td className="p-4 text-right font-mono align-top">
                                {isRegistered ? (prod.low_stock_threshold ?? 5) : <span className="opacity-45">—</span>}
                              </td>

                              <td className="p-4 text-center align-top">
                                <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold ${
                                  !prod.is_active
                                    ? 'bg-red-100 text-red-800'
                                    : !isRegistered
                                    ? 'bg-red-50 text-red-700 border border-red-200 border-dashed'
                                    : lowStock
                                    ? 'bg-yellow-100 text-yellow-800 animate-pulse'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {!prod.is_active ? 'Inactive' : !isRegistered ? '⚠️ Unregistered' : lowStock ? '⚠️ Low Stock' : '✅ Good'}
                                </span>
                              </td>

                              <td className="p-4 text-center align-top">
                                <div className="flex items-center justify-center space-x-3">
                                  {isRegistered ? (
                                    <>
                                      <button
                                        onClick={() => setSelectedInventoryProductId(prod.id)}
                                        className="font-mono text-[9px] uppercase font-bold tracking-wider text-ink hover:underline cursor-pointer"
                                      >
                                        Details
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingProduct(prod);
                                          setEditPrice(prod.price);
                                          setEditStock(String(prod.available_stock ?? ''));
                                          setEditWeightsInput(
                                            prod.weight_options 
                                              ? prod.weight_options.map((opt: any) => 
                                                  opt.stock !== undefined 
                                                    ? `${opt.weight}: ${opt.price}: ${opt.stock}` 
                                                    : `${opt.weight}: ${opt.price}`
                                                ).join(', ') 
                                              : ''
                                          );
                                        }}
                                        className="font-mono text-[9px] uppercase font-bold tracking-wider text-herb hover:underline cursor-pointer"
                                      >
                                        Edit Stock
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingThresholdProduct(prod);
                                          setEditThreshold(String(prod.low_stock_threshold ?? 5));
                                        }}
                                        className="font-mono text-[9px] uppercase font-bold tracking-wider text-turmeric hover:underline cursor-pointer"
                                      >
                                        Set Alert
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setRegisteringInventoryProduct(prod);
                                        setRegStock('10');
                                        setRegThreshold('5');
                                      }}
                                      className="font-mono text-[9px] uppercase font-bold tracking-wider text-paprika hover:underline cursor-pointer"
                                    >
                                      Register Slot
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Per-Weight Breakdown Matrix */}
                            {isExpanded && hasVariants && (
                              <tr className="bg-paper/30 border-b border-cardboard">
                                <td colSpan={8} className="p-4 pl-8">
                                  <div className="p-3.5 border border-cardboard rounded-sm bg-paperLight space-y-3">
                                    <div className="flex justify-between items-center">
                                      <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" />
                                        <span>Per-Weight Pouch Inventory & Held Units for {prod.name}</span>
                                      </span>
                                      <span className="font-mono text-[8px] text-ink/50 uppercase">
                                        {prod.weight_options!.length} pouch variants configured
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                      {prod.weight_options!.map((opt: any) => {
                                        const vStock = opt.stock !== undefined ? Number(opt.stock) : null;
                                        const vRes = Number(opt.reserved ?? 0);
                                        const vAvail = vStock !== null ? Math.max(0, vStock - vRes) : null;
                                        return (
                                          <div key={opt.weight} className="p-2.5 bg-paper border border-cardboard rounded-sm font-mono text-xs space-y-1.5">
                                            <div className="flex justify-between font-bold text-ink">
                                              <span>{opt.weight}</span>
                                              <span className="text-herb">₹{opt.price}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-ink/70">
                                              <span>Physical: <strong>{vStock ?? '—'}</strong></span>
                                              <span>Held: <strong className="text-paprika">{vRes}</strong></span>
                                            </div>
                                            <div className="pt-1 border-t border-cardboard/50 flex justify-between text-[10px] font-bold">
                                              <span>Available:</span>
                                              <span className={vAvail === 0 ? 'text-red-600' : 'text-herb'}>
                                                {vAvail ?? '—'} to buy
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
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
                    className="w-full bg-turmeric text-ink font-mono text-[9px] uppercase px-4 py-3 font-bold rounded-sm hover-bounce disabled:opacity-50 flex items-center justify-center space-x-1.5"
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

        {/* Tab 6: Banners Management */}
        {activeTab === 'banners' && (
          <div className="space-y-8 text-left animate-fade-in-up">
            <div>
              <h3 className="font-display font-bold text-xl text-ink">Homepage Banners</h3>
              <p className="font-body text-xs text-ink opacity-70 mt-0.5">
                Upload and configure the featured banners displayed on the homepage slider.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form Card */}
              <div className="lg:col-span-4 border border-cardboard bg-paperLight p-6 rounded-none space-y-5">
                <div className="border-b border-cardboard border-dashed pb-3">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Banner Management</span>
                  <h4 className="font-display font-bold text-sm text-ink mt-0.5">Upload New Banner</h4>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!bannerFile) {
                      alert('Please select a banner image file to upload.');
                      return;
                    }
                    const formData = new FormData();
                    if (bannerTitle) formData.append('title', bannerTitle);
                    if (bannerSubtitle) formData.append('subtitle', bannerSubtitle);
                    if (bannerLinkUrl) formData.append('link_url', bannerLinkUrl);
                    formData.append('display_order', bannerDisplayOrder);
                    formData.append('is_active', String(bannerIsActive));
                    formData.append('image', bannerFile);

                    createBannerMutation.mutate(formData);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Select Banner Image (Landscape, e.g. 1920x600):
                    </label>
                    <input
                      id="banner-file-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setBannerFile(e.target.files[0]);
                        }
                      }}
                    />
                  </div>

                  {bannerFile && (
                    <div className="space-y-1.5 animate-fade-in-up">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                        Selected Image Preview:
                      </label>
                      <img
                        src={URL.createObjectURL(bannerFile)}
                        alt="Selected Preview"
                        className="w-full h-32 object-cover border border-cardboard rounded-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Title (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Welcome to the Family"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Subtitle (Optional):
                    </label>
                    <textarea
                      placeholder="e.g. Premium single-source meat recipes..."
                      value={bannerSubtitle}
                      onChange={(e) => setBannerSubtitle(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric resize-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                      Link URL (Optional redirect):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. /shop or /product/1"
                      value={bannerLinkUrl}
                      onChange={(e) => setBannerLinkUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                        Display Order:
                      </label>
                      <input
                        type="number"
                        value={bannerDisplayOrder}
                        onChange={(e) => setBannerDisplayOrder(e.target.value)}
                        min="0"
                        className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-5">
                      <input
                        type="checkbox"
                        id="banner-is-active"
                        checked={bannerIsActive}
                        onChange={(e) => setBannerIsActive(e.target.checked)}
                        className="w-4 h-4 border border-cardboard text-turmeric focus:ring-turmeric rounded-none cursor-pointer"
                      />
                      <label htmlFor="banner-is-active" className="font-mono text-[9px] uppercase font-bold text-ink cursor-pointer">
                        Is Active
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={createBannerMutation.isPending}
                    className="w-full bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase font-bold py-3 tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {createBannerMutation.isPending ? 'Uploading...' : 'Save Banner'}
                  </button>
                </form>
              </div>

              {/* Banners List Index */}
              <div className="lg:col-span-8 space-y-4">
                <div className="border-b border-cardboard border-dashed pb-3 text-left">
                  <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">Active Banners Registry</span>
                  <h4 className="font-display font-bold text-sm text-ink mt-0.5">Uploaded Banners</h4>
                </div>

                {bannersLoading ? (
                  <div className="flex items-center space-x-2 text-ink opacity-60 py-10 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-turmeric" />
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Loading Banners...</span>
                  </div>
                ) : !banners || banners.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-cardboard rounded-sm bg-paper bg-opacity-35">
                    <Image className="w-8 h-8 text-cardboard mx-auto stroke-1 mb-2" />
                    <h5 className="font-display font-bold text-ink text-xs">No Banners Found</h5>
                    <p className="font-body text-[10px] text-ink opacity-70 max-w-[240px] mx-auto mt-1">
                      No banners are registered. Upload a banner image to populate the homepage slide show.
                    </p>
                  </div>
                ) : (
                  <div className="border border-cardboard bg-paperLight overflow-hidden rounded-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-body text-ink border-collapse">
                        <thead>
                          <tr className="bg-paper border-b border-cardboard font-mono text-[9px] uppercase tracking-wider text-herb text-left">
                            <th className="p-4 font-bold">Image</th>
                            <th className="p-4 font-bold">Details</th>
                            <th className="p-4 font-bold text-center">Order</th>
                            <th className="p-4 font-bold text-center">Status</th>
                            <th className="p-4 font-bold text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-cardboard divide-dashed">
                          {banners.map((b) => (
                            <tr key={b.id} className="hover:bg-paper transition-colors">
                              <td className="p-4">
                                <img
                                  src={b.image_url}
                                  alt={b.title || 'Banner'}
                                  className="w-24 h-12 object-cover border border-cardboard rounded-none"
                                />
                              </td>
                              <td className="p-4 text-left space-y-1">
                                <div className="font-bold text-xs">{b.title || 'Untitled Banner'}</div>
                                {b.subtitle && <div className="text-[10px] text-ink opacity-70 line-clamp-1">{b.subtitle}</div>}
                                {b.link_url && <div className="text-[9px] font-mono text-herb">Link: {b.link_url}</div>}
                              </td>
                              <td className="p-4 text-center font-mono text-[11px] font-bold">{b.display_order}</td>
                              <td className="p-4 text-center">
                                <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold ${
                                  b.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {b.is_active ? 'Active' : 'Disabled'}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center space-x-3">
                                  <button
                                    onClick={() => {
                                      setEditingBannerId(b.id);
                                      setEditBannerTitle(b.title || '');
                                      setEditBannerSubtitle(b.subtitle || '');
                                      setEditBannerLinkUrl(b.link_url || '');
                                      setEditBannerDisplayOrder(String(b.display_order));
                                      setEditBannerIsActive(b.is_active);
                                      setEditBannerFile(null);
                                    }}
                                    className="font-mono text-[9px] uppercase font-bold tracking-wider text-turmeric hover:underline cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this banner?')) {
                                        deleteBannerMutation.mutate(b.id);
                                      }
                                    }}
                                    className="font-mono text-[9px] uppercase font-bold tracking-wider text-paprika hover:underline cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
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

        {/* Tab 6: Feature Control Center */}
        {activeTab === 'features' && (
          <div className="space-y-8 text-left animate-fade-in-up">
            {/* Header */}
            <div className="border-b border-cardboard border-opacity-40 pb-5">
              <Eyebrow label="SYSTEM ADMIN // LIVE TOGGLE CENTER" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                <div>
                  <h3 className="font-display font-black text-2xl text-ink">
                    Platform Feature Control Center
                  </h3>
                  <p className="font-body text-xs text-ink opacity-70 mt-1 max-w-2xl">
                    Master switches to dynamically enable or disable features in real-time. Changes apply across the website immediately for all users without code changes or restarts.
                  </p>
                </div>
                <div className="flex items-center space-x-1.5 bg-herb/10 border border-herb/30 px-3 py-1.5 rounded-sm shrink-0 self-start sm:self-auto">
                  <ShieldCheck className="w-4 h-4 text-herb shrink-0" />
                  <span className="font-mono text-[10px] text-herb font-bold uppercase tracking-wider">
                    Admin Exclusive Access
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-paper p-4 border border-cardboard border-opacity-50 rounded-sm">
                <span className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold block">
                  Total Managed
                </span>
                <span className="font-display font-black text-2xl text-ink mt-0.5 block">
                  {adminFeatures.length}
                </span>
                <span className="font-mono text-[9px] text-ink/50 uppercase">Registered Capabilities</span>
              </div>
              <div className="bg-paper p-4 border border-cardboard border-opacity-50 rounded-sm">
                <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold block">
                  Active Features
                </span>
                <span className="font-display font-black text-2xl text-herb mt-0.5 block">
                  {adminFeatures.filter((f) => f.is_enabled).length}
                </span>
                <span className="font-mono text-[9px] text-ink/50 uppercase">Visible to Customers</span>
              </div>
              <div className="bg-paper p-4 border border-cardboard border-opacity-50 rounded-sm">
                <span className="font-mono text-[9px] uppercase tracking-wider text-turmeric font-bold block">
                  Paused / Disabled
                </span>
                <span className="font-display font-black text-2xl text-paprika mt-0.5 block">
                  {adminFeatures.filter((f) => !f.is_enabled).length}
                </span>
                <span className="font-mono text-[9px] text-ink/50 uppercase">Hidden / Locked</span>
              </div>
              <div className="bg-paper p-4 border border-cardboard border-opacity-50 rounded-sm">
                <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold block">
                  Propagation Speed
                </span>
                <span className="font-display font-black text-2xl text-ink mt-0.5 block">
                  &lt; 1s
                </span>
                <span className="font-mono text-[9px] text-ink/50 uppercase">Real-Time Invalidation</span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-paperLight border border-cardboard border-opacity-60 p-3.5 rounded-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shadow-2xs">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5 font-mono text-[9px] uppercase font-bold">
                {[
                  { id: 'all', label: 'All Modules' },
                  { id: 'consultations', label: '🩺 Consultations' },
                  { id: 'pets', label: '🐾 Pets' },
                  { id: 'shop', label: '🛍️ Shop' },
                  { id: 'ai', label: '🤖 AI Intelligence' },
                ].map((cat) => {
                  const isActive = featureCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFeatureCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-sm border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-paper border-turmeric text-ink shadow-2xs ring-1 ring-turmeric'
                          : 'bg-paper/40 border-cardboard border-opacity-60 text-ink/65 hover:text-ink hover:bg-paper'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Search input */}
              <div className="relative sm:w-64 shrink-0">
                <input
                  type="text"
                  placeholder="Filter by feature name or key..."
                  value={featureSearchQuery}
                  onChange={(e) => setFeatureSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 border border-cardboard border-opacity-60 rounded-sm bg-paper font-body text-xs text-ink placeholder-cardboard focus:outline-none focus:border-turmeric transition-colors"
                />
                {featureSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setFeatureSearchQuery('')}
                    className="absolute right-2 top-1.5 text-xs text-ink/50 hover:text-ink cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Feature Cards Grid */}
            {isLoadingFeatures ? (
              <div className="text-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-turmeric mx-auto" />
                <span className="font-mono text-xs uppercase tracking-wider text-ink/60 block">
                  Loading Platform Feature Registry...
                </span>
              </div>
            ) : (() => {
              const filtered = adminFeatures.filter((f) => {
                const matchCategory =
                  featureCategoryFilter === 'all' || f.category.toLowerCase() === featureCategoryFilter;
                const matchSearch =
                  !featureSearchQuery ||
                  f.name.toLowerCase().includes(featureSearchQuery.toLowerCase()) ||
                  f.key.toLowerCase().includes(featureSearchQuery.toLowerCase()) ||
                  (f.description && f.description.toLowerCase().includes(featureSearchQuery.toLowerCase()));
                return matchCategory && matchSearch;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-10 bg-paper border border-dashed border-cardboard rounded-sm text-center font-mono text-xs text-ink/60 space-y-2">
                    <p>No feature flags found matching your filter criteria.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setFeatureCategoryFilter('all');
                        setFeatureSearchQuery('');
                      }}
                      className="text-herb underline font-bold uppercase text-[10px] cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filtered.map((feature) => {
                    const isPending = togglingKey === feature.key;

                    return (
                      <div
                        key={feature.key}
                        className={`p-5 rounded-sm border transition-all shadow-2xs flex flex-col justify-between space-y-4 ${
                          feature.is_enabled
                            ? 'bg-paperLight border-cardboard border-opacity-60 hover:border-turmeric/70'
                            : 'bg-paper/40 border-dashed border-cardboard/70 opacity-80'
                        }`}
                      >
                        {/* Top: Category Tag & Key */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 border-b border-cardboard border-opacity-30 pb-2">
                            <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-xs bg-cardboard/25 text-ink">
                              {feature.category}
                            </span>
                            <span className="font-mono text-[9px] text-ink/50 truncate select-all">
                              {feature.key}
                            </span>
                          </div>

                          {/* Feature Name & Description */}
                          <div>
                            <h4 className="font-display font-bold text-base text-ink flex items-center space-x-1.5">
                              <span>{feature.name}</span>
                            </h4>
                            <p className="font-body text-xs text-ink/75 mt-1 leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        </div>

                        {/* Bottom: State & Interactive Switch */}
                        <div className="pt-3 border-t border-dashed border-cardboard border-opacity-35 flex items-center justify-between gap-3">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                feature.is_enabled ? 'bg-herb animate-pulse' : 'bg-paprika'
                              }`}
                            />
                            <div className="min-w-0">
                              <span
                                className={`font-mono text-[10px] uppercase font-bold block truncate ${
                                  feature.is_enabled ? 'text-herb' : 'text-paprika'
                                }`}
                              >
                                {feature.is_enabled ? 'Active / Visible' : 'Disabled / Hidden'}
                              </span>
                              <span className="font-mono text-[8.5px] text-ink/45 block">
                                {feature.is_enabled ? 'Available to customers' : 'Temporarily suspended'}
                              </span>
                            </div>
                          </div>

                          {/* Big Tactile Toggle Button */}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setTogglingKey(feature.key);
                              toggleFeatureMutation.mutate({
                                key: feature.key,
                                is_enabled: !feature.is_enabled,
                              });
                            }}
                            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                              feature.is_enabled ? 'bg-herb' : 'bg-cardboard'
                            }`}
                            title={`Click to ${feature.is_enabled ? 'disable' : 'enable'} ${feature.name}`}
                          >
                            <span className="sr-only">Toggle feature</span>
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                feature.is_enabled ? 'translate-x-6' : 'translate-x-0'
                              }`}
                            >
                              {isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-ink" />
                              ) : feature.is_enabled ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-herb" />
                              ) : (
                                <span className="text-[10px] text-paprika font-bold">✕</span>
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 7: Coupons & Offers Management */}
        {activeTab === 'coupons' && (
          <div className="space-y-8 text-left animate-fade-in-up">
            {/* Header with Title and Create Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-cardboard border-dashed pb-5">
              <div>
                <span className="font-mono text-[9px] uppercase font-bold text-herb tracking-widest block">
                  Promo Campaigns & Discount Ledger
                </span>
                <h3 className="font-display font-bold text-2xl text-ink mt-0.5">
                  Coupons & Promotional Offers
                </h3>
                <p className="font-body text-xs text-ink opacity-70 mt-1 max-w-xl">
                  Create, activate, and manage customer discount codes with customizable percentage or flat savings, minimum cart values, and usage caps.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetCouponForm();
                  setShowCouponModal(true);
                }}
                className="bg-turmeric hover:bg-amber-400 text-ink font-body font-bold text-xs uppercase px-5 py-3 rounded-sm tracking-wider transition-all duration-200 shadow-sm flex items-center space-x-2 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Promo Code</span>
              </button>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-paper p-4 border border-cardboard border-opacity-50 rounded-sm">
                <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold block">
                  Active Coupons
                </span>
                <span className="font-display font-black text-2xl text-herb mt-0.5 block">
                  {adminCoupons.filter((c: any) => c.is_active).length}
                </span>
                <span className="font-mono text-[9px] text-ink/50 uppercase">Ready for Checkout</span>
              </div>
              <div className="bg-paper p-4 border border-cardboard border-opacity-50 rounded-sm">
                <span className="font-mono text-[9px] uppercase tracking-wider text-turmeric font-bold block">
                  Total Redemptions
                </span>
                <span className="font-display font-black text-2xl text-ink mt-0.5 block">
                  {adminCoupons.reduce((sum: number, c: any) => sum + (c.used_count || 0), 0)}
                </span>
                <span className="font-mono text-[9px] text-ink/50 uppercase">Orders Claimed</span>
              </div>
              <div className="bg-paper p-4 border border-cardboard border-opacity-50 rounded-sm">
                <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold block">
                  Total Campaigns
                </span>
                <span className="font-display font-black text-2xl text-ink mt-0.5 block">
                  {adminCoupons.length}
                </span>
                <span className="font-mono text-[9px] text-ink/50 uppercase">All-Time Created</span>
              </div>
            </div>

            {/* Coupons Table List */}
            {isLoadingCoupons ? (
              <div className="text-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-turmeric mx-auto" />
                <span className="font-mono text-xs uppercase tracking-wider text-ink/60 block">
                  Loading Coupon Ledger...
                </span>
              </div>
            ) : adminCoupons.length === 0 ? (
              <div className="p-12 bg-paper border border-dashed border-cardboard rounded-sm text-center space-y-4">
                <Tag className="w-10 h-10 text-turmeric mx-auto opacity-70" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-base text-ink">No Coupons Configured</h4>
                  <p className="font-body text-xs text-ink opacity-70 max-w-sm mx-auto">
                    Reward your customers with festive discounts or first-time purchase codes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetCouponForm();
                    setShowCouponModal(true);
                  }}
                  className="bg-turmeric text-ink font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wider cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Coupon</span>
                </button>
              </div>
            ) : (
              <div className="border border-cardboard bg-paperLight rounded-sm overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-body text-xs">
                    <thead>
                      <tr className="border-b border-cardboard bg-paper text-ink font-mono text-[9px] uppercase tracking-wider">
                        <th className="p-3.5 pl-4 font-bold">Code / Campaign</th>
                        <th className="p-3.5 font-bold">Discount Value</th>
                        <th className="p-3.5 font-bold">Min Order</th>
                        <th className="p-3.5 font-bold">Usage / Limit</th>
                        <th className="p-3.5 font-bold">Expiry Date</th>
                        <th className="p-3.5 font-bold text-center">Status</th>
                        <th className="p-3.5 pr-4 text-right font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cardboard divide-dashed">
                      {adminCoupons.map((coupon: CouponResponse) => {
                        const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
                        return (
                          <tr key={coupon.id} className="hover:bg-paper/40 transition-colors">
                            {/* Code & Description */}
                            <td className="p-3.5 pl-4">
                              <div className="flex items-center space-x-2">
                                <span className="bg-herb/15 text-herb font-mono font-bold text-xs px-2.5 py-1 rounded-xs border border-herb/30 tracking-wider">
                                  {coupon.code}
                                </span>
                              </div>
                              {coupon.description && (
                                <p className="font-body text-[10px] text-ink opacity-65 mt-1 truncate max-w-xs">
                                  {coupon.description}
                                </p>
                              )}
                            </td>

                            {/* Discount */}
                            <td className="p-3.5 font-mono">
                              <span className="font-bold text-ink text-xs block">
                                {coupon.discount_type === 'PERCENTAGE' 
                                  ? `${coupon.discount_value}% OFF` 
                                  : `₹${parseFloat(String(coupon.discount_value)).toFixed(2)} FLAT`}
                              </span>
                              {coupon.max_discount_amount && (
                                <span className="text-[10px] text-ink opacity-60 block">
                                  Cap: ₹{parseFloat(String(coupon.max_discount_amount)).toFixed(2)}
                                </span>
                              )}
                            </td>

                            {/* Min Order */}
                            <td className="p-3.5 font-mono text-ink text-xs">
                              ₹{parseFloat(String(coupon.min_order_amount)).toFixed(2)}
                            </td>

                            {/* Usage Count / Limit */}
                            <td className="p-3.5 font-mono text-xs">
                              <span className="font-bold text-herb">{coupon.used_count}</span>
                              <span className="text-ink opacity-50">
                                {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ' (Unlimited)'}
                              </span>
                            </td>

                            {/* Expiry */}
                            <td className="p-3.5 font-mono text-[11px]">
                              {coupon.valid_until ? (
                                <span className={isExpired ? 'text-paprika font-bold' : 'text-ink'}>
                                  {new Date(coupon.valid_until).toLocaleDateString()}
                                  {isExpired && ' (Expired)'}
                                </span>
                              ) : (
                                <span className="text-ink opacity-50 font-body">Never Expires</span>
                              )}
                            </td>

                            {/* Status Toggle */}
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleCouponMutation.mutate({
                                    id: coupon.id,
                                    is_active: !coupon.is_active,
                                  })
                                }
                                className={`inline-flex items-center space-x-1 font-mono text-[9px] uppercase font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                                  coupon.is_active
                                    ? 'bg-herb/15 text-herb border-herb/30 hover:bg-herb/25'
                                    : 'bg-paprika/15 text-paprika border-paprika/30 hover:bg-paprika/25'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${coupon.is_active ? 'bg-herb' : 'bg-paprika'}`}></span>
                                <span>{coupon.is_active ? 'Active' : 'Inactive'}</span>
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 pr-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete coupon '${coupon.code}'?`)) {
                                    deleteCouponMutation.mutate(coupon.id);
                                  }
                                }}
                                className="p-1.5 text-paprika opacity-70 hover:opacity-100 hover:bg-paper rounded-sm transition-opacity cursor-pointer"
                                title="Delete Coupon"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

      </div>
    </div>
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
                const parsedOptions = editWeightsInput ? editWeightsInput.split(',').map(part => {
                  const pieces = part.split(':').map(s => s.trim());
                  const w = pieces[0] || '';
                  const p = pieces[1] ? parseFloat(pieces[1]) : 0;
                  const s = pieces[2] !== undefined && pieces[2] !== '' ? parseInt(pieces[2], 10) : undefined;
                  return {
                    weight: w,
                    price: p,
                    ...(s !== undefined && !isNaN(s) ? { stock: s, reserved: 0 } : {})
                  };
                }).filter(opt => opt.weight !== '') : [];

                const totalVariantStock = parsedOptions.some(opt => opt.stock !== undefined)
                  ? parsedOptions.reduce((sum, opt) => sum + (opt.stock || 0), 0)
                  : (editStock ? Number(editStock) : undefined);

                updateProductMutation.mutate({
                  productId: editingProduct.id,
                  productData: {
                    price: editPrice || undefined,
                    available_stock: totalVariantStock,
                    weight_options: parsedOptions.length > 0 ? parsedOptions : [],
                    in_slider: editInSlider
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
                  Total Physical Stock:
                </label>
                <input
                  type="number"
                  required
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    Pouch Variants (Weight: Price: Stock, e.g. 1kg: 650: 10, 5kg: 2500: 20):
                  </label>
                </div>
                <input
                  type="text"
                  value={editWeightsInput}
                  onChange={(e) => setEditWeightsInput(e.target.value)}
                  placeholder="e.g. 1.5 kg: 1000: 20, 3 kg: 4000: 12, 5 kg: 6000: 10"
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors font-mono"
                />

                {/* Quick Add Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="font-mono text-[8px] uppercase text-ink/50 font-bold">Quick append:</span>
                  {[
                    { label: '+ 5 kg', val: '5 kg: 3000: 10' },
                    { label: '+ 1 kg', val: '1 kg: 800: 15' },
                    { label: '+ 2 kg', val: '2 kg: 1500: 12' },
                    { label: '+ 3 kg', val: '3 kg: 2200: 10' }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setEditWeightsInput(prev => {
                          const clean = prev ? prev.trim() : '';
                          if (!clean) return preset.val;
                          return `${clean}, ${preset.val}`;
                        });
                      }}
                      className="font-mono text-[9px] px-2 py-0.5 rounded-sm border border-cardboard bg-paper hover:bg-turmeric/20 text-ink transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Live Parsed Preview Chips */}
                {editWeightsInput.trim() && (
                  <div className="p-2.5 bg-paper border border-cardboard rounded-sm space-y-1 mt-1.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-ink/50 font-bold block">
                      Parsed Variant Stock Allocation:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {editWeightsInput.split(',').map(s => s.trim()).filter(Boolean).map((part, idx) => {
                        const [w, p, s] = part.split(':').map(x => x?.trim());
                        return (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-paperLight border border-cardboard font-mono text-[10px]">
                            <span className="font-bold text-herb">{w || 'Size?'}</span>
                            <span className="text-ink/30">|</span>
                            <span className="text-ink/70">₹{p || '0'}</span>
                            <span className="text-ink/30">|</span>
                            <span className="font-bold text-ink">{s !== undefined && s !== '' ? `${s} stock` : 'no stock'}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 py-1 select-none">
                <input
                  type="checkbox"
                  id="editInSlider"
                  checked={editInSlider}
                  onChange={(e) => setEditInSlider(e.target.checked)}
                  className="w-3.5 h-3.5 border border-cardboard rounded-none bg-paperLight accent-turmeric cursor-pointer"
                />
                <label htmlFor="editInSlider" className="font-mono text-[9px] uppercase font-bold text-herb cursor-pointer">
                  Include in Homepage Slider
                </label>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="flex-grow bg-turmeric text-ink font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50"
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
                  className="flex-grow bg-turmeric text-ink font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50"
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





      {/* Warehouse Inventory Details Modal */}
      {selectedInventoryProductId !== null && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-md w-full p-6 space-y-5 animate-fade-in-up relative text-left">
            <button 
              onClick={() => setSelectedInventoryProductId(null)}
              className="absolute top-4 right-4 text-ink opacity-60 hover:opacity-100 font-bold"
            >
              ✕
            </button>

            <div className="space-y-1">
              <Eyebrow label="WAREHOUSE PHYSICAL STOCK LEDGER" />
              <h3 className="font-display font-bold text-xl text-ink">
                Warehouse Holdings Details
              </h3>
            </div>

            {productInventoryDetailsLoading ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-8 h-8 text-turmeric animate-spin mx-auto" />
                <span className="font-mono text-xs uppercase text-ink opacity-60">Auditing Holdings...</span>
              </div>
            ) : !productInventoryDetails ? (
              <p className="font-body text-xs text-ink opacity-60">Failed to load warehouse inventory details.</p>
            ) : (
              <div className="space-y-5 text-xs font-body">
                {/* General Info */}
                <div className="p-4 border border-cardboard rounded-sm bg-paper bg-opacity-50 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-ink">
                    <div>
                      <span className="text-[8px] uppercase text-herb font-bold block">PARTNER SKU</span>
                      <span className="font-bold">{products.find(p => p.id === selectedInventoryProductId)?.sku || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-herb font-bold block">RECIPE NAME</span>
                      <span className="font-bold">{products.find(p => p.id === selectedInventoryProductId)?.name || 'Product'}</span>
                    </div>
                  </div>
                </div>

                {/* Stock Breakdown Proportional Stacked Bar */}
                <div className="space-y-2">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-ink opacity-60 block">Proportional Holdings Distribution:</span>
                  
                  {productInventoryDetails.stock_quantity > 0 ? (
                    <div className="space-y-3">
                      {/* Stacked bar */}
                      <div className="h-6 w-full rounded-sm overflow-hidden flex border border-cardboard">
                        <div 
                          style={{ width: `${(productInventoryDetails.available_stock / productInventoryDetails.stock_quantity) * 100}%` }}
                          className="bg-herb h-full flex items-center justify-center text-[8px] font-mono text-paperLight font-bold"
                          title={`Available: ${productInventoryDetails.available_stock}`}
                        >
                          {productInventoryDetails.available_stock > 0 && `${Math.round((productInventoryDetails.available_stock / productInventoryDetails.stock_quantity) * 100)}%`}
                        </div>
                        <div 
                          style={{ width: `${(productInventoryDetails.reserved_quantity / productInventoryDetails.stock_quantity) * 100}%` }}
                          className="bg-paprika h-full flex items-center justify-center text-[8px] font-mono text-paperLight font-bold"
                          title={`Reserved: ${productInventoryDetails.reserved_quantity}`}
                        >
                          {productInventoryDetails.reserved_quantity > 0 && `${Math.round((productInventoryDetails.reserved_quantity / productInventoryDetails.stock_quantity) * 100)}%`}
                        </div>
                      </div>

                      {/* Legends */}
                      <div className="flex justify-between font-mono text-[9px] text-ink opacity-80 pt-1">
                        <div className="flex items-center space-x-1">
                          <span className="w-2.5 h-2.5 bg-herb inline-block rounded-sm"></span>
                          <span>Available to Buy ({productInventoryDetails.available_stock})</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2.5 h-2.5 bg-paprika inline-block rounded-sm"></span>
                          <span>Held/Reserved ({productInventoryDetails.reserved_quantity})</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center border border-dashed border-cardboard bg-paper rounded-sm font-mono text-[10px] text-ink opacity-60">
                      Zero warehouse stock logged. Register or update stock to view visual distribution.
                    </div>
                  )}
                </div>

                <hr className="border-t border-cardboard border-dashed" />

                {/* Sealed Pouch Variant Holdings Breakdown */}
                {(() => {
                  const selectedProd = products.find(p => p.id === selectedInventoryProductId);
                  if (!selectedProd?.weight_options || selectedProd.weight_options.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-ink opacity-60 block">Sealed Pouch Variant Holdings:</span>
                      <div className="border border-cardboard rounded-sm divide-y divide-cardboard divide-dashed bg-paper">
                        {selectedProd.weight_options.map((opt: any) => {
                          const vStock = opt.stock !== undefined ? opt.stock : 'N/A';
                          const vRes = opt.reserved ?? 0;
                          return (
                            <div key={opt.weight} className="p-2.5 flex justify-between items-center text-xs font-mono">
                              <span className="font-bold text-ink">{opt.weight} (₹{opt.price})</span>
                              <div className="flex space-x-3 text-[10px]">
                                <span className="text-herb font-bold">Physical: {vStock}</span>
                                <span className="text-paprika font-bold">Held: {vRes}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Quantitative statistics */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 border border-cardboard bg-paper rounded-sm">
                    <span className="font-mono text-[8px] text-cardboard font-bold block uppercase">PHYSICAL STOCK</span>
                    <span className="font-display font-bold text-lg text-ink block mt-0.5">{productInventoryDetails.stock_quantity}</span>
                  </div>
                  <div className="p-3 border border-cardboard bg-paper rounded-sm">
                    <span className="font-mono text-[8px] text-cardboard font-bold block uppercase">RESERVED COUNT</span>
                    <span className="font-display font-bold text-lg text-paprika block mt-0.5">{productInventoryDetails.reserved_quantity}</span>
                  </div>
                  <div className="p-3 border border-cardboard bg-paper rounded-sm">
                    <span className="font-mono text-[8px] text-cardboard font-bold block uppercase">NET AVAILABLE</span>
                    <span className="font-display font-bold text-lg text-herb block mt-0.5">{productInventoryDetails.available_stock}</span>
                  </div>
                </div>

                {/* Stock Health */}
                <div className="p-3 border border-cardboard rounded-sm space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-ink font-bold">STOCK HEALTH STATE</span>
                    <span className={`px-2 py-0.5 rounded-sm font-bold uppercase text-[8px] ${
                      productInventoryDetails.low_stock ? 'bg-yellow-100 text-yellow-800 animate-pulse' : 'bg-green-100 text-green-800'
                    }`}>
                      {productInventoryDetails.low_stock ? '⚠️ Low Stock warning' : '✅ Stock Level Good'}
                    </span>
                  </div>
                  {productInventoryDetails.low_stock && (
                    <p className="font-body text-[10px] text-paprika italic">
                      Holdings have dropped below threshold warn parameters configured on this product slot!
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedInventoryProductId(null)}
                  className="w-full bg-ink hover:bg-opacity-90 text-paperLight font-mono text-[9px] uppercase font-bold py-3 tracking-wider rounded-sm transition-colors text-center"
                >
                  Return to Inventory List
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register Inventory Slot Modal */}
      {registeringInventoryProduct && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-sm w-full p-6 space-y-4 animate-fade-in-up relative text-left">
            <div className="flex justify-between items-start border-b border-cardboard pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-paprika font-bold">Registry Initialization</span>
                <h4 className="font-display font-bold text-md text-ink mt-0.5">Register Inventory Slot</h4>
              </div>
              <button 
                onClick={() => setRegisteringInventoryProduct(null)}
                className="text-ink opacity-50 hover:opacity-100 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 border border-cardboard bg-paper rounded-sm font-mono text-[10px] text-ink space-y-1">
              <div><strong>Product:</strong> {registeringInventoryProduct.name}</div>
              <div><strong>SKU:</strong> {registeringInventoryProduct.sku}</div>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                createInventorySlotMutation.mutate({
                  product_id: registeringInventoryProduct.id,
                  stock_quantity: Number(regStock),
                  low_stock_threshold: Number(regThreshold)
                });
              }}
              className="space-y-4 text-xs font-body"
            >
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Initial Physical Stock Level:
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={regStock}
                  onChange={(e) => setRegStock(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Low Stock Alert Threshold:
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={regThreshold}
                  onChange={(e) => setRegThreshold(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={createInventorySlotMutation.isPending}
                  className="flex-grow bg-turmeric text-ink font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm hover-bounce disabled:opacity-50"
                >
                  {createInventorySlotMutation.isPending ? 'Registering...' : 'Register Stock Slot'}
                </button>
                <button
                  type="button"
                  onClick={() => setRegisteringInventoryProduct(null)}
                  className="border border-cardboard font-mono text-[9px] uppercase px-4 py-2.5 font-bold rounded-sm text-ink hover-bounce"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Banner Edit Modal */}
      {editingBannerId !== null && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-none shadow-xl max-w-md w-full p-6 space-y-4 animate-fade-in-up relative text-left">
            <div className="flex justify-between items-start border-b border-cardboard pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">Banner Configuration</span>
                <h4 className="font-display font-bold text-base text-ink mt-0.5">Edit Homepage Banner</h4>
              </div>
              <button 
                onClick={() => setEditingBannerId(null)}
                className="text-ink opacity-50 hover:opacity-100 font-bold cursor-pointer font-sans"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData();
                formData.append('title', editBannerTitle);
                formData.append('subtitle', editBannerSubtitle);
                formData.append('link_url', editBannerLinkUrl);
                formData.append('display_order', editBannerDisplayOrder);
                formData.append('is_active', String(editBannerIsActive));
                if (editBannerFile) {
                  formData.append('image', editBannerFile);
                }

                updateBannerMutation.mutate({ id: editingBannerId, formData });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Replace Banner Image (Optional):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setEditBannerFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs font-mono border border-cardboard p-2 bg-paperLight cursor-pointer"
                />
              </div>

              {editBannerFile && (
                <div className="space-y-1.5 animate-fade-in-up">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                    Selected Replacement Image Preview:
                  </label>
                  <img
                    src={URL.createObjectURL(editBannerFile)}
                    alt="Replacement Preview"
                    className="w-full h-32 object-cover border border-cardboard rounded-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Title:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Welcome to the Family"
                  value={editBannerTitle}
                  onChange={(e) => setEditBannerTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper text-xs text-ink focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Subtitle:
                </label>
                <textarea
                  placeholder="e.g. Premium single-source meat recipes..."
                  value={editBannerSubtitle}
                  onChange={(e) => setEditBannerSubtitle(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper text-xs text-ink focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Link URL:
                </label>
                <input
                  type="text"
                  placeholder="e.g. /shop or /product/1"
                  value={editBannerLinkUrl}
                  onChange={(e) => setEditBannerLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper text-xs text-ink focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                    Display Order:
                  </label>
                  <input
                    type="number"
                    value={editBannerDisplayOrder}
                    onChange={(e) => setEditBannerDisplayOrder(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 border border-cardboard rounded-none bg-paper text-xs text-ink focus:outline-none"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="edit-banner-is-active"
                    checked={editBannerIsActive}
                    onChange={(e) => setEditBannerIsActive(e.target.checked)}
                    className="w-4 h-4 border border-cardboard text-turmeric focus:ring-turmeric rounded-none cursor-pointer"
                  />
                  <label htmlFor="edit-banner-is-active" className="font-mono text-[9px] uppercase font-bold text-ink cursor-pointer">
                    Is Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 border-t border-cardboard border-dashed pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingBannerId(null)}
                  className="px-4 py-2 border border-cardboard rounded-none text-ink font-mono text-[9px] uppercase hover:bg-paper cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateBannerMutation.isPending}
                  className="px-4 py-2 bg-turmeric text-ink font-mono text-[9px] uppercase font-bold rounded-none hover:bg-opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {updateBannerMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Promo Code Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-ink bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paperLight border border-cardboard rounded-sm shadow-xl max-w-lg w-full p-6 space-y-4 animate-fade-in-up relative text-left">
            <div className="flex justify-between items-start border-b border-cardboard pb-3">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
                  Campaign Engine
                </span>
                <h4 className="font-display font-bold text-lg text-ink mt-0.5">
                  Create Promotional Coupon
                </h4>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowCouponModal(false);
                  resetCouponForm();
                }}
                className="text-ink opacity-50 hover:opacity-100 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Template Presets */}
            <div className="space-y-1.5 bg-paper p-3 border border-cardboard border-dashed rounded-xs">
              <span className="font-mono text-[8.5px] uppercase tracking-wider text-herb font-bold block">
                ⚡ Quick Campaign Presets:
              </span>
              <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                <button
                  type="button"
                  onClick={() => {
                    setNewCouponCode('PUPPY10');
                    setNewCouponDesc('10% discount on all fresh meal bowls');
                    setNewCouponType('PERCENTAGE');
                    setNewCouponValue('10');
                    setNewCouponMinOrder('499');
                    setNewCouponMaxDiscount('200');
                  }}
                  className="px-2.5 py-1 bg-paperLight border border-cardboard hover:border-turmeric rounded-xs text-ink cursor-pointer"
                >
                  🐶 10% First Order (Min ₹499)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCouponCode('FLAT100');
                    setNewCouponDesc('Flat ₹100 off on fresh nutrition orders');
                    setNewCouponType('FLAT');
                    setNewCouponValue('100');
                    setNewCouponMinOrder('599');
                    setNewCouponMaxDiscount('');
                  }}
                  className="px-2.5 py-1 bg-paperLight border border-cardboard hover:border-turmeric rounded-xs text-ink cursor-pointer"
                >
                  🎁 Flat ₹100 Off (Min ₹599)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCouponCode('FESTIVE20');
                    setNewCouponDesc('20% Festive Bowl Special Offer');
                    setNewCouponType('PERCENTAGE');
                    setNewCouponValue('20');
                    setNewCouponMinOrder('999');
                    setNewCouponMaxDiscount('350');
                  }}
                  className="px-2.5 py-1 bg-paperLight border border-cardboard hover:border-turmeric rounded-xs text-ink cursor-pointer"
                >
                  🎉 20% Festive Special (Min ₹999)
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCouponFormError(null);

                if (!newCouponCode.trim() || !newCouponValue) {
                  setCouponFormError('Please enter a coupon code and discount value.');
                  return;
                }

                createCouponMutation.mutate({
                  code: newCouponCode.trim().toUpperCase(),
                  description: newCouponDesc.trim() || undefined,
                  discount_type: newCouponType,
                  discount_value: parseFloat(newCouponValue),
                  min_order_amount: parseFloat(newCouponMinOrder) || 0,
                  max_discount_amount: newCouponMaxDiscount ? parseFloat(newCouponMaxDiscount) : null,
                  valid_until: newCouponExpiry ? new Date(newCouponExpiry).toISOString() : null,
                  usage_limit: newCouponUsageLimit ? parseInt(newCouponUsageLimit, 10) : null,
                  is_active: true,
                });
              }}
              className="space-y-3.5"
            >
              {couponFormError && (
                <div className="p-2.5 bg-paprika/10 border border-paprika/30 text-paprika text-xs font-body rounded-xs">
                  {couponFormError}
                </div>
              )}

              {/* Code & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PUPPY10"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-cardboard rounded-xs bg-paper font-mono text-xs text-ink uppercase tracking-wider focus:outline-none focus:border-turmeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                    Discount Type *
                  </label>
                  <select
                    value={newCouponType}
                    onChange={(e) => setNewCouponType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-cardboard rounded-xs bg-paper font-mono text-xs text-ink focus:outline-none focus:border-turmeric"
                  >
                    <option value="PERCENTAGE">Percentage (% Off)</option>
                    <option value="FLAT">Flat Amount (₹ Off)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                  Description / Campaign Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10% off for new pet parents"
                  value={newCouponDesc}
                  onChange={(e) => setNewCouponDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-xs bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric"
                />
              </div>

              {/* Values & Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                    {newCouponType === 'PERCENTAGE' ? 'Discount Rate (%) *' : 'Flat Discount (₹) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder={newCouponType === 'PERCENTAGE' ? '10' : '100'}
                    value={newCouponValue}
                    onChange={(e) => setNewCouponValue(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-xs bg-paper font-mono text-xs text-ink focus:outline-none focus:border-turmeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                    Min Cart Total (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="499"
                    value={newCouponMinOrder}
                    onChange={(e) => setNewCouponMinOrder(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-xs bg-paper font-mono text-xs text-ink focus:outline-none focus:border-turmeric"
                  />
                </div>
              </div>

              {/* Max Discount (if percentage) & Usage Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                    Max Discount Cap (₹) {newCouponType === 'PERCENTAGE' ? '' : '(Optional)'}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 200 (No cap if empty)"
                    value={newCouponMaxDiscount}
                    onChange={(e) => setNewCouponMaxDiscount(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-xs bg-paper font-mono text-xs text-ink focus:outline-none focus:border-turmeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                    Total Redemption Limit
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="e.g. 100 (Unlimited if empty)"
                    value={newCouponUsageLimit}
                    onChange={(e) => setNewCouponUsageLimit(e.target.value)}
                    className="w-full px-3 py-2 border border-cardboard rounded-xs bg-paper font-mono text-xs text-ink focus:outline-none focus:border-turmeric"
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-1">
                <label className="font-mono text-[9px] uppercase font-bold text-herb block">
                  Campaign Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={newCouponExpiry}
                  onChange={(e) => setNewCouponExpiry(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-xs bg-paper font-mono text-xs text-ink focus:outline-none focus:border-turmeric"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 border-t border-cardboard border-dashed pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCouponModal(false);
                    resetCouponForm();
                  }}
                  className="px-4 py-2 border border-cardboard rounded-xs text-ink font-mono text-[9px] uppercase hover:bg-paper cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCouponMutation.isPending}
                  className="px-5 py-2 bg-turmeric hover:bg-amber-400 text-ink font-mono text-[9px] uppercase font-bold rounded-xs tracking-wider cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {createCouponMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Publish Coupon</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
