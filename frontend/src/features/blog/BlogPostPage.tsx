import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { ArrowLeft, AlertCircle, Calendar } from 'lucide-react';
import { fetchBlogPostBySlug } from '../../api/blog';
import { Header } from '../../components/Header';
import { CartDrawer } from '../../components/CartDrawer';
import { NewsletterSignup } from '../../components/NewsletterSignup';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { useStructuredData } from '../../hooks/useStructuredData';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: () => fetchBlogPostBySlug(slug as string),
    enabled: !!slug,
  });

  // Sanitized once per post load — content_html ultimately originates from an
  // automated LLM pipeline (which itself ingests live web search results), so
  // it's never trusted as-is before rendering, same as any other third-party HTML.
  const safeHtml = useMemo(() => {
    if (!post?.content_html) return '';
    return DOMPurify.sanitize(post.content_html);
  }, [post?.content_html]);

  useDocumentMetadata(
    post?.title || 'Journal',
    post?.meta_description || post?.excerpt || 'Practical, vet-informed guidance from the Hearth & One team.',
    post?.cover_image_url || undefined
  );

  useStructuredData(
    post
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.meta_description || post.excerpt || undefined,
          image: post.cover_image_url || undefined,
          datePublished: post.published_at || undefined,
          dateModified: post.updated_at,
          mainEntityOfPage: window.location.origin + window.location.pathname,
          author: {
            '@type': 'Organization',
            name: 'Hearth & One',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Hearth & One',
          },
        }
      : null
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col font-body w-full">
        <Header activeTab="blog" onCartToggle={() => setIsCartOpen(true)} />
        <div className="flex-grow max-w-3xl w-full mx-auto px-4 md:px-8 py-12 animate-pulse space-y-6">
          <div className="h-3 bg-cardboard bg-opacity-20 w-32 rounded-[3px]" />
          <div className="h-9 bg-cardboard bg-opacity-20 w-3/4 rounded-[4px]" />
          <div className="w-full aspect-[16/9] bg-cardboard bg-opacity-20 rounded-sm" />
          <div className="space-y-3 pt-4">
            <div className="h-4 bg-cardboard bg-opacity-20 w-full rounded-[3px]" />
            <div className="h-4 bg-cardboard bg-opacity-20 w-full rounded-[3px]" />
            <div className="h-4 bg-cardboard bg-opacity-20 w-5/6 rounded-[3px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="max-w-md w-full border border-turmeric bg-paperLight p-8 rounded-sm text-center shadow-md">
          <AlertCircle className="w-12 h-12 text-paprika mx-auto mb-4" />
          <h4 className="font-display font-bold text-lg text-ink mb-2">Entry Not Found</h4>
          <p className="font-body text-xs text-ink opacity-80 mb-6">
            This journal entry doesn't exist, or isn't published.
          </p>
          <button
            onClick={() => navigate('/blog')}
            className="bg-turmeric text-ink font-body font-bold text-xs uppercase px-4 py-2.5 rounded-sm tracking-wide"
          >
            Back to Journal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header activeTab="blog" onCartToggle={() => setIsCartOpen(true)} />

      <div className="flex-grow max-w-3xl w-full mx-auto px-4 md:px-8 py-10">
        <button
          onClick={() => navigate('/blog')}
          className="font-mono text-[11px] uppercase tracking-wider text-ink opacity-70 hover:opacity-100 flex items-center space-x-1 mb-6"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to Journal</span>
        </button>

        <article className="text-left">
          <header className="mb-6 space-y-3">
            {post.published_at && (
              <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {formatDate(post.published_at)}
              </span>
            )}
            <h1 className="font-display font-black text-2xl md:text-4xl text-ink leading-tight">
              {post.title}
            </h1>
          </header>

          {post.cover_image_url && (
            <div className="w-full aspect-[16/9] overflow-hidden border border-cardboard rounded-sm mb-8">
              <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-contain" />
            </div>
          )}

          <div
            className="prose-blog font-body text-ink text-[15px] leading-relaxed space-y-4
              [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-xl [&_h2]:text-ink [&_h2]:mt-10 [&_h2]:mb-3
              [&_h3]:font-display [&_h3]:font-bold [&_h3]:text-base [&_h3]:text-ink [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4
              [&_li]:mb-1.5 [&_a]:text-turmeric [&_a]:underline [&_a]:hover:opacity-80"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </article>

        <div className="mt-12">
          <NewsletterSignup source="blog_post" />
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
