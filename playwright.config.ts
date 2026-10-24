import { defineConfig } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
}
export default defineConfig({
  testDir: "./src/tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000",
    channel: process.env.CI ? "chromium" : "chrome",
    launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) } },
  webServer: { command: "npm run dev", url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI, timeout: 120_000 }
});
