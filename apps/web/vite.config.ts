import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// fitfiller is a fully static SPA (no backend). On a custom domain it's served
// from the root; override the base for a project-pages URL if needed.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173 },
});
