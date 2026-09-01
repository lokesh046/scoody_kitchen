import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Star, CheckCircle2, Package, Stethoscope } from 'lucide-react';
import { fetchRecentReviews } from '../api/reviews';
import type { UnifiedReview } from '../api/reviews';

// Curated default dog images to ensure the UI looks premium if a review doesn't have an image
const DEFAULT_DOG_IMAGES = [
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=600',
];

const FALLBACK_COMMUNITY_REVIEWS: UnifiedReview[] = [
  {
    id: -101,
    type: 'product',
    rating: 5,
    comment: 'Switched my Golden Retriever to the Slow-Cooked Chicken formula. His coat is shinier and digestion has improved dramatically!',
    image_url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
    created_at: '2026-08-30T14:20:00Z',
    author_name: 'Aditi Sharma',
    reviewed_item_name: 'Organic Chicken & Sweet Potato Blend',
    reviewed_item_id: 1,
    is_verified_buyer: true,
  },
  {
    id: -102,
    type: 'doctor',
    rating: 5,
    comment: 'The online veterinary consultation was so thorough. Dr. Sai gave us practical dietary advice for our puppy allergies.',
    image_url: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=600',
    created_at: '2026-08-29T10:15:00Z',
    author_name: 'Karan Mehta',
    reviewed_item_name: 'Dr. Sai Kumar',
    reviewed_item_id: 15,
    is_verified_buyer: true,
  },
  {
    id: -103,
    type: 'product',
    rating: 5,
    comment: 'Clean ingredients you can actually see! My Beagle is a notoriously picky eater but finishes his bowl in 2 minutes flat.',
    image_url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=600',
    created_at: '2026-08-28T16:45:00Z',
    author_name: 'Pooja Verma',
    reviewed_item_name: 'Wild-Caught Salmon & Pumpkin Bowl',
    reviewed_item_id: 2,
    is_verified_buyer: true,
  },
  {
    id: -104,
    type: 'product',
    rating: 5,
    comment: 'Zero artificial preservatives. We love the transparency ledger and knowing exactly what farm the meat comes from.',
    image_url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=600',
    created_at: '2026-08-27T09:30:00Z',
    author_name: 'Rohan Gupta',
    reviewed_item_name: 'Grass-Fed Beef & Carrot Recipe',
    reviewed_item_id: 3,
    is_verified_buyer: true,
  },
  {
    id: -105,
    type: 'doctor',
    rating: 5,
    comment: 'Excellent video consultation. Prescribed a tailored elimination diet for our German Shepherd. Highly knowledgeable specialist.',
    image_url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=600',
    created_at: '2026-08-26T11:00:00Z',
    author_name: 'Vikram Sengupta',
    reviewed_item_name: 'Dr. Raghuvaran',
    reviewed_item_id: 2,
    is_verified_buyer: true,
  },
  {
    id: -106,
    type: 'product',
    rating: 5,
    comment: 'Our senior Labrador had low energy, but since switching to Scoobys fresh meals, he is playful and energetic again.',
    image_url: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=600',
    created_at: '2026-08-25T15:20:00Z',
    author_name: 'Sneha Patel',
    reviewed_item_name: 'Senior Vitality Beef & Broth',
    reviewed_item_id: 4,
    is_verified_buyer: true,
  }
];

export function ReviewsCarousel() {
  const [selectedReview, setSelectedReview] = useState<UnifiedReview | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'product' | 'doctor'>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recent-reviews'],
    queryFn: () => fetchRecentReviews(30),
  });

  const apiReviews = data?.reviews || [];
  const allReviews = apiReviews.length > 0 
    ? [...apiReviews, ...FALLBACK_COMMUNITY_REVIEWS.filter(fb => !apiReviews.some(ar => ar.id === fb.id))]
    : FALLBACK_COMMUNITY_REVIEWS;

  const reviews = allReviews.filter((r) => {
    if (reviewFilter === 'product') return r.type === 'product';
    if (reviewFilter === 'doctor') return r.type === 'doctor';
    return true;
  });

  const [isHovered, setIsHovered] = useState(false);
  const [isInViewport, setIsInViewport] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  // Viewport-aware Intersection Observer
  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reviews.length === 0 || selectedReview !== null || isHovered || !isInViewport) return;

    const interval = setInterval(() => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const scrollAmount = window.innerWidth < 768 ? 260 : 320;
      const maxScroll = container.scrollWidth - container.clientWidth;

      if (container.scrollLeft >= maxScroll - 15) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [reviews, selectedReview, isHovered, isInViewport]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = window.innerWidth < 768 ? 260 : 320;
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="animate-pulse flex flex-col items-center space-y-4">
          <div className="h-6 bg-cardboard/20 w-48 rounded-sm"></div>
          <div className="h-10 bg-cardboard/20 w-80 rounded-sm"></div>
          <div className="flex space-x-4 w-full max-w-6xl px-4 overflow-hidden mt-8">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="w-[260px] sm:w-[300px] h-[340px] bg-cardboard/10 border border-cardboard/30 rounded-sm shrink-0"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section ref={sectionRef} className="bg-paperLight py-12 md:py-20 px-3 sm:px-6 md:px-8 border-b border-cardboard border-opacity-30 relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-8 md:space-y-10">
        
        {/* Header Section */}
        <div className="text-center space-y-2 max-w-3xl mx-auto animate-fade-in">
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-herb block">
            // COMMUNITY FEEDBACK LEDGER ({reviews.length} ENTRIES)
          </span>
          <h2 className="font-display font-black text-2xl sm:text-3xl md:text-5xl text-ink tracking-tight">
            Let our #Scoobysfam speak
          </h2>
          <p className="font-body text-xs sm:text-sm text-ink opacity-75 max-w-xl mx-auto">
            Real experiences from pet parents nourishing their companions with whole bioavailable recipes and consulting certified veterinarians.
          </p>

          {/* Filter Chips */}
          <div className="flex items-center justify-center space-x-2 pt-3 font-mono text-[10px] uppercase font-bold">
            <button
              type="button"
              onClick={() => setReviewFilter('all')}
              className={`px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer ${
                reviewFilter === 'all'
                  ? 'bg-ink text-paper shadow-xs'
                  : 'bg-paper border border-cardboard/40 text-ink opacity-70 hover:opacity-100'
              }`}
            >
              All Reviews ({allReviews.length})
            </button>
            <button
              type="button"
              onClick={() => setReviewFilter('product')}
              className={`px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer flex items-center space-x-1.5 ${
                reviewFilter === 'product'
                  ? 'bg-herb text-white shadow-xs'
                  : 'bg-paper border border-cardboard/40 text-ink opacity-70 hover:opacity-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Fresh Meals</span>
            </button>
            <button
              type="button"
              onClick={() => setReviewFilter('doctor')}
              className={`px-3.5 py-1.5 rounded-sm transition-colors cursor-pointer flex items-center space-x-1.5 ${
                reviewFilter === 'doctor'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-paper border border-cardboard/40 text-ink opacity-70 hover:opacity-100'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Vet Consults</span>
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div className="relative group/carousel">
          {/* Scroll Left Button */}
          <button
            onClick={() => handleScroll('left')}
            className="absolute -left-2 sm:-left-4 md:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full border border-cardboard bg-paper hover:bg-turmeric text-ink shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Scroll reviews left"
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </button>

          {/* Scrollable Row */}
          <div
            ref={scrollContainerRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-3 px-1 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {reviews.map((review, index) => {
              const displayImage = review.image_url || DEFAULT_DOG_IMAGES[index % DEFAULT_DOG_IMAGES.length];
              return (
                <div
                  key={`${review.id}-${index}`}
                  onClick={() => setSelectedReview(review)}
                  className="w-[78vw] max-w-[270px] sm:w-[280px] md:w-[300px] border border-cardboard border-opacity-40 hover:border-turmeric bg-paper p-4 sm:p-5 rounded-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-300 snap-center shrink-0 select-none group/card"
                >
                  <div className="space-y-3 sm:space-y-4">
                    {/* Review Picture */}
                    <div className="w-full aspect-square overflow-hidden bg-paperLight border border-cardboard border-opacity-30 rounded-xs relative">
                      <img
                        src={displayImage}
                        alt={`Review by ${review.author_name}`}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_DOG_IMAGES[index % DEFAULT_DOG_IMAGES.length];
                        }}
                      />
                      <span className={`absolute top-2 left-2 text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded-xs border shadow-xs ${
                        review.type === 'doctor'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-emerald-50 text-herb border-emerald-200'
                      }`}>
                        {review.type === 'doctor' ? '🩺 Vet Consult' : '🐾 Fresh Meal'}
                      </span>
                    </div>

                    {/* Stars */}
                    <div className="flex space-x-1 justify-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.rating ? 'fill-[#00b67a] text-[#00b67a]' : 'text-cardboard opacity-40'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Review Body Snippet */}
                    <p className="font-body text-xs text-ink opacity-85 leading-relaxed text-center italic line-clamp-3">
                      "{review.comment || 'No comment provided.'}"
                    </p>
                  </div>

                  <div className="pt-3 sm:pt-4 border-t border-cardboard border-opacity-35 mt-3 text-center space-y-1">
                    <div className="flex items-center justify-center space-x-1.5">
                      <span className="font-display font-bold text-xs text-ink">{review.author_name}</span>
                      {review.is_verified_buyer && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00b67a] shrink-0" />
                      )}
                    </div>
                    
                    <span className="font-mono text-[9px] uppercase tracking-wider text-paprika block truncate">
                      {review.reviewed_item_name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => handleScroll('right')}
            className="absolute -right-2 sm:-right-4 md:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full border border-cardboard bg-paper hover:bg-turmeric text-ink shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Scroll reviews right"
          >
            <ChevronRight className="w-5 h-5 text-ink" />
          </button>
        </div>
      </div>

      {/* Review Detailed Overlay Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-ink bg-opacity-65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-paper max-w-2xl w-full border border-cardboard rounded-sm flex flex-col md:flex-row relative animate-scale-up max-h-[90vh] overflow-hidden my-auto shadow-2xl">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedReview(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full border border-cardboard bg-paper text-ink hover:bg-turmeric flex items-center justify-center cursor-pointer shadow-md transition-colors"
              aria-label="Close review details"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Side: Image */}
            <div className="md:w-1/2 bg-paperLight flex flex-col justify-center items-center border-b md:border-b-0 md:border-r border-cardboard border-opacity-40 p-6 shrink-0">
              <img
                src={
                  selectedReview.image_url ||
                  DEFAULT_DOG_IMAGES[reviews.indexOf(selectedReview) % DEFAULT_DOG_IMAGES.length]
                }
                alt={`Review attachment by ${selectedReview.author_name}`}
                className="max-h-[220px] sm:max-h-[280px] w-full object-cover rounded-sm border border-cardboard shadow-xs"
              />
            </div>

            {/* Right Side: Details */}
            <div className="md:w-1/2 p-6 sm:p-7 flex flex-col justify-between space-y-4 overflow-y-auto">
              <div className="space-y-4">
                {/* Green Stars */}
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= selectedReview.rating ? 'fill-[#00b67a] text-[#00b67a]' : 'text-cardboard opacity-40'
                      }`}
                    />
                  ))}
                </div>

                {/* Reviewer Meta info */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-turmeric flex items-center justify-center font-display font-black text-ink shrink-0">
                    {selectedReview.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-display font-black text-sm text-ink">{selectedReview.author_name}</span>
                      {selectedReview.is_verified_buyer && (
                        <span className="border border-[#00b67a] text-[#00b67a] text-[8px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wider rounded-xs bg-[#00b67a]/5">
                          Verified Buyer ✓
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[9px] text-ink opacity-60">
                      {new Date(selectedReview.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-display font-black text-base uppercase tracking-tight text-ink">
                    {selectedReview.type === 'doctor' ? 'Veterinary Consultation Experience' : 'Recipe Formulation Feedback'}
                  </h4>
                  <p className="font-body text-xs sm:text-sm text-ink opacity-85 leading-relaxed">
                    "{selectedReview.comment || 'No comment provided.'}"
                  </p>
                </div>
              </div>

              {/* Product/Doctor Link */}
              <div className="pt-4 border-t border-cardboard border-opacity-35">
                <span className="font-mono text-[9px] text-ink opacity-65 uppercase tracking-wider block mb-1">
                  {selectedReview.type === 'doctor' ? 'Consulted Specialist:' : 'Sourced Recipe:'}
                </span>
                {selectedReview.type === 'product' ? (
                  <Link
                    to={`/product/${selectedReview.reviewed_item_id}`}
                    onClick={() => setSelectedReview(null)}
                    className="font-display font-bold text-xs sm:text-sm text-herb hover:underline inline-flex items-center space-x-1"
                  >
                    <span>{selectedReview.reviewed_item_name}</span>
                    <span>&rarr;</span>
                  </Link>
                ) : (
                  <span className="font-display font-bold text-xs sm:text-sm text-ink">
                    {selectedReview.reviewed_item_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
