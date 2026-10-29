import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.endsWith('/assets/helvetiker_bold.typeface.json')) return 'typeface';
        },
      },
    },
  },
});
