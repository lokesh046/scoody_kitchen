// Cloudinary can resize/re-optimize an already-uploaded image on the fly by
// inserting a transformation segment into its delivery URL — no re-upload,
// no backend change, and the same original stays available at its full
// resolution wherever that's still wanted (e.g. a future full-screen product
// view). This lets a small thumbnail (an order-history row, a chat product
// card) stop downloading and decoding the same full-size image the product
// detail page uses.
//
// Safe by construction: any URL that isn't a Cloudinary delivery URL (local
// dev's LocalStorageProvider, a future non-Cloudinary provider, a null/
// undefined image) is returned untouched, so this never breaks image
// loading — worst case it's a no-op.
const CLOUDINARY_UPLOAD_MARKER = '/upload/';

export function getOptimizedImageUrl(
  url: string | null | undefined,
  width: number,
  height?: number
): string | undefined {
  if (!url) return url ?? undefined;

  const markerIndex = url.indexOf(CLOUDINARY_UPLOAD_MARKER);
  if (markerIndex === -1) return url;

  const insertAt = markerIndex + CLOUDINARY_UPLOAD_MARKER.length;
  const dimensions = height ? `w_${width},h_${height},c_fill` : `w_${width}`;
  const transformation = `${dimensions},q_auto,f_auto`;

  return `${url.slice(0, insertAt)}${transformation}/${url.slice(insertAt)}`;
}

// Shared sizes (in px, ~2x the largest on-screen container they back) so
// thumbnail sizing stays consistent wherever this is applied.
export const IMAGE_SIZE = {
  rowThumb: 60, // small list-row thumbnails (order history)
  cardThumb: 100, // slightly larger row thumbnails (order detail line items)
  chatCard: 200, // chatbot product-suggestion cards
  reviewCard: 400, // review photo cards
  productCard: 500, // product catalog grid cards
} as const;
