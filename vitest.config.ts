import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit-Tests liegen neben dem Code, Integrationstests unter tests/integration; E2E läuft mit Playwright
    include: ['src/**/*.test.ts', 'pipeline/**/*.test.ts', 'tests/integration/**/*.test.ts'],
  },
});
