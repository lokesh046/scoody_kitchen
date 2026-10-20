import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar } from 'lucide-react';
import { fetchPublishedBlogPosts } from '../../api/blog';
import { Header } from '../../components/Header';
import { CartDrawer } from '../../components/CartDrawer';
import { NewsletterSignup } from '../../components/NewsletterSignup';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';

const FALLBACK_COVER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><rect width="400" height="260" fill="%23FAF6EC"/><path d="M 0,30 L 400,30 M 0,60 L 400,60 M 0,90 L 400,90 M 0,120 L 400,120 M 0,150 L 400,150 M 0,180 L 400,180 M 0,210 L 400,210" stroke="%23C9BB9C" stroke-width="0.5" stroke-dasharray="2,2"/><text x="50%" y="52%" font-family="monospace" font-size="13" font-weight="bold" fill="%232E2418" dominant-baseline="middle" text-anchor="middle">🐾 HEARTH & ONE 🐾</text><text x="50%" y="62%" font-family="monospace" font-size="9" fill="%234B6B3A" dominant-baseline="middle" text-anchor="middle">Journal Entry</text></svg>';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export const BlogListPage: React.FC = () => {
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['blog-posts-published'],
    queryFn: fetchPublishedBlogPosts,
  });

  useDocumentMetadata(
    'Journal',
    'Practical, vet-informed guidance on dog nutrition, feeding, and health — from the Hearth & One team.',
  );

  useStructuredData(
    posts && posts.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Hearth & One Journal',
          url: window.location.origin + window.location.pathname,
          hasPart: posts.map((p) => ({
            '@type': 'BlogPosting',
            headline: p.title,
            url: `${window.location.origin}/blog/${p.slug}/`,
          })),
        }
      : null
  );

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header activeTab="blog" onCartToggle={() => setIsCartOpen(true)} />

      <div className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-12 relative">
        <div className="absolute left-1 top-0 bottom-0 border-l border-dashed border-cardboard opacity-35 hidden md:block" />

        <div className="mb-12 text-center max-w-2xl mx-auto">
          <h1 className="font-display font-black text-3xl md:text-4xl text-ink leading-tight">
            Notes on feeding your dog well
          </h1>
          <p className="font-body text-sm text-ink opacity-75 mt-3 leading-relaxed">
            Practical, vet-informed guidance on nutrition, feeding amounts, and everyday health —
            written for Indian dog owners who care about what's in the bowl.
          </p>
        </div>

        <main className="pl-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-cardboard bg-paperLight rounded-sm overflow-hidden">
                  <div className="w-full aspect-[16/10] bg-cardboard bg-opacity-20" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-cardboard bg-opacity-20 w-1/3 rounded-[3px]" />
                    <div className="h-5 bg-cardboard bg-opacity-20 w-5/6 rounded-[3px]" />
                    <div className="h-3 bg-cardboard bg-opacity-20 w-full rounded-[3px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : !posts || posts.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-cardboard rounded-sm bg-paperLight bg-opacity-40">
              <BookOpen className="w-8 h-8 text-cardboard mx-auto stroke-1 mb-3" />
              <h5 className="font-display font-bold text-ink text-sm">No journal entries yet</h5>
              <p className="font-body text-xs text-ink opacity-70 max-w-[280px] mx-auto mt-1">
                Check back soon — we're writing up practical guidance on dog nutrition and care.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <article
                  key={post.id}
                  onClick={() => navigate(`/blog/${post.slug}`)}
                  className="border border-cardboard border-opacity-60 bg-paperLight rounded-sm overflow-hidden cursor-pointer hover:border-turmeric transition-all duration-300 ease-out hover:-translate-y-[3px] hover:rotate-[0.3deg] hover:shadow-[0_12px_20px_-8px_rgba(46,36,24,0.15)] group flex flex-col"
                >
                  <div className="w-full aspect-[16/10] overflow-hidden bg-paper border-b border-cardboard border-opacity-60 relative">
                    <img
                      src={post.cover_image_url || FALLBACK_COVER}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    <span className="absolute top-2.5 left-2.5 text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded-xs border shadow-xs bg-emerald-50 text-herb border-emerald-200">
                      🐾 Journal
                    </span>
                  </div>
                  <div className="p-5 flex flex-col flex-grow text-left space-y-2.5">
                    {post.published_at && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(post.published_at)}
                      </span>
                    )}
                    <h2 className="font-display font-bold text-base text-ink leading-snug group-hover:text-turmeric transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="font-body text-xs text-ink opacity-75 leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        <div className="pl-4 mt-16 max-w-2xl mx-auto">
          <NewsletterSignup source="blog_list" />
        </div>
      </div>

      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 w-full">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
          © {new Date().getFullYear()} Hearth & One. All rights reserved. ·{' '}
          <Link to="/privacy" className="hover:text-turmeric hover:opacity-100 transition-colors">Privacy Policy</Link>{' '}
          · <Link to="/terms" className="hover:text-turmeric hover:opacity-100 transition-colors">Terms & Conditions</Link>
        </p>
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
