import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      // Provide a deterministic secret for tests. The storage route rejects
      // missing SESSION_SECRET at runtime, so tests must supply one.
      SESSION_SECRET: 'test-session-secret-for-vitest',
    },
  },
});
