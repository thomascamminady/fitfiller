import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the Fastify backend during development. This is a
      // dev-only concern, kept separate from VITE_API_BASE_URL (a browser-side
      // build var). Override with API_PROXY_TARGET if the API runs elsewhere.
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
        // Don't spam fatal-looking errors while the API is still booting.
        configure: (proxy) => {
          proxy.on('error', (err: Error) => {
            console.warn(
              `[vite] API not reachable yet (${err.message}); retry once it's up on :3001`,
            );
          });
        },
      },
    },
  },
});
