/// <reference path="./rollup.d.ts" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve('./src'),
    },
  },
}));