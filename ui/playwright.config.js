import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: [
    {
      command: "npm run dev:api",
      cwd: root,
      url: "http://127.0.0.1:8080/api/requirements",
      timeout: 180000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      cwd: root,
      url: "http://127.0.0.1:5173",
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
