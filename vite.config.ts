import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    // Three.js is intentionally isolated as a cacheable 190 kB gzip vendor chunk.
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/@react-three/')) return 'react-three';
          if (
            id.includes('/node_modules/d3-geo/') ||
            id.includes('/node_modules/topojson-client/') ||
            id.includes('/node_modules/world-atlas/')
          ) {
            return 'geo';
          }
        },
      },
    },
  },
});
