import { APP_STORE_URL, PLAY_STORE_URL } from '../constants/appLinks';

// Shared App Store / Google Play badge pair -- used by the site footer and the
// "Download the App" popup, so both stay visually and functionally in sync.
export function AppStoreBadges({ className = 'flex flex-wrap items-center justify-center gap-3' }: { className?: string }) {
  return (
    <div className={className}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download Hearth & One on the App Store"
        className="flex items-center gap-2.5 bg-black border border-paper border-opacity-15 rounded-xl px-4 py-2 hover:border-opacity-40 transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" aria-hidden="true" className="shrink-0">
          <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1 3.902-1 .613 0 2.886.06 4.374 2.19-.13.08-2.383 1.37-2.383 4.2 0 3.39 2.95 4.57 3.004 4.6z" />
        </svg>
        <span className="flex flex-col items-start leading-none">
          <span className="text-[9px] text-white text-opacity-80 font-body">Download on the</span>
          <span className="text-base font-display font-bold text-white -mt-0.5">App Store</span>
        </span>
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get Hearth & One on Google Play"
        className="flex items-center gap-2.5 bg-black border border-paper border-opacity-15 rounded-xl px-4 py-2 hover:border-opacity-40 transition-colors"
      >
        <img
          src="/google-play-icon.png"
          alt=""
          width={22}
          height={22}
          className="shrink-0"
          aria-hidden="true"
        />
        <span className="flex flex-col items-start leading-none">
          <span className="text-[9px] text-white text-opacity-80 font-body tracking-wide">GET IT ON</span>
          <span className="text-base font-display font-bold text-white -mt-0.5">Google Play</span>
        </span>
      </a>
    </div>
  );
}
