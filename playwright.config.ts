import { defineConfig, devices } from '@playwright/test'

// Testy UI v jadre WebKit (rovnaké ako Safari na iPhone) – bez potreby iPhonu.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'iPhone', use: { ...devices['iPhone 15'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
})
