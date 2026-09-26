import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": __dirname + "/src" },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "api/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
