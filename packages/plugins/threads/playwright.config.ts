/**
 * --------------------------------------------------------------------
 * docmd : the minimalist, zero-config documentation generator.
 *
 * @package     @docmd/plugin-threads
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2026 Saulo Vallory
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:4175",
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm --filter @docmd/playground run dev --port 4175",
    port: 4175,
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
    cwd: "../../../", // monorepo root
  },
});
