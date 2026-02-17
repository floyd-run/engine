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
      database: path.resolve(__dirname, "../../src/database"),
      infra: path.resolve(__dirname, "../../src/infra"),
      workers: path.resolve(__dirname, "../../src/workers"),
      lib: path.resolve(__dirname, "../../src/lib"),
      config: path.resolve(__dirname, "../../src/config"),
      operations: path.resolve(__dirname, "../../src/operations"),
      routes: path.resolve(__dirname, "../../src/routes"),
    },
  },
});
