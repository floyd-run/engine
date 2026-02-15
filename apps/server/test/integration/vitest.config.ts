import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "integration",
    include: ["**/*.{test,spec}.ts"],
    environment: "node",
    globals: true,
    globalSetup: ["./setup/global.ts"],
    setupFiles: ["./setup/client.ts"],
  },
  resolve: {
    alias: {
      config: path.resolve(__dirname, "../../src/config"),
      database: path.resolve(__dirname, "../../src/database"),
      domain: path.resolve(__dirname, "../../src/domain"),
      infra: path.resolve(__dirname, "../../src/infra"),
      lib: path.resolve(__dirname, "../../src/lib"),
      middleware: path.resolve(__dirname, "../../src/middleware"),
      migrations: path.resolve(__dirname, "../../src/migrations"),
      routes: path.resolve(__dirname, "../../src/routes"),
      operations: path.resolve(__dirname, "../../src/operations"),
    },
  },
});
