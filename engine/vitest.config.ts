import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "forks",
  },
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src"),
      "@/": `${path.resolve(__dirname, "src")}/`,
      "@": path.resolve(__dirname, "src"),
    },
  },
});
