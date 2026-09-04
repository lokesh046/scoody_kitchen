import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
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
