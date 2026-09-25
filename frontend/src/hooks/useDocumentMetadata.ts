import { useEffect } from 'react';

const DEFAULT_SHARE_IMAGE = 'https://www.scoobyskitchen.com/images/scoobys_fam_banner.jpg';

function setMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

// Updates <title>, the meta description, Open Graph/Twitter tags, and the
// canonical link for the current page. This reaches Google (which renders
// JS before indexing) and any crawler that does the same, but NOT
// non-JS social link-preview bots (WhatsApp, Twitter/X, iMessage, etc.) —
// those only ever see index.html's static defaults, which is why index.html
// carries its own baseline og:/twitter: tags independent of this hook.
export function useDocumentMetadata(title: string, description: string, image?: string) {
  useEffect(() => {
    const fullTitle = `${title} | Scooby's Kitchen`;
    const shareImage = image || DEFAULT_SHARE_IMAGE;
    const canonicalUrl = window.location.origin + window.location.pathname;

    document.title = fullTitle;

    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:image', shareImage);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', shareImage);
    setCanonicalLink(canonicalUrl);
  }, [title, description, image]);
}
