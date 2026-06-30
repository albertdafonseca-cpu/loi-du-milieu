import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 20_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    channel: undefined,
    // Bloque les service workers : évite que SW_UPDATED déclenche le banner
    // de mise à jour (#update-banner, z-index:9999) qui couvre les boutons.
    serviceWorkers: 'block',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    },
  },
  webServer: {
    command: 'npx serve . -p 8080 -n',
    port: 8080,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
