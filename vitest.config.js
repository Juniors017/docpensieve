import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // The client scripts are measured too: they are the only code that runs
      // in a reader's browser, which makes them the last place to skip.
      include: ['packages/*/src/**/*.js', 'packages/core/client/**/*.js'],
    },
  },
});
