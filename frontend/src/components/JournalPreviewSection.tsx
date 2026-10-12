import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { fetchPublishedBlogPosts } from '../api/blog';

const FALLBACK_COVER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><rect width="400" height="260" fill="%23FAF6EC"/><path d="M 0,30 L 400,30 M 0,60 L 400,60 M 0,90 L 400,90 M 0,120 L 400,120 M 0,150 L 400,150 M 0,180 L 400,180 M 0,210 L 400,210" stroke="%23C9BB9C" stroke-width="0.5" stroke-dasharray="2,2"/><text x="50%" y="52%" font-family="monospace" font-size="13" font-weight="bold" fill="%232E2418" dominant-baseline="middle" text-anchor="middle">🐾 HEARTH & ONE 🐾</text><text x="50%" y="62%" font-family="monospace" font-size="9" fill="%234B6B3A" dominant-baseline="middle" text-anchor="middle">Journal Entry</text></svg>';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function JournalPreviewSection() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['blog-posts-published'],
    queryFn: fetchPublishedBlogPosts,
  });

  // Same convention as FAQSection — an empty, loaded section renders nothing
  // rather than a heading with nothing scrollable under it.
  if (!isLoading && (!posts || posts.length === 0)) return null;

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

  return (
    <section className="bg-paper py-12 md:py-20 px-3 sm:px-6 md:px-8 border-b border-cardboard border-opacity-30">
      <div className="max-w-7xl mx-auto space-y-8 md:space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="font-display font-black text-2xl sm:text-3xl md:text-4xl text-ink tracking-tight">
            Notes on feeding your dog well
          </h2>
          <button
            onClick={() => navigate('/blog')}
            className="font-mono text-[11px] uppercase tracking-wider font-bold text-herb hover:text-turmeric transition-colors"
          >
            View All Entries →
          </button>
        </div>

        {isLoading ? (
          <div className="flex gap-4 sm:gap-6 overflow-hidden px-1 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="w-[78vw] max-w-[300px] sm:w-[320px] h-[280px] bg-cardboard/10 border border-cardboard/30 rounded-sm shrink-0" />
            ))}
          </div>
        ) : (
          <div className="relative group/carousel">
            <button
              onClick={() => handleScroll('left')}
              className="absolute -left-2 sm:-left-4 md:-left-5 top-[40%] -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full border border-cardboard bg-paper hover:bg-turmeric text-ink shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              aria-label="Scroll journal entries left"
            >
              <ChevronLeft className="w-5 h-5 text-ink" />
            </button>

            <div
              ref={scrollContainerRef}
              className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-none py-3 px-1 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none' }}
            >
              {(posts || []).map((post) => (
                <article
                  key={post.id}
                  onClick={() => navigate(`/blog/${post.slug}`)}
                  className="w-[78vw] max-w-[300px] sm:w-[320px] border border-cardboard border-opacity-60 hover:border-turmeric bg-paperLight rounded-sm overflow-hidden cursor-pointer transition-all duration-300 ease-out hover:-translate-y-[3px] hover:rotate-[0.3deg] hover:shadow-[0_12px_20px_-8px_rgba(46,36,24,0.15)] snap-center shrink-0 group/card"
                >
                  <div className="w-full aspect-[16/10] overflow-hidden bg-paper border-b border-cardboard border-opacity-60 relative">
                    <img
                      src={post.cover_image_url || FALLBACK_COVER}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-contain group-hover/card:scale-[1.03] transition-transform duration-300"
                    />
                    <span className="absolute top-2.5 left-2.5 text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded-xs border shadow-xs bg-emerald-50 text-herb border-emerald-200">
                      🐾 Journal
                    </span>
                  </div>
                  <div className="p-5 text-left space-y-2">
                    {post.published_at && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(post.published_at)}
                      </span>
                    )}
                    <h3 className="font-display font-bold text-sm text-ink leading-snug group-hover/card:text-turmeric transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="font-body text-xs text-ink opacity-70 leading-relaxed line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <button
              onClick={() => handleScroll('right')}
              className="absolute -right-2 sm:-right-4 md:-right-5 top-[40%] -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full border border-cardboard bg-paper hover:bg-turmeric text-ink shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              aria-label="Scroll journal entries right"
            >
              <ChevronRight className="w-5 h-5 text-ink" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
