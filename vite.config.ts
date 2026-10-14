import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          typeface: ['three/examples/fonts/helvetiker_bold.typeface.json'],
        },
      },
    },
  },
});
