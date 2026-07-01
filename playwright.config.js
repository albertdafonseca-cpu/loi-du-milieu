import { defineConfig } from '@playwright/test';
import { existsSync } from 'fs';

// Web-environment pre-installed Chromium; absent in CI (Playwright installs its own).
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

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
    launchOptions: existsSync(PREINSTALLED_CHROMIUM)
      ? { executablePath: PREINSTALLED_CHROMIUM }
      : {},
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
