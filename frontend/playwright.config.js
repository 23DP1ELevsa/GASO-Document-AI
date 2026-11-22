import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 10000,
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-360',
      testIgnore: '**/responsive.spec.js',
      use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'mobile-390',
      testIgnore: '**/responsive.spec.js',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'desktop',
      testIgnore: '**/responsive.spec.js',
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'responsive',
      testMatch: '**/responsive.spec.js',
      use: { isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' },
    },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: process.env.GASO_E2E_EXTERNAL_SERVER === '1',
  },
})
