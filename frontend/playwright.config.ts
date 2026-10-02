import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL: process.env.TEST_SITE ?? 'http://127.0.0.1:3001', headless: true },
  reporter: 'list',
  outputDir: '.cache/playwright-results',
});
