import { useEffect, useState } from 'react';
import { getOtpStatus, type OtpStatus } from '../api/auth';

// Looks up, for a valid phone number, how many OTP codes are left this hour and whether a code that was
// already sent is still usable -- so closing the page and coming back shows where the user left off.
export function useOtpStatus(phoneE164: string | null, enabled: boolean): OtpStatus | null {
  const [status, setStatus] = useState<OtpStatus | null>(null);

  useEffect(() => {
    if (!enabled || !phoneE164) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    getOtpStatus(phoneE164)
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [phoneE164, enabled]);

  return status;
}
