import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $domain: fileURLToPath(new URL('./src/lib/domain', import.meta.url)),
      $data: fileURLToPath(new URL('./src/lib/data', import.meta.url)),
      $modules: fileURLToPath(new URL('./src/lib/modules', import.meta.url)),
      $model: fileURLToPath(new URL('./src/lib/model', import.meta.url))
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
