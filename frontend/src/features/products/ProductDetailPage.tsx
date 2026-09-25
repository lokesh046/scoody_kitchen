import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProductById } from '../../api/products';
import { useAuthStore } from '../../store/auth';
import { IngredientLedger, getIngredientsForProduct } from '../../components/IngredientLedger';
import { Eyebrow } from '../../components/Eyebrow';
import { 
  ArrowLeft, Bone, ShoppingCart,
  Minus, Plus, ShieldCheck, Heart, AlertCircle,
  Star, Camera, ChevronLeft, ChevronRight, CheckCircle, Trash2, X
} from 'lucide-react';
import { useCartStore } from '../../store/cart';
import { CartDrawer } from '../../components/CartDrawer';
import { Header } from '../../components/Header';
import { fetchProductReviews, submitProductReview, deleteProductReview, checkProductReviewEligibility } from '../../api/reviews';
import type { ProductReview } from '../../api/reviews';

import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { user } = useAuthStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedWeight, setSelectedWeight] = useState<string | null>(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  // Parse ID
  const productId = id ? parseInt(id, 10) : NaN;

  // Query product data
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProductById(productId),
    enabled: !isNaN(productId),
  });

  // Query reviews data
  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: () => fetchProductReviews(productId),
    enabled: !isNaN(productId),
  });

  // Query review eligibility for logged-in user
  const { data: eligibility, refetch: refetchEligibility } = useQuery({
    queryKey: ['product-review-eligibility', productId, user?.id],
    queryFn: () => checkProductReviewEligibility(productId),
    enabled: !isNaN(productId) && !!user,
  });

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImage, setReviewImage] = useState<File | null>(null);
  const [reviewImagePreview, setReviewImagePreview] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(null);

  const DEFAULT_DOG_IMAGES = [
    'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=400',
  ];

  const handleDeleteReview = async (reviewId: number) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      await deleteProductReview(reviewId);
      refetchReviews();
      refetchEligibility();
      if (selectedReview && selectedReview.id === reviewId) {
        setSelectedReview(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete review. Please try again.");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReviewImage(file);
      setReviewImagePreview(URL.createObjectURL(file));
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmittingReview(true);
    setReviewSubmitError(null);
    setReviewSubmitSuccess(false);

    try {
      const formData = new FormData();
      formData.append('rating', String(reviewRating));
      
      // Combine Title and Comment
      const fullComment = reviewTitle.trim()
        ? `${reviewTitle.trim()}\n\n${reviewComment.trim()}`
        : reviewComment.trim();

      if (fullComment) {
        formData.append('comment', fullComment);
      }
      if (reviewImage) {
        formData.append('image', reviewImage);
      }

      await submitProductReview(productId, formData);
      setReviewSubmitSuccess(true);
      setReviewRating(5);
      setReviewTitle('');
      setReviewComment('');
      setReviewImage(null);
      setReviewImagePreview(null);
      refetchReviews();
      refetchEligibility();
      
      // Auto close the review form after success (quieter state)
      setTimeout(() => {
        setIsFormOpen(false);
      }, 1500);
    } catch (err: any) {
      setReviewSubmitError(err.response?.data?.detail || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const productImage = product?.image_url || (product?.images && product.images.length > 0 ? product.images[0].image_url : undefined);

  useDocumentMetadata(
    product?.name || "Recipe Detail",
    product?.description || "Browse veterinary-supervised ingredients and active nutritional formulas.",
    productImage
  );

  useStructuredData(
    product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description || undefined,
          image: productImage,
          sku: product.sku,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: product.price,
            availability: product.is_in_stock === false
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/InStock',
            url: window.location.origin + window.location.pathname,
          },
          ...(product.review_count && product.review_count > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: product.average_rating,
                  reviewCount: product.review_count,
                },
              }
            : {}),
        }
      : null
  );

  const availableWeights = product?.weight_options || [];
  const activeWeight = selectedWeight || (availableWeights.length > 0 ? availableWeights[0].weight : null);

  // Variant-level available stock calculation
  const activeWeightOption = availableWeights.find((opt: any) => opt.weight === activeWeight);
  const activeVariantStock = activeWeightOption && activeWeightOption.stock !== undefined
    ? Math.max(0, Number(activeWeightOption.stock) - Number(activeWeightOption.reserved || 0))
    : (product?.available_stock ?? null);

  const effectiveMaxStock = activeVariantStock !== null ? activeVariantStock : (product?.available_stock ?? 99);

  let currentPrice = product ? parseFloat(product.price) : 0;
  if (product && activeWeight && availableWeights.length > 0) {
    const match = availableWeights.find((opt: any) => opt.weight === activeWeight);
    if (match) {
      currentPrice = parseFloat(String(match.price));
    }
  }

  const handleIncrement = () => {
    if (effectiveMaxStock !== null && effectiveMaxStock !== undefined) {
      if (quantity < effectiveMaxStock) {
        setQuantity(prev => prev + 1);
      }
    } else {
      setQuantity(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      // Redirect unauthenticated user to login
      navigate('/login');
      return;
    }
    setIsAdding(true);
    const startTime = Date.now();
    try {
      await addItem(productId, quantity, activeWeight || undefined);
      
      // Enforce minimum loading time of 600ms for visual feedback
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 600 - elapsedTime);
      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 1500);
    } catch (err) {
      console.error('Failed to add item to cart:', err);
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
        {/* Full-width Top Navigation Header bar */}
        <Header activeTab="shop" onCartToggle={() => setIsCartOpen(true)} />

        {/* Main content wrapper */}
        <div className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8 relative animate-pulse">
          {/* Back Link Placeholder */}
          <div className="mb-6 pl-4">
            <div className="h-3 bg-cardboard bg-opacity-20 w-32 rounded-[3px]"></div>
          </div>

          {/* Main Recipe Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start text-left pl-4">
            {/* Left Column - Product Image Placeholder */}
            <div className="lg:col-span-6 space-y-4">
              <div className="border border-cardboard bg-paperLight p-4 rounded-sm shadow-sm">
                <div className="w-full aspect-[4/3] bg-cardboard bg-opacity-20 rounded-[4px] border border-cardboard"></div>
                {/* Gallery Thumbnails Placeholders */}
                <div className="flex gap-2 pt-4">
                  <div className="w-16 h-16 bg-cardboard bg-opacity-20 rounded-sm border border-cardboard"></div>
                  <div className="w-16 h-16 bg-cardboard bg-opacity-20 rounded-sm border border-cardboard"></div>
                </div>
              </div>
              {/* Quality Seals Placeholders */}
              <div className="grid grid-cols-2 gap-4">
                <div className="h-14 bg-cardboard bg-opacity-20 rounded-sm border border-cardboard border-dashed"></div>
                <div className="h-14 bg-cardboard bg-opacity-20 rounded-sm border border-cardboard border-dashed"></div>
              </div>
            </div>

            {/* Right Column - Recipe Card Info Placeholder */}
            <div className="lg:col-span-6">
              <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6">
                <div className="space-y-3">
                  <div className="h-3 bg-cardboard bg-opacity-20 w-1/3 rounded-[3px]"></div>
                  <div className="h-9 bg-cardboard bg-opacity-20 w-3/4 rounded-[4px]"></div>
                  <div className="h-6 bg-cardboard bg-opacity-20 w-1/4 rounded-[3px] mt-2"></div>
                </div>

                <hr className="border-t border-dashed border-cardboard" />

                {/* Ingredient breakdown lines */}
                <div className="space-y-3">
                  <div className="h-3 bg-cardboard bg-opacity-20 w-1/2 rounded-[3px]"></div>
                  <div className="flex gap-2">
                    <div className="h-5 bg-cardboard bg-opacity-20 w-12 rounded-[12px]"></div>
                    <div className="h-5 bg-cardboard bg-opacity-20 w-16 rounded-[12px]"></div>
                    <div className="h-5 bg-cardboard bg-opacity-20 w-14 rounded-[12px]"></div>
                  </div>
                </div>

                <hr className="border-t border-dashed border-cardboard" />

                {/* Description lines */}
                <div className="space-y-2">
                  <div className="h-3 bg-cardboard bg-opacity-20 w-1/3 rounded-[3px]"></div>
                  <div className="h-4 bg-cardboard bg-opacity-20 w-full rounded-[3px]"></div>
                  <div className="h-4 bg-cardboard bg-opacity-20 w-5/6 rounded-[3px]"></div>
                </div>

                <hr className="border-t border-dashed border-cardboard" />

                {/* Selector Placeholder */}
                <div className="space-y-3">
                  <div className="h-3 bg-cardboard bg-opacity-20 w-1/4 rounded-[3px]"></div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-cardboard bg-opacity-20 w-16 rounded-sm"></div>
                    <div className="h-8 bg-cardboard bg-opacity-20 w-16 rounded-sm"></div>
                  </div>
                </div>

                {/* Buy Box Placeholder */}
                <div className="pt-4 flex gap-4">
                  <div className="h-12 bg-cardboard bg-opacity-20 w-32 rounded-sm border border-cardboard"></div>
                  <div className="h-12 bg-cardboard bg-opacity-20 flex-grow rounded-sm bg-turmeric opacity-20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 w-full">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
            © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="max-w-md w-full border border-turmeric bg-paperLight p-8 rounded-sm text-center shadow-md">
          <AlertCircle className="w-12 h-12 text-paprika mx-auto mb-4" />
          <h4 className="font-display font-bold text-lg text-ink mb-2">Recipe Not Found</h4>
          <p className="font-body text-xs text-ink opacity-80 mb-6">
            The requested recipe notebook entry could not be retrieved. It may have been archived.
          </p>
          <button
            onClick={() => navigate('/shop')}
            className="bg-turmeric text-ink font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wide"
          >
            Back to Recipes
          </button>
        </div>
      </div>
    );
  }

  const ingredients = getIngredientsForProduct(product.id, product.name);
  const imageUrl = product.image_url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23FAF6EC"/><path d="M 0,20 L 300,20 M 0,40 L 300,40 M 0,60 L 300,60 M 0,80 L 300,80 M 0,100 L 300,100 M 0,120 L 300,120 M 0,140 L 300,140 M 0,160 L 300,160 M 0,180 L 300,180" stroke="%23C9BB9C" stroke-width="0.5" stroke-dasharray="2,2"/><g transform="translate(110, 45)" fill="none" stroke="%234B6B3A" stroke-width="2"><path d="M10 50 L70 50 L60 25 L20 25 Z" stroke-linejoin="round"/><ellipse cx="40" cy="25" rx="20" ry="5"/><circle cx="35" cy="21" r="2" fill="%234B6B3A"/><circle cx="45" cy="22" r="2.5" fill="%234B6B3A"/><circle cx="40" cy="19" r="1.5" fill="%234B6B3A"/><path d="M 12 10 Q 5 5 0 10 Q -5 15 0 20 Q 5 25 12 20 L 68 20 Q 75 25 80 20 Q 85 15 80 10 Q 75 5 68 10 Z" transform="translate(-5, -20) rotate(-15 40 25)"/></g><text x="50%" y="80%" font-family="monospace" font-size="11" font-weight="bold" fill="%232E2418" dominant-baseline="middle" text-anchor="middle">🐾 SCOOBY’S KITCHEN 🐾</text><text x="50%" y="90%" font-family="monospace" font-size="9" fill="%234B6B3A" dominant-baseline="middle" text-anchor="middle">Canine Tested Recipe</text></svg>';
  const currentDisplayImage = selectedImage || imageUrl;
  
  const isOutOfStock = activeVariantStock !== null 
    ? activeVariantStock === 0 
    : product.available_stock === 0;

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      {/* Full-width Top Navigation Header bar */}
      <Header activeTab="shop" onCartToggle={() => setIsCartOpen(true)} />

      {/* Main content wrapper */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8 relative">
        {/* Notebook Spine Motif */}
        <div className="absolute left-1 top-0 bottom-0 border-l border-dashed border-cardboard opacity-35 hidden md:block"></div>

        {/* Back Link */}
        <div className="mb-6 pl-4">
          <button
            onClick={() => navigate('/shop')}
            className="font-mono text-[11px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Product Ledger</span>
          </button>
        </div>

        {/* Main Recipe Detail Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start text-left pl-4">
        {/* Left Column - Product Image */}
        <div className="lg:col-span-6 space-y-4">
          <div className="border border-cardboard bg-paperLight p-4 rounded-sm shadow-sm">
            <div className="torn-edge relative w-full aspect-[4/3] bg-paper overflow-hidden border border-cardboard">
              <img
                src={currentDisplayImage}
                alt={product.name}
                className={`w-full h-full object-cover transition-all duration-300 ${
                  !product.is_active ? 'grayscale opacity-50' : 'hover:scale-[1.03]'
                }`}
              />
              {/* Category Tag */}
              {product.category?.name && (
                <div className="absolute top-4 left-4 bg-paprika text-paperLight font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm">
                  {product.category.name}
                </div>
              )}
              {/* Deactivated Tag */}
              {!product.is_active && (
                <div className="absolute top-4 left-4 mt-7 bg-turmeric text-ink font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold shadow-sm animate-pulse">
                  Deactivated
                </div>
              )}
              {/* Canine Approved Stamp */}
              <div className="absolute top-4 right-4 bg-turmeric text-paperLight font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm flex items-center space-x-1 shadow-sm">
                <Bone className="w-2.5 h-2.5" />
                <span>Dog Tested</span>
              </div>
            </div>

            {/* Gallery Thumbnails */}
            {product.images && product.images.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4">
                {/* Hero Image Thumbnail */}
                {product.image_url && (
                  <button
                    onClick={() => setSelectedImage(product.image_url)}
                    className={`relative w-16 h-16 aspect-square border rounded-sm overflow-hidden bg-paper transition-all duration-150 cursor-pointer ${
                      currentDisplayImage === product.image_url
                        ? 'border-turmeric ring-1 ring-turmeric'
                        : 'border-cardboard hover:border-ink opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={product.image_url} 
                      alt="Main thumbnail" 
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}
                {/* Gallery Image Thumbnails */}
                {product.images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img.image_url)}
                    className={`relative w-16 h-16 aspect-square border rounded-sm overflow-hidden bg-paper transition-all duration-150 cursor-pointer ${
                      currentDisplayImage === img.image_url
                        ? 'border-turmeric ring-1 ring-turmeric'
                        : 'border-cardboard hover:border-ink opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={img.image_url} 
                      alt="Gallery thumbnail" 
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quality Seals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-cardboard border-dashed p-3 rounded-sm flex items-center space-x-2.5 bg-paperLight bg-opacity-40">
              <ShieldCheck className="w-5 h-5 text-paprika shrink-0" />
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-paprika block leading-tight">Human-Grade</span>
                <span className="font-body text-xs text-ink opacity-80 leading-none">100% Sourced Food</span>
              </div>
            </div>
            <div className="border border-cardboard border-dashed p-3 rounded-sm flex items-center space-x-2.5 bg-paperLight bg-opacity-40">
              <Heart className="w-5 h-5 text-paprika shrink-0" />
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-paprika block leading-tight">Canine Tested</span>
                <span className="font-body text-xs text-ink opacity-80 leading-none">Vol. 07 Formula Approved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Recipe Card Info */}
        <div className="lg:col-span-6">
          <div className="bg-paperLight border border-cardboard p-8 rounded-sm shadow-md space-y-6 relative overflow-hidden">
            {/* Page Tab */}
            <div className="absolute top-0 right-8 bg-cardboard bg-opacity-35 text-ink font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-b-sm border-x border-b border-cardboard font-bold">
              RECIPE NO. 0{product.id}
            </div>

            {!product.is_active && (
              <div className="bg-red-50 border border-turmeric border-opacity-35 p-4 rounded-sm flex items-start space-x-2.5 text-paprika text-xs font-body mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">This product has been deactivated.</strong>
                  Only administrators can view this page. Customers will not see this recipe in the shop catalog.
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Eyebrow label="NUTRITIONAL COMPOSITION LEDGER" />
              <h2 className="font-display font-bold text-3xl text-ink leading-tight">
                {product.name}
              </h2>
              
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <span className="font-mono font-bold text-turmeric text-2xl">
                  ₹{currentPrice.toFixed(2)}
                </span>
                
                {/* Stock Status Badge */}
                {!product.is_active ? (
                  <span className="font-mono text-[10px] font-bold text-paprika bg-red-50 border border-turmeric border-opacity-35 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    Deactivated
                  </span>
                ) : isOutOfStock ? (
                  <span className="font-mono text-[10px] font-bold text-paprika bg-red-50 border border-paprika border-opacity-35 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    {activeWeight ? `${activeWeight} Sold Out` : 'Out of Stock'}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] font-bold text-paprika bg-emerald-50 border border-herb border-opacity-35 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    In Stock ({activeVariantStock !== null ? `${activeVariantStock} packs left` : product.available_stock !== null ? `${product.available_stock} packs left` : 'Fresh Batch'})
                  </span>
                )}
              </div>
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            {/* Monospace Ingredient Ledger */}
            <div className="space-y-3">
              <span className="font-mono text-[11px] uppercase font-bold text-paprika tracking-wide block">
                🐾 Formula Ingredient Breakdown:
              </span>
              <IngredientLedger ingredients={ingredients} />
            </div>

            <hr className="border-t border-dashed border-cardboard" />

            {/* Description */}
            <div className="space-y-2 text-left">
              <span className="font-mono text-[11px] uppercase font-bold text-paprika tracking-wide block">
                Nutritionist Notes:
              </span>
              <p className="font-body text-sm md:text-base text-ink opacity-90 leading-relaxed">
                {product.description || 'Our original slow-cooked formula designed specifically for adult dogs with sensitive skin or digestive issues. Prepared under low heat to capture full nutritional value, containing zero wheat, soy, or corn byproducts.'}
              </p>
            </div>

            {/* Pack Size Selector */}
            {availableWeights.length > 0 && (
              <>
                <hr className="border-t border-dashed border-cardboard" />
                <div className="space-y-3 text-left">
                  <span className="font-mono text-[11px] uppercase font-bold text-paprika tracking-wide block">
                    Pack Size:
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {availableWeights.map((opt: any) => {
                      const variantStock = opt.stock !== undefined ? Math.max(0, Number(opt.stock) - Number(opt.reserved || 0)) : null;
                      const isVariantSoldOut = variantStock !== null && variantStock === 0;
                      const isLowStock = variantStock !== null && variantStock > 0 && variantStock <= 3;

                      return (
                        <button
                          key={opt.weight}
                          disabled={isVariantSoldOut}
                          onClick={() => {
                            setSelectedWeight(opt.weight);
                            setQuantity(1);
                          }}
                          className={`font-mono text-xs uppercase font-bold px-4 py-2 rounded-sm border transition-all duration-150 relative ${
                            isVariantSoldOut
                              ? 'border-cardboard border-dashed text-cardboard bg-paper cursor-not-allowed opacity-50 line-through'
                              : activeWeight === opt.weight
                              ? 'border-turmeric text-turmeric bg-paperLight ring-1 ring-turmeric shadow-xs cursor-pointer'
                              : 'border-cardboard text-ink opacity-80 hover:opacity-100 hover:border-ink bg-paper cursor-pointer'
                          }`}
                        >
                          <span>{opt.weight}</span>
                          {isVariantSoldOut ? (
                            <span className="text-[7px] text-paprika block font-normal no-underline uppercase">Sold Out</span>
                          ) : isLowStock ? (
                            <span className="text-[7px] text-turmeric block font-normal uppercase">Only {variantStock} left</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Buy Box */}
            <div className="pt-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              {/* Quantity Selector */}
              <div className="flex items-center justify-between border border-cardboard bg-paperLight rounded-sm p-1 sm:w-32 shrink-0">
                <button
                  onClick={handleDecrement}
                  disabled={quantity <= 1 || isOutOfStock || !product.is_active}
                  aria-label="Decrease quantity"
                  className="p-1.5 hover:bg-paper rounded-sm text-ink disabled:opacity-30"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-sm px-4 text-ink">
                  {quantity}
                </span>
                <button
                  onClick={handleIncrement}
                  disabled={isOutOfStock || !product.is_active}
                  aria-label="Increase quantity"
                  className="p-1.5 hover:bg-paper rounded-sm text-ink disabled:opacity-30"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Cart CTA */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAdding || !product.is_active}
                className={`flex-grow font-body font-bold text-xs uppercase py-3.5 px-6 rounded-sm tracking-wide transition-all duration-300 shadow-sm flex items-center justify-center space-x-2 ${
                  !product.is_active
                    ? 'bg-cardboard bg-opacity-35 text-ink text-opacity-50 cursor-not-allowed border border-cardboard border-opacity-30'
                    : isAdded
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-turmeric hover:bg-opacity-95 text-ink'
                } disabled:opacity-50`}
              >
                {isAdding ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Adding...</span>
                  </>
                ) : isAdded ? (
                  <span>Added! 🐾</span>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    <span>{!product.is_active ? 'Unavailable' : isOutOfStock ? 'Sold Out' : 'Shop the Recipe'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

        {/* Reviews Section */}
        {(() => {
          const reviewsList = reviewsData?.items || [];
          const totalCount = reviewsData?.total || reviewsList.length;

          const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          reviewsList.forEach((r) => {
            const ratingVal = Math.round(r.rating);
            if (ratingVal >= 1 && ratingVal <= 5) {
              starCounts[ratingVal as 5 | 4 | 3 | 2 | 1] += 1;
            }
          });

          return (
            <section className="mt-16 border-t border-cardboard border-opacity-30 pt-16 text-left space-y-12">
              
              {/* Customer Reviews Header Panel (Image 1 style) */}
              <div className="bg-paper border border-cardboard p-8 rounded-none space-y-8 shadow-xs">
                <div className="text-center">
                  <h3 className="font-display font-black text-2xl uppercase tracking-tight text-ink">
                    Customer Reviews
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center divide-y md:divide-y-0 md:divide-x divide-cardboard divide-opacity-30">
                  
                  {/* Column 1: Average Score */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center space-y-2 text-center pb-6 md:pb-0">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-display font-black text-4xl text-ink">
                        {product.average_rating ? product.average_rating.toFixed(2) : '0.00'}
                      </span>
                      <span className="font-mono text-xs text-ink opacity-80 mt-2">out of 5</span>
                    </div>
                    
                    <div className="flex space-x-1 justify-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5.5 h-5.5 ${
                            star <= (product.average_rating || 0)
                              ? 'fill-[#00b67a] text-[#00b67a]'
                              : 'text-cardboard opacity-45'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-center space-x-1.5 pt-1">
                      <span className="font-body text-xs text-ink opacity-70">
                        Based on {product.review_count || 0} reviews
                      </span>
                      {(product.review_count || 0) > 0 && (
                        <CheckCircle className="w-4 h-4 fill-[#00b67a] text-white shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Column 2: Star Breakdown Progress Bars */}
                  <div className="md:col-span-5 flex flex-col justify-center space-y-2 px-0 md:px-8 py-6 md:py-0">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = starCounts[stars as 5 | 4 | 3 | 2 | 1];
                      const percent = totalCount > 0 ? (count / totalCount) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center space-x-3 text-xs">
                          {/* Stars count */}
                          <div className="flex space-x-0.5 w-[75px] justify-end shrink-0">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= stars ? 'fill-[#00b67a] text-[#00b67a]' : 'text-cardboard opacity-20'
                                }`}
                              />
                            ))}
                          </div>
                          {/* Progress Bar */}
                          <div className="flex-grow h-2.5 bg-paperLight border border-cardboard border-opacity-40 rounded-none overflow-hidden relative">
                            <div
                              className="h-full bg-[#00b67a] transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          {/* Review Count */}
                          <span className="w-8 text-left font-mono text-[10px] text-ink opacity-75 shrink-0 pl-1">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Column 3: Write a Review Button */}
                  <div className="md:col-span-3 flex items-center justify-center pt-6 md:pt-0">
                    {(!user || eligibility?.reason !== 'already_reviewed') && (
                      <div className="text-center w-full max-w-[200px]">
                        <button
                          type="button"
                          onClick={() => setIsFormOpen(true)}
                          className="bg-[#00b67a] hover:bg-opacity-95 text-white font-display font-bold text-xs uppercase px-8 py-3.5 tracking-wide transition-colors shadow-sm select-none border-0 cursor-pointer w-full"
                        >
                          Write a review
                        </button>
                        {user && eligibility?.eligible && (
                          <span className="font-mono text-[9px] text-[#00b67a] font-bold mt-2 block uppercase tracking-wider">
                            {((eligibility?.purchase_count || 0) - (eligibility?.review_count || 0))} {((eligibility?.purchase_count || 0) - (eligibility?.review_count || 0)) === 1 ? 'review' : 'reviews'} remaining
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Write a Review Section (Image 2 style) */}
              {isFormOpen && (
                <div className="bg-paper border border-cardboard p-8 rounded-none space-y-6 max-w-2xl mx-auto animate-fade-in shadow-sm">
                  {!user ? (
                    <div className="text-center space-y-4">
                      <h4 className="font-display font-bold text-lg text-ink uppercase">Write a review</h4>
                      <p className="font-body text-xs text-ink opacity-80">
                        You must be logged in as a customer to review this recipe formulation.
                      </p>
                      <div className="flex justify-center space-x-3">
                        <button
                          onClick={() => navigate('/login')}
                          className="bg-[#00b67a] text-white hover:bg-opacity-95 font-mono text-[9px] uppercase font-bold px-4 py-2 cursor-pointer transition-colors border-0"
                        >
                          Navigate to Login Log
                        </button>
                        <button
                          onClick={() => setIsFormOpen(false)}
                          className="border border-cardboard hover:bg-paperLight text-ink font-mono text-[9px] uppercase font-bold px-4 py-2 cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : !eligibility?.eligible ? (
                    <div className="text-center space-y-4">
                      <h4 className="font-display font-bold text-lg text-ink uppercase">Review Form Status</h4>
                      {eligibility?.reason === 'no_purchase' ? (
                        <p className="font-body text-xs text-ink opacity-85 leading-relaxed">
                          Only verified buyers who have purchased this recipe can leave a review. Formulated recipes are open to public reviews from buyers.
                        </p>
                      ) : (
                        <p className="font-body text-xs text-ink opacity-85 leading-relaxed">
                          🐾 Thank you! You have already reviewed your purchase of this recipe. If you buy this recipe again in the future, you can leave another review.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="border border-cardboard hover:bg-paperLight text-ink font-mono text-[9px] uppercase font-bold px-4 py-2 cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit} className="space-y-6 text-center">
                      <div className="space-y-3">
                        <h4 className="font-display font-black text-xl text-ink uppercase">Write a review</h4>
                        {(() => {
                          const remaining = (eligibility?.purchase_count || 0) - (eligibility?.review_count || 0);
                          if (remaining <= 0) return null;
                          return (
                            <div className="bg-[#00b67a]/5 border border-[#00b67a]/25 text-[#00b67a] text-[9px] font-mono py-1.5 px-3 tracking-wide uppercase rounded-xs inline-block font-black select-none">
                              Verified Purchase: {remaining} {remaining === 1 ? 'review' : 'reviews'} remaining
                            </div>
                          );
                        })()}
                      </div>

                      {/* Rating selection */}
                      <div className="space-y-1.5">
                        <span className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Rating</span>
                        <div className="flex justify-center space-x-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              className="hover:scale-110 transition-transform cursor-pointer border-0 bg-transparent p-0"
                            >
                              <Star
                                className={`w-8 h-8 ${
                                  star <= reviewRating
                                    ? 'fill-[#00b67a] text-[#00b67a]'
                                    : 'text-[#00b67a] opacity-30 text-opacity-100'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Review Title */}
                      <div className="space-y-1.5 text-left">
                        <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Review Title</label>
                        <input
                          type="text"
                          placeholder="Give your review a title"
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          maxLength={100}
                          className="w-full px-3 py-2 border border-cardboard rounded-none bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1"
                        />
                      </div>

                      {/* Review Content */}
                      <div className="space-y-1.5 text-left">
                        <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Review content</label>
                        <textarea
                          placeholder="Start writing here..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          maxLength={1000}
                          rows={5}
                          className="w-full px-3 py-2 border border-cardboard rounded-none bg-paperLight font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 resize-none"
                          required
                        />
                      </div>

                      {/* Picture/Video upload */}
                      <div className="space-y-2 text-left">
                        <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Picture/Video (optional)</label>
                        <div className="flex flex-col items-center justify-center border border-dashed border-cardboard p-6 bg-paperLight hover:bg-cardboard hover:bg-opacity-5 transition-colors relative cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <Camera className="w-8 h-8 text-cardboard mb-2 stroke-1" />
                          <span className="font-mono text-[9px] uppercase tracking-wider text-ink opacity-70">
                            {reviewImage ? reviewImage.name : 'Upload review photo'}
                          </span>
                        </div>
                        {reviewImagePreview && (
                          <div className="relative w-20 h-20 border border-cardboard bg-paper p-1 rounded-none mt-2 mx-auto">
                            <img src={reviewImagePreview} alt="Upload preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setReviewImage(null);
                                setReviewImagePreview(null);
                              }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-paprika text-white rounded-full flex items-center justify-center text-[9px] font-mono cursor-pointer border-none"
                            >
                              &times;
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Display name */}
                      <div className="space-y-1.5 text-left">
                        <label className="font-mono text-[10px] uppercase font-bold text-ink opacity-85 block">Display name</label>
                        <div className="px-3 py-2 border border-cardboard bg-paperLight font-body text-xs text-ink opacity-70">
                          {user ? `${user.first_name} ${user.last_name}` : 'Anonymous'} (displayed publicly)
                        </div>
                      </div>

                      {reviewSubmitError && (
                        <p className="font-mono text-[9px] uppercase font-bold text-paprika">
                          Error: {reviewSubmitError}
                        </p>
                      )}

                      {reviewSubmitSuccess && (
                        <p className="font-mono text-[9px] uppercase font-bold text-herb">
                          Review submitted successfully! Thank you.
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-center space-x-4 pt-4 border-t border-cardboard border-opacity-30">
                        <button
                          type="submit"
                          disabled={isSubmittingReview}
                          className="bg-[#00b67a] hover:bg-opacity-95 text-white font-display font-bold text-xs uppercase px-6 py-3.5 tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-sm border-none"
                        >
                          {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsFormOpen(false)}
                          className="border border-cardboard hover:bg-paperLight text-ink font-mono text-[10px] uppercase font-bold px-6 py-3.5 cursor-pointer transition-colors"
                        >
                          Cancel Review
                        </button>
                      </div>

                    </form>
                  )}
                </div>
              )}


          {/* Dotted full-width divider */}
          <hr className="border-t border-dashed border-cardboard w-full mt-10" />

          {/* Bottom Panel: Full Width Reviews Carousel (Banner style) */}
          <div className="w-full space-y-6 text-left">
            <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2 border-b border-cardboard pb-3">
              <h4 className="font-display font-black text-2xl uppercase tracking-tight text-ink">
                Ledger Reviews ({reviewsData?.total || 0})
              </h4>
              <p className="font-mono text-[10px] text-herb uppercase tracking-widest font-bold">
                // SECURE CANINE FEEDBACK LEDGER
              </p>
            </div>

            {!reviewsData || reviewsData.items.length === 0 ? (
              <div className="py-12 border border-cardboard border-dashed bg-paperLight flex flex-col items-center justify-center space-y-2 rounded-none">
                <span className="font-mono text-[10px] uppercase font-bold text-cardboard tracking-widest">// EMPTY FEED LOG</span>
                <p className="font-body text-xs text-ink opacity-70">
                  No canine feedback log entries yet. Be the first to publish a review!
                </p>
              </div>
            ) : (
              <div className="relative group px-1">
                {/* Scroll Left Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (scrollContainerRef.current) {
                      scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
                    }
                  }}
                  className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center border border-cardboard bg-paper hover:bg-turmeric hover:border-ink transition-all cursor-pointer opacity-80 hover:opacity-100 shadow-sm"
                  aria-label="Scroll reviews left"
                >
                  <ChevronLeft className="w-5 h-5 text-ink" />
                </button>

                {/* Scrollable Row */}
                <div
                  ref={scrollContainerRef}
                  className="flex gap-6 overflow-x-auto scrollbar-none py-4 px-2 snap-x snap-mandatory"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {reviewsData.items.map((rev, index) => {
                    const displayImage = rev.image_url || DEFAULT_DOG_IMAGES[index % DEFAULT_DOG_IMAGES.length];
                    return (
                      <div
                        key={rev.id}
                        onClick={() => setSelectedReview(rev)}
                        className="w-[320px] md:w-[360px] border-double border-4 border-cardboard hover:border-turmeric bg-paper p-6 rounded-none flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-300 snap-start shrink-0 select-none group/card"
                      >
                        <div className="space-y-4">
                          {/* Review Picture */}
                          <div className="w-full aspect-square overflow-hidden bg-paperLight border border-cardboard border-opacity-30 relative">
                            <img
                              src={displayImage}
                              alt={`Review`}
                              className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                            {user?.role === 'admin' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReview(rev.id);
                                }}
                                className="absolute top-2 right-2 bg-paprika hover:bg-opacity-95 text-white p-2 rounded-sm hover:scale-110 transition-transform cursor-pointer shadow-md z-20 flex items-center justify-center border border-cardboard"
                                title="Delete Review"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Stars */}
                          <div className="flex space-x-1 justify-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-5 h-5 ${
                                  star <= rev.rating ? 'fill-[#00b67a] text-[#00b67a]' : 'text-cardboard opacity-40'
                                }`}
                              />
                            ))}
                          </div>

                          {/* Review Body Snippet */}
                          <p className="font-body text-xs text-ink opacity-85 leading-relaxed text-center italic line-clamp-3">
                            "{rev.comment || 'No comment provided.'}"
                          </p>
                        </div>

                        <div className="pt-4 border-t border-cardboard border-opacity-30 mt-4 text-center space-y-1">
                          <div className="flex items-center justify-center space-x-1.5">
                            <span className="font-display font-bold text-xs text-ink">
                              {rev.user ? `${rev.user.first_name} ${rev.user.last_name}` : 'Anonymous'}
                            </span>
                            {rev.is_verified_buyer && (
                              <CheckCircle className="w-3.5 h-3.5 fill-[#00b67a] text-white shrink-0" />
                            )}
                          </div>
                          
                          <span className="font-mono text-[9px] uppercase tracking-wider text-herb block truncate">
                            Recipe: {product?.name || 'Recipe'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Scroll Right Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (scrollContainerRef.current) {
                      scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
                    }
                  }}
                  className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center border border-cardboard bg-paper hover:bg-turmeric hover:border-ink transition-all cursor-pointer opacity-80 hover:opacity-100 shadow-sm"
                  aria-label="Scroll reviews right"
                >
                  <ChevronRight className="w-5 h-5 text-ink" />
                </button>
              </div>
            )}
          </div>
            </section>
          );
        })()}

        {/* Detailed Split-View Modal Overlay */}
        {selectedReview && (
          <div className="fixed inset-0 bg-ink bg-opacity-70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-paper max-w-4xl w-full border-double border-8 border-cardboard flex flex-col md:flex-row relative animate-scale-up text-left">
              
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full border border-cardboard bg-paper text-ink hover:bg-turmeric flex items-center justify-center cursor-pointer shadow-md"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Left Side: Large image & details */}
              <div className="md:w-1/2 aspect-square md:aspect-auto md:min-h-[480px] bg-paperLight flex flex-col justify-between border-b md:border-b-0 md:border-r border-cardboard">
                <div className="flex-grow flex items-center justify-center overflow-hidden p-6">
                  <img
                    src={
                      selectedReview.image_url ||
                      DEFAULT_DOG_IMAGES[
                        reviewsData?.items 
                          ? Math.max(0, reviewsData.items.findIndex(r => r.id === selectedReview.id)) % DEFAULT_DOG_IMAGES.length 
                          : 0
                      ]
                    }
                    alt="Review attachment"
                    className="max-h-[380px] max-w-full object-contain border border-cardboard shadow-xs"
                  />
                </div>
                
                {/* Optional gallery thumbnails */}
                <div className="p-4 bg-paper border-t border-cardboard border-opacity-30 flex justify-center space-x-2">
                  <div className="w-12 h-12 border-2 border-turmeric bg-paper p-0.5">
                    <img
                      src={
                        selectedReview.image_url ||
                        DEFAULT_DOG_IMAGES[
                          reviewsData?.items 
                            ? Math.max(0, reviewsData.items.findIndex(r => r.id === selectedReview.id)) % DEFAULT_DOG_IMAGES.length 
                            : 0
                        ]
                      }
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Right Side: Ratings, title, descriptions, tags */}
              <div className="md:w-1/2 p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  {/* Green Stars */}
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= selectedReview.rating ? 'fill-[#00b67a] text-[#00b67a]' : 'text-cardboard opacity-40'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Reviewer Meta info */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-turmeric flex items-center justify-center font-display font-black text-ink">
                      {(selectedReview.user?.first_name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-display font-black text-sm text-ink font-bold">
                          {selectedReview.user ? `${selectedReview.user.first_name} ${selectedReview.user.last_name}` : 'Anonymous'}
                        </span>
                        {selectedReview.is_verified_buyer && (
                          <span className="border border-[#00b67a] text-[#00b67a] text-[8px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wide rounded-xs bg-[#00b67a]/5">
                            Verified Buyer
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[9px] text-ink opacity-60">
                        {new Date(selectedReview.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 space-y-2">
                    <h4 className="font-display font-black text-xl uppercase tracking-tight text-ink">
                      Bruno Approved Formula!
                    </h4>
                    <p className="font-body text-xs text-ink opacity-85 leading-relaxed">
                      {selectedReview.comment || 'No comment provided.'}
                    </p>
                  </div>
                </div>

                {/* Action area */}
                <div className="pt-4 border-t border-cardboard border-opacity-30 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[9px] text-ink opacity-65 uppercase tracking-wider block mb-1">
                      Recipe Formulation:
                    </span>
                    <span className="inline-block bg-[#00b67a]/10 text-[#00b67a] text-[10px] font-mono font-black py-1.5 px-3 uppercase tracking-wide border border-[#00b67a]/25 select-none rounded-xs">
                      {product?.name || 'Recipe'}
                    </span>
                  </div>

                  {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteReview(selectedReview.id)}
                      className="bg-paprika hover:bg-opacity-95 text-white font-mono text-[9px] uppercase font-bold py-2 px-4 rounded-sm tracking-wide transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs border border-cardboard"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Review</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    {/* Footer */}
    <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 w-full">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
        © {new Date().getFullYear()} Scooby's Kitchen. All rights reserved.
      </p>
      <p className="font-body text-xs mt-1 max-w-md mx-auto leading-relaxed">
        Tested and crafted with love for pet parents who care about what goes in the bowl.
      </p>
    </footer>
    <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
  </div>
  );
};
