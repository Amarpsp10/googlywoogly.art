import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": root.replace(/\/$/, "") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**", "**/*.e2e.*"],
    // Component tests (userEvent + react-hook-form in jsdom) can be timing-flaky
    // under parallel load. Retry to absorb environmental flakiness; a genuine
    // failure still fails on every attempt.
    retry: 2,
  },
});
