import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "unit",
    include: ["**/*.{test,spec}.ts"],
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      domain: path.resolve(__dirname, "../../src/domain"),
    },
  },
});
