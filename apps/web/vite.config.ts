import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the Fastify backend during development.
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
