import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://ppp:ppp@localhost:5433/ppp_test',
      JWT_SECRET: 'test-secret',
      CALLBACK_TOKEN: 'test-token',
      SMS_PROVIDER: 'console',
    },
  },
});
