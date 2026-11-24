import { useEffect, useState } from 'react';
import { APP_STORE_URL, PLAY_STORE_URL } from '../constants/appLinks';
import { AppStoreBadges } from './AppStoreBadges';

// What the "Download the App" QR code points to. A phone scanning it is sent straight to
// its matching store; anyone else (desktop, an unrecognized device) sees both choices.
export function DownloadAppPage() {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setRedirecting(true);
      window.location.replace(APP_STORE_URL);
    } else if (/Android/i.test(ua)) {
      setRedirecting(true);
      window.location.replace(PLAY_STORE_URL);
    }
  }, []);

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4 text-center">
      <img
        src="/scooby-logo-256.png"
        alt="Hearth & One"
        width={64}
        height={64}
        className="w-16 h-16 mb-6 rounded-full"
      />
      <h1 className="font-display font-bold text-2xl text-paper mb-2">
        {redirecting ? 'Taking you to the app store…' : 'Get the Hearth & One App'}
      </h1>
      <p className="font-body text-sm text-paper/70 mb-8 max-w-xs">
        Choose your device below to download.
      </p>
      <AppStoreBadges className="flex flex-col items-center gap-3" />
    </div>
  );
}
