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
  Image
} from 'lucide-react';



export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'analytics' | 'orders' | 'recipes' | 'inventory' | 'knowledge_agent' | 'banners'>('analytics');
  
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

  const { data: banners, isLoading: bannersLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: fetchAllBanners,
    enabled: activeTab === 'banners',
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
              { id: 'inventory', label: 'Inventory', icon: Boxes },
              { id: 'knowledge_agent', label: 'AI Knowledge', icon: Sparkles },
              { id: 'banners', label: 'Banners', icon: Image },
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
                        const [w, p] = part.split(':');
                        return {
                          weight: w ? w.trim() : '',
                          price: p ? parseFloat(p.trim()) : 0
                        };
                      }).filter(opt => opt.weight !== '') : undefined;

                      createProductMutation.mutate({
                        name: recipeName,
                        description: recipeDesc,
                        sku: recipeSku,
                        price: recipePrice,
                        available_stock: Number(recipeStock),
                        category_id: Number(recipeCategoryId),
                        image_url: recipeImgUrl || undefined,
                        weight_options: parsedOptions,
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
                    placeholder="Custom Weight Options (e.g. 1 Kg: 500, 5 Kg: 2200)"
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
                        return (
                          <tr key={prod.id} className="hover:bg-paper transition-colors">
                            <td className="p-4 font-bold">{prod.name}</td>
                            <td className="p-4 font-mono text-[10px]">{prod.sku}</td>
                            <td className="p-4 text-right font-mono font-bold">
                              {isRegistered ? physicalStock : <span className="opacity-45">—</span>}
                            </td>
                            <td className="p-4 text-right font-mono text-paprika">
                              {isRegistered ? (prod.reserved_stock ?? 0) : <span className="opacity-45">—</span>}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-herb">
                              {isRegistered ? (prod.available_stock ?? 0) : <span className="opacity-45">—</span>}
                            </td>
                            <td className="p-4 text-right font-mono">
                              {isRegistered ? (prod.low_stock_threshold ?? 5) : <span className="opacity-45">—</span>}
                            </td>
                            <td className="p-4 text-center">
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
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center space-x-3">
                                {isRegistered ? (
                                  <>
                                    <button
                                      onClick={() => setSelectedInventoryProductId(prod.id)}
                                      className="font-mono text-[9px] uppercase font-bold tracking-wider text-ink hover:underline"
                                    >
                                      Details
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingProduct(prod);
                                        setEditPrice(prod.price);
                                        setEditStock(String(prod.available_stock ?? ''));
                                        setEditWeightsInput(prod.weight_options ? prod.weight_options.map((opt: any) => `${opt.weight}: ${opt.price}`).join(', ') : '');
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
                                  </>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setRegisteringInventoryProduct(prod);
                                      setRegStock('10');
                                      setRegThreshold('5');
                                    }}
                                    className="font-mono text-[9px] uppercase font-bold tracking-wider text-paprika hover:underline"
                                  >
                                    Register Slot
                                  </button>
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
                  const [w, p] = part.split(':');
                  return {
                    weight: w ? w.trim() : '',
                    price: p ? parseFloat(p.trim()) : 0
                  };
                }).filter(opt => opt.weight !== '') : [];

                updateProductMutation.mutate({
                  productId: editingProduct.id,
                  productData: {
                    price: editPrice || undefined,
                    available_stock: editStock ? Number(editStock) : undefined,
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

              <div className="space-y-1.5">
                <label className="font-mono text-[9px] uppercase font-bold text-herb tracking-wide block">
                  Weight options (e.g. 1 Kg: 500, 5 Kg: 2200):
                </label>
                <input
                  type="text"
                  value={editWeightsInput}
                  onChange={(e) => setEditWeightsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-cardboard rounded-sm bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors font-mono"
                />
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
    </div>
  );
};
