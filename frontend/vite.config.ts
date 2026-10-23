import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

// maplibre-gl-worker.mjs does `import ... from "./maplibre-gl-shared.mjs"`
// internally. Vite's asset pipeline (new URL(..., import.meta.url)) only
// copies the one file it's pointed at -- it doesn't parse a raw copied
// asset for further imports, so that sibling file never shipped and the
// worker's own module load 404'd (reported as a blank Worker 'error'
// event with no message, per spec, which is why this looked like nothing
// was wrong from the network tab alone). Copy both files, under their
// real unhashed names so the worker's relative import still resolves,
// into dist/assets/maplibre-worker/ ourselves. setWorkerUrl() in map.tsx
// points at this exact path. If maplibre-gl is ever upgraded, re-check
// these two files still exist with these names in its dist/ folder --
// nginx long-caches /assets/ by URL, so a silent file-content change
// here without a path change could serve stale copies to return visitors
// for up to a year.
function copyMaplibreWorkerFiles(): Plugin {
  return {
    name: 'copy-maplibre-worker-files',
    apply: 'build',
    closeBundle() {
      const srcDir = resolve(__dirname, 'node_modules/maplibre-gl/dist');
      const outDir = resolve(__dirname, 'dist/assets/maplibre-worker');
      mkdirSync(outDir, { recursive: true });
      for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
        copyFileSync(resolve(srcDir, file), resolve(outDir, file));
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), copyMaplibreWorkerFiles()],
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    server: {
      port: 3000,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_TARGET_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/chatbot': {
          target: env.VITE_CHATBOT_TARGET_URL || 'http://127.0.0.1:8002',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/chatbot/, ''),
        },
        '/vision': {
          target: env.VITE_VISION_TARGET_URL || 'http://127.0.0.1:8003',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/vision/, ''),
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three')) {
                return 'three-vendor';
              }
              if (id.includes('maplibre-gl')) {
                // Own chunk so maplibre-gl.css always ships with any page
                // that imports the Map component, instead of getting
                // bundled into whichever unrelated vendor chunk Rollup
                // happens to group it with (previously landed inside the
                // Razorpay chunk, so pages that load Map without ever
                // loading Razorpay -- e.g. /consultations -- got no
                // maplibre CSS at all and the map rendered blank).
                return 'maplibre-vendor';
              }
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('zustand') || id.includes('axios') || id.includes('@tanstack')) {
                return 'vendor';
              }
            }
          },
        },
      },
    },
  };
})
