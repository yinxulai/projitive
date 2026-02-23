import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['source/**/*.ts'],
      exclude: [
        'source/**/*.test.ts',
        'source/**/*.spec.ts',
        'source/tests/**/*'
      ]
      // Thresholds are disabled for now - will enable gradually as coverage improves
      // thresholds: {
      //   lines: 80,
      //   functions: 80,
      //   branches: 70,
      //   statements: 80
      // }
    },
    include: ['source/**/*.test.ts'],
    exclude: ['node_modules', 'output'],
    testTimeout: 30000
  }
});
