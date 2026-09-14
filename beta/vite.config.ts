import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { offlineShell } from "./build-tools/offline";
export default defineConfig({
  plugins: [react(), offlineShell()],
  worker: { format: "es" },
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
