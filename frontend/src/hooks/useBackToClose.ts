import { useEffect, useRef } from 'react';

// Makes the phone's Back button (and the browser's) close a slide-in panel or pop-up instead of leaving
// the page. While `isOpen` is true the hook adds one history entry; pressing Back removes that entry and
// calls `onClose`. If the panel is closed some other way (its X, tapping outside), the entry is removed
// again, so history never piles up.
export function useBackToClose(isOpen: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    let pushed = false;
    // Added on the next tick so React's development double-run of effects (StrictMode) cleans up first
    // and never leaves a stray entry behind.
    const timer = window.setTimeout(() => {
      window.history.pushState({ ...(window.history.state ?? {}), __overlay: true }, '');
      pushed = true;
    }, 0);
    const onPop = () => {
      if (!pushed) return;
      pushed = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      // Closed from inside the page (X button, backdrop): take the extra entry back off.
      if (pushed && window.history.state?.__overlay) window.history.back();
    };
  }, [isOpen]);
}
