import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Não roda em paralelo — testa fluxo sequencial num único DB SQLite.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:59574",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Não inicia servidor automaticamente — assume que `npm run dev` já está
  // rodando ou que o usuário define PLAYWRIGHT_BASE_URL pra outro lugar.
});
