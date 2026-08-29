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
];

export function ReviewsCarousel() {
  const [selectedReview, setSelectedReview] = useState<UnifiedReview | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recent-reviews'],
    queryFn: () => fetchRecentReviews(20),
  });

  const reviews = data?.reviews || [];
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (reviews.length === 0 || selectedReview !== null || isHovered) return;

    const interval = setInterval(() => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const scrollAmount = 340; // width of card + gap
      const maxScroll = container.scrollWidth - container.clientWidth;

      if (container.scrollLeft >= maxScroll - 15) {
        // Wrap back to start instantly (no reverse slide animation)
        container.scrollTo({ left: 0, behavior: 'auto' });
      } else {
        // Scroll right
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [reviews, selectedReview, isHovered]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = 340; // width of card + gap
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
          <div className="flex space-x-6 w-full max-w-6xl px-4 overflow-hidden mt-8">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="w-[300px] h-[380px] bg-cardboard bg-opacity-10 border border-cardboard border-opacity-30 shrink-0"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return null; // Don't render empty carousel
  }



  return (
    <section className="bg-paperLight py-20 px-4 md:px-8 border-b border-cardboard border-opacity-30 relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <h2 className="font-display font-black text-4xl md:text-5xl uppercase tracking-tight text-ink">
            Let our #Scoobysfam speak for us
          </h2>
          <p className="font-body text-sm md:text-base text-ink opacity-80 italic max-w-2xl mx-auto leading-relaxed">
            "Fueling healthier, happier, and longer lives for our best friends, one human-grade bowl at a time."
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative group max-w-7xl mx-auto px-4 md:px-8">
          
          {/* Scroll Left Button */}
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center border border-cardboard bg-paper hover:bg-turmeric hover:border-ink transition-all cursor-pointer opacity-80 hover:opacity-100 shadow-sm"
            aria-label="Scroll reviews left"
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </button>

          {/* Scrollable Row */}
          <div
            ref={scrollContainerRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="flex gap-6 overflow-x-auto scrollbar-none py-4 px-2 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {reviews.map((review, index) => {
              const displayImage = review.image_url || DEFAULT_DOG_IMAGES[index % DEFAULT_DOG_IMAGES.length];
              return (
                <div
                  key={review.id}
                  onClick={() => setSelectedReview(review)}
                  className="w-[280px] md:w-[300px] border-double border-4 border-cardboard hover:border-turmeric bg-paper p-5 rounded-none flex flex-col justify-between cursor-pointer hover:shadow-md transition-all duration-300 snap-start shrink-0 select-none group/card"
                >
                  <div className="space-y-4">
                    {/* Review Picture */}
                    <div className="w-full aspect-square overflow-hidden bg-paperLight border border-cardboard border-opacity-30 relative">
                      <img
                        src={displayImage}
                        alt={`Review by ${review.author_name}`}
                        className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
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

                  <div className="pt-4 border-t border-cardboard border-opacity-30 mt-4 text-center space-y-1">
                    <div className="flex items-center justify-center space-x-1.5">
                      <span className="font-display font-bold text-xs text-ink">{review.author_name}</span>
                      {review.is_verified_buyer && (
                        <CheckCircle className="w-3.5 h-3.5 fill-[#00b67a] text-white shrink-0" />
                      )}
                    </div>
                    
                    <span className="font-mono text-[9px] uppercase tracking-wider text-herb block truncate">
                      {review.type === 'doctor' ? 'Vet' : 'Recipe'}: {review.reviewed_item_name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center border border-cardboard bg-paper hover:bg-turmeric hover:border-ink transition-all cursor-pointer opacity-80 hover:opacity-100 shadow-sm"
            aria-label="Scroll reviews right"
          >
            <ChevronRight className="w-5 h-5 text-ink" />
          </button>
        </div>
      </div>

      {/* Review Detailed Overlay Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-ink bg-opacity-70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-paper max-w-4xl w-full border-double border-8 border-cardboard flex flex-col md:flex-row relative animate-scale-up">
            
            {/* Close Button */}
            <button
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
                    DEFAULT_DOG_IMAGES[reviews.indexOf(selectedReview) % DEFAULT_DOG_IMAGES.length]
                  }
                  alt={`Review attachment by ${selectedReview.author_name}`}
                  className="max-h-[380px] max-w-full object-contain border border-cardboard shadow-xs"
                />
              </div>
              
              {/* Optional gallery thumbnails */}
              <div className="p-4 bg-paper border-t border-cardboard border-opacity-30 flex justify-center space-x-2">
                <div className="w-12 h-12 border-2 border-turmeric bg-paper p-0.5">
                  <img
                    src={
                      selectedReview.image_url ||
                      DEFAULT_DOG_IMAGES[reviews.indexOf(selectedReview) % DEFAULT_DOG_IMAGES.length]
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
                    {selectedReview.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-display font-black text-sm text-ink">{selectedReview.author_name}</span>
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
                    {selectedReview.type === 'doctor' ? 'Outstanding Vet Visit!' : 'Scooby Approved Formula!'}
                  </h4>
                  <p className="font-body text-xs text-ink opacity-85 leading-relaxed">
                    {selectedReview.comment || 'No comment provided.'}
                  </p>
                </div>
              </div>

              {/* Light Green Product Link Tag */}
              <div className="pt-4 border-t border-cardboard border-opacity-30">
                <span className="font-mono text-[9px] text-ink opacity-65 uppercase tracking-wider block mb-1">
                  {selectedReview.type === 'doctor' ? 'Consulted Vet Specialist:' : 'Recipe Formulation:'}
                </span>
                {selectedReview.type === 'product' ? (
                  <Link
                    to={`/product/${selectedReview.reviewed_item_id}`}
                    onClick={() => setSelectedReview(null)}
                    className="inline-block bg-[#00b67a]/10 text-[#00b67a] hover:bg-[#00b67a]/20 text-[10px] font-mono font-black py-1.5 px-3 uppercase tracking-wide border border-[#00b67a]/25 rounded-xs transition-colors cursor-pointer"
                  >
                    {selectedReview.reviewed_item_name} &rarr;
                  </Link>
                ) : (
                  <span className="inline-block bg-[#00b67a]/10 text-[#00b67a] text-[10px] font-mono font-black py-1.5 px-3 uppercase tracking-wide border border-[#00b67a]/25 select-none rounded-xs">
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
