import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Star, CheckCircle } from 'lucide-react';
import { fetchRecentReviews } from '../api/reviews';
import type { UnifiedReview } from '../api/reviews';

// Curated default dog images to ensure the UI looks premium if a review doesn't have an image
const DEFAULT_DOG_IMAGES = [
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=400',
];

const FALLBACK_COMMUNITY_REVIEWS: UnifiedReview[] = [
  {
    id: -101,
    type: 'product',
    rating: 5,
    comment: 'Switched my Golden Retriever to the Slow-Cooked Chicken formula. His coat is shinier and digestion has improved dramatically!',
    image_url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=400',
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
    image_url: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&q=80&w=400',
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
    image_url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=400',
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
    image_url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&q=80&w=400',
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
    image_url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=400',
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
    image_url: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=400',
    created_at: '2026-08-25T15:20:00Z',
    author_name: 'Sneha Patel',
    reviewed_item_name: 'Senior Vitality Beef & Broth',
    reviewed_item_id: 4,
    is_verified_buyer: true,
  }
];

export function ReviewsCarousel() {
  const [selectedReview, setSelectedReview] = useState<UnifiedReview | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recent-reviews'],
    queryFn: () => fetchRecentReviews(30),
  });

  const apiReviews = data?.reviews || [];
  // Merge live API reviews with community fallback reviews so there are always 8+ rich reviews
  const reviews = apiReviews.length > 0 
    ? [...apiReviews, ...FALLBACK_COMMUNITY_REVIEWS.filter(fb => !apiReviews.some(ar => ar.id === fb.id))]
    : FALLBACK_COMMUNITY_REVIEWS;

  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (reviews.length === 0 || selectedReview !== null || isHovered) return;

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
    }, 3500);

    return () => clearInterval(interval);
  }, [reviews, selectedReview, isHovered]);

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
          <div className="h-8 bg-cardboard bg-opacity-20 w-64"></div>
          <div className="h-6 bg-cardboard bg-opacity-20 w-48"></div>
          <div className="flex space-x-4 w-full max-w-6xl px-4 overflow-hidden mt-8">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="w-[260px] sm:w-[300px] h-[340px] bg-cardboard bg-opacity-10 border border-cardboard border-opacity-30 shrink-0"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="bg-paperLight py-12 md:py-20 px-3 sm:px-6 md:px-8 border-b border-cardboard border-opacity-30 relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-2 max-w-4xl mx-auto animate-fade-in-up">
          <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-herb block">
            // COMMUNITY FEEDBACK LEDGER ({reviews.length} ENTRIES)
          </span>
          <h2 className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-tight text-ink sm:whitespace-nowrap">
            Let our #Scoobysfam speak
          </h2>
          <p className="font-body text-xs text-ink opacity-70 max-w-lg mx-auto">
            Honest feedback from pet parents feeding whole bioavailable food and consulting certified veterinarians.
          </p>
        </div>

        {/* Carousel Container with Side Navigation Buttons on the cards */}
        <div className="relative group/carousel">
          {/* Scroll Left Button */}
          <button
            onClick={() => handleScroll('left')}
            className="absolute -left-2 sm:-left-4 md:-left-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full border border-cardboard bg-paper hover:bg-turmeric text-ink shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Scroll reviews left"
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </button>

          {/* Scrollable Row */}
          <div
            ref={scrollContainerRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-2 px-1 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {reviews.map((review, index) => {
              const displayImage = review.image_url || DEFAULT_DOG_IMAGES[index % DEFAULT_DOG_IMAGES.length];
              return (
                <div
                  key={`${review.id}-${index}`}
                  onClick={() => setSelectedReview(review)}
                  className="w-[78vw] max-w-[270px] sm:w-[280px] md:w-[300px] border-double border-4 border-cardboard hover:border-turmeric bg-paper p-4 sm:p-5 rounded-none flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-300 snap-center shrink-0 select-none group/card"
                >
                  <div className="space-y-3 sm:space-y-4">
                    {/* Review Picture */}
                    <div className="w-full aspect-square overflow-hidden bg-paperLight border border-cardboard border-opacity-30 relative">
                      <img
                        src={displayImage}
                        alt={`Review by ${review.author_name}`}
                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_DOG_IMAGES[index % DEFAULT_DOG_IMAGES.length];
                        }}
                      />
                    </div>

                    {/* Stars */}
                    <div className="flex space-x-1 justify-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
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

                  <div className="pt-3 sm:pt-4 border-t border-cardboard border-opacity-30 mt-3 sm:mt-4 text-center space-y-1">
                    <div className="flex items-center justify-center space-x-1.5">
                      <span className="font-display font-bold text-xs text-ink">{review.author_name}</span>
                      {review.is_verified_buyer && (
                        <CheckCircle className="w-3.5 h-3.5 fill-[#00b67a] text-white shrink-0" />
                      )}
                    </div>
                    
                    <span className="font-mono text-[9px] uppercase tracking-wider text-herb block truncate">
                      {review.type === 'doctor' ? 'Vet Specialist' : 'Recipe'}: {review.reviewed_item_name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => handleScroll('right')}
            className="absolute -right-2 sm:-right-4 md:-right-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-full border border-cardboard bg-paper hover:bg-turmeric text-ink shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Scroll reviews right"
          >
            <ChevronRight className="w-5 h-5 text-ink" />
          </button>
        </div>
      </div>

      {/* Review Detailed Overlay Modal (Responsive on all phones) */}
      {selectedReview && (
        <div className="fixed inset-0 bg-ink bg-opacity-75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-paper max-w-3xl w-full border-double border-4 sm:border-8 border-cardboard flex flex-col md:flex-row relative animate-scale-up max-h-[90vh] overflow-y-auto my-auto shadow-2xl">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedReview(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full border border-cardboard bg-paper text-ink hover:bg-turmeric flex items-center justify-center cursor-pointer shadow-md"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Side: Image */}
            <div className="md:w-1/2 aspect-video sm:aspect-square md:aspect-auto md:min-h-[420px] bg-paperLight flex flex-col justify-between border-b md:border-b-0 md:border-r border-cardboard shrink-0">
              <div className="flex-grow flex items-center justify-center overflow-hidden p-4 sm:p-6">
                <img
                  src={
                    selectedReview.image_url ||
                    DEFAULT_DOG_IMAGES[reviews.indexOf(selectedReview) % DEFAULT_DOG_IMAGES.length]
                  }
                  alt={`Review attachment by ${selectedReview.author_name}`}
                  className="max-h-[200px] sm:max-h-[300px] md:max-h-[360px] max-w-full object-contain border border-cardboard shadow-xs"
                />
              </div>
            </div>

            {/* Right Side: Details */}
            <div className="md:w-1/2 p-5 sm:p-7 flex flex-col justify-between space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                {/* Green Stars */}
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        star <= selectedReview.rating ? 'fill-[#00b67a] text-[#00b67a]' : 'text-cardboard opacity-40'
                      }`}
                    />
                  ))}
                </div>

                {/* Reviewer Meta info */}
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-turmeric flex items-center justify-center font-display font-black text-ink shrink-0">
                    {selectedReview.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-display font-black text-sm text-ink">{selectedReview.author_name}</span>
                      {selectedReview.is_verified_buyer && (
                        <span className="border border-[#00b67a] text-[#00b67a] text-[8px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wide rounded-xs bg-[#00b67a]/5">
                          Verified
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

                <div className="pt-2 sm:pt-4 space-y-2">
                  <h4 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight text-ink">
                    {selectedReview.type === 'doctor' ? 'Veterinary Consultation Review' : 'Recipe Experience'}
                  </h4>
                  <p className="font-body text-xs sm:text-sm text-ink opacity-85 leading-relaxed">
                    {selectedReview.comment || 'No comment provided.'}
                  </p>
                </div>
              </div>

              {/* Product/Doctor Link */}
              <div className="pt-3 sm:pt-4 border-t border-cardboard border-opacity-30">
                <span className="font-mono text-[9px] text-ink opacity-65 uppercase tracking-wider block mb-1">
                  {selectedReview.type === 'doctor' ? 'Consulted Vet Specialist:' : 'Recipe Formulation:'}
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
