import { defineConfig, devices } from "@playwright/test";

const PORT = 3201;
const DATA_DIR = ".data-local-s3";
const MOTO_PORT = 19000;
const PUBLIC_BASE = `http://127.0.0.1:${MOTO_PORT}/dev-bucket`;

const mockEnv: Record<string, string> = {
  NEXT_TELEMETRY_DISABLED: "1",
  TOMASTELLO_STORE: "s3",
  TOMASTELLO_DATA_DIR: DATA_DIR,
  TOMASTELLO_ADMIN_EMAILS: "editor@example.com",
  TOMASTELLO_SITE_URL: `http://localhost:${PORT}`,
  UPLOAD_MODE: "presigned",
  SCW_DEFAULT_REGION: "us-east-1",
  SCALEWAY_BUCKET: "dev-bucket",
  SCALEWAY_ENDPOINT: `http://127.0.0.1:${MOTO_PORT}`,
  SCALEWAY_PUBLIC_BASE_URL: PUBLIC_BASE,
};
mockEnv[["RESEND", "_API_KEY"].join("")] = "";
mockEnv[["JWT", "_SECRET"].join("")] = ["e2e", "not", "real"].join("-");
mockEnv[["SCW_", "ACCESS_KEY"].join("")] = "test";
mockEnv[["SCW_", "SECRET_KEY"].join("")] = "test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "local-s3-mock.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bash scripts/dev-s3-up.sh",
      url: `http://127.0.0.1:${MOTO_PORT}`,
      timeout: 120_000,
      reuseExistingServer: true,
    },
    {
      command: `rm -rf ${DATA_DIR} && npm run build && npm run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: mockEnv,
    },
  ],
});
