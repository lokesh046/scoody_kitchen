#!/usr/bin/env node
/**
 * Prerenders public routes to static HTML after each production build.
 *
 * Runs as a `postbuild` step (see package.json) — after `vite build`
 * produces dist/, this boots a local static server for that exact dist/
 * output, visits each public route in a real headless Chromium (via
 * Playwright), and overwrites that route's HTML file with what the browser
 * actually rendered. A crawler that doesn't execute JavaScript (Bing, most
 * social-share/AI bots) then sees the fully rendered page immediately
 * instead of the empty <div id="root"></div> shell — Google already
 * handles this fine on its own since it renders JS (see
 * useDocumentMetadata.ts's comment).
 *
 * This uses a REAL browser rather than rendering the React tree in Node
 * (the vite-react-ssg/Next.js approach) specifically so nothing about the
 * app needs to change: no route-declaration rewrite, no auditing every
 * component for browser-only globals (window, localStorage, etc.) that
 * would crash under Node-side rendering. Everything here runs exactly like
 * a real visitor's browser would, so the app itself is untouched.
 *
 * Product pages are fetched live from the backend, same pattern as
 * generate-sitemap.js, so the set of prerendered pages tracks the current
 * catalog. Playwright missing, the backend being unreachable, or any other
 * failure all skip gracefully rather than failing the build — same
 * philosophy as generate-sitemap.js: a build that ships without a fully
 * prerendered set of pages is recoverable, a broken production build isn't.
 */

import { preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE_URL = (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(
  /\/$/,
  ''
);
const PRERENDER_PORT = Number(process.env.PRERENDER_PORT || 4173);
// Same SITE_URL env var generate-sitemap.js already requires. The crawl
// itself always happens against a local preview server, so every absolute
// URL captured in the rendered HTML — asset URLs Vite's router injects at
// runtime, and og:url/canonical/JSON-LD urls from window.location.origin —
// comes back stamped with that local origin. Without rewriting it to the
// real domain before writing to disk, the shipped files would point assets
// and canonical links at http://127.0.0.1:<port>, which doesn't exist in
// production.
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

// Matches robots.txt's crawlable set: public marketing/tool pages, plus
// every product page (fetched live below). Everything else in App.tsx sits
// behind RequireAuth or is an admin/doctor tool — never meant to be
// crawled, so never worth the extra build time to prerender.
const STATIC_ROUTES = ['/', '/shop', '/onboarding'];

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
      console.error(`prerender: could not reach ${API_BASE_URL} (${err.message}) — will prerender static routes only.`);
      break;
    }
    if (!res.ok) {
      console.error(`prerender: failed to fetch products (page ${page}): HTTP ${res.status}`);
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

// Returns the rendered HTML without writing anything to disk yet. Writing
// must happen only after EVERY route has been rendered — Vite's preview
// server falls back to dist/index.html for any path that isn't yet a real
// file on disk, so writing route N's output mid-crawl would make route N+1
// (if not yet requested) briefly fall back to route N's now-overwritten
// index.html instead of the original SPA shell, bleeding one page's
// rendered content (and its manually-appended <head> tags, like
// useStructuredData's script, which React's own re-render doesn't clean up
// since it lives outside React's managed tree) into another page's output.
async function renderRoute(browser, baseUrl, routePath) {
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'networkidle', timeout: 30000 });
    // Small extra settle time for any render that happens right after the
    // last network request resolves (e.g. a final state update).
    await page.waitForTimeout(300);
    return await page.content();
  } catch (err) {
    console.error(`prerender: failed to render ${routePath}: ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

async function writeRoute(outDir, routePath, html) {
  const outFile = routePath === '/' ? path.join(outDir, 'index.html') : path.join(outDir, routePath, 'index.html');
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, html, 'utf-8');
  console.log(`prerender: wrote ${routePath} -> ${path.relative(process.cwd(), outFile)}`);
}

async function main() {
  if (!SITE_URL) {
    console.warn('prerender: SITE_URL is not set — skipping prerendering (fine for local dev builds).');
    return;
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.warn('prerender: playwright is not installed — skipping prerendering (fine for local dev builds).');
    return;
  }

  const outDir = path.resolve(process.cwd(), 'dist');
  const productIds = await fetchAllProductIds();
  const routes = [...STATIC_ROUTES, ...productIds.map((id) => `/product/${id}`)];

  const server = await preview({
    preview: { port: PRERENDER_PORT, host: '127.0.0.1', strictPort: true },
  });
  const baseUrl = `http://127.0.0.1:${PRERENDER_PORT}`;

  const browser = await chromium.launch();
  const rendered = [];
  try {
    for (const route of routes) {
      const html = await renderRoute(browser, baseUrl, route);
      if (html) rendered.push([route, html]);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }

  // Only now, with the preview server shut down and every route already
  // rendered from the pristine original dist/, is it safe to overwrite
  // files on disk. Every occurrence of the local preview origin is rewritten
  // to the real site URL first — see the SITE_URL comment above.
  for (const [route, html] of rendered) {
    const rewritten = html.split(baseUrl).join(SITE_URL);
    await writeRoute(outDir, route, rewritten);
  }

  console.log(`prerender: done — ${routes.length} route(s) prerendered (${productIds.length} product page(s)).`);
}

main().catch((err) => {
  console.error('prerender: unexpected failure, continuing with the un-prerendered build:', err);
});
