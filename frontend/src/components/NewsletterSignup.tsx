import React, { useState } from 'react';
import { Mail, CheckCircle2 } from 'lucide-react';
import { subscribeToNewsletter } from '../api/newsletter';

interface NewsletterSignupProps {
  source?: string;
}

export const NewsletterSignup: React.FC<NewsletterSignupProps> = ({ source = 'blog' }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      await subscribeToNewsletter(email.trim(), source);
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="border border-cardboard border-opacity-60 bg-paperLight rounded-sm p-6 sm:p-8 text-center">
      {status === 'success' ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <CheckCircle2 className="w-6 h-6 text-herb" />
          <p className="font-display font-bold text-sm text-ink">You're on the list!</p>
          <p className="font-body text-xs text-ink opacity-70">Check your inbox for a quick welcome note.</p>
        </div>
      ) : (
        <>
          <Mail className="w-5 h-5 text-turmeric mx-auto mb-2" />
          <h3 className="font-display font-bold text-base text-ink">Get new entries in your inbox</h3>
          <p className="font-body text-xs text-ink opacity-70 mt-1 mb-4 max-w-sm mx-auto">
            No spam — just feeding guidance and dog care notes when we publish something new.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-grow px-3 py-2.5 border border-cardboard rounded-sm bg-paper font-body text-xs text-ink focus:outline-none focus:border-turmeric focus:ring-1 focus:ring-turmeric transition-colors"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-turmeric hover:bg-opacity-95 text-ink font-mono text-[10px] uppercase font-bold px-5 py-2.5 rounded-sm tracking-wide transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
          {status === 'error' && (
            <p className="font-mono text-[10px] text-paprika mt-2 uppercase">Something went wrong — try again.</p>
          )}
        </>
      )}
    </div>
  );
};
