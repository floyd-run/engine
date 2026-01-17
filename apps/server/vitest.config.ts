import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ["./test/setup/global.ts"],
    include: ["test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    environment: "node",
  },
  resolve: {
    alias: {
      config: path.resolve(__dirname, "./src/config"),
      database: path.resolve(__dirname, "./src/database"),
      lib: path.resolve(__dirname, "./src/lib"),
      middleware: path.resolve(__dirname, "./src/middleware"),
      migrations: path.resolve(__dirname, "./src/migrations"),
      routes: path.resolve(__dirname, "./src/routes"),
      services: path.resolve(__dirname, "./src/services"),
    },
  },
});
