import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
        },
      },
      {
        // Needs Docker: global-setup.ts starts a Postgres container.
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          globalSetup: ["test/integration/support/global-setup.ts"],
        },
      },
      {
        // Needs the compose stack running: docker compose up -d --build --wait
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.test.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: {
        "src/modules/*/domain/**": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
