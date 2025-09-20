import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/shared/presentation/__tests__/**/*.test.ts"],
    environment: "node",
    globals: true,
    pool: "forks",
  },
});
