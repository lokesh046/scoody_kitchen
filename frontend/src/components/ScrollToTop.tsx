import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// A single-page app keeps the old scroll position when the route changes, so a new
// page opened from the middle of another one starts in the middle. This sends every
// forward navigation (links, buttons, redirects) to the top of the new page, jumps to
// an in-page anchor when the URL has a #hash, and leaves the browser's own scroll
// restoration alone for Back and Forward.
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash, navigationType]);

  return null;
}
