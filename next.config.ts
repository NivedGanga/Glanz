import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: {
    "/*": [".env*", ".local-data/**/*", ".git/**/*"]
  },
  allowedDevOrigins: ["127.0.0.1"]
};
export default config;
