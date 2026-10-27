import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Minus } from 'lucide-react';
import { fetchActiveFaqs } from '../api/faqs';

// Shared query key so HomePage's own useQuery call (used to build the
// FAQPage structured-data block) hits react-query's cache instead of
// firing a second network request for the same data.
export const FAQ_QUERY_KEY = ['faqs-active'];

export function FAQSection({ dark = false }: { dark?: boolean }) {
  const { data: faqs = [], isLoading } = useQuery({
    queryKey: FAQ_QUERY_KEY,
    queryFn: () => fetchActiveFaqs(),
    staleTime: 1000 * 60 * 10,
  });

  const [openId, setOpenId] = useState<number | null>(null);

  if (!isLoading && faqs.length === 0) return null;

  return (
    <section className={`w-full ${dark ? 'bg-obsidian' : ''}`}>
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-16">
      <div className="text-center mb-10">
        <h2 className={`text-3xl md:text-4xl tracking-tight text-ink ${dark ? 'font-script font-normal' : 'font-display font-bold'}`}>
          Frequently Asked Questions
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-14 border rounded-sm ${dark ? 'bg-ink bg-opacity-5 border-ink border-opacity-15' : 'bg-paperLight border-cardboard'}`} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className={`border rounded-sm overflow-hidden ${dark ? 'border-ink border-opacity-15 bg-ink bg-opacity-5' : 'border-cardboard border-opacity-40 bg-paperLight'}`}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
                >
                  <span className={`font-body font-bold text-sm ${dark ? 'text-ink' : 'text-ink'}`}>{faq.question}</span>
                  {isOpen ? <Minus aria-hidden="true" className="w-5 h-5 shrink-0 text-black" /> : <Plus aria-hidden="true" className="w-5 h-5 shrink-0 text-black" />}
                </button>
                {isOpen && (
                  <div className={`px-5 pb-4 font-body text-sm leading-relaxed ${dark ? 'text-ink opacity-70' : 'text-ink opacity-80'}`}>
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </section>
  );
}
