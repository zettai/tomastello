import { defineConfig, devices } from "@playwright/test";

/** Scratch data dir — never the production bucket. */
export const E2E_DATA_DIR = ".data-e2e";
const PORT = 3200;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `rm -rf ${E2E_DATA_DIR} && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      TOMASTELLO_STORE: "file",
      TOMASTELLO_DATA_DIR: E2E_DATA_DIR,
      JWT_SECRET: "e2e-not-real",
      // Empty values win over a developer's .env.local so e2e never touches Scaleway.
      SCW_ACCESS_KEY: "",
      SCW_SECRET_KEY: "",
      SCW_DEFAULT_REGION: "",
      SCALEWAY_BUCKET: "",
      SCALEWAY_ENDPOINT: "",
      TOMASTELLO_SITE_URL: `http://localhost:${PORT}`,
      TOMASTELLO_ADMIN_EMAILS: "editor@example.com",
    },
  },
});
