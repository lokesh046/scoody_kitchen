import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { fetchActiveFaqs } from '../api/faqs';

// Shared query key so HomePage's own useQuery call (used to build the
// FAQPage structured-data block) hits react-query's cache instead of
// firing a second network request for the same data.
export const FAQ_QUERY_KEY = ['faqs-active'];

export function FAQSection() {
  const { data: faqs = [], isLoading } = useQuery({
    queryKey: FAQ_QUERY_KEY,
    queryFn: fetchActiveFaqs,
    staleTime: 1000 * 60 * 10,
  });

  const [openId, setOpenId] = useState<number | null>(null);

  if (!isLoading && faqs.length === 0) return null;

  return (
    <section className="max-w-4xl mx-auto px-4 md:px-8 py-16 w-full">
      <div className="text-center mb-10">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
          Frequently Asked Questions
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-paperLight border border-cardboard rounded-sm" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className="border border-cardboard border-opacity-40 rounded-sm bg-paperLight overflow-hidden"
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
                >
                  <span className="font-body font-bold text-sm text-ink">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-herb shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 font-body text-sm text-ink opacity-80 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
