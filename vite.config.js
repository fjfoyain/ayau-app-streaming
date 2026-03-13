import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    host: true
  },
  optimizeDeps: {
    include: ['music-metadata'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/music-metadata') ||
            id.includes('node_modules/strtok3') ||
            id.includes('node_modules/@tokenizer') ||
            id.includes('node_modules/peek-readable') ||
            id.includes('node_modules/token-types') ||
            id.includes('node_modules/file-type')
          ) {
            return 'vendor-media';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/services/**', 'src/utils/**', 'src/components/**'],
      exclude: ['src/test/**'],
    },
  },
})
