import { defineConfig, type Plugin } from 'vite';
import { gzipSync } from 'node:zlib';

/**
 * Writes dist/build-stats.json: every emitted file with its raw and gzipped size.
 * The "How this site is built" page reads it, so its numbers are always real.
 */
function buildStats(): Plugin {
  return {
    name: 'build-stats',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.values(bundle).map((f) => {
        const raw = f.type === 'chunk' ? f.code : f.source;
        const buf = typeof raw === 'string' ? Buffer.from(raw) : Buffer.from(raw);
        return {
          file: f.fileName,
          name: f.type === 'chunk' ? f.name : (f.names?.[0] ?? f.fileName),
          type: f.type === 'chunk' ? 'js' : (f.fileName.split('.').pop() ?? ''),
          entry: f.type === 'chunk' ? f.isEntry : false,
          bytes: buf.length,
          gzip: gzipSync(buf, { level: 9 }).length,
        };
      });
      this.emitFile({ type: 'asset', fileName: 'build-stats.json', source: JSON.stringify({ builtAt: new Date().toISOString(), files }) });
    },
  };
}

export default defineConfig({
  plugins: [buildStats()],
  server: {
    // `npm run ask` serves the AI assistant on :8787 during development
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // three.js gets its own long-cached chunk, only fetched by the designs that need it
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
});
