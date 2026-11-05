import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', headless: true },
  webServer: [
    { command: 'php -d extension=gd -d extension=exif -d memory_limit=512M -d upload_max_filesize=20M -d post_max_size=24M -S 127.0.0.1:8000 -t public public/index.php', cwd: '../backend', url: 'http://127.0.0.1:8000/api/health', reuseExistingServer: false },
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: false },
  ],
})
