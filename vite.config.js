import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8443,
    host: '0.0.0.0',
    https: {
      cert: './server.crt',
      key: './server.key'
    }
  },
  build: {
    outDir: 'dist'
  }
});