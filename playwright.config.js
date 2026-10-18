// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:8080',   // el frontend del docker-compose
    screenshot: 'only-on-failure',      // si una prueba falla, guarda una captura
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});