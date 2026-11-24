// Real store listings -- keep these in sync with mobile/app.config.js (bundleIdentifier /
// package) and SiteFooter.tsx, which links to the same two URLs.
export const APP_STORE_URL = 'https://apps.apple.com/in/app/hearth-one-pet-ecosystem/id6834203269';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.scooby.kitchen';

// A banner's admin-set Link URL that signals "open the download app popup" instead of
// navigating -- set in Admin > Banners > Link URL for the one banner meant to promote the app.
export const APP_DOWNLOAD_CTA_SENTINEL = 'app-download';

// Smart-redirect page a QR code points to: sends a phone straight to the right store,
// and shows both choices to anyone who lands on it without a phone's user agent.
export const APP_DOWNLOAD_PATH = '/download';
