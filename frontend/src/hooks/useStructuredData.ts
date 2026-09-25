import { useEffect } from 'react';

const SCRIPT_ID = 'structured-data-jsonld';

// Injects a single JSON-LD <script> tag for the current page (Product,
// Organization, etc. — https://schema.org). Google's crawler renders JS
// before parsing structured data, so this reaches it despite being
// client-side; it's what lets a product page qualify for rich results
// (price, availability, star rating shown directly in search listings).
// Pass null/undefined to remove the tag (e.g. while a product is still
// loading) rather than publishing incomplete/incorrect data.
export function useStructuredData(data: Record<string, unknown> | null | undefined) {
  useEffect(() => {
    if (!data) return;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);

    // React always runs this before the next effect call (new data) and on
    // unmount, so the tag never lingers stale or duplicates.
    return () => {
      script.remove();
    };
  }, [data]);
}
