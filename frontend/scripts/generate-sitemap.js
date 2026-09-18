#!/usr/bin/env node
/**
 * Generates public/sitemap.xml before each production build.
 *
 * Static marketing/tool pages are hardcoded below; product pages are
 * fetched live from the backend so the sitemap always reflects the current
 * catalog instead of going stale the moment a product is added, removed,
 * or deactivated. Runs as a `prebuild` script (see package.json) so it's
 * always regenerated right before `vite build` copies public/ into dist/.
 *
 * Requires SITE_URL (e.g. https://www.scoobyskitchen.com) in the build
 * environment. Without it, this skips generation rather than failing the
 * build — a missing sitemap is recoverable; a broken production build isn't.
 */

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const API_BASE_URL = (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(
  /\/$/,
  ''
);

const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
  // The "Meal Planner" diet quiz (folder name is legacy — see
  // frontend/src/features/onboarding) is a public tool, not a signup gate,
  // so it belongs in the sitemap like any other page.
  { path: '/onboarding', changefreq: 'weekly', priority: '0.6' },
];

function urlEntry(loc, changefreq, priority) {
  return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function fetchAllProductIds() {
  const ids = [];
  let page = 1;
  const limit = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let res;
    try {
      res = await fetch(`${API_BASE_URL}/product?page=${page}&limit=${limit}`);
    } catch (err) {
      console.error(`generate-sitemap: could not reach ${API_BASE_URL} (${err.message}) — sitemap will omit product pages.`);
      break;
    }
    if (!res.ok) {
      console.error(`generate-sitemap: failed to fetch products (page ${page}): HTTP ${res.status}`);
      break;
    }
    const data = await res.json();
    for (const item of data.items || []) {
      ids.push(item.id);
    }
    if (page >= (data.pages || 1)) break;
    page += 1;
  }
  return ids;
}

async function main() {
  if (!SITE_URL) {
    console.warn('generate-sitemap: SITE_URL is not set — skipping sitemap generation (fine for local dev builds).');
    return;
  }

  const entries = STATIC_PAGES.map((p) => urlEntry(`${SITE_URL}${p.path}`, p.changefreq, p.priority));

  const productIds = await fetchAllProductIds();
  for (const id of productIds) {
    entries.push(urlEntry(`${SITE_URL}/product/${id}`, 'weekly', '0.8'));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const outPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
  await fs.writeFile(outPath, xml, 'utf-8');
  console.log(`generate-sitemap: wrote ${entries.length} URL(s) (${productIds.length} product page(s)) to ${outPath}`);
}

main().catch((err) => {
  console.error('generate-sitemap: unexpected failure, continuing build without a fresh sitemap:', err);
});
