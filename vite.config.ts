import { defineConfig } from 'vite';

// `base: './'` makes every asset URL relative, so the built game works from the
// domain root (https://example.com/) or any subfolder (https://example.com/games/hh/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Keep Phaser in its own long-cached chunk; game code changes more often.
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    // During development the PHP API runs on PHP's built-in server (see README).
    proxy: {
      '/api': process.env.HH_API_URL ?? 'http://127.0.0.1:8090',
    },
  },
});
