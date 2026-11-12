// Cloudinary can resize and re-compress an already-uploaded image on the fly: a transformation
// segment is inserted into its delivery URL, so there is no re-upload and no backend change, and
// the original stays available at full size. The website used to download the full-size original
// everywhere (hero photos, product cards, blog covers); this serves a right-sized copy instead.
//
// Safe by construction: a URL that is not a Cloudinary delivery URL (local dev storage, a photo
// from another site, an empty value, a data: image) is returned untouched, as is one that
// already carries a transformation, so this can never break image loading.
//
// `c_limit` only ever shrinks an image to fit inside the width (it never crops or enlarges), so
// page layouts are not affected. Mirrors mobile/src/utils/cloudinaryImage.ts.
const UPLOAD_MARKER = '/image/upload/';

export function getOptimizedImageUrl(url: string | null | undefined, width: number): string | undefined;
export function getOptimizedImageUrl(url: string | null | undefined, width: number): string | undefined {
  if (!url) return url ?? undefined;
  if (!url.includes('res.cloudinary.com')) return url;
  const markerIndex = url.indexOf(UPLOAD_MARKER);
  if (markerIndex === -1) return url;
  const insertAt = markerIndex + UPLOAD_MARKER.length;
  const rest = url.slice(insertAt);
  // Already transformed (the first path segment is a transformation such as "w_200,..." rather than "v123..." or a folder).
  if (/^[a-z]{1,3}_[^/]*\//.test(rest)) return url;
  return `${url.slice(0, insertAt)}w_${width},c_limit,q_auto,f_auto/${rest}`;
}

// Shared widths (px): about 2x the largest on-screen size they back, so photos stay sharp on retina screens.
export const IMAGE_WIDTH = {
  thumb: 160, // 64px gallery thumbnails
  card: 800, // product and blog cards
  banner: 1600, // carousel banners
  hero: 1920, // full-screen heroes
} as const;

// If a resized copy cannot be made (the original is missing from Cloudinary, or it was only ever
// served from a cache), fall back to the original address instead of showing a blank image.
export const originalOnError = (original: string | null | undefined) => (e: { currentTarget: HTMLImageElement }) => {
  const img = e.currentTarget;
  if (original && img.src !== original) {
    img.onerror = null;
    img.src = original;
  }
};
