import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { writeshapeBrand } from "./build-tools/writeshapeBrand";
import { offlineShell } from "./build-tools/offline";
import { dependencyNotices, licenseAttribution } from "./build-tools/notices";
export default defineConfig({
  plugins: [
    react(),
    licenseAttribution(),
    dependencyNotices(),
    writeshapeBrand(),
    offlineShell(),
  ],
  worker: { format: "es", plugins: () => [licenseAttribution()] },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:5174" },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  build: { target: "es2022" },
});
