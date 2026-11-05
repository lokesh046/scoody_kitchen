import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useFlagEntry, useVetAccess } from '../hooks/useFeatureFlag';

// A landing page whose feature is set to "hide" should not exist for visitors: send them home, the same way
// the header links, footer links and cards for it already disappear. A feature set to "coming soon" or
// "unavailable" is NOT hidden -- the page still opens and shows that status. While the flags are loading
// (or failed to load) every feature counts as on, so nothing redirects by mistake.
export function HideWhenHidden({ flag, children }: { flag: string; children: ReactNode }) {
  const entry = useFlagEntry(flag);
  if (entry.state === 'hide') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// The vet area has two flags (video consults and nearby clinics): it is hidden only when BOTH are hidden.
export function HideVetWhenHidden({ children }: { children: ReactNode }) {
  const vet = useVetAccess();
  if (vet.blocked && !vet.navVisible) return <Navigate to="/" replace />;
  return <>{children}</>;
}
