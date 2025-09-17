const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react-swc');
const { resolve } = require('path');
const { componentTagger } = require('lovable-tagger');

module.exports = defineConfig(({ mode }) => ({
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