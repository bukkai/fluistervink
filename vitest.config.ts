import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Los van vite.config.ts: de tests hebben de Worker en de PWA niet nodig.
// happy-dom geeft een nep-`window` en -`document`, fake-indexeddb een
// database in het geheugen (zie src/test-setup.ts).
export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
