import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
    }),
  ],
  server: {
    port: 5173,
    host: true
  },
  optimizeDeps: {
    include: ['music-metadata'],
  },
  build: {
    sourcemap: true,
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
