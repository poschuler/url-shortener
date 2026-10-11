import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

import type { PostgresConfig } from "#src/shared/postgres/create-pool.js";

declare module "vitest" {
  export interface ProvidedContext {
    postgres: PostgresConfig;
  }
}

// One container for the whole run: starting Postgres takes seconds, creating
// a database inside it (createTestDatabase) takes milliseconds.
export async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();

  project.provide("postgres", {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    dbName: container.getDatabase(),
  });

  return async () => {
    await container.stop();
  };
}
