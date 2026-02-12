import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["test/unit/vitest.config.ts", "test/integration/vitest.config.ts"],
  },
});
